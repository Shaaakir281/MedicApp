"""Appointment routes.

These endpoints allow clients to list available appointment slots for a
specified day and to create new appointments. A simple conflict check
prevents double booking of the same date/time.
"""

from __future__ import annotations

import logging
from datetime import date, time as dtime
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import crud
import models
import schemas
from database import get_db
from dependencies.auth import get_current_user
from services.email import send_appointment_confirmation_email
from datetime import datetime


router = APIRouter(prefix="/appointments", tags=["appointments"])


class AppointmentCreateRequest(BaseModel):
    date: date
    time: dtime
    appointment_type: str = Field(default="preconsultation")
    procedure_id: int | None = None


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
    current_user=Depends(get_current_user),
) -> schemas.Appointment:
    """Create a new appointment if the selected slot is free."""
    try:
        appointment = crud.create_appointment(
            db,
            current_user.id,
            payload.date,
            payload.time,
            appointment_type=payload.appointment_type,
            procedure_id=payload.procedure_id,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = status.HTTP_409_CONFLICT if "booked" in message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=message)

    # Send confirmation email (best-effort; log failure)
    try:
        send_appointment_confirmation_email(
            current_user.email,
            appointment.date.isoformat(),
            appointment.time.strftime("%H:%M"),
        )
    except Exception as exc:  # noqa: BLE001
        # Do not fail the request if email sending raises
        logging.getLogger(__name__).exception("Failed to send confirmation email: %s", exc)

    return schemas.Appointment.from_orm(appointment)


@router.delete("/{appointment_id}", response_model=schemas.Message, status_code=status.HTTP_200_OK)
def cancel_appointment(
    appointment_id: int,
    cascade_act: bool = Query(True, description="Supprimer également l'acte associé le cas échéant."),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.Message:
    """Cancel an appointment owned by the current user. If it is the preconsultation, any linked act is also removed."""
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if appointment is None or appointment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable.")

    linked_act_deleted = False
    # Legal/business rule: if preconsultation is cancelled, linked act cannot be kept.
    if appointment.appointment_type == models.AppointmentType.preconsultation and appointment.procedure_id:
        if not cascade_act:
            logging.getLogger(__name__).info(
                "Ignoring cascade_act=false for preconsultation cancellation (appointment_id=%s).",
                appointment_id,
            )
        deleted_rows = (
            db.query(models.Appointment)
            .filter(
                models.Appointment.procedure_id == appointment.procedure_id,
                models.Appointment.appointment_type == models.AppointmentType.act,
            )
            .delete(synchronize_session=False)
        )
        linked_act_deleted = deleted_rows > 0

    db.delete(appointment)
    db.commit()
    if linked_act_deleted:
        return schemas.Message(detail="Rendez-vous annulé. Le rendez-vous d'acte associé a également été annulé.")
    return schemas.Message(detail="Rendez-vous annulé.")


@router.get("/reminders/{token}", response_model=schemas.Message, status_code=status.HTTP_200_OK)
def acknowledge_reminder(token: str, db: Session = Depends(get_db)) -> schemas.Message:
    """Mark a reminder as opened by the patient."""
    appointment = (
        db.query(models.Appointment)
        .filter(models.Appointment.reminder_token == token)
        .first()
    )
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rappel introuvable.")

    appointment.reminder_opened_at = datetime.utcnow()
    # keep token for trace, but could be nulled if desirable
    db.add(appointment)
    db.commit()
    return schemas.Message(detail="Merci, votre rappel a été confirmé.")
