"""Daily job: emit an event when the 15-day reflection period ends."""

from __future__ import annotations

import datetime as dt

from sqlalchemy.orm import Session

import models
from services.event_tracker import get_event_tracker

event_tracker = get_event_tracker()


def run(db: Session, *, target_date: dt.date | None = None) -> dict[str, int | str]:
    """Track `reflection_period_ended` for cases eligible today."""
    today = target_date or dt.date.today()
    cases = (
        db.query(models.ProcedureCase)
        .filter(models.ProcedureCase.preconsultation_date.isnot(None))
        .all()
    )

    matching_cases = 0
    emitted_events = 0

    for case in cases:
        if case.preconsultation_date is None:
            continue

        available_date = case.preconsultation_date + dt.timedelta(days=15)
        if available_date != today:
            continue

        matching_cases += 1
        event_tracker.track_event(
            "reflection_period_ended",
            properties={
                "procedure_id": case.id,
                "available_date": available_date.isoformat(),
                "days_since_preconsultation": 15,
            },
        )
        event_tracker.track_event(
            "patient_journey_transition",
            properties={
                "procedure_id": case.id,
                "patient_id": str(case.patient_id) if case.patient_id is not None else None,
                "from_step": "waiting",
                "to_step": "booked",
                "time_in_previous_step_hours": 15 * 24,
            },
        )
        emitted_events += 1

    return {
        "target_date": today.isoformat(),
        "cases_checked": len(cases),
        "matching_cases": matching_cases,
        "events_emitted": emitted_events,
    }
