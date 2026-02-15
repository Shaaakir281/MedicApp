"""Application Insights event tracking helpers.

This tracker emits structured logs with ``custom_dimensions`` so events are
queryable in Application Insights. It intentionally avoids direct PII fields.
"""

from __future__ import annotations

import datetime as dt
import logging
from threading import Lock
from typing import Any

from core.config import get_settings

logger = logging.getLogger("event_tracker")


def _to_serializable(value: Any) -> Any:
    """Normalize values for telemetry payloads."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if hasattr(value, "value"):
        return getattr(value, "value")
    if isinstance(value, (dt.date, dt.datetime, dt.time)):
        return value.isoformat()
    return str(value)


class EventTracker:
    """Singleton tracker for business/security telemetry events."""

    _instance: "EventTracker | None" = None
    _lock = Lock()

    def __new__(cls) -> "EventTracker":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        settings = get_settings()
        self._environment = settings.environment
        self._initialized = True

    def track_event(
        self,
        event_name: str,
        properties: dict[str, Any] | None = None,
        measurements: dict[str, float | int] | None = None,
    ) -> None:
        """Emit a structured telemetry event."""
        if not event_name:
            return

        dimensions: dict[str, Any] = {
            "event_name": event_name,
            "timestamp": dt.datetime.utcnow().isoformat() + "Z",
            "environment": self._environment,
        }

        if properties:
            for key, value in properties.items():
                serial = _to_serializable(value)
                if serial is not None:
                    dimensions[key] = serial

        if measurements:
            for key, value in measurements.items():
                try:
                    dimensions[f"measurement_{key}"] = float(value)
                except (TypeError, ValueError):
                    continue

        logger.info(
            "event:%s",
            event_name,
            extra={"custom_dimensions": dimensions},
        )

    def track_patient_event(self, event: str, patient_id: int | str, **kwargs: Any) -> None:
        props = {"patient_id": str(patient_id), **kwargs}
        self.track_event(event, properties=props)

    def track_practitioner_event(
        self,
        event: str,
        practitioner_id: int | str,
        **kwargs: Any,
    ) -> None:
        props = {"practitioner_id": str(practitioner_id), **kwargs}
        self.track_event(event, properties=props)

    def track_security_event(
        self,
        event: str,
        ip_address: str | None,
        **kwargs: Any,
    ) -> None:
        props = {"ip_address": ip_address, **kwargs}
        self.track_event(event, properties=props)


def get_event_tracker() -> EventTracker:
    return EventTracker()

