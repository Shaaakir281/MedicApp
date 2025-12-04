"""Procedure routes dedicated to the circumcision workflow."""

from __future__ import annotations

from datetime import date as date_cls, datetime, timedelta
import random
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

import crud
import schemas
from pydantic import BaseModel, Field
from database import get_db
from dependencies.auth import get_current_user
from core.config import get_settings
from services import pdf as pdf_service
from services import email as email_service
from services import download_links
from services.storage import StorageError, get_storage_backend
from services.sms import send_sms


router = APIRouter(prefix="/procedures", tags=["procedures"])

PATIENT_INFO: Dict[str, Any] = {
    "title": "Circoncision rituelle - informations patients",
    "sections": [
        {
            "heading": "Avant la consultation pre-operatoire",
            "items": [
                "Indiquer l'age, le poids, les allergies et traitements de l'enfant.",
                "Confirmer l'autorite parentale ou disposer de l'accord ecrit du second parent.",
                "Reconnaitre que l'intervention comporte des risques (saignement, infection, douleur, cicatrisation).",
            ],
        },
        {
            "heading": "Etapes du parcours",
            "items": [
                "Consultation pre-operatoire (visio ou presentiel) pour valider l'intervention et repondre aux questions.",
                "Signature du consentement eclaire par les deux parents ou representants legaux (telechargement ou signature sur place).",
                "Planification de l'acte et preparation du materiel prescrit (ordonnance fournie).",
            ],
        },
        {
            "heading": "Materiel a preparer",
            "items": [
                "Antiseptique chirurgical, pansements steriles, compresses, gants steriles.",
                "Creme cicatrisante, antalgique pediatrique adapte au poids, serum physiologique.",
                "Vaseline ou coton selon les recommandations du praticien.",
            ],
        },
    ],
}


class PhoneOtpRequest(BaseModel):
    parent: str = Field(pattern="^(parent1|parent2)$")
    phone: str | None = None


class PhoneOtpVerify(BaseModel):
    parent: str = Field(pattern="^(parent1|parent2)$")
    code: str


def _serialize_case(case) -> schemas.ProcedureCase:
    today = date_cls.today()
    child_age_years = (today - case.child_birthdate).days / 365.25
    base_url = get_settings().app_base_url.rstrip("/")

    appointments_payload = []
    for appt in sorted(case.appointments, key=lambda a: (a.date, a.time)):
        prescription = getattr(appt, "prescription", None)
        pres_id = prescription.id if prescription else None
        pres_signed_at = prescription.signed_at if prescription else None
        pres_signed = bool(prescription and prescription.signed_at)
        pres_url = None
        if prescription:
            token = download_links.create_prescription_download_token(
                prescription.id,
                actor="patient",
                channel="patient_rdv",
            )
            pres_url = (
                f"{base_url}/prescriptions/access/{token}?actor=patient&channel=patient_rdv"
            )

        appointments_payload.append(
            schemas.Appointment(
                id=appt.id,
                user_id=appt.user_id,
                status=appt.status.value,
                created_at=appt.created_at,
                appointment_type=appt.appointment_type.value,
                mode=appt.mode.value if appt.mode else None,
                procedure_id=appt.procedure_id,
                date=appt.date,
                time=appt.time,
                prescription_id=pres_id,
                prescription_url=pres_url,
                prescription_signed_at=pres_signed_at,
                prescription_signed=pres_signed,
            )
        )
    download_url = None
    if case.consent_download_token and case.consent_pdf_path:
        download_url = f"{base_url}/procedures/{case.consent_download_token}/consent.pdf"

    appointments_entities = case.appointments or []
    latest_signed_prescription = None
    for appointment in appointments_entities:
        prescription = getattr(appointment, "prescription", None)
        if prescription and prescription.signed_at:
            if latest_signed_prescription is None:
                latest_signed_prescription = prescription
            else:
                previous = latest_signed_prescription.signed_at or datetime.min
                current = prescription.signed_at or datetime.min
                if current > previous:
                    latest_signed_prescription = prescription

    ordonnance_prescription_id = None
    ordonnance_signed_at = None
    ordonnance_download_url = None
    if latest_signed_prescription:
        ordonnance_prescription_id = latest_signed_prescription.id
        ordonnance_signed_at = latest_signed_prescription.signed_at
        token = download_links.create_prescription_download_token(
            latest_signed_prescription.id,
            actor="patient",
            channel="patient_case",
        )
        ordonnance_download_url = (
            f"{base_url}/prescriptions/access/{token}?actor=patient&channel=patient_case"
        )

    return schemas.ProcedureCase(
        id=case.id,
        procedure_type=case.procedure_type.value,
        child_full_name=case.child_full_name,
        child_birthdate=case.child_birthdate,
        child_weight_kg=case.child_weight_kg,
        parent1_name=case.parent1_name,
        parent1_email=case.parent1_email,
        parent2_name=case.parent2_name,
        parent2_email=case.parent2_email,
        parent1_phone=case.parent1_phone,
        parent2_phone=case.parent2_phone,
        parent1_sms_optin=case.parent1_sms_optin,
        parent2_sms_optin=case.parent2_sms_optin,
        parent1_phone_verified_at=case.parent1_phone_verified_at,
        parent2_phone_verified_at=case.parent2_phone_verified_at,
        parental_authority_ack=case.parental_authority_ack,
        notes=case.notes,
        created_at=case.created_at,
        updated_at=case.updated_at,
        checklist_pdf_path=case.checklist_pdf_path,
        consent_pdf_path=case.consent_pdf_path,
        consent_download_url=download_url,
        consent_signed_pdf_url=case.consent_signed_pdf_url,
        consent_evidence_pdf_url=case.consent_evidence_pdf_url,
        consent_last_status=case.consent_last_status,
        consent_ready_at=case.consent_ready_at,
        yousign_procedure_id=case.yousign_procedure_id,
        parent1_yousign_signer_id=case.parent1_yousign_signer_id,
        parent2_yousign_signer_id=case.parent2_yousign_signer_id,
        parent1_consent_status=case.parent1_consent_status,
        parent2_consent_status=case.parent2_consent_status,
        parent1_consent_sent_at=case.parent1_consent_sent_at,
        parent2_consent_sent_at=case.parent2_consent_sent_at,
        parent1_consent_signed_at=case.parent1_consent_signed_at,
        parent2_consent_signed_at=case.parent2_consent_signed_at,
        parent1_consent_method=case.parent1_consent_method,
        parent2_consent_method=case.parent2_consent_method,
        parent1_signature_link=case.parent1_signature_link,
        parent2_signature_link=case.parent2_signature_link,
        preconsultation_date=case.preconsultation_date,
        signature_open_at=case.signature_open_at,
        ordonnance_pdf_path=case.ordonnance_pdf_path,
        ordonnance_download_url=ordonnance_download_url,
        ordonnance_prescription_id=ordonnance_prescription_id,
        ordonnance_signed_at=ordonnance_signed_at,
        child_age_years=round(child_age_years, 2),
        appointments=appointments_payload,
        steps_acknowledged=case.steps_acknowledged,
        dossier_completed=case.dossier_completed,
        missing_fields=case.missing_fields or [],
    )


@router.get("/info")
def get_procedure_information() -> Dict[str, Any]:
    """Return informational content for the circumcision workflow."""
    return PATIENT_INFO


def _get_case_for_user(db: Session, user_id: int):
    case = crud.get_active_procedure_case(db, user_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune procedure en cours.",
        )
    return case


@router.get("/current", response_model=schemas.ProcedureCase)
def get_current_procedure(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.ProcedureCase:
    case = crud.get_active_procedure_case(db, current_user.id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune procedure en cours.",
        )
    return _serialize_case(case)


@router.post("", response_model=schemas.ProcedureCase, status_code=status.HTTP_201_CREATED)
def create_or_update_procedure(
    payload: schemas.ProcedureCaseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.ProcedureCase:
    existing = crud.get_active_procedure_case(db, current_user.id)
    if existing:
        case = crud.update_procedure_case(db, existing, payload)
    else:
        case = crud.create_procedure_case(db, current_user.id, payload)

    db.refresh(case)
    return _serialize_case(case)


@router.post("/acknowledge-steps", response_model=schemas.ProcedureCase)
def acknowledge_steps(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.ProcedureCase:
    case = crud.get_active_procedure_case(db, current_user.id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune procedure en cours.",
        )
    if not case.steps_acknowledged:
        case.steps_acknowledged = True
        db.add(case)
        db.commit()
        db.refresh(case)
    return _serialize_case(case)


@router.post("/send-consent-link", status_code=status.HTTP_202_ACCEPTED)
def send_consent_link(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Send the consent download link by email to the recorded parents."""
    case = crud.get_active_procedure_case(db, current_user.id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune procedure en cours.",
        )

    if not case.consent_download_token or not case.consent_pdf_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le consentement n'est pas encore disponible.",
        )
    if not case.consent_pdf_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consentement introuvable.",
        )
    storage = get_storage_backend()
    if not storage.exists(pdf_service.CONSENT_CATEGORY, case.consent_pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier de consentement introuvable.",
        )

    recipients = [
        email for email in (case.parent1_email, case.parent2_email) if email
    ]
    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune adresse e-mail valide n'est associee au dossier.",
        )

    base_url = get_settings().app_base_url.rstrip("/")
    download_url = f"{base_url}/procedures/{case.consent_download_token}/consent.pdf"

    for recipient in recipients:
        email_service.send_consent_download_email(
            recipient,
            case.child_full_name,
            download_url,
        )

    return {"detail": "Lien de consentement envoye.", "recipients": recipients}


@router.get("/{token}/consent.pdf")
def download_consent_pdf(
    token: str,
    db: Session = Depends(get_db),
) -> Response:
    case = crud.get_procedure_case_by_token(db, token)
    if case is None or not case.consent_pdf_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consentement introuvable.",
        )

    storage = get_storage_backend()
    filename = f"consentement-{case.child_full_name.replace(' ', '_')}.pdf"
    if storage.supports_presigned_urls:
        try:
            url = storage.generate_presigned_url(
                pdf_service.CONSENT_CATEGORY,
                case.consent_pdf_path,
                download_name=filename,
                expires_in_seconds=600,
                inline=False,
            )
            return RedirectResponse(url, status_code=307)
        except StorageError:
            # fallback to streaming below
            pass

    try:
        return storage.build_file_response(
            pdf_service.CONSENT_CATEGORY,
            case.consent_pdf_path,
            filename,
            inline=False,
        )
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier manquant sur le serveur.",
        ) from exc


@router.post("/phone-otp/request", response_model=schemas.ProcedureCase)
def request_phone_otp(
    payload: PhoneOtpRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.ProcedureCase:
    case = _get_case_for_user(db, current_user.id)
    parent = payload.parent
    phone = payload.phone or getattr(case, f"{parent}_phone")
    if not phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Numero de telephone manquant.")

    code = f"{random.randint(0, 999999):06d}"
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    setattr(case, f"{parent}_phone", phone)
    setattr(case, f"{parent}_phone_otp_code", code)
    setattr(case, f"{parent}_phone_otp_expires_at", expires_at)
    # reset verification if phone changed
    setattr(case, f"{parent}_phone_verified_at", None)

    db.add(case)
    db.commit()
    db.refresh(case)

    try:
        send_sms(phone, f"Code de verification MedScript : {code}")
    except Exception:
        # ne bloque pas si SMS KO, l'utilisateur peut demander un nouveau code
        pass

    return _serialize_case(case)


@router.post("/phone-otp/verify", response_model=schemas.ProcedureCase)
def verify_phone_otp(
    payload: PhoneOtpVerify,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.ProcedureCase:
    case = _get_case_for_user(db, current_user.id)
    parent = payload.parent
    code = payload.code.strip()
    stored = getattr(case, f"{parent}_phone_otp_code")
    expires_at = getattr(case, f"{parent}_phone_otp_expires_at")

    if not stored or stored != code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code invalide.")
    if expires_at and expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code expire, veuillez renvoyer un code.")

    setattr(case, f"{parent}_phone_verified_at", datetime.utcnow())
    setattr(case, f"{parent}_phone_otp_code", None)
    setattr(case, f"{parent}_phone_otp_expires_at", None)

    db.add(case)
    db.commit()
    db.refresh(case)
    return _serialize_case(case)
