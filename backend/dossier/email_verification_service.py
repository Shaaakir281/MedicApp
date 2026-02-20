"""Guardian email verification service."""

from __future__ import annotations

import datetime as dt
import hashlib
import logging
import secrets
from urllib.parse import urlencode
from typing import Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from core.config import get_settings
from dossier.models import Child, Guardian, GuardianEmailVerification, EmailVerificationStatus
from services import email as email_service

logger = logging.getLogger("uvicorn.error")

EMAIL_TOKEN_TTL_HOURS = 24


def _hash_token(token: str) -> str:
    """Hash email verification token using SHA256."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _random_token() -> str:
    """Generate a secure random token for email verification."""
    return secrets.token_urlsafe(32)


def _latest_email_verification(db: Session, guardian_id: str) -> GuardianEmailVerification | None:
    """Get the most recent email verification for a guardian."""
    stmt = (
        select(GuardianEmailVerification)
        .where(GuardianEmailVerification.guardian_id == guardian_id)
        .order_by(GuardianEmailVerification.sent_at.desc())
    )
    return db.scalars(stmt).first()


def _build_verification_link(token: str, guardian_id: str, base_url: str | None = None) -> str:
    """Build email verification link."""
    frontend_url = (base_url or get_settings().frontend_base_url).rstrip("/")
    query = urlencode({"guardian_id": guardian_id, "token": token})
    return f"{frontend_url}/auth/verify-guardian-email?{query}"


def send_email_verification(
    db: Session,
    guardian_id: str,
    current_user,
    *,
    email_override: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> Tuple[GuardianEmailVerification, str]:
    """Send email verification link to guardian."""
    guardian = db.get(Guardian, guardian_id)
    if guardian is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent introuvable.")

    child = db.get(Child, guardian.child_id)
    if child is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enfant introuvable.")

    # Check access rights
    if current_user.role == models.UserRole.patient:
        if child.patient_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse.")

    email = email_override or guardian.email
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email manquant.")

    now = dt.datetime.now(tz=dt.timezone.utc)

    # Invalidate previous pending verifications
    latest = _latest_email_verification(db, guardian.id)
    if latest and latest.status == EmailVerificationStatus.sent.value and latest.expires_at > now:
        latest.status = EmailVerificationStatus.expired.value
        db.add(latest)

    # Generate token
    token = _random_token()
    verification = GuardianEmailVerification(
        guardian_id=guardian.id,
        email=email,
        token_hash=_hash_token(token),
        expires_at=now + dt.timedelta(hours=EMAIL_TOKEN_TTL_HOURS),
        status=EmailVerificationStatus.sent.value,
        sent_at=now,
        consumed_at=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)

    # Send email
    try:
        settings = get_settings()
        verification_link = _build_verification_link(token, guardian.id, settings.frontend_base_url)
        alternative_links = []
        for candidate_base_url in settings.frontend_base_urls:
            if candidate_base_url.rstrip("/") == settings.frontend_base_url.rstrip("/"):
                continue
            alternative_links.append(_build_verification_link(token, guardian.id, candidate_base_url))
        guardian_name = f"{guardian.first_name} {guardian.last_name}".strip()
        child_name = f"{child.first_name} {child.last_name}".strip()

        email_service.send_guardian_verification_email(
            to_email=email,
            guardian_name=guardian_name,
            child_name=child_name,
            verification_link=verification_link,
            alternative_links=alternative_links,
        )
    except Exception as exc:  # pragma: no cover - external
        logger.warning("Email non envoye (guardian=%s): %s", guardian.id, exc)

    return verification, email


def verify_email_token(
    db: Session,
    guardian_id: str,
    token: str,
    *,
    ip_address: str | None,
    user_agent: str | None,
) -> GuardianEmailVerification:
    """Verify guardian email using token."""
    guardian = db.get(Guardian, guardian_id)
    if guardian is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent introuvable.")

    token_hash = _hash_token(token)
    stmt = (
        select(GuardianEmailVerification)
        .where(GuardianEmailVerification.guardian_id == guardian_id)
        .where(GuardianEmailVerification.token_hash == token_hash)
    )
    verification = db.scalars(stmt).first()

    if verification is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token invalide.")

    now = dt.datetime.now(tz=dt.timezone.utc)

    if verification.consumed_at is not None:
        same_email = (guardian.email or "").strip().lower() == (verification.email or "").strip().lower()
        if guardian.email_verified_at is not None and same_email:
            return verification
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token deja utilise.")

    if verification.expires_at < now:
        verification.status = EmailVerificationStatus.expired.value
        db.add(verification)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expire, renvoyez un email.")

    # Mark as verified
    verification.status = EmailVerificationStatus.verified.value
    verification.consumed_at = now
    guardian.email = verification.email  # Update guardian email in case it changed
    guardian.email_verified_at = now

    db.add_all([verification, guardian])
    db.commit()
    db.refresh(verification)
    db.refresh(guardian)

    return verification
