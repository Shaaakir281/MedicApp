"""Business logic helpers for practitioner appointment workflows."""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from typing import Dict, Iterable, List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

import crud
import models
import schemas
from core.config import get_settings
from services import download_links

settings = get_settings()


def _date_range(start: dt.date, end: dt.date) -> Iterable[dt.date]:
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += dt.timedelta(days=1)


def compute_case_status(case: models.ProcedureCase) -> schemas.PractitionerCaseStatus:
    """Return the aggregated status payload for a case."""

    appointments = case.appointments or []
    has_preconsultation = any(
        appt.appointment_type == models.AppointmentType.preconsultation for appt in appointments
    )
    act_appointments = [
        appt for appt in appointments if appt.appointment_type == models.AppointmentType.act
    ]
    has_act = bool(act_appointments)

    has_checklist = bool(case.checklist_pdf_path)
    has_consent = bool(case.consent_pdf_path)
    has_ordonnance = bool(case.ordonnance_pdf_path)

    next_act_date = None
    if act_appointments:
        future_dates = [appt.date for appt in act_appointments if appt.date >= dt.date.today()]
        if future_dates:
            next_act_date = min(future_dates)
        else:
            next_act_date = min(appt.date for appt in act_appointments)

    next_preconsultation_date = None
    if has_preconsultation:
        future_pre = [
            appt.date
            for appt in appointments
            if appt.appointment_type == models.AppointmentType.preconsultation
            and appt.date >= dt.date.today()
        ]
        if future_pre:
            next_preconsultation_date = min(future_pre)

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

    base_url = settings.app_base_url.rstrip("/")
    consent_download_url = None
    if case.consent_download_token and case.consent_pdf_path:
        consent_download_url = f"{base_url}/procedures/{case.consent_download_token}/consent.pdf"

    appointments_overview = [
        schemas.PractitionerAppointmentSummary(
            appointment_id=appt.id,
            appointment_type=appt.appointment_type.value,
            date=appt.date,
            time=appt.time,
            status=appt.status.value,
            mode=appt.mode.value if appt.mode else None,
        )
        for appt in sorted(case.appointments, key=lambda a: (a.date, a.time))
    ]

    return schemas.PractitionerCaseStatus(
        case_id=case.id,
        child_birthdate=case.child_birthdate,
        child_full_name=case.child_full_name,
        child_weight_kg=case.child_weight_kg,
        parent1_name=case.parent1_name,
        parent1_email=case.parent1_email,
        parent2_name=case.parent2_name,
        parent2_email=case.parent2_email,
        parental_authority_ack=case.parental_authority_ack,
        has_checklist=has_checklist,
        has_consent=has_consent,
        has_ordonnance=has_ordonnance,
        has_preconsultation=has_preconsultation,
        has_act_planned=has_act,
        next_act_date=next_act_date,
        next_preconsultation_date=next_preconsultation_date,
        notes=notes,
        missing_items=missing,
        needs_follow_up=needs_follow_up,
        appointments_overview=appointments_overview,
        consent_download_url=consent_download_url,
    )


def build_appointment_entry(
    appointment: models.Appointment,
    patient: models.User,
    case: models.ProcedureCase,
    case_status: schemas.PractitionerCaseStatus,
) -> schemas.PractitionerAppointmentEntry:
    """Assemble the full appointment payload returned to the dashboard."""

    prescription = appointment.prescription
    prescription_url = None
    if prescription:
        token = download_links.create_prescription_download_token(
            prescription.id,
            actor="practitioner",
            channel="dashboard",
        )
        prescription_url = f"/prescriptions/access/{token}"

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
        reminder_sent_at=appointment.reminder_sent_at,
        reminder_opened_at=appointment.reminder_opened_at,
        prescription_sent_at=prescription.sent_at if prescription else None,
        prescription_last_download_at=prescription.last_download_at if prescription else None,
        prescription_download_count=prescription.download_count if prescription else 0,
        prescription_items=prescription.items if prescription and prescription.items else None,
        prescription_instructions=prescription.instructions if prescription else None,
        prescription_id=prescription.id if prescription else None,
        prescription_url=prescription_url,
    )


def get_agenda(
    db: Session,
    start_date: dt.date,
    end_date: dt.date,
) -> schemas.PractitionerAgendaResponse:
    """Return the aggregated agenda across the requested date range."""

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
            case_cache[case.id] = compute_case_status(case)
        entry = build_appointment_entry(appointment, patient, case, case_cache[case.id])
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


def get_stats(db: Session, target_date: dt.date) -> schemas.PractitionerStats:
    """Compute practitioner dashboard statistics for a given day."""

    start_dt = dt.datetime.combine(target_date, dt.time.min)
    end_dt = dt.datetime.combine(target_date, dt.time.max)

    day_appointments = (
        db.query(models.Appointment)
        .options(
            joinedload(models.Appointment.procedure_case).joinedload(models.ProcedureCase.appointments),
        )
        .filter(models.Appointment.date == target_date)
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
            case_cache[case.id] = compute_case_status(case)
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

    week_start = start_dt - dt.timedelta(days=6)
    new_patients_week = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.patient)
        .filter(
            models.User.created_at >= week_start,
            models.User.created_at <= end_dt,
        )
        .count()
    )

    return schemas.PractitionerStats(
        date=target_date,
        total_appointments=len(day_appointments),
        bookings_created=bookings_created,
        new_patients=new_patients,
        new_patients_week=new_patients_week,
        follow_ups_required=follow_ups,
        pending_consents=pending_consents,
    )


def get_new_patients(db: Session, days: int) -> List[schemas.PractitionerNewPatient]:
    """Return the newest cases opened over the sliding window."""

    window_start = dt.datetime.utcnow() - dt.timedelta(days=days - 1)

    recent_cases = (
        db.query(models.ProcedureCase)
        .options(
            joinedload(models.ProcedureCase.patient),
            joinedload(models.ProcedureCase.appointments).joinedload(models.Appointment.prescription),
        )
        .filter(models.ProcedureCase.created_at >= window_start)
        .order_by(models.ProcedureCase.created_at.desc())
        .limit(100)
        .all()
    )

    response: List[schemas.PractitionerNewPatient] = []
    for case in recent_cases:
        patient = case.patient
        if patient is None:
            continue
        status_payload = compute_case_status(case)
        response.append(
            schemas.PractitionerNewPatient(
                case_id=case.id,
                created_at=case.created_at,
                child_full_name=case.child_full_name,
                patient_email=patient.email,
                next_preconsultation_date=status_payload.next_preconsultation_date,
                next_act_date=status_payload.next_act_date,
                procedure=status_payload,
            )
        )
    return response


def update_case(
    db: Session,
    case_id: int,
    payload: schemas.PractitionerCaseUpdate,
) -> schemas.PractitionerCaseStatus:
    """Persist practitioner edits on a case and return the updated status."""

    case = db.query(models.ProcedureCase).filter(models.ProcedureCase.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable.")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune donnée à mettre à jour.",
        )

    if "procedure_type" in updates:
        raw_type = updates.pop("procedure_type")
        if raw_type is not None:
            try:
                case.procedure_type = models.ProcedureType(raw_type)
            except ValueError as exc:  # noqa: BLE001
                raise HTTPException(status_code=400, detail="Type de procédure invalide.") from exc

    for field, value in updates.items():
        if value == "":
            value = None
        setattr(case, field, value)

    db.add(case)
    db.commit()
    db.refresh(case)
    return compute_case_status(case)


def reschedule_appointment(
    db: Session,
    appointment_id: int,
    payload: schemas.AppointmentRescheduleRequest,
) -> schemas.PractitionerAppointmentEntry:
    """Update an appointment with practitioner-provided changes."""

    appointment = (
        db.query(models.Appointment)
        .options(
            joinedload(models.Appointment.user),
            joinedload(models.Appointment.procedure_case).joinedload(models.ProcedureCase.appointments),
            joinedload(models.Appointment.prescription),
        )
        .filter(models.Appointment.id == appointment_id)
        .first()
    )
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable.")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun changement transmis.",
        )

    if "appointment_type" in updates:
        try:
            appointment.appointment_type = models.AppointmentType(updates.pop("appointment_type"))
        except ValueError as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="Type de rendez-vous invalide.") from exc
    if "mode" in updates:
        mode_value = updates.pop("mode")
        if mode_value is None:
            appointment.mode = None
        else:
            try:
                appointment.mode = models.AppointmentMode(mode_value)
            except ValueError as exc:  # noqa: BLE001
                raise HTTPException(status_code=400, detail="Mode de rendez-vous invalide.") from exc
    if "status" in updates:
        try:
            appointment.status = models.AppointmentStatus(updates.pop("status"))
        except ValueError as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="Statut de rendez-vous invalide.") from exc

    if "date" in updates or "time" in updates:
        new_date = updates.get("date", appointment.date)
        new_time = updates.get("time", appointment.time)
        if new_date is not None and new_time is not None:
            if dt.datetime.combine(new_date, new_time) < dt.datetime.utcnow():
                raise HTTPException(
                    status_code=400, detail="Impossible de planifier un rendez-vous dans le passé."
                )
            conflict = (
                db.query(models.Appointment)
                .filter(
                    models.Appointment.date == new_date,
                    models.Appointment.time == new_time,
                    models.Appointment.id != appointment.id,
                )
                .first()
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Le créneau sélectionné est déjà réservé.",
                )

    for field, value in updates.items():
        setattr(appointment, field, value)

    if appointment.appointment_type == models.AppointmentType.act:
        appointment.mode = models.AppointmentMode.presentiel

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    case = appointment.procedure_case
    patient = appointment.user
    if case is None or patient is None:
        raise HTTPException(status_code=400, detail="Le rendez-vous n'est pas relié à un dossier patient.")

    status_payload = compute_case_status(case)
    return build_appointment_entry(appointment, patient, case, status_payload)


def create_practitioner_appointment(
    db: Session,
    payload: schemas.PractitionerAppointmentCreate,
) -> schemas.PractitionerAppointmentEntry:
    """Create a new appointment tied to a case for practitioner use."""

    case = (
        db.query(models.ProcedureCase)
        .options(joinedload(models.ProcedureCase.patient), joinedload(models.ProcedureCase.appointments))
        .filter(models.ProcedureCase.id == payload.case_id)
        .first()
    )
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dossier introuvable.")
    patient = case.patient
    if patient is None:
        raise HTTPException(status_code=400, detail="Le dossier n'est associé à aucun patient.")

    try:
        appointment_type = models.AppointmentType(payload.appointment_type)
    except ValueError as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Type de rendez-vous invalide.") from exc

    mode_value: str | None = payload.mode
    if appointment_type == models.AppointmentType.act:
        mode_value = models.AppointmentMode.presentiel.value
    elif mode_value is not None:
        try:
            models.AppointmentMode(mode_value)
        except ValueError as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="Mode de rendez-vous invalide.") from exc

    try:
        appointment = crud.create_appointment(
            db=db,
            user_id=patient.id,
            date=payload.date,
            time=payload.time,
            appointment_type=appointment_type,
            procedure_id=case.id,
            mode=mode_value,
        )
    except ValueError as exc:
        message = str(exc)
        lowered = message.lower()
        conflict = "deja" in lowered or "déjà" in lowered
        status_code = status.HTTP_409_CONFLICT if conflict else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=message)

    db.refresh(appointment)
    db.refresh(case)

    status_payload = compute_case_status(case)
    return build_appointment_entry(appointment, patient, case, status_payload)


__all__ = [
    "build_appointment_entry",
    "compute_case_status",
    "create_practitioner_appointment",
    "get_agenda",
    "get_new_patients",
    "get_stats",
    "reschedule_appointment",
    "update_case",
]
