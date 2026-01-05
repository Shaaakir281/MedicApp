from __future__ import annotations

from typing import Any, Dict

import pytest

try:
    from fastapi.testclient import TestClient
except RuntimeError as exc:  # pragma: no cover - exercised when httpx is missing
    pytest.skip(f"fastapi TestClient unavailable: {exc}", allow_module_level=True)
from sqlalchemy.orm import Session

import models
from core import security


def _create_user(
    db: Session,
    *,
    email: str = "user@example.com",
    password: str = "password123",
    email_verified: bool = True,
    role: models.UserRole = models.UserRole.patient,
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


def test_register_creates_user_and_sends_email(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent_emails: list[Dict[str, Any]] = []

    def fake_send_email(recipient: str, verification_link: str) -> None:
        sent_emails.append({"recipient": recipient, "link": verification_link})

    monkeypatch.setattr("routes.auth.send_verification_email", fake_send_email)

    payload = {
        "email": "new.user@example.com",
        "password": "StrongPass1!",
        "password_confirm": "StrongPass1!",
        "role": models.UserRole.patient.value,
    }
    response = client.post("/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert sent_emails and sent_emails[0]["recipient"] == payload["email"]


def test_login_requires_verified_email(client: TestClient, db_session: Session) -> None:
    _create_user(db_session, email="unverified@example.com", email_verified=False)

    response = client.post(
        "/auth/login",
        json={"email": "unverified@example.com", "password": "password123"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Email address not verified"


def test_login_and_refresh_success(client: TestClient, db_session: Session) -> None:
    _create_user(db_session, email="practitioner@example.com")

    response = client.post(
        "/auth/login",
        json={"email": "practitioner@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    tokens = response.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    refresh_response = client.post(
        "/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )

    assert refresh_response.status_code == 200
    new_token = refresh_response.json()
    assert "access_token" in new_token


def test_login_fails_with_invalid_credentials(client: TestClient) -> None:
    response = client.post(
        "/auth/login",
        json={"email": "unknown@example.com", "password": "whatever"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"
