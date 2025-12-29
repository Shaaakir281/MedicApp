"""Routes to manage short-lived cabinet tablet sessions."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

import models
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
    settings = get_settings()
    base_url = (settings.frontend_base_url or settings.app_base_url).rstrip("/")
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


@router.get("/patients/today", response_model=list[schemas.CabinetPatientEntry])
def get_cabinet_patients_today(
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> list[schemas.CabinetPatientEntry]:
    today = dt.datetime.utcnow().date()
    appointments = (
        db.query(models.Appointment)
        .options(
            joinedload(models.Appointment.procedure_case).joinedload(
                models.ProcedureCase.document_signatures
            )
        )
        .filter(models.Appointment.date == today)
        .all()
    )

    results: list[schemas.CabinetPatientEntry] = []
    for appt in appointments:
        case = appt.procedure_case
        if not case:
            continue

        docs = {doc.document_type: doc for doc in case.document_signatures or []}

        def _is_completed(doc_type: str) -> bool:
            doc_sig = docs.get(doc_type)
            if not doc_sig:
                return False
            status_value = doc_sig.overall_status
            if hasattr(status_value, "value"):
                status_value = status_value.value
            return str(status_value) == "completed"

        appt_type = appt.appointment_type.value if hasattr(appt.appointment_type, "value") else appt.appointment_type

        results.append(
            schemas.CabinetPatientEntry(
                id=case.id,
                appointment_id=appt.id,
                child_name=case.child_full_name or "",
                appointment_date=appt.date,
                appointment_time=appt.time,
                appointment_type=appt_type,
                authorization_signed=_is_completed("authorization"),
                consent_signed=_is_completed("consent"),
                fees_signed=_is_completed("fees"),
            )
        )

    return results
