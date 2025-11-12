"""Utilities to issue and validate short-lived download tokens for documents."""

from __future__ import annotations

from datetime import timedelta
from typing import Optional, Tuple

from core import security

PRESCRIPTION_TOKEN_KIND = "prescription-download"
PRESCRIPTION_VERSION_TOKEN_KIND = "prescription-version-download"


class InvalidDownloadTokenError(ValueError):
    """Raised when a download token cannot be decoded or is not valid anymore."""


def _create_token(
    subject: str,
    *,
    kind: str,
    actor: Optional[str],
    channel: Optional[str],
    expires_minutes: int,
) -> str:
    claims: dict[str, str] = {"token_kind": kind}
    if actor:
        claims["actor"] = actor
    if channel:
        claims["channel"] = channel
    return security.create_access_token(
        subject,
        expires_delta=timedelta(minutes=expires_minutes),
        claims=claims,
    )


def _decode_token(token: str, *, expected_kind: str) -> Tuple[int, Optional[str], Optional[str]]:
    try:
        claims = security.decode_token(token)
    except security.TokenDecodeError as exc:  # pragma: no cover - handled at runtime
        raise InvalidDownloadTokenError("Invalid token") from exc

    if claims.get("token_kind") != expected_kind:
        raise InvalidDownloadTokenError("Token type mismatch")

    subject = claims.get("sub")
    if subject is None:
        raise InvalidDownloadTokenError("Token missing subject")

    try:
        document_id = int(subject)
    except ValueError as exc:
        raise InvalidDownloadTokenError("Token subject malformed") from exc

    return document_id, claims.get("actor"), claims.get("channel")


def create_prescription_download_token(
    prescription_id: int,
    *,
    actor: Optional[str],
    channel: Optional[str],
    expires_minutes: int = 10,
) -> str:
    return _create_token(
        str(prescription_id),
        kind=PRESCRIPTION_TOKEN_KIND,
        actor=actor,
        channel=channel,
        expires_minutes=expires_minutes,
    )


def resolve_prescription_download_token(token: str) -> Tuple[int, Optional[str], Optional[str]]:
    return _decode_token(token, expected_kind=PRESCRIPTION_TOKEN_KIND)


def create_prescription_version_download_token(
    version_id: int,
    *,
    actor: Optional[str],
    channel: Optional[str],
    expires_minutes: int = 10,
) -> str:
    return _create_token(
        str(version_id),
        kind=PRESCRIPTION_VERSION_TOKEN_KIND,
        actor=actor,
        channel=channel,
        expires_minutes=expires_minutes,
    )


def resolve_prescription_version_download_token(token: str) -> Tuple[int, Optional[str], Optional[str]]:
    return _decode_token(token, expected_kind=PRESCRIPTION_VERSION_TOKEN_KIND)
