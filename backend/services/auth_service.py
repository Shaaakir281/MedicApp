"""Authentication service orchestrating repositories and security helpers."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

import models
from core import security
from repositories import email_verification_repository, user_repository


class InvalidCredentialsError(ValueError):
    """Raised when the login credentials do not match any user."""


class EmailAlreadyRegisteredError(ValueError):
    """Raised when attempting to register an email that already exists."""


class InvalidVerificationTokenError(ValueError):
    """Raised when the email verification token cannot be used."""


class InvalidRefreshTokenError(ValueError):
    """Raised when a refresh token is invalid or malformatted."""


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str


def authenticate_user(db: Session, email: str, password: str) -> models.User:
    """Return the authenticated user or raise ``InvalidCredentialsError``."""
    user = user_repository.get_by_email(db, email)
    if not user or not security.verify_password(password, user.hashed_password):
        raise InvalidCredentialsError("Incorrect email or password")
    return user


def register_user(
    db: Session,
    *,
    email: str,
    password: str,
    role: models.UserRole,
) -> models.User:
    """Create a new user or raise ``EmailAlreadyRegisteredError``."""
    if user_repository.get_by_email(db, email):
        raise EmailAlreadyRegisteredError("Email already registered")

    hashed_password = security.hash_password(password)
    user = user_repository.create(
        db,
        email=email,
        hashed_password=hashed_password,
        role=role,
    )
    return user


def issue_tokens(user_id: int) -> TokenPair:
    subject = str(user_id)
    access_token = security.create_access_token(subject)
    refresh_token = security.create_refresh_token(subject)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


def refresh_access_token(refresh_token: str) -> str:
    try:
        claims = security.decode_token(refresh_token)
    except security.TokenDecodeError as exc:
        raise InvalidRefreshTokenError("Invalid refresh token") from exc

    if claims.get("type") != "refresh":
        raise InvalidRefreshTokenError("Not a refresh token")
    subject = claims.get("sub")
    if not subject:
        raise InvalidRefreshTokenError("Refresh token missing subject")
    return security.create_access_token(str(subject))


def decode_token(token: str) -> dict:
    try:
        return security.decode_token(token)
    except security.TokenDecodeError as exc:
        raise InvalidCredentialsError("Invalid authentication token") from exc


def get_user_by_id(db: Session, user_id: int) -> models.User | None:
    return user_repository.get_by_id(db, user_id)


def create_email_verification_token(
    db: Session,
    user: models.User,
    expires_in_hours: int = 24,
) -> models.EmailVerificationToken:
    email_verification_repository.invalidate_pending_tokens(db, user.id)

    expiry = datetime.utcnow() + timedelta(hours=expires_in_hours)
    token_value = secrets.token_urlsafe(32)
    return email_verification_repository.create(
        db,
        user_id=user.id,
        token_value=token_value,
        expires_at=expiry,
    )


def verify_email_token(
    db: Session,
    token_value: str,
) -> models.User:
    token = email_verification_repository.get_by_token(db, token_value)
    if token is None:
        raise InvalidVerificationTokenError("Invalid verification token")

    if token.consumed_at is not None:
        raise InvalidVerificationTokenError("Verification token already used")

    if token.expires_at < datetime.utcnow():
        raise InvalidVerificationTokenError("Verification token has expired")

    token.consumed_at = datetime.utcnow()
    user = token.user
    user.email_verified = True

    db.add(token)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

