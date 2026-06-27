from __future__ import annotations

import datetime as dt

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import models
from core import security


def _create_user(
    db: Session,
    email: str,
    role: models.UserRole = models.UserRole.patient,
) -> models.User:
    user = models.User(
        email=email,
        hashed_password=security.hash_password("password123"),
        role=role,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_headers(user: models.User) -> dict[str, str]:
    token = security.create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}


def _create_visio_appointment(
    db: Session,
    patient: models.User,
    *,
    appointment_status: models.AppointmentStatus = models.AppointmentStatus.validated,
    payment_status: models.PaymentStatus = models.PaymentStatus.succeeded,
    access_token: str = "patient-access-token",
) -> models.Appointment:
    starts_at = dt.datetime.utcnow() + dt.timedelta(minutes=5)
    appointment = models.Appointment(
        user_id=patient.id,
        date=starts_at.date(),
        time=starts_at.time().replace(microsecond=0),
        status=appointment_status,
        appointment_type=models.AppointmentType.preconsultation,
        mode=models.AppointmentMode.visio,
    )
    db.add(appointment)
    db.flush()
    db.add(
        models.Payment(
            appointment_id=appointment.id,
            user_id=patient.id,
            amount_cents=5000,
            currency="eur",
            status=payment_status,
            idempotency_key=f"payment-key-{appointment.id}",
        )
    )
    db.add(
        models.TeleconsultationSession(
            appointment_id=appointment.id,
            livekit_room_name=f"precons-{appointment.id}-testroom",
            status=models.TeleconsultationSessionStatus.scheduled,
            access_link_token=access_token,
            access_link_expires_at=starts_at + dt.timedelta(hours=1),
        )
    )
    db.commit()
    db.refresh(appointment)
    return appointment


def test_patient_access_can_be_reused_during_access_window(
    client: TestClient,
    db_session: Session,
) -> None:
    patient = _create_user(db_session, "patient.teleconsult@example.com")
    appointment = _create_visio_appointment(db_session, patient)

    response = client.get(
        f"/teleconsultation/{appointment.id}/access?access_token=patient-access-token",
        headers=_auth_headers(patient),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["appointment_id"] == appointment.id
    assert payload["room_name"] == f"precons-{appointment.id}-testroom"
    assert payload["mock"] is True
    assert payload["token"].startswith("mock_livekit_token:")
    assert payload["expires_in"] == 900

    db_session.expire_all()
    session = (
        db_session.query(models.TeleconsultationSession)
        .filter_by(appointment_id=appointment.id)
        .one()
    )
    assert session.access_link_used_at is not None

    replay = client.get(
        f"/teleconsultation/{appointment.id}/access?access_token=patient-access-token",
        headers=_auth_headers(patient),
    )
    assert replay.status_code == 200
    assert replay.json()["room_name"] == f"precons-{appointment.id}-testroom"


def test_patient_access_rejects_wrong_patient(client: TestClient, db_session: Session) -> None:
    patient = _create_user(db_session, "right.patient@example.com")
    other_patient = _create_user(db_session, "wrong.patient@example.com")
    appointment = _create_visio_appointment(db_session, patient, access_token="wrong-patient-token")

    response = client.get(
        f"/teleconsultation/{appointment.id}/access?access_token=wrong-patient-token",
        headers=_auth_headers(other_patient),
    )

    assert response.status_code == 403


def test_patient_access_requires_validated_payment(client: TestClient, db_session: Session) -> None:
    patient = _create_user(db_session, "unpaid.patient@example.com")
    appointment = _create_visio_appointment(
        db_session,
        patient,
        appointment_status=models.AppointmentStatus.awaiting_payment,
        payment_status=models.PaymentStatus.requires_payment,
        access_token="unpaid-token",
    )

    response = client.get(
        f"/teleconsultation/{appointment.id}/access?access_token=unpaid-token",
        headers=_auth_headers(patient),
    )

    assert response.status_code == 403


def test_practitioner_can_get_room_token(client: TestClient, db_session: Session) -> None:
    patient = _create_user(db_session, "visio.patient@example.com")
    practitioner = _create_user(
        db_session,
        "doctor.teleconsult@example.com",
        role=models.UserRole.praticien,
    )
    appointment = _create_visio_appointment(
        db_session,
        patient,
        access_token="practitioner-test-token",
    )

    response = client.get(
        f"/teleconsultation/{appointment.id}/token",
        headers=_auth_headers(practitioner),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["appointment_id"] == appointment.id
    assert payload["room_name"] == f"precons-{appointment.id}-testroom"
    assert payload["mock"] is True
    assert "practitioner-" in payload["token"]

    db_session.expire_all()
    session = (
        db_session.query(models.TeleconsultationSession)
        .filter_by(appointment_id=appointment.id)
        .one()
    )
    assert session.access_link_used_at is None
