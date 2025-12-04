"""SMS sending helpers (Twilio-backed)."""

from __future__ import annotations

import logging
from typing import Optional

from core.config import get_settings

try:
    from twilio.rest import Client as TwilioClient  # type: ignore
except Exception:  # pragma: no cover - library may be absent in dev
    TwilioClient = None

logger = logging.getLogger(__name__)


class SMSConfigurationError(Exception):
    """Raised when the SMS provider is not properly configured."""


def _twilio_client() -> TwilioClient:
    settings = get_settings()
    if settings.sms_provider != "twilio":
        raise SMSConfigurationError("SMS provider is not enabled.")
    if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number):
        raise SMSConfigurationError("Twilio credentials or sender number missing.")
    if TwilioClient is None:
        raise SMSConfigurationError("Twilio SDK is not installed. Please install `twilio`.")
    return TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)


def send_sms(to: str, body: str) -> Optional[str]:
    """Send an SMS through Twilio. Returns the provider message SID when possible.

    In development (no provider configured), the message is simply logged.
    """
    try:
        client = _twilio_client()
    except SMSConfigurationError as exc:
        logger.warning("SMS not sent (configuration missing): %s", exc)
        logger.info("SMS to %s: %s", to, body)
        return None

    message = client.messages.create(body=body, from_=get_settings().twilio_from_number, to=to)
    logger.info("SMS sent to %s via Twilio (sid=%s)", to, getattr(message, "sid", "unknown"))
    return getattr(message, "sid", None)
