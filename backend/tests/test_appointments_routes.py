from __future__ import annotations

from datetime import date, datetime, timedelta, time

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import crud
import models
from core import security
from core.config import reset_settings_cache
from domain.legal_documents.types import DocumentType, SignerRole


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
        child_full_name="Kid Test",
        child_birthdate=date(2020, 1, 1),
        parent1_name="Parent One",
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def _login_headers(client: TestClient, email: str, password: str = "password123") -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dev_test_slots_build_near_future_slots() -> None:
    now = datetime(2026, 6, 27, 20, 38, 30)

    slots = crud._build_dev_test_slots(now.date(), now=now)

    assert slots == ["20:45", "20:50", "20:55", "21:00", "21:05", "21:10"]


def test_dev_test_slots_are_disabled_in_production(monkeypatch) -> None:
    monkeypatch.setenv("DEV_TEST_SLOTS_ENABLED", "true")
    monkeypatch.setenv("ENVIRONMENT", "production")
    reset_settings_cache()

    try:
        assert crud._dev_test_slots_enabled() is False
    finally:
        reset_settings_cache()


def test_cancel_act_appointment_deletes_fk_dependencies(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "cancel.act@example.com")
    case = _create_case(db_session, user.id)

    act_appt = models.Appointment(
        user_id=user.id,
        date=date.today() + timedelta(days=30),
        time=time(10, 0),
        appointment_type=models.AppointmentType.act,
        procedure_id=case.id,
    )
    db_session.add(act_appt)
    db_session.commit()
    db_session.refresh(act_appt)

    db_session.add(
        models.LegalAcknowledgement(
            appointment_id=act_appt.id,
            document_type=DocumentType.INFORMED_CONSENT,
            signer_role=SignerRole.parent1,
            case_key="case_1",
            case_text="Lu et approuve",
            catalog_version="v1",
        )
    )
    db_session.add(
        models.SignatureCabinetSession(
            appointment_id=act_appt.id,
            signer_role=SignerRole.parent1,
            token_hash=f"tok-{act_appt.id}",
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
    )
    db_session.commit()

    headers = _login_headers(client, user.email)
    response = client.delete(f"/appointments/{act_appt.id}?cascade_act=false", headers=headers)

    assert response.status_code == 200
    assert db_session.query(models.Appointment).filter(models.Appointment.id == act_appt.id).first() is None
    assert (
        db_session.query(models.LegalAcknowledgement)
        .filter(models.LegalAcknowledgement.appointment_id == act_appt.id)
        .count()
        == 0
    )
    assert (
        db_session.query(models.SignatureCabinetSession)
        .filter(models.SignatureCabinetSession.appointment_id == act_appt.id)
        .count()
        == 0
    )


def test_cancel_preconsultation_cascades_act_with_fk_dependencies(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, "cancel.pre@example.com")
    case = _create_case(db_session, user.id)

    pre_appt = models.Appointment(
        user_id=user.id,
        date=date.today() + timedelta(days=10),
        time=time(9, 0),
        appointment_type=models.AppointmentType.preconsultation,
        procedure_id=case.id,
    )
    act_appt = models.Appointment(
        user_id=user.id,
        date=date.today() + timedelta(days=30),
        time=time(11, 0),
        appointment_type=models.AppointmentType.act,
        procedure_id=case.id,
    )
    db_session.add_all([pre_appt, act_appt])
    db_session.commit()
    db_session.refresh(pre_appt)
    db_session.refresh(act_appt)

    db_session.add(
        models.LegalAcknowledgement(
            appointment_id=act_appt.id,
            document_type=DocumentType.SURGICAL_AUTHORIZATION_MINOR,
            signer_role=SignerRole.parent2,
            case_key="case_2",
            case_text="Lu et approuve",
            catalog_version="v1",
        )
    )
    db_session.add(
        models.SignatureCabinetSession(
            appointment_id=act_appt.id,
            signer_role=SignerRole.parent2,
            token_hash=f"tok-{act_appt.id}-2",
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
    )
    db_session.commit()

    headers = _login_headers(client, user.email)
    response = client.delete(f"/appointments/{pre_appt.id}?cascade_act=true", headers=headers)

    assert response.status_code == 200
    assert "acte" in response.json()["detail"].lower()
    assert db_session.query(models.Appointment).filter(models.Appointment.id == pre_appt.id).first() is None
    assert db_session.query(models.Appointment).filter(models.Appointment.id == act_appt.id).first() is None
    assert (
        db_session.query(models.LegalAcknowledgement)
        .filter(models.LegalAcknowledgement.appointment_id == act_appt.id)
        .count()
        == 0
    )
    assert (
        db_session.query(models.SignatureCabinetSession)
        .filter(models.SignatureCabinetSession.appointment_id == act_appt.id)
        .count()
        == 0
    )
