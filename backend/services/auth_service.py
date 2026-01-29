"""Authentication service orchestrating repositories and security helpers."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

import models
from core import security
from core import password_policy
from repositories import (
    email_verification_repository,
    password_reset_repository,
    user_repository,
)


class InvalidCredentialsError(ValueError):
    """Raised when the login credentials do not match any user."""


class EmailAlreadyRegisteredError(ValueError):
    """Raised when attempting to register an email that already exists."""


class InvalidVerificationTokenError(ValueError):
    """Raised when the email verification token cannot be used."""


class InvalidRefreshTokenError(ValueError):
    """Raised when a refresh token is invalid or malformatted."""


class InvalidPasswordResetTokenError(ValueError):
    """Raised when a password reset token cannot be used."""


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

    password_policy.validate_password_strength(password)
    hashed_password = security.hash_password(password)
    email_verified = role == models.UserRole.praticien
    user = user_repository.create(
        db,
        email=email,
        hashed_password=hashed_password,
        role=role,
        email_verified=email_verified,
    )
    return user


def issue_tokens(
    user_id: int,
    *,
    access_claims: dict | None = None,
    refresh_claims: dict | None = None,
) -> TokenPair:
    subject = str(user_id)
    access_token = security.create_access_token(subject, claims=access_claims)
    refresh_token = security.create_refresh_token(
        subject,
        claims=refresh_claims if refresh_claims is not None else access_claims,
    )
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
    access_claims = {}
    if claims.get("mfa_verified") is True:
        access_claims["mfa_verified"] = True
    return security.create_access_token(str(subject), claims=access_claims or None)


def decode_token(token: str) -> dict:
    try:
        return security.decode_token(token)
    except security.TokenDecodeError as exc:
        raise InvalidCredentialsError("Invalid authentication token") from exc


def get_user_by_id(db: Session, user_id: int) -> models.User | None:
    return user_repository.get_by_id(db, user_id)


def get_user_by_email(db: Session, email: str) -> models.User | None:
    return user_repository.get_by_email(db, email)


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


def create_password_reset_token(
    db: Session,
    user: models.User,
    expires_in_minutes: int = 60,
) -> models.PasswordResetToken:
    password_reset_repository.invalidate_pending_tokens(db, user.id)
    token_value = secrets.token_urlsafe(32)
    expiry = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
    return password_reset_repository.create(
        db,
        user_id=user.id,
        token_value=token_value,
        expires_at=expiry,
    )


def reset_password_with_token(db: Session, token_value: str, new_password: str) -> models.User:
    token = password_reset_repository.get_by_token(db, token_value)
    if token is None:
        raise InvalidPasswordResetTokenError("Invalid reset token")
    if token.consumed_at is not None:
        raise InvalidPasswordResetTokenError("Reset token already used")
    if token.expires_at < datetime.utcnow():
        raise InvalidPasswordResetTokenError("Reset token has expired")

    password_policy.validate_password_strength(new_password)
    token.consumed_at = datetime.utcnow()
    user = token.user
    user.hashed_password = security.hash_password(new_password)
    user.email_verified = user.email_verified or user.role == models.UserRole.praticien

    db.add(token)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
