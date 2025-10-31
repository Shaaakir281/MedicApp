"""CRUD utility functions.

This module groups common database operations used by the API routes. It
handles user creation and authentication, token generation, appointment
booking and questionnaire persistence. In a real application you might
separate responsibilities into dedicated modules or classes; for this
exercise they are collected here for simplicity.
"""

from __future__ import annotations

import os
import datetime
import secrets
from typing import Optional, Dict, Any

from jose import jwt
from jose.exceptions import JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session, joinedload

import models
from services.pdf import (
    generate_checklist_pdf,
    generate_consent_pdf,
    generate_ordonnance_pdf,
)


def _normalize_procedure_type(
    value: str | models.ProcedureType,
) -> models.ProcedureType:
    if isinstance(value, models.ProcedureType):
        return value

    normalized = value
    if value in {"circumcision", "circoncision"}:
        normalized = "circumcision"

    return models.ProcedureType(normalized)


# Password hashing context (bcrypt + sha256 prehash to avoid 72-byte limit)
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")

# JWT configuration from environment
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "changeme")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 15))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its hashed version."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Generate a signed access token.

    The token's payload must include a ``sub`` claim identifying the user.
    """
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + (
        expires_delta
        or datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")


def create_refresh_token(data: dict) -> str:
    """Generate a signed refresh token."""
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode a JWT token and return its claims. Raises on invalid tokens."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError as exc:
        raise ValueError("Invalid token") from exc


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def create_user(db: Session, email: str, password: str, role: str) -> models.User:
    hashed_password = get_password_hash(password)
    role_enum = role if isinstance(role, models.UserRole) else models.UserRole(role)
    user = models.User(
        email=email,
        hashed_password=hashed_password,
        role=role_enum,
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def get_available_slots(db: Session, date: datetime.date) -> list[str]:
    """Return a list of ISO-time strings representing available slots on a given day.

    For demonstration purposes, this returns every hour from 08:00 to 17:00 except
    those already booked in the appointments table.
    """
    today = datetime.date.today()
    if date < today:
        return []

    all_slots = [f"{hour:02d}:00" for hour in range(8, 18)]
    booked_times = (
        db.query(models.Appointment.time)
        .filter(models.Appointment.date == date)
        .all()
    )
    booked_set = {t[0].strftime("%H:%M") for t in booked_times}
    available = [slot for slot in all_slots if slot not in booked_set]

    if date == today:
        now_time = datetime.datetime.now().time().replace(second=0, microsecond=0)
        available = [
            slot for slot in available
            if datetime.datetime.strptime(slot, "%H:%M").time() >= now_time
        ]

    return available




def create_appointment(
    db: Session,
    user_id: int,
    date: datetime.date,
    time: datetime.time,
    appointment_type: str | models.AppointmentType = models.AppointmentType.general,
    procedure_id: int | None = None,
    mode: str | models.AppointmentMode | None = None,
) -> models.Appointment:
    """Create a new appointment if the slot is free. Raises ValueError if invalid."""
    appointment_dt = datetime.datetime.combine(date, time)
    if appointment_dt < datetime.datetime.now():
        raise ValueError("Impossible de planifier un rendez-vous dans le passe")

    if isinstance(appointment_type, str):
        appointment_type = models.AppointmentType(appointment_type)

    mode_enum = None
    if mode is not None:
        if isinstance(mode, str):
            try:
                mode_enum = models.AppointmentMode(mode)
            except ValueError as exc:
                raise ValueError("Mode de rendez-vous invalide") from exc
        else:
            mode_enum = mode

    conflict = (
        db.query(models.Appointment)
        .filter(models.Appointment.date == date, models.Appointment.time == time)
        .first()
    )
    if conflict:
        raise ValueError("Le creneau selectionne est deja reserve")

    procedure_case: models.ProcedureCase | None = None
    if appointment_type in {
        models.AppointmentType.preconsultation,
        models.AppointmentType.act,
    }:
        if procedure_id is None:
            procedure_case = get_active_procedure_case(db, user_id)
            if procedure_case is None:
                raise ValueError("Aucune procedure en cours pour ce patient")
        else:
            procedure_case = get_procedure_case_by_id(db, procedure_id, user_id=user_id)
            if procedure_case is None:
                raise ValueError("Procedure introuvable pour ce patient")

        if not procedure_case.parental_authority_ack:
            raise ValueError("Veuillez confirmer l'autorite parentale avant de reserver")

        existing_types = {
            appt.appointment_type for appt in procedure_case.appointments
        }
        if appointment_type in existing_types:
            raise ValueError("Un rendez-vous de ce type est deja planifie")

        if appointment_type == models.AppointmentType.act:
            if models.AppointmentType.preconsultation not in existing_types:
                raise ValueError("Planifiez d'abord la consultation pre-operatoire")

    appointment = models.Appointment(
        user_id=user_id,
        date=date,
        time=time,
        appointment_type=appointment_type,
        procedure_id=procedure_case.id if procedure_case else None,
        mode=mode_enum,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    if procedure_case and appointment_type == models.AppointmentType.act:
        refreshed_case = get_procedure_case_by_id(db, procedure_case.id)
        if refreshed_case is not None:
            _ensure_consent_pdf(refreshed_case)
            db.add(refreshed_case)
            db.commit()
            db.refresh(refreshed_case)

    return appointment


def create_questionnaire(db: Session, appointment_id: int, data: dict) -> models.Questionnaire:
    """Persist questionnaire answers associated with an appointment."""
    questionnaire = models.Questionnaire(appointment_id=appointment_id, data=data)
    db.add(questionnaire)
    db.commit()
    db.refresh(questionnaire)
    return questionnaire




def get_procedure_case_by_id(
    db: Session,
    procedure_id: int,
    user_id: int | None = None,
) -> Optional[models.ProcedureCase]:
    query = (
        db.query(models.ProcedureCase)
        .options(joinedload(models.ProcedureCase.appointments))
        .filter(models.ProcedureCase.id == procedure_id)
    )
    if user_id is not None:
        query = query.filter(models.ProcedureCase.patient_id == user_id)
    return query.first()


def get_procedure_case_by_token(
    db: Session,
    token: str,
) -> Optional[models.ProcedureCase]:
    return (
        db.query(models.ProcedureCase)
        .filter(models.ProcedureCase.consent_download_token == token)
        .first()
    )


def get_active_procedure_case(db: Session, patient_id: int) -> Optional[models.ProcedureCase]:
    return (
        db.query(models.ProcedureCase)
        .options(joinedload(models.ProcedureCase.appointments))
        .filter(models.ProcedureCase.patient_id == patient_id)
        .order_by(models.ProcedureCase.created_at.desc())
        .first()
    )


def _build_checklist_context(case: models.ProcedureCase) -> Dict[str, Any]:
    checklist_items = [
        {
            "label": (
                "Je comprends que la circoncision rituelle n'est pas "
                "motivee par une pathologie."
            ),
            "checked": case.parental_authority_ack,
        },
        {
            "label": (
                "Je suis titulaire de l'autorite parentale ou dispose de "
                "l'accord ecrit du second parent."
            ),
            "checked": case.parental_authority_ack,
        },
        {
            "label": (
                "J'ai fourni les informations medicales de l'enfant "
                "(age, poids, allergies, traitements)."
            ),
            "checked": bool(case.child_weight_kg is not None),
        },
        {
            "label": (
                "Je suis informe(e) des risques "
                "(saignement, infection, douleur, cicatrisation)."
            ),
            "checked": case.parental_authority_ack,
        },
    ]
    return {
        "checklist_items": checklist_items,
        "parent1_name": case.parent1_name,
        "parent2_name": case.parent2_name,
        "child_full_name": case.child_full_name,
        "child_birthdate": case.child_birthdate.strftime('%d/%m/%Y'),
        "child_weight": case.child_weight_kg or '',
    }


def _build_consent_context(case: models.ProcedureCase) -> Dict[str, Any]:
    return {
        "parent1_name": case.parent1_name,
        "parent1_email": case.parent1_email,
        "parent2_name": case.parent2_name,
        "parent2_email": case.parent2_email,
        "child_full_name": case.child_full_name,
        "child_birthdate": case.child_birthdate.strftime('%d/%m/%Y'),
        "child_weight": case.child_weight_kg or '',
        "checklist_notes": case.notes or '',
        "parent1_signed_at": None,
        "parent2_signed_at": None,
    }


def _build_ordonnance_context(case: models.ProcedureCase) -> Dict[str, Any]:
    act_appointment = next(
        (
            appt
            for appt in case.appointments
            if appt.appointment_type == models.AppointmentType.act
        ),
        None,
    )

    prescriptions = [
        "Antiseptique chirurgical (flacon)",
        "Pansements steriles adaptes - quantite a definir",
        "Compresses steriles - quantite a definir",
        "Gants steriles usage unique - 1 boite",
        "Creme cicatrisante (tube 30 g)",
        "Antalgique pediatrique (paracetamol suspension) - dosage selon poids",
        "Serum physiologique 0.9 pourcent - flacon",
        "Autres consommables (vaseline, coton, etc.)",
    ]

    return {
        "praticien_nom": "",
        "date_ordonnance": datetime.date.today().strftime("%d/%m/%Y"),
        "enfant_nom": case.child_full_name,
        "enfant_ddn": case.child_birthdate.strftime("%d/%m/%Y"),
        "enfant_poids": case.child_weight_kg or "",
        "date_intervention": act_appointment.date.strftime("%d/%m/%Y") if act_appointment else "",
        "prescriptions": prescriptions,
    }


def _ensure_consent_pdf(case: models.ProcedureCase) -> None:
    try:
        case.checklist_pdf_path = generate_checklist_pdf(
            _build_checklist_context(case)
        )
        case.consent_pdf_path = generate_consent_pdf(_build_consent_context(case))
        case.ordonnance_pdf_path = generate_ordonnance_pdf(
            _build_ordonnance_context(case)
        )
        if not case.consent_download_token:
            case.consent_download_token = secrets.token_urlsafe(24)
    except Exception:
        pass


def create_procedure_case(
    db: Session,
    patient_id: int,
    case_data,
) -> models.ProcedureCase:
    procedure_type = _normalize_procedure_type(case_data.procedure_type)
    procedure = models.ProcedureCase(
        patient_id=patient_id,
        procedure_type=procedure_type,
        child_full_name=case_data.child_full_name,
        child_birthdate=case_data.child_birthdate,
        child_weight_kg=case_data.child_weight_kg,
        parent1_name=case_data.parent1_name,
        parent1_email=case_data.parent1_email,
        parent2_name=case_data.parent2_name,
        parent2_email=case_data.parent2_email,
        parental_authority_ack=case_data.parental_authority_ack,
        notes=case_data.notes,
        consent_download_token=secrets.token_urlsafe(24),
    )
    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    _ensure_consent_pdf(procedure)
    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    return procedure


def update_procedure_case(
    db: Session,
    procedure: models.ProcedureCase,
    case_data,
) -> models.ProcedureCase:
    procedure.procedure_type = _normalize_procedure_type(case_data.procedure_type)
    procedure.child_full_name = case_data.child_full_name
    procedure.child_birthdate = case_data.child_birthdate
    procedure.child_weight_kg = case_data.child_weight_kg
    procedure.parent1_name = case_data.parent1_name
    procedure.parent1_email = case_data.parent1_email
    procedure.parent2_name = case_data.parent2_name
    procedure.parent2_email = case_data.parent2_email
    procedure.parental_authority_ack = case_data.parental_authority_ack
    procedure.notes = case_data.notes
    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    _ensure_consent_pdf(procedure)
    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    return procedure

def create_email_verification_token(
    db: Session,
    user: models.User,
    expires_in_hours: int = 24,
) -> models.EmailVerificationToken:
    """Create and persist a new verification token for ``user``."""
    # Invalidate previous pending tokens
    db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.user_id == user.id,
        models.EmailVerificationToken.consumed_at.is_(None),
    ).update(
        {
            models.EmailVerificationToken.consumed_at: datetime.datetime.utcnow(),
        },
        synchronize_session=False,
    )

    expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=expires_in_hours)

    token_value = secrets.token_urlsafe(32)
    token = models.EmailVerificationToken(
        user_id=user.id,
        token=token_value,
        expires_at=expiry,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def verify_email_token(db: Session, token_value: str) -> models.User:
    """Validate a verification token and mark the user as verified."""
    token = (
        db.query(models.EmailVerificationToken)
        .filter(models.EmailVerificationToken.token == token_value)
        .first()
    )
    if token is None:
        raise ValueError("Invalid verification token")

    if token.consumed_at is not None:
        raise ValueError("Verification token already used")

    if token.expires_at < datetime.datetime.utcnow():
        raise ValueError("Verification token has expired")

    user = token.user
    token.consumed_at = datetime.datetime.utcnow()
    user.email_verified = True

    db.commit()
    db.refresh(user)
    return user
