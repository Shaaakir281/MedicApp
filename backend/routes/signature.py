"""Signature start endpoint with legal checklist guard."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from core.config import get_settings
from database import get_db
from dependencies.auth import get_optional_user
from services import consents as consents_service
from services import legal as legal_service

router = APIRouter(prefix="/signature", tags=["signature"])
settings = get_settings()


def _get_appointment_with_case(db: Session, appointment_id: int) -> models.Appointment:
    appointment = (
        db.query(models.Appointment)
        .options(joinedload(models.Appointment.procedure_case))
        .filter(models.Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable.")
    return appointment


@router.post("/start", response_model=schemas.SignatureStartResponse)
def start_signature(
    payload: schemas.SignatureStartPayload,
    request: Request,
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> schemas.SignatureStartResponse:
    session = None
    appointment_id = payload.appointment_id
    signer_role = payload.signer_role
    mode = payload.mode

    if payload.session_code:
        session = legal_service.get_active_session(db, payload.session_code)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session expirée ou invalide.")
        appointment_id = session.appointment_id
        signer_role = session.signer_role
        mode = "cabinet"

    if current_user is None and session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise.")

    appointment = _get_appointment_with_case(db, appointment_id)
    if current_user and current_user.role == models.UserRole.patient and appointment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    if (
        session is None
        and mode == "cabinet"
        and current_user
        and current_user.role == models.UserRole.patient
    ):
        active_session = legal_service.get_active_session_for_appointment(
            db,
            appointment_id=appointment.id,
            signer_role=signer_role,
        )
        if not active_session:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Signature en cabinet non activée par le praticien.",
            )

    if settings.feature_enforce_legal_checklist:
        legal_status = legal_service.compute_status(db, appointment.id)
        if not legal_status.complete:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Checklist incomplète, signature indisponible.",
                    "legal_status": legal_status.model_dump(mode="json"),
                },
            )

    case = appointment.procedure_case
    if not case:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dossier patient introuvable.")

    in_person = mode == "cabinet"
    updated_case = consents_service.initiate_consent(db, case, in_person=in_person)

    link_attr = f"{signer_role.value}_signature_link" if hasattr(signer_role, "value") else f"{signer_role}_signature_link"
    signature_link = getattr(updated_case, link_attr, None)

    if not signature_link:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lien de signature indisponible pour le signataire.",
        )

    logger_payload = {
        "appointment_id": appointment.id,
        "signer_role": signer_role.value if hasattr(signer_role, "value") else signer_role,
        "mode": mode,
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }
    legal_logger = getattr(consents_service, "logger", None)
    if legal_logger:
        legal_logger.info("start_signature guard passed -> %s", logger_payload)

    return schemas.SignatureStartResponse(
        appointment_id=appointment.id,
        signer_role=signer_role,
        signature_link=signature_link,
        yousign_procedure_id=updated_case.yousign_procedure_id,
        status="started",
    )
