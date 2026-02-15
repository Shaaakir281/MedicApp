"""Weekly job: detect patient journeys with prolonged inactivity."""

from __future__ import annotations

import datetime as dt

from sqlalchemy.orm import Session

import models
from services.event_tracker import get_event_tracker

event_tracker = get_event_tracker()


def _signature_complete(signature: models.DocumentSignature) -> bool:
    overall = (
        signature.overall_status.value
        if hasattr(signature.overall_status, "value")
        else signature.overall_status
    )
    return overall == models.DocumentSignatureStatus.completed.value or (
        signature.parent1_status == "signed" and signature.parent2_status == "signed"
    )


def _last_step(case: models.ProcedureCase) -> str:
    signatures = list(case.document_signatures or [])
    if signatures and all(_signature_complete(signature) for signature in signatures):
        return "complete"
    if signatures:
        return "signing"

    appointments = list(case.appointments or [])
    has_preconsultation = any(
        appointment.appointment_type == models.AppointmentType.preconsultation
        for appointment in appointments
    )
    if has_preconsultation:
        if case.preconsultation_date:
            available_date = case.preconsultation_date + dt.timedelta(days=15)
            if dt.date.today() < available_date:
                return "waiting"
        return "booked"
    return "created"


def run(
    db: Session,
    *,
    inactivity_days: int = 30,
    detection_window_days: int = 7,
    now: dt.datetime | None = None,
) -> dict[str, int]:
    """Track `patient_journey_abandoned` for stale non-complete journeys.

    `detection_window_days` avoids alerting forever on the same untouched case.
    """
    now_dt = now or dt.datetime.utcnow()
    lower_bound = now_dt - dt.timedelta(days=inactivity_days + detection_window_days)
    upper_bound = now_dt - dt.timedelta(days=inactivity_days)

    cases = (
        db.query(models.ProcedureCase)
        .filter(models.ProcedureCase.updated_at <= upper_bound)
        .filter(models.ProcedureCase.updated_at > lower_bound)
        .all()
    )

    emitted_events = 0
    for case in cases:
        step = _last_step(case)
        if step == "complete":
            continue

        days_since_activity = int((now_dt - case.updated_at).total_seconds() // 86400)
        event_tracker.track_event(
            "patient_journey_abandoned",
            properties={
                "procedure_id": case.id,
                "last_step": step,
                "days_since_activity": days_since_activity,
            },
        )
        emitted_events += 1

    return {
        "cases_checked": len(cases),
        "events_emitted": emitted_events,
    }

