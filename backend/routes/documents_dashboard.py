"""Routes for practitioner documents dashboard."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from database import get_db
from dependencies.auth import require_practitioner
from services import document_signature_service

router = APIRouter(prefix="/practitioner/documents-dashboard", tags=["documents-dashboard"])

DOC_TYPES = ("authorization", "consent", "fees")


def _normalize_status(value: Optional[object]) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _normalize_doc_type(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return document_signature_service.DOCUMENT_TYPE_ALIASES.get(value, value)


def _is_completed(doc_sig: Optional[models.DocumentSignature]) -> bool:
    if not doc_sig:
        return False
    return _normalize_status(doc_sig.overall_status) == "completed"


def _needs_reminder(doc_sig: models.DocumentSignature, now: datetime) -> bool:
    for role in ("parent1", "parent2"):
        status_value = _normalize_status(getattr(doc_sig, f"{role}_status", None))
        if status_value == "signed":
            continue
        sent_at = getattr(doc_sig, f"{role}_sent_at", None)
        signed_at = getattr(doc_sig, f"{role}_signed_at", None)
        if sent_at and not signed_at and now - sent_at > timedelta(hours=48):
            return True
    return False


def _filter_appointments(
    appointments: Iterable[models.Appointment],
    *,
    date_range: str,
    today: date,
) -> List[models.Appointment]:
    filtered = []
    for appt in appointments:
        if not appt.date:
            continue
        if date_range == "all":
            filtered.append(appt)
        elif date_range == "today" and appt.date == today:
            filtered.append(appt)
        elif date_range == "week":
            if today <= appt.date <= today + timedelta(days=7):
                filtered.append(appt)
        else:
            if appt.date >= today:
                filtered.append(appt)
    return filtered


def _appointment_sort_key(appt: models.Appointment) -> datetime:
    appt_date = appt.date or date.max
    appt_time = appt.time or datetime.min.time()
    return datetime.combine(appt_date, appt_time)


def _select_display_appointment(appointments: List[models.Appointment]) -> Optional[models.Appointment]:
    if not appointments:
        return None
    sorted_appts = sorted(appointments, key=_appointment_sort_key)
    for appt in sorted_appts:
        appt_type = appt.appointment_type.value if hasattr(appt.appointment_type, "value") else appt.appointment_type
        if appt_type == "act":
            return appt
    return sorted_appts[0]


@router.get("", response_model=schemas.DocumentsDashboardResponse, status_code=status.HTTP_200_OK)
def get_documents_dashboard(
    status_filter: str = Query("all", alias="status", pattern="^(all|incomplete|complete)$"),
    date_range: str = Query("upcoming", pattern="^(upcoming|today|week|all)$"),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.DocumentsDashboardResponse:
    cases = (
        db.query(models.ProcedureCase)
        .options(
            joinedload(models.ProcedureCase.document_signatures),
            joinedload(models.ProcedureCase.appointments),
        )
        .all()
    )

    now = datetime.utcnow()
    today = now.date()
    stats = schemas.DocumentsDashboardStats()
    entries: List[schemas.DocumentsDashboardCaseEntry] = []

    for case in cases:
        appointments = _filter_appointments(case.appointments or [], date_range=date_range, today=today)
        if not appointments:
            continue

        docs_by_type: Dict[str, models.DocumentSignature] = {}
        for doc_sig in case.document_signatures or []:
            doc_type = _normalize_doc_type(doc_sig.document_type)
            if doc_type:
                docs_by_type[doc_type] = doc_sig

        all_signed = all(_is_completed(docs_by_type.get(doc_type)) for doc_type in DOC_TYPES)
        if all_signed:
            stats.complete += 1
        else:
            stats.incomplete += 1

        reminder_needed = any(
            _needs_reminder(doc_sig, now) for doc_sig in docs_by_type.values()
        )
        if reminder_needed:
            stats.reminders += 1

        if status_filter == "complete" and not all_signed:
            continue
        if status_filter == "incomplete" and all_signed:
            continue

        appt = _select_display_appointment(appointments)
        appt_type = appt.appointment_type.value if appt and hasattr(appt.appointment_type, "value") else appt.appointment_type if appt else None

        def _doc_status(doc_sig: Optional[models.DocumentSignature]) -> Optional[schemas.DocumentsDashboardDocumentStatus]:
            if not doc_sig:
                return None
            return schemas.DocumentsDashboardDocumentStatus(
                parent1_status=_normalize_status(doc_sig.parent1_status),
                parent2_status=_normalize_status(doc_sig.parent2_status),
                document_signature_id=doc_sig.id,
                final_pdf_available=bool(doc_sig.final_pdf_identifier),
                signed_pdf_available=bool(doc_sig.signed_pdf_identifier),
            )

        entries.append(
            schemas.DocumentsDashboardCaseEntry(
                id=case.id,
                appointment_id=appt.id if appt else None,
                child_name=case.child_full_name or "",
                parent_email=case.parent1_email,
                appointment_date=appt.date if appt else None,
                appointment_time=appt.time if appt else None,
                appointment_type=appt_type,
                authorization=_doc_status(docs_by_type.get("authorization")),
                consent=_doc_status(docs_by_type.get("consent")),
                fees=_doc_status(docs_by_type.get("fees")),
                has_signed_documents=all_signed,
            )
        )

    return schemas.DocumentsDashboardResponse(stats=stats, cases=entries)


@router.post("/{case_id}/resend-documents", status_code=status.HTTP_200_OK)
def resend_documents(
    case_id: int,
    parent_role: str = Query(..., pattern="^(parent1|parent2)$"),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> dict:
    case = (
        db.query(models.ProcedureCase)
        .options(joinedload(models.ProcedureCase.document_signatures))
        .filter(models.ProcedureCase.id == case_id)
        .first()
    )
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Procedure case not found.")

    resent: List[str] = []
    for doc_sig in case.document_signatures or []:
        status_value = _normalize_status(getattr(doc_sig, f"{parent_role}_status", None))
        signed_at = getattr(doc_sig, f"{parent_role}_signed_at", None)
        if status_value == "signed" or signed_at:
            continue
        sent = document_signature_service.send_document_reminder(
            case,
            doc_sig,
            doc_sig.document_type,
            parent_role,
        )
        if sent:
            resent.append(doc_sig.document_type)

    return {
        "detail": f"Reminder sent for {len(resent)} document(s).",
        "documents": resent,
    }
