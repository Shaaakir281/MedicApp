"""Send appointment reminders for patients (lookahead configured via REMINDER_LOOKAHEAD_DAYS).

Usage:
    poetry run python scripts/send_appointment_reminders.py
"""

from __future__ import annotations

import logging
import sys
import uuid
from datetime import date, datetime, timedelta

import models
from core.config import get_settings
from database import SessionLocal
from services.email import send_appointment_reminder_email

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main() -> int:
    settings = get_settings()
    reminder_delta = timedelta(days=settings.reminder_lookahead_days)
    target_date = date.today() + reminder_delta
    logger.info("Sending reminders for appointments on %s", target_date.isoformat())

    session = SessionLocal()
    sent = 0
    try:
        appointments = (
            session.query(models.Appointment)
            .join(models.User)
            .filter(
                models.Appointment.date == target_date,
                models.Appointment.reminder_sent_at.is_(None),
                models.User.email.isnot(None),
            )
            .all()
        )

        logger.info("Found %s appointment(s) needing reminders", len(appointments))
        for appointment in appointments:
            user = appointment.user
            if not user or not user.email:
                continue

            token = uuid.uuid4().hex
            reminder_link = f"{settings.app_base_url.rstrip('/')}/reminders/{token}"
            send_appointment_reminder_email(
                recipient=user.email,
                appointment_date=appointment.date.strftime("%d/%m/%Y"),
                appointment_type=appointment.appointment_type.value,
                reminder_link=reminder_link,
            )

            appointment.reminder_sent_at = datetime.utcnow()
            appointment.reminder_token = token
            session.add(appointment)
            sent += 1

        session.commit()
        logger.info("Reminders sent: %s", sent)
    except Exception:
        session.rollback()
        logger.exception("Failed to send reminders")
        return 1
    finally:
        session.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
