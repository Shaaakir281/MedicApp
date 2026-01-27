"""Unit tests for the practitioner appointment service layer."""

from __future__ import annotations

import datetime as dt

import pytest
from fastapi import HTTPException, status

import models
import schemas
from services import appointments_service


@pytest.fixture()
def patient_case(db_session):
    """Create a patient user and associated procedure case."""

    patient = models.User(
        email="patient@example.com",
        hashed_password="hashed",
        role=models.UserRole.patient,
        email_verified=True,
    )
    db_session.add(patient)
    db_session.flush()

    case = models.ProcedureCase(
        patient_id=patient.id,
        child_full_name="Baby Doe",
        child_birthdate=dt.date(2023, 1, 1),
        parent1_name="Parent One",
        parental_authority_ack=True,
    )
    db_session.add(case)
    db_session.commit()
    db_session.refresh(patient)
    db_session.refresh(case)
    return patient, case


def test_create_practitioner_appointment_returns_entry(db_session, patient_case):
    patient, case = patient_case
    payload = schemas.PractitionerAppointmentCreate(
        case_id=case.id,
        appointment_type=models.AppointmentType.general.value,
        date=dt.date.today() + dt.timedelta(days=1),
        time=dt.time(9, 0),
        mode=models.AppointmentMode.visio.value,
    )

    entry = appointments_service.create_practitioner_appointment(db_session, payload)

    assert entry.patient.id == patient.id
    assert entry.procedure.case_id == case.id
    stored = db_session.query(models.Appointment).one()
    assert stored.mode == models.AppointmentMode.visio


def test_reschedule_appointment_detects_conflict(db_session, patient_case):
    patient, case = patient_case
    day = dt.date.today() + dt.timedelta(days=2)

    appt_one = models.Appointment(
        user_id=patient.id,
        procedure_case=case,
        date=day,
        time=dt.time(9, 0),
    )
    appt_two = models.Appointment(
        user_id=patient.id,
        procedure_case=case,
        date=day,
        time=dt.time(11, 0),
    )
    db_session.add_all([appt_one, appt_two])
    db_session.commit()

    payload = schemas.AppointmentRescheduleRequest(date=day, time=dt.time(9, 0))

    with pytest.raises(HTTPException) as exc:
        appointments_service.reschedule_appointment(db_session, appt_two.id, payload)
    assert exc.value.status_code == status.HTTP_409_CONFLICT


def test_get_stats_counts_followups_and_documents(db_session, patient_case):
    patient, case = patient_case
    case.parental_authority_ack = False
    db_session.add(case)
    db_session.commit()

    today = dt.date.today()
    appointment = models.Appointment(
        user_id=patient.id,
        procedure_case=case,
        date=today,
        time=dt.time(10, 0),
    )
    db_session.add(appointment)
    db_session.commit()

    stats = appointments_service.get_stats(db_session, target_date=today)

    assert stats.total_appointments == 1
    assert stats.bookings_created == 1
    assert stats.new_patients == 1
    assert stats.new_patients_week == 1
    assert stats.follow_ups_required == 1
    assert stats.pending_documents == 1


def test_get_agenda_validates_date_range(db_session):
    today = dt.date.today()
    with pytest.raises(HTTPException) as exc:
        appointments_service.get_agenda(
            db_session,
            start_date=today,
            end_date=today - dt.timedelta(days=1),
        )
    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
