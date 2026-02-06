#!/usr/bin/env python3
"""Lightweight maintenance health check + alert email.

Usage:
    python -m scripts.maintenance_health_check

Configuration (.env):
    MAINTENANCE_ALERT_ENABLED=true
    MAINTENANCE_ALERT_RECIPIENT_EMAIL=admin@medicapp.fr
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import text

from core.config import get_settings
from database import SessionLocal
from services import email as email_service
from services.storage import StorageError, get_storage_backend

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def main() -> int:
    settings = get_settings()

    if not settings.maintenance_alert_enabled:
        logger.info("Maintenance alerts disabled via config.")
        return 0

    recipient = settings.maintenance_alert_recipient_email
    if not recipient:
        logger.error("MAINTENANCE_ALERT_RECIPIENT_EMAIL is not configured.")
        return 1

    checks: list[tuple[str, str]] = []

    # Database health
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        checks.append(("database", "ok"))
    except Exception:
        logger.exception("Database health check failed.")
        checks.append(("database", "error"))

    # Storage health
    try:
        _ = get_storage_backend()
        checks.append(("storage", "ok"))
    except StorageError:
        logger.exception("Storage backend check failed.")
        checks.append(("storage", "error"))

    # Email/SMS configuration (not a hard failure)
    email_status = "ok" if settings.smtp_settings().is_configured else "not_configured"
    sms_status = (
        "ok"
        if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number
        else "not_configured"
    )
    checks.append(("email_service", email_status))
    checks.append(("sms_service", sms_status))

    failures = [name for name, status in checks if status == "error"]
    warnings = [name for name, status in checks if status == "not_configured"]

    if not failures and not warnings:
        logger.info("All health checks are OK.")
        return 0

    subject = f"[MedicApp] Maintenance health check ({datetime.utcnow().isoformat()})"
    lines = [
        "Maintenance health check summary",
        "",
        "Checks:",
    ]
    for name, status in checks:
        lines.append(f"- {name}: {status}")

    if failures:
        lines.append("")
        lines.append("Failures:")
        for name in failures:
            lines.append(f"- {name}")

    if warnings:
        lines.append("")
        lines.append("Warnings (not configured):")
        for name in warnings:
            lines.append(f"- {name}")

    body = "\n".join(lines)

    try:
        email_service.send_email(
            subject=subject,
            to_email=recipient,
            body=body,
        )
        logger.info("Maintenance alert email sent to %s.", recipient)
    except Exception:
        logger.exception("Failed to send maintenance alert email.")
        return 2

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
