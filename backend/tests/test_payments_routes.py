from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import models
from core import security


def _create_user(db: Session, email: str, password: str = "password123") -> models.User:
    user = models.User(
        email=email,
        hashed_password=security.hash_password(password),
        role=models.UserRole.patient,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_case(db: Session, user_id: int) -> models.ProcedureCase:
    case = models.ProcedureCase(
        patient_id=user_id,
        procedure_type=models.ProcedureType.circumcision,
        child_full_name="Kid Payment",
        child_birthdate=date(2020, 1, 1),
        parent1_name="Parent One",
        parental_authority_ack=True,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def _auth_headers(user: models.User) -> dict[str, str]:
    token = security.create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}


def test_create_preconsultation_checkout_uses_local_mock_without_stripe_keys(
    client: TestClient,
    db_session: Session,
) -> None:
    user = _create_user(db_session, "checkout.patient@example.com")
    case = _create_case(db_session, user.id)
    headers = _auth_headers(user)
    slot_date = date.today() + timedelta(days=7)

    response = client.post(
        "/appointments/preconsultation",
        headers=headers,
        json={
            "date": slot_date.isoformat(),
            "time": "09:00:00",
            "procedure_id": case.id,
            "mode": "visio",
            "idempotency_key": "test-checkout-key",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["mock"] is True
    assert payload["amount_cents"] == 5000
    assert payload["currency"] == "eur"
    assert payload["payment_status"] == models.PaymentStatus.requires_payment.value
    assert "payment=mock" in payload["checkout_url"]
    assert payload["appointment"]["status"] == models.AppointmentStatus.awaiting_payment.value
    assert payload["appointment"]["mode"] == models.AppointmentMode.visio.value

    appointment = db_session.query(models.Appointment).filter_by(id=payload["appointment"]["id"]).one()
    payment = db_session.query(models.Payment).filter_by(id=payload["payment_id"]).one()
    assert appointment.status == models.AppointmentStatus.awaiting_payment
    assert payment.appointment_id == appointment.id
    assert payment.stripe_checkout_session_id.startswith("mock_cs_preconsult_")
    assert payment.checkout_url == payload["checkout_url"]

    retry = client.post(
        "/appointments/preconsultation",
        headers=headers,
        json={
            "date": slot_date.isoformat(),
            "time": "09:00:00",
            "procedure_id": case.id,
            "mode": "visio",
            "idempotency_key": "test-checkout-key",
        },
    )

    assert retry.status_code == 201
    assert retry.json()["payment_id"] == payment.id
    assert retry.json()["appointment"]["id"] == appointment.id
