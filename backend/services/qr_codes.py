"""Utilities to manage QR-code metadata for prescriptions."""

from __future__ import annotations

import secrets
from datetime import datetime

from sqlalchemy.orm import Session

import models
from core.config import get_settings


def generate_unique_slug(db: Session, *, length: int = 12) -> str:
    """Generate a slug that is not already stored in the database."""
    while True:
        candidate = secrets.token_urlsafe(length)
        exists = (
            db.query(models.PrescriptionQRCode)
            .filter(models.PrescriptionQRCode.slug == candidate)
            .first()
        )
        if not exists:
            return candidate


def build_verification_url(slug: str) -> str:
    """Build the public URL embedded in the QR code."""
    settings = get_settings()
    base = settings.app_base_url.rstrip("/")
    return f"{base}/prescriptions/qr/{slug}"


def upsert_qr_code(
    db: Session,
    *,
    prescription: models.Prescription,
    reference: str,
    slug: str,
    verification_url: str,
    payload: dict | None = None,
    version: models.PrescriptionVersion | None = None,
) -> models.PrescriptionQRCode:
    """Create or update the QR code metadata for the given prescription."""
    qr_code = (
        db.query(models.PrescriptionQRCode)
        .filter(models.PrescriptionQRCode.prescription_id == prescription.id)
        .order_by(models.PrescriptionQRCode.created_at.desc())
        .first()
    )
    if qr_code is None:
        qr_code = models.PrescriptionQRCode(
            prescription_id=prescription.id,
            version=version,
            reference=reference,
            slug=slug,
            verification_url=verification_url,
            qr_payload=payload,
        )
        db.add(qr_code)
    else:
        qr_code.reference = reference
        qr_code.slug = slug
        qr_code.verification_url = verification_url
        qr_code.qr_payload = payload
        qr_code.version = version
    db.flush()
    return qr_code


def log_scan(
    db: Session,
    qr_code: models.PrescriptionQRCode,
    *,
    channel: str = "qr",
    actor: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> models.PrescriptionQRScan:
    """Persist a scan entry for analytics and compliance."""
    qr_code.scan_count = (qr_code.scan_count or 0) + 1
    qr_code.last_scanned_at = datetime.utcnow()
    db.add(qr_code)

    entry = models.PrescriptionQRScan(
        qr_code_id=qr_code.id,
        channel=channel,
        actor=actor,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    db.flush()
    return entry
