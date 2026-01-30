"""Service for managing MFA (SMS) codes for practitioner authentication."""

from __future__ import annotations

from datetime import datetime, timedelta
import logging
import secrets

from sqlalchemy.orm import Session

import models
from core.config import get_settings
from services.sms import send_sms

logger = logging.getLogger(__name__)


class MFAService:
    def __init__(self, code_length: int = 6, ttl_minutes: int = 5) -> None:
        self.code_length = code_length
        self.ttl_minutes = ttl_minutes

    def generate_code(self) -> str:
        digits = "0123456789"
        return "".join(secrets.choice(digits) for _ in range(self.code_length))

    def get_last_phone(self, db: Session, user_id: int) -> str | None:
        entry = (
            db.query(models.MFACode)
            .filter(models.MFACode.user_id == user_id, models.MFACode.phone.isnot(None))
            .order_by(models.MFACode.created_at.desc())
            .first()
        )
        return entry.phone if entry else None

    def send_mfa_code(self, db: Session, user_id: int, phone: str) -> bool:
        code = self.generate_code()
        expires_at = datetime.utcnow() + timedelta(minutes=self.ttl_minutes)

        entry = models.MFACode(
            user_id=user_id,
            code=code,
            phone=phone,
            expires_at=expires_at,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

        sid = send_sms(phone, f"Code de verification MedScript : {code}")
        if sid is None and get_settings().sms_provider == "twilio":
            logger.error("MFA SMS not sent for user_id=%s", user_id)
            return False
        return True

    def verify_code(self, db: Session, user_id: int, code: str) -> bool:
        now = datetime.utcnow()
        entry = (
            db.query(models.MFACode)
            .filter(
                models.MFACode.user_id == user_id,
                models.MFACode.code == code,
                models.MFACode.used_at.is_(None),
                models.MFACode.expires_at > now,
            )
            .order_by(models.MFACode.created_at.desc())
            .first()
        )
        if not entry:
            return False

        entry.used_at = now
        db.add(entry)
        db.commit()
        return True


mfa_service = MFAService()
