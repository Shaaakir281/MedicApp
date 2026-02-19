"""Routes for cabinet handwritten signatures (tablet mode)."""

from __future__ import annotations

import base64
import datetime as dt
import hashlib
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from core.config import get_settings
from database import get_db
from dependencies.auth import require_practitioner
from services import consent_pdf, legal_documents_pdf, document_signature_service
from services import pdf_signature_cabinet
from services.event_tracker import get_event_tracker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cabinet-signatures", tags=["cabinet-signatures"])
event_tracker = get_event_tracker()

_MAX_SIGNATURE_BYTES = 500 * 1024


def _compute_document_hash(doc_sig: models.DocumentSignature) -> str | None:
    case = doc_sig.procedure_case
    if not case:
        return None
    try:
        doc_type_enum = legal_documents_pdf.normalize_document_type(doc_sig.document_type)
        base_doc_id = legal_documents_pdf.ensure_legal_document_pdf(case, doc_type_enum)
        base_category = legal_documents_pdf.base_category_for(doc_type_enum)
        pdf_bytes = consent_pdf.load_pdf_bytes(base_category, base_doc_id)
        if not pdf_bytes:
            return None
        return consent_pdf.compute_pdf_sha256(pdf_bytes)
    except Exception:
        logger.exception("Failed to compute document hash for document_signature_id=%s", doc_sig.id)
        return None


def _decode_signature(signature_base64: str) -> bytes:
    raw = signature_base64.strip()
    if raw.startswith("data:image"):
        parts = raw.split(",", 1)
        if len(parts) != 2:
            raise ValueError("Signature invalide.")
        raw = parts[1]
    try:
        decoded = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise ValueError("Signature invalide.") from exc
    if len(decoded) > _MAX_SIGNATURE_BYTES:
        raise ValueError("Signature trop volumineuse.")
    if not decoded.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Format de signature invalide. PNG requis.")
    return decoded


@router.post("/initiate", response_model=schemas.CabinetSignatureInitiateResponse, status_code=status.HTTP_201_CREATED)
def initiate_cabinet_signature(
    payload: schemas.CabinetSignatureInitiateRequest,
    current_user=Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.CabinetSignatureInitiateResponse:
    doc_sig = (
        db.query(models.DocumentSignature)
        .options(joinedload(models.DocumentSignature.procedure_case))
        .filter(models.DocumentSignature.id == payload.document_signature_id)
        .first()
    )
    if not doc_sig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")

    token = secrets.token_urlsafe(32)
    expires_at = dt.datetime.utcnow() + dt.timedelta(minutes=30)
    document_hash = _compute_document_hash(doc_sig)

    session = models.CabinetSignatureSession(
        document_signature_id=doc_sig.id,
        parent_role=payload.parent_role,
        token=token,
        expires_at=expires_at,
        initiated_by_practitioner_id=current_user.id,
        document_hash=document_hash,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    settings = get_settings()
    base_url = (settings.frontend_base_url or settings.app_base_url).rstrip("/")
    sign_url = f"{base_url}/sign/{token}"
    role_value = payload.parent_role.value if hasattr(payload.parent_role, "value") else str(payload.parent_role)
    event_tracker.track_practitioner_event(
        "signature_cabinet_initiated",
        current_user.id,
        procedure_id=doc_sig.procedure_case_id,
        document_type=doc_sig.document_type,
        parent_role=role_value,
    )

    return schemas.CabinetSignatureInitiateResponse(
        session_id=session.id,
        sign_url=sign_url,
        expires_at=session.expires_at,
    )


@router.get("/{token}/status", response_model=schemas.CabinetSignatureStatusResponse)
def get_cabinet_signature_status(
    token: str,
    db: Session = Depends(get_db),
) -> schemas.CabinetSignatureStatusResponse:
    session = (
        db.query(models.CabinetSignatureSession)
        .options(joinedload(models.CabinetSignatureSession.document_signature).joinedload(models.DocumentSignature.procedure_case))
        .filter(models.CabinetSignatureSession.token == token)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable.")

    doc_sig = session.document_signature
    case = doc_sig.procedure_case if doc_sig else None
    now = dt.datetime.utcnow()
    valid = session.completed_at is None and session.expires_at > now

    return schemas.CabinetSignatureStatusResponse(
        session_id=session.id,
        document_signature_id=doc_sig.id if doc_sig else None,
        parent_role=session.parent_role,
        expires_at=session.expires_at,
        completed_at=session.completed_at,
        document_type=doc_sig.document_type if doc_sig else None,
        patient_name=case.child_full_name if case else None,
        valid=valid,
    )


@router.post("/{token}/upload", response_model=schemas.CabinetSignatureUploadResponse)
def upload_cabinet_signature(
    token: str,
    payload: schemas.CabinetSignatureUploadRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.CabinetSignatureUploadResponse:
    session = (
        db.query(models.CabinetSignatureSession)
        .filter(models.CabinetSignatureSession.token == token)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable.")

    now = dt.datetime.utcnow()
    if session.completed_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session deja utilisee.")
    if session.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expiree.")
    if not payload.consent_confirmed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consentement requis.")

    doc_sig = (
        db.query(models.DocumentSignature)
        .options(joinedload(models.DocumentSignature.procedure_case))
        .filter(models.DocumentSignature.id == session.document_signature_id)
        .first()
    )
    if not doc_sig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document introuvable.")
    case = doc_sig.procedure_case
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable.")

    if session.document_hash:
        current_hash = _compute_document_hash(doc_sig)
        if current_hash and current_hash != session.document_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Le document a ete modifie. Veuillez relancer la session.",
            )

    try:
        signature_bytes = _decode_signature(payload.signature_base64)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    signature_hash = hashlib.sha256(signature_bytes).hexdigest()
    cabinet_signature = models.CabinetSignature(
        document_signature_id=session.document_signature_id,
        parent_role=session.parent_role,
        signature_image_base64=payload.signature_base64,
        signature_hash=signature_hash,
        consent_confirmed=payload.consent_confirmed,
        signed_at=now,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(cabinet_signature)

    session.completed_at = now
    if payload.device_id:
        session.device_id = payload.device_id

    doc_type = legal_documents_pdf.normalize_document_type(doc_sig.document_type)
    base_doc_id = legal_documents_pdf.ensure_legal_document_pdf(case, doc_type)
    base_category = legal_documents_pdf.base_category_for(doc_type)
    base_pdf_bytes = consent_pdf.load_pdf_bytes(base_category, base_doc_id)
    if not base_pdf_bytes:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Document source introuvable.")

    role_value = session.parent_role.value if hasattr(session.parent_role, "value") else str(session.parent_role)
    signer_label = "Parent 1" if role_value == "parent1" else "Parent 2"
    signed_bytes = pdf_signature_cabinet.embed_signature(
        base_pdf_bytes,
        signature_bytes,
        signer_label=signer_label,
        signed_at=now,
        ip_address=request.client.host if request.client else None,
        session_token=session.token,
    )

    signed_category = legal_documents_pdf.signed_category_for(doc_type)
    signed_prefix = f"{case.id}-{doc_sig.document_type}-cabinet-{role_value}"
    signed_identifier = consent_pdf.store_pdf_bytes(signed_category, signed_prefix, signed_bytes)
    doc_sig.signed_pdf_identifier = signed_identifier

    evidence_bytes = pdf_signature_cabinet.render_cabinet_evidence_pdf(
        document_type=str(doc_sig.document_type),
        signer_label=signer_label,
        signed_at=now,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        session_token=session.token,
        signature_hash=signature_hash,
        document_hash=session.document_hash,
    )
    if evidence_bytes:
        evidence_category = legal_documents_pdf.evidence_category_for(doc_type)
        evidence_prefix = f"{case.id}-{doc_sig.document_type}-audit-{role_value}"
        evidence_identifier = consent_pdf.store_pdf_bytes(evidence_category, evidence_prefix, evidence_bytes)
        doc_sig.evidence_pdf_identifier = evidence_identifier

    if role_value == "parent1":
        doc_sig.parent1_status = "signed"
        doc_sig.parent1_signed_at = now
        doc_sig.parent1_method = "cabinet"
    else:
        doc_sig.parent2_status = "signed"
        doc_sig.parent2_signed_at = now
        doc_sig.parent2_method = "cabinet"

    both_signed = doc_sig.parent1_status == "signed" and doc_sig.parent2_status == "signed"
    if both_signed:
        doc_sig.overall_status = models.DocumentSignatureStatus.completed
        doc_sig.completed_at = now
    else:
        doc_sig.overall_status = models.DocumentSignatureStatus.partially_signed

    db.add(doc_sig)
    db.commit()
    db.refresh(doc_sig)

    if both_signed:
        document_signature_service.ensure_final_document(db, doc_sig)

    session_duration = None
    if session.created_at:
        session_duration = max(0.0, (now - session.created_at).total_seconds())

    event_tracker.track_event(
        "signature_cabinet_completed",
        properties={
            "procedure_id": doc_sig.procedure_case_id,
            "document_type": doc_sig.document_type,
            "parent_role": role_value,
        },
        measurements={"session_duration_seconds": session_duration} if session_duration is not None else None,
    )
    if both_signed:
        start_points = [value for value in (doc_sig.parent1_sent_at, doc_sig.parent2_sent_at) if value]
        total_time_days = None
        if start_points:
            total_time_days = (dt.datetime.utcnow() - min(start_points)).total_seconds() / 86400
        event_tracker.track_event(
            "signature_all_completed",
            properties={
                "procedure_id": doc_sig.procedure_case_id,
                "document_type": doc_sig.document_type,
                "mode": "cabinet",
            },
            measurements={"total_time_days": total_time_days} if total_time_days is not None else None,
        )
        transition_properties = {
            "procedure_id": doc_sig.procedure_case_id,
            "from_step": "signing",
            "to_step": "complete",
            "time_in_previous_step_hours": (total_time_days * 24) if total_time_days is not None else None,
        }
        if doc_sig.procedure_case and doc_sig.procedure_case.patient_id is not None:
            transition_properties["patient_id"] = str(doc_sig.procedure_case.patient_id)
        event_tracker.track_event(
            "patient_journey_transition",
            properties=transition_properties,
        )

    logger.info(
        "Cabinet signature captured document_signature_id=%s parent_role=%s",
        session.document_signature_id,
        session.parent_role,
    )

    return schemas.CabinetSignatureUploadResponse(success=True, message="Signature enregistree")
