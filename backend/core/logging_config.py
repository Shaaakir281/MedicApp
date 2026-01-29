"""Logging helpers for Application Insights."""

from __future__ import annotations

import logging


def configure_application_insights(connection_string: str | None) -> None:
    """Attach Azure Application Insights handler if configured."""
    if not connection_string:
        return
    try:
        from opencensus.ext.azure.log_exporter import AzureLogHandler
    except Exception:
        logging.getLogger(__name__).warning(
            "Application Insights logger unavailable; continuing without it."
        )
        return

    root_logger = logging.getLogger()
    if any(isinstance(handler, AzureLogHandler) for handler in root_logger.handlers):
        return

    handler = AzureLogHandler(connection_string=connection_string)
    handler.setLevel(logging.INFO)
    root_logger.addHandler(handler)
    if root_logger.level == logging.WARNING:
        root_logger.setLevel(logging.INFO)
