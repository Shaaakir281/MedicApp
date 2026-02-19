from __future__ import annotations

import datetime as dt
import hashlib
import logging
import random
import unicodedata
from typing import List, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from core.config import get_settings
from dossier import schemas
from dossier.models import Child, Guardian, GuardianPhoneVerification, GuardianEmailVerification, GuardianRole, VerificationStatus
from services.event_tracker import get_event_tracker
from services import sms

try:
    import phonenumbers
    from phonenumbers.phonenumberutil import NumberParseException
except Exception:  # pragma: no cover - optional dependency
    phonenumbers = None
    NumberParseException = Exception

logger = logging.getLogger("uvicorn.error")
event_tracker = get_event_tracker()

CODE_LENGTH = 6  # Code à 6 chiffres (aligné avec ancien système)
TTL_SECONDS = 600  # 10 minutes (aligné avec ancien système, marge pour délai SMS)
COOLDOWN_SECONDS = 15  # 15 secondes (plus fluide, garde protection anti-spam)

PLACEHOLDER_NAMES = {
    "prenom",
    "nom",
    "parent",
    "parent 1",
    "parent 2",
    "parent1",
    "parent2",
    "pere",
    "mere",
}


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value)
    stripped = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return stripped.strip().lower()


def _is_placeholder(value: str | None) -> bool:
    normalized = _normalize_text(value)
    return normalized in PLACEHOLDER_NAMES


def _guardian_name_missing(guardian: Guardian | None) -> bool:
    if guardian is None:
        return True
    first = (guardian.first_name or "").strip()
    last = (guardian.last_name or "").strip()
    return not first or not last or _is_placeholder(first) or _is_placeholder(last)


def _guardian_by_role(guardians: List[Guardian], role: GuardianRole) -> Guardian | None:
    expected = role.value
    for guardian in guardians:
        if guardian.role == expected:
            return guardian
    return None


def _is_dossier_minimum_ready(child: Child, guardians: List[Guardian]) -> bool:
    if not (child.first_name or "").strip():
        return False
    if not (child.last_name or "").strip():
        return False
    if child.birth_date is None:
        return False

    parent1 = _guardian_by_role(guardians, GuardianRole.parent1)
    if _guardian_name_missing(parent1):
        return False
    return True


class InvalidPhoneNumber(ValueError):
    """Raised when phone cannot be normalized."""


def normalize_phone(phone: str, default_region: str = "FR") -> str:
    if not phonenumbers:
        raise InvalidPhoneNumber("Phone library missing")
    try:
        parsed = phonenumbers.parse(phone, default_region)
    except NumberParseException as exc:  # pragma: no cover - defensive
        raise InvalidPhoneNumber("Numero de telephone invalide") from exc
    if not (phonenumbers.is_possible_number(parsed) and phonenumbers.is_valid_number(parsed)):
        raise InvalidPhoneNumber("Numero de telephone invalide")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _random_code(length: int = CODE_LENGTH) -> str:
    upper = 10**length - 1
    return f"{random.randint(0, upper):0{length}d}"


def _latest_verification(db: Session, guardian_id: str) -> GuardianPhoneVerification | None:
    stmt = (
        select(GuardianPhoneVerification)
        .where(GuardianPhoneVerification.guardian_id == guardian_id)
        .order_by(GuardianPhoneVerification.sent_at.desc())
    )
    return db.scalars(stmt).first()


def _split_name(full_name: str) -> tuple[str, str]:
    cleaned = (full_name or "").strip()
    if not cleaned:
        return "", ""
    parts = cleaned.split()
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


def _prefill_from_procedure_case(db: Session, patient_id: int) -> tuple[dict, List[dict]]:
    case = (
        db.query(models.ProcedureCase)
        .filter(models.ProcedureCase.patient_id == patient_id)
        .order_by(models.ProcedureCase.created_at.desc())
        .first()
    )
    if not case:
        return {}, []

    first_name, last_name = _split_name(case.child_full_name or "")
    child_data = {
        "first_name": first_name,
        "last_name": last_name,
        "birth_date": case.child_birthdate,
        "weight_kg": case.child_weight_kg,
        "medical_notes": case.notes,
    }

    guardians: List[dict] = []
    for role, name, email, phone, verified_at in [
        (GuardianRole.parent1, case.parent1_name, case.parent1_email, case.parent1_phone, case.parent1_phone_verified_at),
        (GuardianRole.parent2, case.parent2_name, case.parent2_email, case.parent2_phone, case.parent2_phone_verified_at),
    ]:
        if not (name or email or phone):
            continue
        first, last = _split_name(name or "")
        try:
            phone_e164 = normalize_phone(phone) if phone else None
        except InvalidPhoneNumber:
            phone_e164 = None
        guardians.append(
            {
                "role": role.value,
                "first_name": first or name or "Parent",
                "last_name": last or "",
                "email": email,
                "phone_e164": phone_e164,
                "phone_verified_at": verified_at,
            }
        )

    return child_data, guardians


def _guard_patient_access(child: Child | None, current_user) -> None:
    if not child or current_user.role != models.UserRole.patient:
        return
    if child.patient_id and child.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse.")


def _sync_to_procedure_case(db: Session, patient_id: int, guardians: List[Guardian]) -> None:
    """Propagate guardians data to the legacy procedure_case for compatibility.

    Creates ProcedureCase automatically if it doesn't exist.
    """
    import crud

    case = (
        db.query(models.ProcedureCase)
        .filter(models.ProcedureCase.patient_id == patient_id)
        .order_by(models.ProcedureCase.created_at.desc())
        .first()
    )

    # Auto-create ProcedureCase if it doesn't exist
    if not case:
        child = (
            db.query(Child)
            .filter(Child.patient_id == patient_id)
            .order_by(Child.created_at.desc())
            .first()
        )
        if not child:
            return  # No child data, cannot create case

        # Build parent names from guardians
        parent1_name = ""
        parent1_email = None
        parent1_phone = None
        parent2_name = ""
        parent2_email = None
        parent2_phone = None

        for guardian in guardians:
            role = GuardianRole(guardian.role)
            full_name = f"{guardian.first_name} {guardian.last_name}".strip()
            if role == GuardianRole.parent1:
                parent1_name = full_name
                parent1_email = guardian.email
                parent1_phone = guardian.phone_e164
            elif role == GuardianRole.parent2:
                parent2_name = full_name
                parent2_email = guardian.email
                parent2_phone = guardian.phone_e164

        # Create minimal case data
        case_data = type(
            "CaseData",
            (object,),
            {
                "procedure_type": "circumcision",
                "child_full_name": f"{child.first_name} {child.last_name}".strip(),
                "child_birthdate": child.birth_date,
                "child_weight_kg": child.weight_kg,
                "parent1_name": parent1_name or "Parent 1",
                "parent1_email": parent1_email,
                "parent2_name": parent2_name,
                "parent2_email": parent2_email,
                "parent1_phone": parent1_phone,
                "parent2_phone": parent2_phone,
                "parent1_sms_optin": False,
                "parent2_sms_optin": False,
                "parental_authority_ack": True,  # Auto-accepted when Dossier is saved
                "notes": "[Auto-créé depuis Dossier]",
                "preconsultation_date": None,
            },
        )()

        case = crud.create_procedure_case(db, patient_id, case_data)
        return  # Already committed in create_procedure_case

    # Update existing case
    for guardian in guardians:
        role = GuardianRole(guardian.role)
        if role == GuardianRole.parent1:
            case.parent1_name = f"{guardian.first_name} {guardian.last_name}".strip()
            case.parent1_email = guardian.email
            case.parent1_phone = guardian.phone_e164
            case.parent1_phone_verified_at = guardian.phone_verified_at
        elif role == GuardianRole.parent2:
            case.parent2_name = f"{guardian.first_name} {guardian.last_name}".strip()
            case.parent2_email = guardian.email
            case.parent2_phone = guardian.phone_e164
            case.parent2_phone_verified_at = guardian.phone_verified_at

    db.add(case)
    db.commit()


def get_dossier(db: Session, child_id: str, current_user) -> schemas.DossierResponse:
    child = db.get(Child, child_id)
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable.")
    _guard_patient_access(child, current_user)
    guardians = list(db.scalars(select(Guardian).where(Guardian.child_id == child.id)))

    # Populate email_sent_at from latest email verification
    for guardian in guardians:
        latest_verification = db.scalars(
            select(GuardianEmailVerification)
            .where(GuardianEmailVerification.guardian_id == guardian.id)
            .order_by(GuardianEmailVerification.sent_at.desc())
            .limit(1)
        ).first()
        guardian.email_sent_at = latest_verification.sent_at if latest_verification else None

    warnings: List[str] = []
    parent2 = next((g for g in guardians if g.role == GuardianRole.parent2.value), None)
    if parent2:
        has_real_name = not _is_placeholder(parent2.first_name) or not _is_placeholder(parent2.last_name)
        parent2_started = any(
            [
                (parent2.first_name or "").strip() and has_real_name,
                (parent2.last_name or "").strip() and has_real_name,
                (parent2.email or "").strip(),
                (parent2.phone_e164 or "").strip(),
            ]
        )
        missing_fields = []
        if _guardian_name_missing(parent2):
            missing_fields.append("nom/prénom")
        if not parent2.email:
            missing_fields.append("email")
        if not parent2.phone_e164:
            missing_fields.append("téléphone")
        if parent2_started and missing_fields:
            warnings.append("Parent 2 incomplet")
    elif get_settings().require_guardian_2:
        warnings.append("Parent 2 requis : merci de le renseigner.")
    return schemas.DossierResponse(child=child, guardians=guardians, warnings=warnings)


def get_or_create_child_for_patient(db: Session, patient_id: int) -> Child:
    existing = (
        db.query(Child)
        .filter(Child.patient_id == patient_id)
        .order_by(Child.created_at.desc())
        .first()
    )
    if existing:
        return existing

    child_data, guardians_data = _prefill_from_procedure_case(db, patient_id)
    child = Child(
        patient_id=patient_id,
        first_name=child_data.get("first_name") or "Prénom",
        last_name=child_data.get("last_name") or "Nom",
        birth_date=child_data.get("birth_date") or dt.date.today(),
        weight_kg=child_data.get("weight_kg"),
        medical_notes=child_data.get("medical_notes"),
    )
    db.add(child)
    db.flush()

    for g in guardians_data:
        guardian = Guardian(
            child_id=child.id,
            role=g["role"],
            first_name=g["first_name"],
            last_name=g["last_name"],
            email=g.get("email"),
            phone_e164=g.get("phone_e164"),
            phone_verified_at=g.get("phone_verified_at"),
        )
        db.add(guardian)

    db.commit()
    db.refresh(child)
    return child


def get_dossier_current(db: Session, current_user) -> schemas.DossierResponse:
    if current_user.role != models.UserRole.patient:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Reserve aux patients.")
    child = get_or_create_child_for_patient(db, current_user.id)
    return get_dossier(db, child.id, current_user)


def save_dossier(db: Session, child_id: str, payload: schemas.DossierPayload, current_user) -> schemas.DossierResponse:
    roles = [GuardianRole(g.role) for g in payload.guardians]
    if GuardianRole.parent1 not in roles:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Parent/Tuteur 1 est requis.")
    if len(set(roles)) != len(roles):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Chaque parent ne peut être renseigné qu'une seule fois.",
        )

    if not payload.child.first_name.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Prénom de l'enfant requis.")
    if not payload.child.last_name.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nom de l'enfant requis.")
    if not payload.child.birth_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Date de naissance de l'enfant requise.",
        )

    child = db.get(Child, child_id)
    if child:
        _guard_patient_access(child, current_user)
    else:
        child = Child(id=child_id, patient_id=current_user.id if current_user.role == models.UserRole.patient else None)
        db.add(child)

    existing_guardians = {g.role: g for g in db.scalars(select(Guardian).where(Guardian.child_id == child.id))}
    was_ready = _is_dossier_minimum_ready(child, list(existing_guardians.values()))

    child.first_name = payload.child.first_name.strip()
    child.last_name = payload.child.last_name.strip()
    child.birth_date = payload.child.birth_date
    child.weight_kg = payload.child.weight_kg
    child.medical_notes = payload.child.medical_notes
    child.updated_at = dt.datetime.now(tz=dt.timezone.utc)
    updated: List[Guardian] = []
    for g in payload.guardians:
        role = GuardianRole(g.role).value
        phone = normalize_phone(g.phone_e164) if g.phone_e164 else None
        current = existing_guardians.get(role)
        if current is None:
            current = Guardian(child_id=child.id, role=role)
            db.add(current)
        current.first_name = g.first_name.strip()
        current.last_name = g.last_name.strip()
        current.email = g.email
        current.phone_e164 = phone
        current.updated_at = dt.datetime.now(tz=dt.timezone.utc)
        updated.append(current)

    db.commit()
    for obj in [child, *updated]:
        db.refresh(obj)

    # Compatibilité : synchroniser vers procedure_cases pour que les autres onglets voient les données
    if current_user.role == models.UserRole.patient:
        all_guardians = list(db.scalars(select(Guardian).where(Guardian.child_id == child.id)))
        _sync_to_procedure_case(db, current_user.id, all_guardians)
        now_ready = _is_dossier_minimum_ready(child, all_guardians)
        if not was_ready and now_ready:
            parent2 = _guardian_by_role(all_guardians, GuardianRole.parent2)
            has_parent2 = parent2 is not None and not _guardian_name_missing(parent2)
            phone_verified = any(guardian.phone_verified_at is not None for guardian in all_guardians)
            latest_case = (
                db.query(models.ProcedureCase)
                .filter(models.ProcedureCase.patient_id == current_user.id)
                .order_by(models.ProcedureCase.created_at.desc())
                .first()
            )
            time_in_previous_step_hours = None
            if latest_case and latest_case.created_at:
                time_in_previous_step_hours = max(
                    0.0,
                    (dt.datetime.utcnow() - latest_case.created_at).total_seconds() / 3600,
                )
            event_tracker.track_patient_event(
                "patient_dossier_completed",
                current_user.id,
                has_parent2=has_parent2,
                phone_verified=phone_verified,
            )
            event_tracker.track_patient_event(
                "patient_journey_transition",
                current_user.id,
                procedure_id=latest_case.id if latest_case else None,
                from_step="created",
                to_step="dossier_completed",
                time_in_previous_step_hours=time_in_previous_step_hours,
            )

    return get_dossier(db, child_id, current_user)


def save_dossier_current(db: Session, payload: schemas.DossierPayload, current_user) -> schemas.DossierResponse:
    if current_user.role != models.UserRole.patient:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Reserve aux patients.")
    child = get_or_create_child_for_patient(db, current_user.id)
    return save_dossier(db, child.id, payload, current_user)


def send_verification_code(
    db: Session,
    guardian_id: str,
    current_user,
    *,
    phone_override: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> Tuple[GuardianPhoneVerification, int, int]:
    guardian = db.get(Guardian, guardian_id)
    if guardian is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent introuvable.")
    child = db.get(Child, guardian.child_id)
    _guard_patient_access(child, current_user)

    phone = phone_override or guardian.phone_e164
    if not phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Numero de telephone manquant.")
    phone_e164 = normalize_phone(phone)

    now = dt.datetime.now(tz=dt.timezone.utc)
    latest = _latest_verification(db, guardian.id)
    if latest and latest.cooldown_until and latest.cooldown_until > now:
        remaining = int((latest.cooldown_until - now).total_seconds())
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"Attendez {remaining} secondes.")
    if latest and latest.status == VerificationStatus.sent.value and latest.expires_at > now:
        latest.status = VerificationStatus.expired.value
        db.add(latest)

    code = _random_code()
    verification = GuardianPhoneVerification(
        guardian_id=guardian.id,
        phone_e164=phone_e164,
        code_hash=_hash_code(code),
        expires_at=now + dt.timedelta(seconds=TTL_SECONDS),
        cooldown_until=now + dt.timedelta(seconds=COOLDOWN_SECONDS),
        attempt_count=0,
        max_attempts=10,  # 10 tentatives (moins restrictif, erreurs de frappe possibles)
        status=VerificationStatus.sent.value,
        sent_at=now,
        verified_at=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)

    try:
        sms.send_sms(phone_e164, f"Code de verification MedScript : {code}")
    except Exception as exc:  # pragma: no cover - external
        logger.warning("SMS non envoye (guardian=%s): %s", guardian.id, exc)

    return verification, TTL_SECONDS, COOLDOWN_SECONDS


def verify_code(db: Session, guardian_id: str, current_user, code: str) -> GuardianPhoneVerification:
    guardian = db.get(Guardian, guardian_id)
    if guardian is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent introuvable.")
    child = db.get(Child, guardian.child_id)
    _guard_patient_access(child, current_user)

    latest = _latest_verification(db, guardian.id)
    now = dt.datetime.now(tz=dt.timezone.utc)
    if latest is None or latest.status not in {VerificationStatus.sent.value, VerificationStatus.locked.value}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucun code actif.")
    if latest.status == VerificationStatus.locked.value:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Trop de tentatives.")
    if latest.expires_at < now:
        latest.status = VerificationStatus.expired.value
        db.add(latest)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code expire, renvoyez un code.")

    latest.attempt_count += 1
    if _hash_code(code.strip()) != latest.code_hash:
        if latest.attempt_count >= latest.max_attempts:
            latest.status = VerificationStatus.locked.value
            db.add(latest)
            db.commit()
            raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Trop de tentatives.")
        db.add(latest)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code invalide.")

    latest.status = VerificationStatus.verified.value
    latest.verified_at = now
    guardian.phone_e164 = latest.phone_e164
    guardian.phone_verified_at = now

    db.add_all([latest, guardian])
    db.commit()
    db.refresh(latest)

    # Propagate verified phone to legacy procedure_case for compatibility
    if current_user.role == models.UserRole.patient:
        _sync_to_procedure_case(db, current_user.id, [guardian])
        event_tracker.track_patient_event(
            "patient_phone_verified",
            current_user.id,
            attempts_count=latest.attempt_count,
            guardian_role=guardian.role,
        )

    return latest
