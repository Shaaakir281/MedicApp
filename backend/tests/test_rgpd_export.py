from __future__ import annotations

import pytest

try:
    from fastapi.testclient import TestClient
except RuntimeError as exc:  # pragma: no cover
    pytest.skip(f"fastapi TestClient unavailable: {exc}", allow_module_level=True)
from sqlalchemy.orm import Session

import models
from core import security


def _create_user(
    db: Session,
    *,
    email: str = "patient@example.com",
    password: str = "password123",
    role: models.UserRole = models.UserRole.patient,
    email_verified: bool = True,
) -> models.User:
    user = models.User(
        email=email,
        hashed_password=security.hash_password(password),
        role=role,
        email_verified=email_verified,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_headers(user: models.User) -> dict[str, str]:
    token = security.create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}


def test_patient_export_returns_payload(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="rgpd@example.com")

    response = client.get("/patient/me/export", headers=_auth_headers(user))

    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "rgpd@example.com"
    assert "procedure_cases" in data
    assert "appointments" in data
    assert "dossier" in data


def test_patient_export_forbidden_for_practitioner(client: TestClient, db_session: Session) -> None:
    practitioner = _create_user(
        db_session,
        email="practitioner@example.com",
        role=models.UserRole.praticien,
    )

    response = client.get("/patient/me/export", headers=_auth_headers(practitioner))

    assert response.status_code == 403


def test_patient_delete_requires_password(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="delete@example.com", password="Password123!")
    response = client.post(
        "/patient/me/delete",
        json={"password": "Password123!"},
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["deleted_email"].startswith("deleted+")


def test_patient_delete_rejects_bad_password(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="delete2@example.com", password="Password123!")
    response = client.post(
        "/patient/me/delete",
        json={"password": "wrong"},
        headers=_auth_headers(user),
    )

    assert response.status_code == 401


def test_patient_rectify_updates_email(client: TestClient, db_session: Session) -> None:
    user = _create_user(db_session, email="rectify@example.com", password="Password123!")
    response = client.put(
        "/patient/me/rectify",
        json={"email": "new.email@example.com"},
        headers=_auth_headers(user),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "new.email@example.com"
