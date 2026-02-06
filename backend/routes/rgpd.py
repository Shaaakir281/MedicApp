"""RGPD endpoints for patient data export."""

from __future__ import annotations

import datetime as dt
import secrets
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

import models
from database import get_db
from dependencies.auth import get_current_user
from dossier import models as dossier_models
from dossier import service as dossier_service
from core import security
from repositories import user_repository

router = APIRouter(prefix="/patient/me", tags=["rgpd"])


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


def _iso(value):
    if value is None:
        return None
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    return value


def _serialize_user(user: models.User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "email_verified": user.email_verified,
        "created_at": _iso(user.created_at),
    }


def _serialize_case(case: models.ProcedureCase) -> dict:
    return {
        "id": case.id,
        "procedure_type": case.procedure_type.value if hasattr(case.procedure_type, "value") else case.procedure_type,
        "child_full_name": case.child_full_name,
        "child_birthdate": _iso(case.child_birthdate),
        "child_weight_kg": float(case.child_weight_kg) if case.child_weight_kg is not None else None,
        "parent1_name": case.parent1_name,
        "parent1_first_name": case.parent1_first_name,
        "parent1_last_name": case.parent1_last_name,
        "parent1_email": case.parent1_email,
        "parent2_name": case.parent2_name,
        "parent2_first_name": case.parent2_first_name,
        "parent2_last_name": case.parent2_last_name,
        "parent2_email": case.parent2_email,
        "parent1_phone": case.parent1_phone,
        "parent2_phone": case.parent2_phone,
        "parent1_sms_optin": case.parent1_sms_optin,
        "parent2_sms_optin": case.parent2_sms_optin,
        "parent1_phone_verified_at": _iso(case.parent1_phone_verified_at),
        "parent2_phone_verified_at": _iso(case.parent2_phone_verified_at),
        "parental_authority_ack": case.parental_authority_ack,
        "notes": case.notes,
        "document_download_token": case.document_download_token,
        "preconsultation_date": _iso(case.preconsultation_date),
        "ordonnance_pdf_path": case.ordonnance_pdf_path,
        "dossier_completed": case.dossier_completed,
        "missing_fields": case.missing_fields,
        "created_at": _iso(case.created_at),
        "updated_at": _iso(case.updated_at),
    }


def _serialize_appointment(appointment: models.Appointment) -> dict:
    return {
        "id": appointment.id,
        "date": _iso(appointment.date),
        "time": _iso(appointment.time),
        "status": appointment.status.value if hasattr(appointment.status, "value") else appointment.status,
        "appointment_type": appointment.appointment_type.value if hasattr(appointment.appointment_type, "value") else appointment.appointment_type,
        "mode": appointment.mode.value if hasattr(appointment.mode, "value") else appointment.mode,
        "procedure_case_id": appointment.procedure_id,
        "created_at": _iso(appointment.created_at),
        "reminder_sent_at": _iso(appointment.reminder_sent_at),
        "reminder_opened_at": _iso(appointment.reminder_opened_at),
        "reminder_token": appointment.reminder_token,
    }


def _serialize_prescription(prescription: models.Prescription) -> dict:
    return {
        "id": prescription.id,
        "appointment_id": prescription.appointment_id,
        "reference": prescription.reference,
        "pdf_path": prescription.pdf_path,
        "items": prescription.items,
        "instructions": prescription.instructions,
        "sent_at": _iso(prescription.sent_at),
        "sent_via": prescription.sent_via,
        "download_count": prescription.download_count,
        "last_download_at": _iso(prescription.last_download_at),
        "signed_at": _iso(prescription.signed_at),
        "signed_by_id": prescription.signed_by_id,
        "created_at": _iso(prescription.created_at),
    }


def _serialize_prescription_version(version: models.PrescriptionVersion) -> dict:
    return {
        "id": version.id,
        "prescription_id": version.prescription_id,
        "appointment_id": version.appointment_id,
        "reference": version.reference,
        "appointment_type": version.appointment_type,
        "pdf_path": version.pdf_path,
        "items": version.items,
        "instructions": version.instructions,
        "created_at": _iso(version.created_at),
    }


def _serialize_document_signature(signature: models.DocumentSignature) -> dict:
    return {
        "id": signature.id,
        "procedure_case_id": signature.procedure_case_id,
        "document_type": signature.document_type,
        "document_version": signature.document_version,
        "yousign_procedure_id": signature.yousign_procedure_id,
        "parent1_status": signature.parent1_status,
        "parent1_sent_at": _iso(signature.parent1_sent_at),
        "parent1_signed_at": _iso(signature.parent1_signed_at),
        "parent1_method": signature.parent1_method,
        "parent2_status": signature.parent2_status,
        "parent2_sent_at": _iso(signature.parent2_sent_at),
        "parent2_signed_at": _iso(signature.parent2_signed_at),
        "parent2_method": signature.parent2_method,
        "overall_status": signature.overall_status.value if hasattr(signature.overall_status, "value") else signature.overall_status,
        "signed_pdf_identifier": signature.signed_pdf_identifier,
        "evidence_pdf_identifier": signature.evidence_pdf_identifier,
        "final_pdf_identifier": signature.final_pdf_identifier,
        "completed_at": _iso(signature.completed_at),
        "yousign_purged_at": _iso(signature.yousign_purged_at),
        "created_at": _iso(signature.created_at),
        "updated_at": _iso(signature.updated_at),
    }


def _serialize_acknowledgement(entry: models.LegalAcknowledgement) -> dict:
    return {
        "id": entry.id,
        "appointment_id": entry.appointment_id,
        "document_type": entry.document_type.value if hasattr(entry.document_type, "value") else entry.document_type,
        "signer_role": entry.signer_role.value if hasattr(entry.signer_role, "value") else entry.signer_role,
        "case_key": entry.case_key,
        "case_text": entry.case_text,
        "catalog_version": entry.catalog_version,
        "acknowledged_at": _iso(entry.acknowledged_at),
        "ip": entry.ip,
        "user_agent": entry.user_agent,
        "source": entry.source,
    }


def _serialize_child(child: dossier_models.Child) -> dict:
    return {
        "id": child.id,
        "patient_id": child.patient_id,
        "procedure_case_id": child.procedure_case_id,
        "first_name": child.first_name,
        "last_name": child.last_name,
        "birth_date": _iso(child.birth_date),
        "weight_kg": float(child.weight_kg) if child.weight_kg is not None else None,
        "medical_notes": child.medical_notes,
        "created_at": _iso(child.created_at),
        "updated_at": _iso(child.updated_at),
    }


def _serialize_guardian(guardian: dossier_models.Guardian) -> dict:
    return {
        "id": guardian.id,
        "child_id": guardian.child_id,
        "role": guardian.role,
        "first_name": guardian.first_name,
        "last_name": guardian.last_name,
        "email": guardian.email,
        "phone_e164": guardian.phone_e164,
        "phone_verified_at": _iso(guardian.phone_verified_at),
        "email_verified_at": _iso(guardian.email_verified_at),
        "created_at": _iso(guardian.created_at),
        "updated_at": _iso(guardian.updated_at),
    }


def _serialize_phone_verification(entry: dossier_models.GuardianPhoneVerification) -> dict:
    return {
        "id": entry.id,
        "guardian_id": entry.guardian_id,
        "phone_e164": entry.phone_e164,
        "expires_at": _iso(entry.expires_at),
        "cooldown_until": _iso(entry.cooldown_until),
        "attempt_count": entry.attempt_count,
        "max_attempts": entry.max_attempts,
        "status": entry.status,
        "sent_at": _iso(entry.sent_at),
        "verified_at": _iso(entry.verified_at),
        "ip_address": entry.ip_address,
        "user_agent": entry.user_agent,
    }


def _serialize_email_verification(entry: dossier_models.GuardianEmailVerification) -> dict:
    return {
        "id": entry.id,
        "guardian_id": entry.guardian_id,
        "email": entry.email,
        "expires_at": _iso(entry.expires_at),
        "status": entry.status,
        "sent_at": _iso(entry.sent_at),
        "consumed_at": _iso(entry.consumed_at),
        "ip_address": entry.ip_address,
        "user_agent": entry.user_agent,
    }


def _appointment_datetime(appointment: models.Appointment | None) -> dt.datetime | None:
    if appointment is None or appointment.date is None:
        return None
    time_value = appointment.time or dt.time.min
    return dt.datetime.combine(appointment.date, time_value)


class JourneyDossierStatus(BaseModel):
    created: bool = False
    complete: bool = False
    missing_fields: list[str] = Field(default_factory=list)


class JourneyAppointmentStatus(BaseModel):
    booked: bool = False
    date: dt.datetime | None = None


class JourneyReflectionDelay(BaseModel):
    can_sign: bool = False
    days_left: int | None = None
    available_date: dt.date | None = None


class JourneySignaturesStatus(BaseModel):
    complete: bool = False
    parent1_signed: bool = False
    parent2_signed: bool = False
    reflection_delay: JourneyReflectionDelay = Field(default_factory=JourneyReflectionDelay)


class PatientJourneyStatus(BaseModel):
    dossier: JourneyDossierStatus
    pre_consultation: JourneyAppointmentStatus
    rdv_acte: JourneyAppointmentStatus
    signatures: JourneySignaturesStatus


class PatientJourneyResponse(BaseModel):
    journey_status: PatientJourneyStatus


def _resolve_guardian(guardians: list[dossier_models.Guardian], role: str) -> dossier_models.Guardian | None:
    return next((guardian for guardian in guardians if guardian.role == role), None)


def _guardian_name_missing(guardian: dossier_models.Guardian | None) -> bool:
    if guardian is None:
        return True
    if _is_placeholder(guardian.first_name) or _is_placeholder(guardian.last_name):
        return True
    return not guardian.first_name.strip() or not guardian.last_name.strip()


def _build_dossier_status(dossier: dossier_models.Child, guardians: list[dossier_models.Guardian]) -> JourneyDossierStatus:
    missing: list[str] = []

    if not dossier.first_name or _is_placeholder(dossier.first_name):
        missing.append("child_first_name")
    if not dossier.last_name or _is_placeholder(dossier.last_name):
        missing.append("child_last_name")
    if not dossier.birth_date:
        missing.append("child_birth_date")

    parent1 = _resolve_guardian(guardians, dossier_models.GuardianRole.parent1.value)
    parent2 = _resolve_guardian(guardians, dossier_models.GuardianRole.parent2.value)

    if _guardian_name_missing(parent1):
        missing.append("parent1_name")
    if not parent1 or not parent1.email:
        missing.append("parent1_email")

    if _guardian_name_missing(parent2):
        missing.append("parent2_name")
    if not parent2 or not parent2.email:
        missing.append("parent2_email")
    if not parent2 or not parent2.phone_e164:
        missing.append("parent2_phone")

    created = bool(
        dossier.first_name
        and dossier.last_name
        and not _is_placeholder(dossier.first_name)
        and not _is_placeholder(dossier.last_name)
    )

    return JourneyDossierStatus(
        created=created,
        complete=len(missing) == 0,
        missing_fields=missing,
    )


def _appointment_key(appointment: models.Appointment) -> dt.datetime:
    date_value = appointment.date or dt.date.min
    time_value = appointment.time or dt.time.min
    return dt.datetime.combine(date_value, time_value)


def _find_latest_appointment(appointments: list[models.Appointment], appointment_type: str) -> models.Appointment | None:
    matching = []
    for appointment in appointments:
        appt_type = appointment.appointment_type.value if hasattr(appointment.appointment_type, "value") else appointment.appointment_type
        if appt_type == appointment_type:
            matching.append(appointment)
    if not matching:
        return None
    return max(matching, key=_appointment_key)


def _signature_complete(signature: models.DocumentSignature) -> bool:
    overall_status = signature.overall_status.value if hasattr(signature.overall_status, "value") else signature.overall_status
    if overall_status == models.DocumentSignatureStatus.completed.value:
        return True
    return signature.parent1_status == "signed" and signature.parent2_status == "signed"


def _parent_signed(signature: models.DocumentSignature, parent: str) -> bool:
    if parent == "parent1":
        return signature.parent1_status == "signed" or _signature_complete(signature)
    if parent == "parent2":
        return signature.parent2_status == "signed" or _signature_complete(signature)
    return False


@router.get("", response_model=PatientJourneyResponse, status_code=status.HTTP_200_OK)
def get_patient_journey(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> PatientJourneyResponse:
    """Return patient journey status for the UI header."""
    if current_user.role != models.UserRole.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to patient accounts.",
        )

    dossier = dossier_service.get_dossier_current(db, current_user)
    dossier_status = _build_dossier_status(dossier.child, dossier.guardians)

    case = (
        db.query(models.ProcedureCase)
        .filter(models.ProcedureCase.patient_id == current_user.id)
        .order_by(models.ProcedureCase.created_at.desc())
        .first()
    )

    appointments = list(case.appointments) if case else []
    preconsultation = _find_latest_appointment(appointments, models.AppointmentType.preconsultation.value)
    act_appointment = _find_latest_appointment(appointments, models.AppointmentType.act.value)

    preconsultation_date = _appointment_datetime(preconsultation)
    act_date = _appointment_datetime(act_appointment)

    reflection_delay = JourneyReflectionDelay()
    if preconsultation_date:
        available_date = preconsultation_date.date() + dt.timedelta(days=15)
        today = dt.date.today()
        days_left = max(0, (available_date - today).days)
        reflection_delay = JourneyReflectionDelay(
            can_sign=available_date <= today,
            days_left=days_left,
            available_date=available_date,
        )

    signatures = list(case.document_signatures) if case else []
    parent1_signed = bool(signatures) and all(_parent_signed(sig, "parent1") for sig in signatures)
    parent2_signed = bool(signatures) and all(_parent_signed(sig, "parent2") for sig in signatures)
    signatures_complete = bool(signatures) and all(_signature_complete(sig) for sig in signatures)

    journey_status = PatientJourneyStatus(
        dossier=dossier_status,
        pre_consultation=JourneyAppointmentStatus(
            booked=preconsultation is not None,
            date=preconsultation_date,
        ),
        rdv_acte=JourneyAppointmentStatus(
            booked=act_appointment is not None,
            date=act_date,
        ),
        signatures=JourneySignaturesStatus(
            complete=signatures_complete,
            parent1_signed=parent1_signed,
            parent2_signed=parent2_signed,
            reflection_delay=reflection_delay,
        ),
    )

    return PatientJourneyResponse(journey_status=journey_status)


@router.get("/export", status_code=status.HTTP_200_OK)
def export_patient_data(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Export all personal data for the authenticated patient."""
    if current_user.role != models.UserRole.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to patient accounts.",
        )

    cases = db.query(models.ProcedureCase).filter(models.ProcedureCase.patient_id == current_user.id).all()
    case_ids = [case.id for case in cases]

    appointments = db.query(models.Appointment).filter(models.Appointment.user_id == current_user.id).all()
    appointment_ids = [appointment.id for appointment in appointments]

    prescriptions = []
    prescription_versions = []
    if appointment_ids:
        prescriptions = (
            db.query(models.Prescription)
            .filter(models.Prescription.appointment_id.in_(appointment_ids))
            .all()
        )
        prescription_ids = [prescription.id for prescription in prescriptions]
        if prescription_ids:
            prescription_versions = (
                db.query(models.PrescriptionVersion)
                .filter(models.PrescriptionVersion.prescription_id.in_(prescription_ids))
                .all()
            )

    document_signatures = []
    if case_ids:
        document_signatures = (
            db.query(models.DocumentSignature)
            .filter(models.DocumentSignature.procedure_case_id.in_(case_ids))
            .all()
        )

    legal_acknowledgements = []
    if appointment_ids:
        legal_acknowledgements = (
            db.query(models.LegalAcknowledgement)
            .filter(models.LegalAcknowledgement.appointment_id.in_(appointment_ids))
            .all()
        )

    children = (
        db.query(dossier_models.Child)
        .filter(dossier_models.Child.patient_id == current_user.id)
        .all()
    )
    child_ids = [child.id for child in children]

    guardians = []
    phone_verifications = []
    email_verifications = []
    if child_ids:
        guardians = (
            db.query(dossier_models.Guardian)
            .filter(dossier_models.Guardian.child_id.in_(child_ids))
            .all()
        )
        guardian_ids = [guardian.id for guardian in guardians]
        if guardian_ids:
            phone_verifications = (
                db.query(dossier_models.GuardianPhoneVerification)
                .filter(dossier_models.GuardianPhoneVerification.guardian_id.in_(guardian_ids))
                .all()
            )
            email_verifications = (
                db.query(dossier_models.GuardianEmailVerification)
                .filter(dossier_models.GuardianEmailVerification.guardian_id.in_(guardian_ids))
                .all()
            )

    return {
        "generated_at": _iso(dt.datetime.utcnow()),
        "user": _serialize_user(current_user),
        "procedure_cases": [_serialize_case(case) for case in cases],
        "appointments": [_serialize_appointment(appointment) for appointment in appointments],
        "prescriptions": [_serialize_prescription(prescription) for prescription in prescriptions],
        "prescription_versions": [
            _serialize_prescription_version(version) for version in prescription_versions
        ],
        "document_signatures": [
            _serialize_document_signature(signature) for signature in document_signatures
        ],
        "legal_acknowledgements": [
            _serialize_acknowledgement(entry) for entry in legal_acknowledgements
        ],
        "dossier": {
            "children": [_serialize_child(child) for child in children],
            "guardians": [_serialize_guardian(guardian) for guardian in guardians],
            "phone_verifications": [
                _serialize_phone_verification(entry) for entry in phone_verifications
            ],
            "email_verifications": [
                _serialize_email_verification(entry) for entry in email_verifications
            ],
        },
    }


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1)


class DeleteAccountResponse(BaseModel):
    detail: str
    deleted_email: EmailStr


@router.post("/delete", response_model=DeleteAccountResponse, status_code=status.HTTP_200_OK)
def delete_patient_account(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> DeleteAccountResponse:
    """Soft delete the authenticated patient account (requires password)."""
    if current_user.role != models.UserRole.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to patient accounts.",
        )

    if not security.verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password.",
        )

    deleted_email = f"deleted+{current_user.id}@medicapp.example"
    current_user.email = deleted_email
    current_user.hashed_password = security.hash_password(secrets.token_urlsafe(32))
    current_user.email_verified = False
    db.add(current_user)
    db.commit()

    return DeleteAccountResponse(detail="Compte supprime.", deleted_email=deleted_email)


class RectifyAccountRequest(BaseModel):
    email: EmailStr | None = None
    phone_e164: str | None = None


class RectifyAccountResponse(BaseModel):
    detail: str
    email: EmailStr | None = None
    phone_e164: str | None = None


@router.put("/rectify", response_model=RectifyAccountResponse, status_code=status.HTTP_200_OK)
def rectify_patient_account(
    payload: RectifyAccountRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> RectifyAccountResponse:
    """Rectify patient contact data (email / phone)."""
    if current_user.role != models.UserRole.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to patient accounts.",
        )

    updated_email = None
    updated_phone = None

    if payload.email:
        existing = user_repository.get_by_email(db, payload.email)
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use.",
            )
        if payload.email != current_user.email:
            current_user.email = payload.email
            current_user.email_verified = False
            updated_email = payload.email

    if payload.phone_e164:
        updated_phone = dossier_service.normalize_phone(payload.phone_e164)

    children = (
        db.query(dossier_models.Child)
        .filter(dossier_models.Child.patient_id == current_user.id)
        .all()
    )
    child_ids = [child.id for child in children]

    guardians = []
    if child_ids:
        guardians = (
            db.query(dossier_models.Guardian)
            .filter(
                dossier_models.Guardian.child_id.in_(child_ids),
                dossier_models.Guardian.role == dossier_models.GuardianRole.parent1.value,
            )
            .all()
        )

    for guardian in guardians:
        if updated_email:
            guardian.email = updated_email
            guardian.email_verified_at = None
        if updated_phone is not None:
            guardian.phone_e164 = updated_phone
            guardian.phone_verified_at = None

    cases = (
        db.query(models.ProcedureCase)
        .filter(models.ProcedureCase.patient_id == current_user.id)
        .all()
    )
    for case in cases:
        if updated_email:
            case.parent1_email = updated_email
        if updated_phone is not None:
            case.parent1_phone = updated_phone
            case.parent1_phone_verified_at = None

    db.add(current_user)
    db.commit()

    return RectifyAccountResponse(
        detail="Profil mis a jour.",
        email=updated_email or current_user.email,
        phone_e164=updated_phone,
    )
