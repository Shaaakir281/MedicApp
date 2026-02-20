"""Appointment routes.

These endpoints allow clients to list available appointment slots for a
specified day and to create new appointments. A simple conflict check
prevents double booking of the same date/time.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time as dtime
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
from services.event_tracker import get_event_tracker


router = APIRouter(prefix="/appointments", tags=["appointments"])
event_tracker = get_event_tracker()
_DEFAULT_DAILY_SLOTS = 10


class AppointmentCreateRequest(BaseModel):
    date: date
    time: dtime
    appointment_type: str = Field(default="preconsultation")
    procedure_id: int | None = None


def _track_slot_utilization(db: Session, slot_date: date) -> None:
    slots_booked = (
        db.query(models.Appointment)
        .filter(models.Appointment.date == slot_date)
        .count()
    )
    utilization = (slots_booked / _DEFAULT_DAILY_SLOTS) if _DEFAULT_DAILY_SLOTS else 0
    event_tracker.track_event(
        "appointment_slot_utilization",
        properties={"slot_date": slot_date.isoformat()},
        measurements={
            "slots_booked": slots_booked,
            "slots_total": _DEFAULT_DAILY_SLOTS,
            "utilization_rate": utilization,
        },
    )


def _delete_appointment_dependencies(db: Session, appointment_ids: List[int]) -> None:
    """Delete rows that FK-reference appointments before deleting appointments."""
    if not appointment_ids:
        return

    (
        db.query(models.LegalAcknowledgement)
        .filter(models.LegalAcknowledgement.appointment_id.in_(appointment_ids))
        .delete(synchronize_session=False)
    )
    (
        db.query(models.SignatureCabinetSession)
        .filter(models.SignatureCabinetSession.appointment_id.in_(appointment_ids))
        .delete(synchronize_session=False)
    )


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

    appointment_type = (
        appointment.appointment_type.value
        if hasattr(appointment.appointment_type, "value")
        else appointment.appointment_type
    )
    days_until_appointment = (appointment.date - date.today()).days
    event_tracker.track_patient_event(
        "appointment_booked",
        current_user.id,
        appointment_type=appointment_type,
        slot_date=appointment.date.isoformat(),
        days_until_appointment=days_until_appointment,
        user_role=getattr(current_user.role, "value", current_user.role),
    )
    journey_from = None
    journey_to = None
    time_in_previous_step_hours = None
    procedure_case = appointment.procedure_case
    if appointment.appointment_type == models.AppointmentType.preconsultation:
        journey_from = "created"
        journey_to = "booked"
        if procedure_case and procedure_case.created_at:
            time_in_previous_step_hours = (
                datetime.utcnow() - procedure_case.created_at
            ).total_seconds() / 3600
    elif appointment.appointment_type == models.AppointmentType.act:
        journey_from = "waiting"
        journey_to = "booked"
        if procedure_case and procedure_case.preconsultation_date:
            preconsultation_dt = datetime.combine(procedure_case.preconsultation_date, dtime.min)
            time_in_previous_step_hours = (
                datetime.utcnow() - preconsultation_dt
            ).total_seconds() / 3600

    if journey_from and journey_to:
        event_tracker.track_patient_event(
            "patient_journey_transition",
            current_user.id,
            procedure_id=appointment.procedure_id,
            from_step=journey_from,
            to_step=journey_to,
            time_in_previous_step_hours=(
                max(0.0, time_in_previous_step_hours)
                if time_in_previous_step_hours is not None
                else None
            ),
        )
    _track_slot_utilization(db, appointment.date)

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
    appointment_type = (
        appointment.appointment_type.value
        if hasattr(appointment.appointment_type, "value")
        else appointment.appointment_type
    )
    days_before_appointment = (appointment.date - date.today()).days
    deleted_dates = {appointment.date}
    appointments_to_delete = [appointment]

    # Legal/business rule: if preconsultation is cancelled, linked act cannot be kept.
    if appointment.appointment_type == models.AppointmentType.preconsultation and appointment.procedure_id:
        if not cascade_act:
            logging.getLogger(__name__).info(
                "Ignoring cascade_act=false for preconsultation cancellation (appointment_id=%s).",
                appointment_id,
            )
        linked_acts = (
            db.query(models.Appointment)
            .filter(
                models.Appointment.procedure_id == appointment.procedure_id,
                models.Appointment.appointment_type == models.AppointmentType.act,
            )
            .all()
        )
        linked_act_deleted = len(linked_acts) > 0
        appointments_to_delete.extend(linked_acts)
        deleted_dates.update(appt.date for appt in linked_acts)

    appointment_ids = [appt.id for appt in appointments_to_delete]
    _delete_appointment_dependencies(db, appointment_ids)
    for appt in appointments_to_delete:
        db.delete(appt)
    db.commit()

    event_tracker.track_patient_event(
        "appointment_cancelled",
        current_user.id,
        appointment_type=appointment_type,
        reason="user_cancelled",
        days_before_appointment=days_before_appointment,
        linked_act_deleted=linked_act_deleted,
    )
    _track_slot_utilization(db, appointment.date)

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
