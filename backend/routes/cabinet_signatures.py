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
from services import consent_pdf, legal_documents_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cabinet-signatures", tags=["cabinet-signatures"])

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

    db.commit()

    logger.info(
        "Cabinet signature captured document_signature_id=%s parent_role=%s",
        session.document_signature_id,
        session.parent_role,
    )

    return schemas.CabinetSignatureUploadResponse(success=True, message="Signature enregistree")
