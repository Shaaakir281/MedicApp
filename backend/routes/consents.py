"""Routes for consent signature workflow (Yousign + Twilio)."""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict

import json
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from dependencies.auth import require_practitioner
from services import appointments_service
from services.consents import (
    compute_signature_open_at,
    initiate_consent,
    remind_pending,
    update_signature_status,
)

router = APIRouter(prefix="/consents", tags=["consents"])


def _get_case_or_404(db: Session, case_id: int) -> Any:
    case = crud.get_procedure_case_by_id(db, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable.")
    return case


@router.get("/procedures/{case_id}/status", response_model=schemas.PractitionerCaseStatus)
def consent_status(
    case_id: int,
    _: Any = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerCaseStatus:
    case = _get_case_or_404(db, case_id)
    return appointments_service.compute_case_status(case)


@router.post("/procedures/{case_id}/initiate", response_model=schemas.PractitionerCaseStatus)
def initiate_consent_flow(
    case_id: int,
    _: Any = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerCaseStatus:
    case = _get_case_or_404(db, case_id)
    case = initiate_consent(db, case)
    return appointments_service.compute_case_status(case)


@router.post("/procedures/{case_id}/remind", response_model=schemas.PractitionerCaseStatus)
def remind_consent(
    case_id: int,
    _: Any = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerCaseStatus:
    case = _get_case_or_404(db, case_id)
    case = remind_pending(db, case)
    return appointments_service.compute_case_status(case)


@router.get("/procedures/{case_id}/window")
def consent_window(
    case_id: int,
    _: Any = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    case = _get_case_or_404(db, case_id)
    open_at = compute_signature_open_at(case)
    return {"signature_open_at": open_at}


@router.post("/procedures/{case_id}/face-to-face/{parent_label}")
def consent_face_to_face(
    case_id: int,
    parent_label: str,
    _: Any = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return the signature link for on-site signing (placeholder)."""
    case = _get_case_or_404(db, case_id)
    link = None
    if parent_label == "parent1":
        link = case.parent1_signature_link
    elif parent_label == "parent2":
        link = case.parent2_signature_link
    if not link:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lien de signature indisponible.")
    return {"signature_link": link, "parent": parent_label}


@router.get("/procedures/{case_id}/download")
def consent_download(
    case_id: int,
    _: Any = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Expose signed consent and evidence URLs when available."""
    case = _get_case_or_404(db, case_id)
    return {
        "signed_pdf_url": case.consent_signed_pdf_url,
        "evidence_pdf_url": case.consent_evidence_pdf_url,
        "last_status": case.consent_last_status,
    }


@router.post("/webhooks/yousign")
async def yousign_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Consume Yousign webhook events (v3) and always return 200 to avoid retries."""
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        payload = {}

    data = payload.get("data", {}) if isinstance(payload, dict) else {}
    sr = data.get("signature_request") or {}
    signer = data.get("signer") or {}
    procedure_id = sr.get("id") or payload.get("procedure_id") or payload.get("procedureId")
    signer_id = signer.get("id") or payload.get("signer_id") or payload.get("signerId")
    event_name = payload.get("event_name") or payload.get("eventName")
    signed_file_url = payload.get("signed_file_url") or sr.get("signed_file_url")
    evidence_url = payload.get("evidence_url") or sr.get("evidence_url")

    from models import ProcedureCase  # imported lazily to avoid circular import in autoloaders

    if procedure_id:
        case = db.query(ProcedureCase).filter(ProcedureCase.yousign_procedure_id == procedure_id).first()
    else:
        case = None

    if case:
        parent_label = None
        if signer_id:
            if signer_id == case.parent1_yousign_signer_id:
                parent_label = "parent1"
            elif signer_id == case.parent2_yousign_signer_id:
                parent_label = "parent2"
        if parent_label is None:
            parent_label = "parent1"

        status_value = "signed" if event_name and "signed" in event_name else "ongoing"

        update_signature_status(
            db,
            case,
            parent_label=parent_label,
            status_value=status_value,
            signed_at=dt.datetime.utcnow(),
            method="yousign",
            signed_file_url=signed_file_url,
            evidence_url=evidence_url,
        )

    return {"detail": "ok"}
