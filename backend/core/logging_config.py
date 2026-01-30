"""Logging helpers for Application Insights."""

from __future__ import annotations

import logging
from typing import Optional

try:
    from opencensus.ext.azure.log_exporter import AzureLogHandler
except Exception:  # pragma: no cover - optional dependency
    AzureLogHandler = None  # type: ignore[assignment]


def configure_application_insights(connection_string: Optional[str]) -> None:
    """Attach an Azure Application Insights handler when configured."""
    if not connection_string:
        return

    if AzureLogHandler is None:
        logging.getLogger(__name__).warning(
            "Application Insights logger unavailable; continuing without it."
        )
        return

    root_logger = logging.getLogger()
    if any(isinstance(handler, AzureLogHandler) for handler in root_logger.handlers):
        return

    handler = AzureLogHandler(connection_string=connection_string)
    handler.setLevel(logging.INFO)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )

    root_logger.addHandler(handler)
    root_logger.addHandler(handler)
    if root_logger.level > logging.INFO:
        root_logger.setLevel(logging.INFO)

    # Let uvicorn logs bubble up to the root handler.
    for name in ("uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).propagate = True
