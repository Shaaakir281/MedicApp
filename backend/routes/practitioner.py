"""Routes dédiées au tableau de bord praticien."""

from __future__ import annotations

import datetime as dt
from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies.auth import require_practitioner
from services import appointments_service

router = APIRouter(prefix="/practitioner", tags=["practitioner"])


@router.get(
    "/agenda",
    response_model=schemas.PractitionerAgendaResponse,
    status_code=status.HTTP_200_OK,
)
def get_practitioner_agenda(
    start: dt.date | None = Query(None, description="Date de début (YYYY-MM-DD)"),
    end: dt.date | None = Query(None, description="Date de fin (YYYY-MM-DD)"),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerAgendaResponse:
    today = dt.date.today()
    start_date = start or today
    end_date = end or (start_date + dt.timedelta(days=6))
    return appointments_service.get_agenda(db=db, start_date=start_date, end_date=end_date)


@router.get(
    "/stats",
    response_model=schemas.PractitionerStats,
    status_code=status.HTTP_200_OK,
)
def get_practitioner_stats(
    target_date: dt.date | None = Query(None, description="Date de référence (YYYY-MM-DD)"),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerStats:
    day = target_date or dt.date.today()
    return appointments_service.get_stats(db=db, target_date=day)


@router.get(
    "/new-patients",
    response_model=List[schemas.PractitionerNewPatient],
    status_code=status.HTTP_200_OK,
)
def get_new_patients(
    days: int = Query(
        7,
        ge=1,
        le=60,
        description="Periode glissante (en jours) pour les dossiers recents.",
    ),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> List[schemas.PractitionerNewPatient]:
    return appointments_service.get_new_patients(db=db, days=days)


@router.put(
    "/patient/{case_id}",
    response_model=schemas.PractitionerCaseStatus,
    status_code=status.HTTP_200_OK,
)
def update_patient_case(
    case_id: int,
    payload: schemas.PractitionerCaseUpdate,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerCaseStatus:
    return appointments_service.update_case(db=db, case_id=case_id, updates=payload)


@router.patch(
    "/appointments/{appointment_id}",
    response_model=schemas.PractitionerAppointmentEntry,
    status_code=status.HTTP_200_OK,
)
def reschedule_appointment(
    appointment_id: int,
    payload: schemas.AppointmentRescheduleRequest,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerAppointmentEntry:
    return appointments_service.reschedule_appointment(
        db=db,
        appointment_id=appointment_id,
        payload=payload,
    )


@router.post(
    "/appointments",
    response_model=schemas.PractitionerAppointmentEntry,
    status_code=status.HTTP_201_CREATED,
)
def create_practitioner_appointment(
    payload: schemas.PractitionerAppointmentCreate,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerAppointmentEntry:
    return appointments_service.create_practitioner_appointment(db=db, payload=payload)
