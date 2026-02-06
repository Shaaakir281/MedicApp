"""Mini dashboard admin for practitioners (maintenance/health)."""

from __future__ import annotations

import datetime as dt
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
import schemas
from core.config import get_settings
from database import get_db
from dependencies.auth import require_practitioner
from services.storage import StorageError, get_storage_backend

router = APIRouter(prefix="/admin", tags=["admin"])


def _current_week_range() -> tuple[dt.date, dt.date]:
    today = dt.date.today()
    start = today - dt.timedelta(days=today.weekday())
    end = start + dt.timedelta(days=6)
    return start, end


def _estimate_storage_mb() -> float | None:
    settings = get_settings()
    if settings.storage_backend == "local":
        # Local storage size estimation could be added later.
        return None

    # For Azure storage, we keep it minimal to avoid heavy scans.
    # A more precise computation can be added once required.
    return None


@router.get(
    "/stats/overview",
    response_model=schemas.AdminOverviewStats,
    status_code=status.HTTP_200_OK,
)
def get_admin_overview(
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.AdminOverviewStats:
    start, end = _current_week_range()
    appointments_this_week = db.query(models.Appointment).filter(
        models.Appointment.date >= start,
        models.Appointment.date <= end,
    ).count()

    pending_signatures = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status.in_(
            [
                models.DocumentSignatureStatus.sent,
                models.DocumentSignatureStatus.partially_signed,
                models.DocumentSignatureStatus.draft,
            ]
        )
    ).count()

    total_patients = db.query(models.User).filter(
        models.User.role == models.UserRole.patient
    ).count()

    return schemas.AdminOverviewStats(
        total_patients=total_patients,
        pending_signatures=pending_signatures,
        appointments_this_week=appointments_this_week,
        storage_used_mb=_estimate_storage_mb(),
        last_backup=None,
    )


@router.get(
    "/stats/recent-activity",
    response_model=List[schemas.AdminRecentActivity],
    status_code=status.HTTP_200_OK,
)
def get_recent_activity(
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> List[schemas.AdminRecentActivity]:
    activities: list[schemas.AdminRecentActivity] = []

    recent_users = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.patient)
        .order_by(models.User.created_at.desc())
        .limit(5)
        .all()
    )
    for user in recent_users:
        if not user.created_at:
            continue
        activities.append(
            schemas.AdminRecentActivity(
                type="new_patient",
                date=user.created_at,
                details=f"Nouveau patient : {user.email}",
            )
        )

    recent_signatures = (
        db.query(models.DocumentSignature)
        .filter(models.DocumentSignature.completed_at.isnot(None))
        .order_by(models.DocumentSignature.completed_at.desc())
        .limit(5)
        .all()
    )
    for signature in recent_signatures:
        if not signature.completed_at:
            continue
        activities.append(
            schemas.AdminRecentActivity(
                type="signature",
                date=signature.completed_at,
                details=f"Document {signature.document_type} signé (dossier {signature.procedure_case_id})",
            )
        )

    recent_appointments = (
        db.query(models.Appointment)
        .order_by(models.Appointment.created_at.desc())
        .limit(5)
        .all()
    )
    for appointment in recent_appointments:
        if not appointment.created_at:
            continue
        activities.append(
            schemas.AdminRecentActivity(
                type="appointment",
                date=appointment.created_at,
                details=f"RDV {appointment.appointment_type} créé ({appointment.date})",
            )
        )

    activities.sort(key=lambda item: item.date, reverse=True)
    return activities[:10]


@router.get(
    "/health",
    response_model=schemas.AdminHealthStatus,
    status_code=status.HTTP_200_OK,
)
def get_admin_health(
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.AdminHealthStatus:
    settings = get_settings()

    # Database health (simple query)
    try:
        db.execute(text("SELECT 1"))
        database_status = "ok"
    except Exception:
        database_status = "error"

    # Storage health
    try:
        _ = get_storage_backend()
        storage_status = "ok"
    except StorageError:
        storage_status = "error"

    # Email/SMS config
    email_status = "ok" if settings.smtp_settings().is_configured else "not_configured"
    sms_status = (
        "ok"
        if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number
        else "not_configured"
    )

    return schemas.AdminHealthStatus(
        database=database_status,
        storage=storage_status,
        email_service=email_status,
        sms_service=sms_status,
    )
