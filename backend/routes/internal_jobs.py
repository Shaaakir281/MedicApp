"""Internal endpoints to trigger scheduled monitoring jobs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from core.config import get_settings
from database import get_db
from jobs import check_abandoned_journeys, check_reflection_period

router = APIRouter(prefix="/internal", tags=["internal-jobs"])


def _require_internal_key(
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
) -> None:
    settings = get_settings()
    expected_key = settings.internal_jobs_key
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_JOBS_KEY is not configured.",
        )
    if x_internal_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal key.",
        )


@router.get("/check-reflection-period", status_code=status.HTTP_200_OK)
def trigger_reflection_period_check(
    _: None = Depends(_require_internal_key),
    db: Session = Depends(get_db),
) -> dict:
    return check_reflection_period.run(db)


@router.get("/check-abandoned-journeys", status_code=status.HTTP_200_OK)
def trigger_abandoned_journeys_check(
    _: None = Depends(_require_internal_key),
    db: Session = Depends(get_db),
) -> dict:
    return check_abandoned_journeys.run(db)

