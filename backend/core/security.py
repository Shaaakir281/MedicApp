"""Security helpers for password hashing and JWT handling."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext


class TokenDecodeError(ValueError):
    """Raised when a JWT cannot be decoded or validated."""


_pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")

# Lazy environment lookups so that tests can override them.
DEFAULT_JWT_SECRET = "changeme"


def _get_jwt_secret() -> str:
    return os.getenv("JWT_SECRET_KEY", DEFAULT_JWT_SECRET)


def _get_access_expiry_minutes() -> int:
    return int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))


def _get_refresh_expiry_days() -> int:
    return int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))


def hash_password(password: str) -> str:
    """Hash ``password`` using bcrypt."""
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify that ``plain_password`` matches ``hashed_password``."""
    return _pwd_context.verify(plain_password, hashed_password)


def _build_token(
    subject: str,
    *,
    expires_delta: Optional[timedelta],
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    payload = dict(additional_claims or {})
    payload["sub"] = subject
    expiry = datetime.now(tz=timezone.utc) + (expires_delta or timedelta(minutes=_get_access_expiry_minutes()))
    payload["exp"] = expiry
    secret = _get_jwt_secret()
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
    default_expiry = timedelta(days=_get_refresh_expiry_days())
    return _build_token(subject, expires_delta=expires_delta or default_expiry, additional_claims=refresh_claims)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode ``token`` and return its claims or raise ``TokenDecodeError``."""
    try:
        return jwt.decode(token, _get_jwt_secret(), algorithms=["HS256"])
    except JWTError as exc:
        raise TokenDecodeError("Invalid token") from exc

