from __future__ import annotations

import pytest

try:
    from fastapi.testclient import TestClient
except RuntimeError as exc:  # pragma: no cover
    pytest.skip(f"fastapi TestClient unavailable: {exc}", allow_module_level=True)
from sqlalchemy.orm import Session

import models
from core import security


def _create_user(db: Session, email: str = "patient.procedure@example.com") -> models.User:
    user = models.User(
        email=email,
        hashed_password=security.hash_password("password123"),
        role=models.UserRole.patient,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_headers(user: models.User) -> dict[str, str]:
    token = security.create_access_token(str(user.id))
    return {"Authorization": f"Bearer {token}"}


def test_current_procedure_returns_null_when_patient_has_no_active_case(
    client: TestClient,
    db_session: Session,
) -> None:
    user = _create_user(db_session)

    response = client.get("/procedures/current", headers=_auth_headers(user))

    assert response.status_code == 200
    assert response.json() is None
