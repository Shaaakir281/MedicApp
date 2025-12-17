"""Patient dashboard read-model endpoint (read-only)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas_patient_dashboard as dashboard_schemas
from database import get_db
from dependencies.auth import get_optional_user
from services import patient_dashboard as dashboard_service

router = APIRouter(prefix="/patient-dashboard", tags=["patient-dashboard"])


@router.get("/{appointment_id}", response_model=dashboard_schemas.PatientDashboard)
def get_patient_dashboard(
    appointment_id: int,
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> dashboard_schemas.PatientDashboard:
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise.")

    appointment = dashboard_service.get_appointment(db, appointment_id)
    if current_user.role == models.UserRole.patient and appointment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")

    return dashboard_service.build_dashboard(db, appointment)
