"""Consent workflow orchestration (Yousign + SMS + email stubs)."""

from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import models
from core.config import get_settings
from services import consent_pdf
from services import email as email_service
from services.sms import send_sms
from services.yousign import YousignClient, YousignConfigurationError, start_neutral_signature_request
from services.yousign.models import YousignSigner

# Utilise le logger uvicorn pour garantir l'affichage dans les logs du conteneur
logger = logging.getLogger("uvicorn.error")


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


def _build_signers_payload(case: models.ProcedureCase, auth_mode: str = "otp_sms") -> list[dict]:
    """Build signers payload; fallback email generated from phone if missing."""

    def _ensure_email(email: str | None, phone: str | None, label: str) -> str | None:
        if email:
            return email
        if phone:
            safe = phone.replace("+", "").replace(" ", "").replace("-", "")
            return f"{safe}@{label}.consent.test"
        return None

    signers = []
    if case.parent1_name and (case.parent1_email or case.parent1_phone):
        email = _ensure_email(case.parent1_email, case.parent1_phone, "parent1")
        signers.append(
            {
                "label": "parent1",
                "email": email,
                "phone": case.parent1_phone,
                "auth_mode": auth_mode,
            }
        )
    if case.parent2_name and (case.parent2_email or case.parent2_phone):
        email = _ensure_email(case.parent2_email, case.parent2_phone, "parent2")
        signers.append(
            {
                "label": "parent2",
                "email": email,
                "phone": case.parent2_phone,
                "auth_mode": auth_mode,
            }
        )
    return signers


def _validate_contacts(case: models.ProcedureCase) -> None:
    missing = []
    if not case.parent1_phone:
        missing.append("parent1_phone")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coordonnees SMS manquantes : {', '.join(missing)}",
        )


def initiate_consent(db: Session, case: models.ProcedureCase, *, in_person: bool = False) -> models.ProcedureCase:
    """Create the Yousign procedure (or mock) and send initial notifications."""
    signature_open_at = compute_signature_open_at(case)
    _validate_contacts(case)
    # Yousign v3 accepte : otp_sms, otp_email, no_otp. En face à face on supprime l'OTP.
    auth_mode = "no_otp" if in_person else "otp_sms"
    signers = _build_signers_payload(case, auth_mode=auth_mode)
    if not signers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucun parent n'est renseigne.")

    try:
        client = YousignClient()
        consent_hash = None
        if case.consent_pdf_path:
            from services import pdf as pdf_service

            pdf_bytes = consent_pdf.load_pdf_bytes(pdf_service.CONSENT_CATEGORY, case.consent_pdf_path)
            if pdf_bytes:
                consent_hash = consent_pdf.compute_pdf_sha256(pdf_bytes)

        neutral_pdf_path = consent_pdf.render_neutral_consent_pdf(consent_id=str(case.id), consent_hash=consent_hash)
        procedure = start_neutral_signature_request(
            client=client,
            neutral_pdf_path=str(neutral_pdf_path),
            signers=signers,
            procedure_label="Consentement electronique MedScript",
            delivery_mode="none" if in_person else "email",
        )
    except YousignConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    logger.info("initiate_consent -> Yousign procedure=%s signers=%s", procedure.procedure_id, procedure.signers)

    # Fallback : si des liens de signature manquent, tenter une recuperation immediate.
    if not client.mock_mode and any(not s.signature_link for s in procedure.signers):
        def _sig_link(data: dict) -> str:
            links = data.get("signature_links") or {}
            return (
                data.get("signature_url")
                or data.get("signature_link")
                or data.get("url")
                or links.get("iframe")
                or links.get("short")
                or links.get("long")
                or ""
            )

        refreshed: list[YousignSigner] = []
        try:
            signers_data = client.fetch_signers(procedure.procedure_id)
            mapping = {str(s.get("id")): _sig_link(s) for s in signers_data if isinstance(s, dict)}
        except Exception:
            mapping = {}

        for signer in procedure.signers:
            link = signer.signature_link or mapping.get(str(signer.signer_id)) or ""
            if not link:
                try:
                    payload = client.fetch_signer(str(signer.signer_id))
                    link = _sig_link(payload)
                    email = (payload.get("info") or {}).get("email") or payload.get("email") or signer.email
                    phone = (payload.get("info") or {}).get("phone_number") or payload.get("phone") or signer.phone
                except Exception:
                    email = signer.email
                    phone = signer.phone
                refreshed.append(
                    YousignSigner(
                        signer_id=signer.signer_id,
                        signature_link=link,
                        email=email,
                        phone=phone,
                    )
                )
            else:
                refreshed.append(signer)

        procedure.signers = refreshed

    case.yousign_procedure_id = procedure.procedure_id
    now = dt.datetime.utcnow()
    # Associer les signers retournés à nos labels (ordre d'insertion)
    for idx, signer in enumerate(procedure.signers):
        label = signers[idx].get("label") if idx < len(signers) else None
        if label == "parent1":
            case.parent1_yousign_signer_id = signer.signer_id
            case.parent1_consent_status = "sent"
            case.parent1_consent_sent_at = now
            case.parent1_signature_link = signer.signature_link
            logger.info("Persisting Yousign links for parent1: %s", signer)
        elif label == "parent2":
            case.parent2_yousign_signer_id = signer.signer_id
            case.parent2_consent_status = "sent"
            case.parent2_consent_sent_at = now
            case.parent2_signature_link = signer.signature_link
            logger.info("Persisting Yousign links for parent2: %s", signer)

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


def _download_and_store_artifacts(
    case: models.ProcedureCase,
    signed_url: Optional[str] = None,
    evidence_url: Optional[str] = None,
    signer_id: Optional[str] = None,
) -> tuple[Optional[str], Optional[str]]:
    """Download signed/evidence PDFs from Yousign and persist them in HDS storage."""
    client = YousignClient()
    if client.mock_mode or not case.yousign_procedure_id:
        return None, None

    signed_identifier = None
    evidence_identifier = None

    try:
        if signed_url:
            signed_bytes = client.download_with_auth(signed_url)
        else:
            signed_bytes = client.download_signed_documents(case.yousign_procedure_id)
        if signed_bytes:
            signed_identifier = consent_pdf.store_signed_pdf(signed_bytes, prefix=str(case.id))
            consent_pdf.prune_case_files(consent_pdf.SIGNED_CONSENT_CATEGORY, case.id, keep_latest=2)
    except Exception:
        logger.exception("Failed to download or store signed document for case %s", case.id)

    try:
        if evidence_url:
            evidence_bytes = client.download_with_auth(evidence_url)
        else:
            # En v3, l'audit trail est exposé via /audit_trails (global ou par signer)
            evidence_bytes = client.download_evidence(case.yousign_procedure_id, signer_id=signer_id)
        if evidence_bytes:
            evidence_identifier = consent_pdf.store_evidence_pdf(evidence_bytes, prefix=str(case.id))
            consent_pdf.prune_case_files(consent_pdf.EVIDENCE_CATEGORY, case.id, keep_latest=2)
    except Exception:
        logger.exception("Failed to download or store evidence PDF for case %s", case.id)

    return signed_identifier, evidence_identifier


def _assemble_signed_package(case: models.ProcedureCase) -> Optional[str]:
    """Assemble consent complet + evidences + PDF(s) signés disponibles."""
    if not case.consent_pdf_path:
        return None

    signed_ids: list[str] = []
    evid_ids: list[str] = []
    # Récupère tous les fichiers locaux commençant par case.id-
    signed_ids.extend(consent_pdf.list_local_files_for_case(consent_pdf.SIGNED_CONSENT_CATEGORY, case.id))
    evid_ids.extend(consent_pdf.list_local_files_for_case(consent_pdf.EVIDENCE_CATEGORY, case.id))
    # Ajout des derniers identifiants connus
    if case.consent_signed_pdf_url and case.consent_signed_pdf_url not in signed_ids:
        signed_ids.append(case.consent_signed_pdf_url)
    if case.consent_evidence_pdf_url and case.consent_evidence_pdf_url not in evid_ids:
        evid_ids.append(case.consent_evidence_pdf_url)

    if not signed_ids and not evid_ids:
        return None

    try:
        logger.info("Assemblage consentement case=%s signed=%s evidences=%s", case.id, signed_ids, evid_ids)
        return consent_pdf.compose_final_consent(
            full_consent_id=case.consent_pdf_path,
            case_id=case.id,
            signed_ids=signed_ids,
            evidence_ids=evid_ids,
        )
    except Exception:
        logger.exception("Echec d'assemblage du consentement signe pour le dossier %s", case.id)
        return None


def poll_and_fetch_signed(db: Session, case: models.ProcedureCase) -> models.ProcedureCase:
    """Fallback polling: récupère l'état SR, télécharge artefacts, assemble."""
    client = YousignClient()
    if client.mock_mode or not case.yousign_procedure_id:
        return case
    try:
        sr = client.fetch_signature_request(case.yousign_procedure_id)
    except Exception:
        logger.exception("Poll Yousign SR failed for case %s", case.id)
        return case

    now = dt.datetime.utcnow()
    for s in sr.get("signers") or []:
        if (s.get("status") or "").lower() != "signed":
            continue
        sid = str(s.get("id"))
        if sid == case.parent1_yousign_signer_id:
            case.parent1_consent_status = "signed"
            case.parent1_consent_signed_at = now
            case.parent1_consent_method = "yousign"
        if sid == case.parent2_yousign_signer_id:
            case.parent2_consent_status = "signed"
            case.parent2_consent_signed_at = now
            case.parent2_consent_method = "yousign"

    signed_url = sr.get("signed_file_url")
    evidence_url = sr.get("evidence_url")
    stored_signed, stored_evidence = _download_and_store_artifacts(case, signed_url=signed_url, evidence_url=evidence_url)
    if stored_signed:
        case.consent_signed_pdf_url = stored_signed
    if stored_evidence:
        case.consent_evidence_pdf_url = stored_evidence

    assembled = _assemble_signed_package(case)
    if assembled:
        case.consent_signed_pdf_url = assembled

    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def purge_yousign_signature(case: models.ProcedureCase) -> None:
    """Best-effort cleanup of the Yousign signature request (no PHI retained externally)."""
    client = YousignClient()
    if client.mock_mode or not case.yousign_procedure_id:
        return
    try:
        client.delete_signature_request(case.yousign_procedure_id, permanent_delete=True)
        logger.info("Yousign signature_request %s purge demandee (permanent=true)", case.yousign_procedure_id)
    except Exception:
        logger.exception("Failed to purge Yousign signature_request %s", case.yousign_procedure_id)


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

    if status_value == "signed" and case.yousign_procedure_id:
        stored_signed, stored_evidence = _download_and_store_artifacts(
            case,
            signed_url=signed_file_url,
            evidence_url=evidence_url,
            signer_id=case.parent1_yousign_signer_id if parent_label == "parent1" else case.parent2_yousign_signer_id,
        )
        if stored_signed:
            case.consent_signed_pdf_url = stored_signed
        if stored_evidence:
            case.consent_evidence_pdf_url = stored_evidence
        assembled_partial = _assemble_signed_package(case)
        if assembled_partial:
            case.consent_signed_pdf_url = assembled_partial

    if case.parent1_consent_status == "signed" and case.parent2_consent_status == "signed":
        # Une fois les deux signatures obtenues, récupérer l'audit complet (tous signataires)
        stored_signed, stored_evidence = _download_and_store_artifacts(
            case,
            signed_url=None,
            evidence_url=None,
            signer_id=None,
        )
        if stored_signed:
            case.consent_signed_pdf_url = stored_signed
        if stored_evidence:
            case.consent_evidence_pdf_url = stored_evidence
        final_path = _assemble_signed_package(case)
        if final_path:
            case.consent_signed_pdf_url = final_path
        case.consent_ready_at = signed_at
        case.consent_last_status = "completed"
        # Purge Yousign apres recuperation locale (best-effort)
        try:
            purge_yousign_signature(case)
        except Exception:
            logger.exception("Echec de purge Yousign pour le dossier %s", case.id)
    else:
        case.consent_last_status = status_value

    db.add(case)
    db.commit()
    db.refresh(case)
    return case
