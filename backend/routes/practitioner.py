"""Routes dédiées au tableau de bord praticien."""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from typing import Dict, Iterable, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from database import get_db
from dependencies.auth import require_practitioner

router = APIRouter(prefix="/practitioner", tags=["practitioner"])


def _date_range(start: dt.date, end: dt.date) -> Iterable[dt.date]:
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += dt.timedelta(days=1)


def _compute_case_status(case: models.ProcedureCase) -> schemas.PractitionerCaseStatus:
    appointments = case.appointments or []
    has_preconsultation = any(
        appt.appointment_type == models.AppointmentType.preconsultation for appt in appointments
    )
    has_act = any(
        appt.appointment_type == models.AppointmentType.act for appt in appointments
    )

    has_checklist = bool(case.checklist_pdf_path)
    has_consent = bool(case.consent_pdf_path)
    has_ordonnance = bool(case.ordonnance_pdf_path)

    missing: List[str] = []
    if not case.parental_authority_ack:
        missing.append("Autorité parentale")
    if not has_preconsultation:
        missing.append("Pré‑consultation")
    if not has_act:
        missing.append("Acte planifié")
    if not has_checklist:
        missing.append("Checklist")
    if not has_consent:
        missing.append("Consentement")
    if not has_ordonnance:
        missing.append("Ordonnance")

    notes = case.notes or None
    needs_follow_up = bool(missing)
    if notes and "relance" in notes.lower():
        needs_follow_up = True

    return schemas.PractitionerCaseStatus(
        case_id=case.id,
        child_birthdate=case.child_birthdate,
        parental_authority_ack=case.parental_authority_ack,
        has_checklist=has_checklist,
        has_consent=has_consent,
        has_ordonnance=has_ordonnance,
        has_preconsultation=has_preconsultation,
        has_act_planned=has_act,
        notes=notes,
        missing_items=missing,
        needs_follow_up=needs_follow_up,
    )


def _appointment_entry(
    appointment: models.Appointment,
    patient: models.User,
    case: models.ProcedureCase,
    case_status: schemas.PractitionerCaseStatus,
) -> schemas.PractitionerAppointmentEntry:
    return schemas.PractitionerAppointmentEntry(
        appointment_id=appointment.id,
        date=appointment.date,
        time=appointment.time,
        appointment_type=appointment.appointment_type.value,
        status=appointment.status.value,
        mode=appointment.mode.value if appointment.mode else None,
        patient=schemas.PractitionerPatientSummary(
            id=patient.id,
            email=patient.email,
            child_full_name=case.child_full_name,
        ),
        procedure=case_status,
    )


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

    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La date de fin doit être postérieure ou égale à la date de début.",
        )

    appointments = (
        db.query(models.Appointment)
        .options(
            joinedload(models.Appointment.user),
            joinedload(models.Appointment.procedure_case).joinedload(models.ProcedureCase.appointments),
        )
        .filter(
            models.Appointment.date >= start_date,
            models.Appointment.date <= end_date,
        )
        .order_by(models.Appointment.date.asc(), models.Appointment.time.asc())
        .all()
    )

    case_cache: Dict[int, schemas.PractitionerCaseStatus] = {}
    agenda_map: Dict[dt.date, List[schemas.PractitionerAppointmentEntry]] = defaultdict(list)

    for appointment in appointments:
        case = appointment.procedure_case
        patient = appointment.user
        if case is None or patient is None:
            continue

        if case.id not in case_cache:
            case_cache[case.id] = _compute_case_status(case)
        entry = _appointment_entry(appointment, patient, case, case_cache[case.id])
        agenda_map[appointment.date].append(entry)

    days_payload = [
        schemas.PractitionerAgendaDay(
            date=day,
            appointments=agenda_map.get(day, []),
        )
        for day in _date_range(start_date, end_date)
    ]

    return schemas.PractitionerAgendaResponse(
        start=start_date,
        end=end_date,
        days=days_payload,
    )


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
    start_dt = dt.datetime.combine(day, dt.time.min)
    end_dt = dt.datetime.combine(day, dt.time.max)

    day_appointments = (
        db.query(models.Appointment)
        .options(
            joinedload(models.Appointment.procedure_case).joinedload(models.ProcedureCase.appointments),
        )
        .filter(models.Appointment.date == day)
        .order_by(models.Appointment.time.asc())
        .all()
    )

    case_cache: Dict[int, schemas.PractitionerCaseStatus] = {}
    follow_ups = 0
    pending_consents = 0

    for appointment in day_appointments:
        case = appointment.procedure_case
        if case is None:
            continue
        if case.id not in case_cache:
            case_cache[case.id] = _compute_case_status(case)
        status_case = case_cache[case.id]
        if status_case.needs_follow_up:
            follow_ups += 1
        if not status_case.has_consent:
            pending_consents += 1

    bookings_created = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.created_at >= start_dt,
            models.Appointment.created_at <= end_dt,
        )
        .count()
    )

    new_patients = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.patient)
        .filter(
            models.User.created_at >= start_dt,
            models.User.created_at <= end_dt,
        )
        .count()
    )

    return schemas.PractitionerStats(
        date=day,
        total_appointments=len(day_appointments),
        bookings_created=bookings_created,
        new_patients=new_patients,
        follow_ups_required=follow_ups,
        pending_consents=pending_consents,
    )
