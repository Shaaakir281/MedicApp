"""Security helpers for password hashing and JWT handling."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from core.config import Settings, get_settings


class TokenDecodeError(ValueError):
    """Raised when a JWT cannot be decoded or validated."""


_pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash ``password`` using bcrypt."""
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify that ``plain_password`` matches ``hashed_password``."""
    return _pwd_context.verify(plain_password, hashed_password)


def _settings() -> Settings:
    # Local helper to avoid repeated lookups in module globals while keeping the settings cache.
    return get_settings()


def _build_token(
    subject: str,
    *,
    expires_delta: Optional[timedelta],
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    payload = dict(additional_claims or {})
    payload["sub"] = subject
    settings = _settings()
    expiry = datetime.now(tz=timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload["exp"] = expiry
    secret = settings.jwt_secret_key
    return jwt.encode(payload, secret, algorithm="HS256")


def create_access_token(
    subject: str,
    *,
    expires_delta: Optional[timedelta] = None,
    claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Return a signed access token for ``subject``."""
    return _build_token(subject, expires_delta=expires_delta, additional_claims=claims)


def create_refresh_token(
    subject: str,
    *,
    expires_delta: Optional[timedelta] = None,
    claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Return a signed refresh token for ``subject``."""
    refresh_claims = dict(claims or {})
    refresh_claims["type"] = "refresh"
    settings = _settings()
    default_expiry = timedelta(days=settings.refresh_token_expire_days)
    return _build_token(subject, expires_delta=expires_delta or default_expiry, additional_claims=refresh_claims)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode ``token`` and return its claims or raise ``TokenDecodeError``."""
    try:
        return jwt.decode(token, _settings().jwt_secret_key, algorithms=["HS256"])
    except JWTError as exc:
        raise TokenDecodeError("Invalid token") from exc
