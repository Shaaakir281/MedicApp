"""Routes to manage short-lived cabinet tablet sessions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import schemas
from core.config import get_settings
from database import get_db
from dependencies.auth import require_practitioner
from services import legal as legal_service

router = APIRouter(prefix="/cabinet-sessions", tags=["cabinet-sessions"])


@router.post("", response_model=schemas.CabinetSessionResponse, status_code=status.HTTP_201_CREATED)
def create_cabinet_session(
    payload: schemas.CabinetSessionCreate,
    current_user=Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.CabinetSessionResponse:
    session, code = legal_service.create_cabinet_session(
        db,
        appointment_id=payload.appointment_id,
        signer_role=payload.signer_role,
        practitioner_id=current_user.id,
    )
    base_url = get_settings().app_base_url.rstrip("/")
    tablet_url = f"{base_url}/tablet/{code}"
    return schemas.CabinetSessionResponse(
        appointment_id=session.appointment_id,
        signer_role=session.signer_role,
        session_code=code,
        tablet_url=tablet_url,
        expires_at=session.expires_at,
        status=session.status.value if hasattr(session.status, "value") else str(session.status),
    )


@router.get("/{session_code}")
def get_cabinet_session(session_code: str, db: Session = Depends(get_db)) -> dict:
    session = legal_service.get_active_session(db, session_code)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session expirée ou invalide.")
    appointment = session.appointment
    case = getattr(appointment, "procedure_case", None)
    legal_status = legal_service.compute_status(db, appointment.id)
    return {
        "appointment_id": appointment.id,
        "signer_role": session.signer_role.value if hasattr(session.signer_role, "value") else session.signer_role,
        "expires_at": session.expires_at,
        "status": session.status.value if hasattr(session.status, "value") else str(session.status),
        "case_id": case.id if case else None,
        "child_full_name": case.child_full_name if case else None,
        "legal_status": legal_status,
    }
