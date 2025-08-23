"""Appointment routes.

These endpoints allow clients to list available appointment slots for a
specified day and to create new appointments. A simple conflict check
prevents double booking of the same date/time.
"""

from __future__ import annotations

from datetime import date, datetime, time as dtime
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db


router = APIRouter(prefix="/appointments", tags=["appointments"])


class AppointmentCreateRequest(BaseModel):
    user_id: int
    date: date
    time: dtime


@router.get("/slots", response_model=Dict[str, List[str]])
def get_available_slots(
    *, db: Session = Depends(get_db), date: date = Query(..., description="YYYY-MM-DD")
) -> Dict[str, List[str]]:
    """List available appointment slots on a given date."""
    slots = crud.get_available_slots(db, date)
    return {"slots": slots}


@router.post("", response_model=schemas.Appointment, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreateRequest,
    db: Session = Depends(get_db),
) -> schemas.Appointment:
    """Create a new appointment if the selected slot is free."""
    try:
        appointment = crud.create_appointment(db, payload.user_id, payload.date, payload.time)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return schemas.Appointment.from_orm(appointment)