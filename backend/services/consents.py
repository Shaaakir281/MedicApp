"""Consent workflow orchestration (Yousign + SMS + email stubs)."""

from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import models
from core.config import get_settings
from services import email as email_service
from services.sms import send_sms
from services.yousign import YousignClient, YousignConfigurationError

logger = logging.getLogger(__name__)


def _get_preconsultation_date(case: models.ProcedureCase) -> Optional[dt.date]:
    """Return stored preconsultation date or derive it from appointments."""
    if case.preconsultation_date:
        return case.preconsultation_date
    for appt in case.appointments or []:
        if appt.appointment_type == models.AppointmentType.preconsultation:
            return appt.date
    return None


def compute_signature_open_at(case: models.ProcedureCase) -> Optional[dt.date]:
    """Compute or reuse the signature opening date (15 days after pre-consultation)."""
    if case.signature_open_at:
        return case.signature_open_at
    pre_date = _get_preconsultation_date(case)
    if not pre_date:
        return None
    return pre_date + dt.timedelta(days=15)


def _build_signers_payload(case: models.ProcedureCase) -> list[dict]:
    signers = []
    if case.parent1_name and case.parent1_email:
        signers.append(
            {
                "full_name": case.parent1_name,
                "email": case.parent1_email,
                "phone": case.parent1_phone,
                "external_id": f"parent1-{case.id}",
            }
        )
    if case.parent2_name and case.parent2_email:
        signers.append(
            {
                "full_name": case.parent2_name,
                "email": case.parent2_email,
                "phone": case.parent2_phone,
                "external_id": f"parent2-{case.id}",
            }
        )
    return signers


def _validate_contacts(case: models.ProcedureCase) -> None:
    missing = []
    if not case.parent1_phone:
        missing.append("parent1_phone")
    if case.parent2_name and not case.parent2_phone:
        missing.append("parent2_phone")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coordonnees SMS manquantes : {', '.join(missing)}",
        )


def initiate_consent(db: Session, case: models.ProcedureCase) -> models.ProcedureCase:
    """Create the Yousign procedure (or mock) and send initial notifications."""
    signature_open_at = compute_signature_open_at(case)
    if not signature_open_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date de consultation pre-operatoire manquante pour calculer le delai de 15 jours.",
        )
    today = dt.date.today()
    if today < signature_open_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Signature autorisee a partir du {signature_open_at.isoformat()} (delai de reflexion).",
        )

    _validate_contacts(case)
    signers = _build_signers_payload(case)
    if not signers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucun parent n'est renseigne.")

    try:
        client = YousignClient()
        procedure = client.create_procedure(signers, name=f"Consentement {case.child_full_name}")
    except YousignConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    case.yousign_procedure_id = procedure.procedure_id
    now = dt.datetime.utcnow()
    for signer in procedure.signers:
        if signer.signer_id.startswith("parent1") or signer.email == case.parent1_email:
            case.parent1_yousign_signer_id = signer.signer_id
            case.parent1_consent_status = "sent"
            case.parent1_consent_sent_at = now
            case.parent1_signature_link = signer.signature_link
        else:
            case.parent2_yousign_signer_id = signer.signer_id
            case.parent2_consent_status = "sent"
            case.parent2_consent_sent_at = now
            case.parent2_signature_link = signer.signature_link

    case.signature_open_at = signature_open_at
    case.consent_last_status = "procedure_created"

    db.add(case)
    db.commit()
    db.refresh(case)

    _send_initial_notifications(case)
    return case


def _send_initial_notifications(case: models.ProcedureCase) -> None:
    """Send emails and SMS for initial signature availability."""
    app_name = get_settings().app_name
    child = case.child_full_name

    def _build_body(link: str) -> str:
        return (
            f"Vous pouvez signer le consentement pour {child}.\n"
            f"Lien de signature securise : {link}\n"
            f"{app_name}"
        )

    if case.parent1_signature_link and case.parent1_sms_optin and case.parent1_phone:
        send_sms(case.parent1_phone, _build_body(case.parent1_signature_link))
    if case.parent2_signature_link and case.parent2_sms_optin and case.parent2_phone:
        send_sms(case.parent2_phone, _build_body(case.parent2_signature_link))

    if case.parent1_email and case.parent1_signature_link:
        email_service.send_consent_download_email(case.parent1_email, child, case.parent1_signature_link)
    if case.parent2_email and case.parent2_signature_link:
        email_service.send_consent_download_email(case.parent2_email, child, case.parent2_signature_link)


def remind_pending(db: Session, case: models.ProcedureCase) -> models.ProcedureCase:
    """Resend notifications for parents who have not signed yet."""
    now = dt.datetime.utcnow()
    if case.parent1_consent_status != "signed" and case.parent1_signature_link:
        case.parent1_consent_status = "sent"
        case.parent1_consent_sent_at = now
        if case.parent1_sms_optin and case.parent1_phone:
            send_sms(
                case.parent1_phone,
                f"Rappel : merci de signer le consentement pour {case.child_full_name} : {case.parent1_signature_link}",
            )
    if case.parent2_consent_status != "signed" and case.parent2_signature_link:
        case.parent2_consent_status = "sent"
        case.parent2_consent_sent_at = now
        if case.parent2_sms_optin and case.parent2_phone:
            send_sms(
                case.parent2_phone,
                f"Rappel : merci de signer le consentement pour {case.child_full_name} : {case.parent2_signature_link}",
            )

    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def update_signature_status(
    db: Session,
    case: models.ProcedureCase,
    *,
    parent_label: str,
    status_value: str,
    signed_at: Optional[dt.datetime] = None,
    method: Optional[str] = None,
    signed_file_url: Optional[str] = None,
    evidence_url: Optional[str] = None,
) -> models.ProcedureCase:
    """Apply signature updates coming from Yousign (webhook or polling)."""
    signed_at = signed_at or dt.datetime.utcnow()
    if parent_label == "parent1":
        case.parent1_consent_status = status_value
        case.parent1_consent_signed_at = signed_at
        case.parent1_consent_method = method
    elif parent_label == "parent2":
        case.parent2_consent_status = status_value
        case.parent2_consent_signed_at = signed_at
        case.parent2_consent_method = method

    if signed_file_url:
        case.consent_signed_pdf_url = signed_file_url
    if evidence_url:
        case.consent_evidence_pdf_url = evidence_url

    if case.parent1_consent_status == "signed" and case.parent2_consent_status == "signed":
        case.consent_ready_at = signed_at
        case.consent_last_status = "completed"
    else:
        case.consent_last_status = status_value

    db.add(case)
    db.commit()
    db.refresh(case)
    return case
