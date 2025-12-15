"""Routes for legal acknowledgements and checklist status."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies.auth import get_optional_user
from services import legal as legal_service

router = APIRouter(prefix="/legal", tags=["legal"])


def _ensure_access(db: Session, appointment_id: int, user: models.User | None) -> models.Appointment:
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable.")
    if user and user.role == models.UserRole.patient and appointment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    return appointment


def _resolve_appointment(
    db: Session,
    *,
    appointment_id: int | None,
    session_code: str | None,
    user: models.User | None,
) -> tuple[models.Appointment, models.SignatureCabinetSession | None]:
    session = None
    if session_code:
        session = legal_service.get_active_session(db, session_code)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session expirée ou invalide.")
        appointment_id = session.appointment_id
    elif user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise.")
    if appointment_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="appointment_id requis.")
    appointment = _ensure_access(db, appointment_id, user)
    return appointment, session


@router.get("/catalog", response_model=schemas.LegalCatalog)
def get_catalog(
    appointment_id: int | None = Query(default=None),
    session_code: str | None = Query(default=None),
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> schemas.LegalCatalog:
    _resolve_appointment(db, appointment_id=appointment_id, session_code=session_code, user=current_user)
    return legal_service.build_catalog()


@router.get("/status", response_model=schemas.LegalStatusResponse)
def get_status(
    appointment_id: int | None = Query(default=None),
    session_code: str | None = Query(default=None),
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> schemas.LegalStatusResponse:
    appointment, session = _resolve_appointment(db, appointment_id=appointment_id, session_code=session_code, user=current_user)
    return legal_service.compute_status(db, appointment.id)


@router.post("/acknowledge", response_model=schemas.LegalStatusResponse)
def acknowledge_case(
    payload: schemas.LegalAcknowledgeRequest,
    request: Request,
    session_code: str | None = Query(default=None),
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> schemas.LegalStatusResponse:
    appointment, session = _resolve_appointment(
        db,
        appointment_id=payload.appointment_id,
        session_code=session_code,
        user=current_user,
    )
    signer_role = session.signer_role if session else payload.signer_role
    source = "cabinet" if session else payload.source
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    ack_payload = schemas.LegalAcknowledgeRequest(
        appointment_id=appointment.id,
        signer_role=signer_role,
        document_type=payload.document_type,
        case_key=payload.case_key,
        catalog_version=payload.catalog_version,
        source=source,
    )
    legal_service.acknowledge_case(db, ack_payload, ip=ip, user_agent=user_agent)
    return legal_service.compute_status(db, appointment.id)


@router.post("/acknowledge/bulk", response_model=schemas.LegalStatusResponse)
def acknowledge_bulk(
    payload: schemas.LegalAcknowledgeBulkInput,
    request: Request,
    session_code: str | None = Query(default=None),
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> schemas.LegalStatusResponse:
    appointment, session = _resolve_appointment(
        db,
        appointment_id=payload.appointment_id,
        session_code=session_code,
        user=current_user,
    )
    source = "cabinet" if session else payload.source
    signer_role = session.signer_role if session else payload.signer_role
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    bulk_payload = schemas.LegalAcknowledgeBulkInput(
        appointment_id=appointment.id,
        signer_role=signer_role,
        acknowledgements=payload.acknowledgements,
        source=source,
        catalog_version=payload.catalog_version,
    )
    legal_service.acknowledge_bulk(db, bulk_payload, ip=ip, user_agent=user_agent)
    return legal_service.compute_status(db, appointment.id)
