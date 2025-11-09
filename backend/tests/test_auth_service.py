from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

import models
from core import security
from services import auth_service


def _create_user(
    db: Session,
    *,
    email: str = "user@example.com",
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


def test_register_user_creates_new_account(db_session: Session) -> None:
    user = auth_service.register_user(
        db_session,
        email="new-user@example.com",
        password="strong-password",
        role=models.UserRole.patient,
    )

    assert user.id is not None
    assert user.email == "new-user@example.com"
    assert security.verify_password("strong-password", user.hashed_password)


def test_register_user_raises_for_duplicate_email(db_session: Session) -> None:
    _create_user(db_session, email="duplicate@example.com")

    with pytest.raises(auth_service.EmailAlreadyRegisteredError):
        auth_service.register_user(
            db_session,
            email="duplicate@example.com",
            password="another-password",
            role=models.UserRole.patient,
        )


def test_authenticate_user_returns_user_when_credentials_match(db_session: Session) -> None:
    created = _create_user(db_session, email="login@example.com", password="letmein123")

    user = auth_service.authenticate_user(db_session, "login@example.com", "letmein123")

    assert user.id == created.id


def test_authenticate_user_raises_when_password_invalid(db_session: Session) -> None:
    _create_user(db_session, email="login@example.com", password="letmein123")

    with pytest.raises(auth_service.InvalidCredentialsError):
        auth_service.authenticate_user(db_session, "login@example.com", "wrong-password")


def test_issue_and_refresh_tokens(db_session: Session) -> None:
    user = _create_user(db_session, email="token@example.com")

    tokens = auth_service.issue_tokens(user.id)
    assert tokens.access_token
    assert tokens.refresh_token

    new_access_token = auth_service.refresh_access_token(tokens.refresh_token)
    assert new_access_token


def test_refresh_access_token_rejects_invalid_token() -> None:
    with pytest.raises(auth_service.InvalidRefreshTokenError):
        auth_service.refresh_access_token("this-is-not-a-valid-token")


def test_email_verification_flow(db_session: Session) -> None:
    user = _create_user(db_session, email_verified=False)

    token = auth_service.create_email_verification_token(db_session, user)
    assert token.user_id == user.id

    verified_user = auth_service.verify_email_token(db_session, token.token)
    assert verified_user.email_verified is True

    with pytest.raises(auth_service.InvalidVerificationTokenError):
        auth_service.verify_email_token(db_session, token.token)
