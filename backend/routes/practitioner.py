"""Routes dédiées au tableau de bord praticien."""

from __future__ import annotations

import datetime as dt
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies.auth import require_practitioner
from services import appointments_service, storage
from services.document_verification import (
    check_missing_identifiers,
    check_missing_storage_files,
    check_orphaned_yousign_procedures,
    check_stuck_partial_signatures,
    check_artifact_integrity,
)

router = APIRouter(prefix="/practitioner", tags=["practitioner"])


@router.get(
    "/agenda",
    response_model=schemas.PractitionerAgendaResponse,
    status_code=status.HTTP_200_OK,
)
def get_practitioner_agenda(
    start: dt.date | None = Query(None, description="Date de début (YYYY-MM-DD)"),
    end: dt.date | None = Query(None, description="Date de fin (YYYY-MM-DD)"),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerAgendaResponse:
    today = dt.date.today()
    start_date = start or today
    end_date = end or (start_date + dt.timedelta(days=6))
    return appointments_service.get_agenda(db=db, start_date=start_date, end_date=end_date)


@router.get(
    "/stats",
    response_model=schemas.PractitionerStats,
    status_code=status.HTTP_200_OK,
)
def get_practitioner_stats(
    target_date: dt.date | None = Query(None, description="Date de référence (YYYY-MM-DD)"),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerStats:
    day = target_date or dt.date.today()
    return appointments_service.get_stats(db=db, target_date=day)


@router.get(
    "/new-patients",
    response_model=List[schemas.PractitionerNewPatient],
    status_code=status.HTTP_200_OK,
)
def get_new_patients(
    days: int = Query(
        7,
        ge=1,
        le=60,
        description="Periode glissante (en jours) pour les dossiers recents.",
    ),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> List[schemas.PractitionerNewPatient]:
    return appointments_service.get_new_patients(db=db, days=days)


@router.put(
    "/patient/{case_id}",
    response_model=schemas.PractitionerCaseStatus,
    status_code=status.HTTP_200_OK,
)
def update_patient_case(
    case_id: int,
    payload: schemas.PractitionerCaseUpdate,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerCaseStatus:
    return appointments_service.update_case(db=db, case_id=case_id, updates=payload)


@router.patch(
    "/appointments/{appointment_id}",
    response_model=schemas.PractitionerAppointmentEntry,
    status_code=status.HTTP_200_OK,
)
def reschedule_appointment(
    appointment_id: int,
    payload: schemas.AppointmentRescheduleRequest,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerAppointmentEntry:
    return appointments_service.reschedule_appointment(
        db=db,
        appointment_id=appointment_id,
        payload=payload,
    )


@router.post(
    "/appointments",
    response_model=schemas.PractitionerAppointmentEntry,
    status_code=status.HTTP_201_CREATED,
)
def create_practitioner_appointment(
    payload: schemas.PractitionerAppointmentCreate,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PractitionerAppointmentEntry:
    return appointments_service.create_practitioner_appointment(db=db, payload=payload)


@router.get(
    "/document-verification/status",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
)
def get_document_verification_status(
    target_date: dt.date | None = Query(None, description="Date de référence (YYYY-MM-DD). Par défaut: aujourd'hui"),
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Endpoint pour le dashboard praticien : vérification quotidienne des documents signés.

    Retourne :
    - Nombre de documents complétés pour la date donnée
    - Anomalies détectées (fichiers manquants, corruptions, etc.)
    - Statistiques par catégorie
    """
    day = target_date or dt.date.today()
    storage_backend = storage.get_storage_backend()

    # Statistiques du jour
    completed_today = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status == models.DocumentSignatureStatus.completed,
        models.DocumentSignature.completed_at >= dt.datetime.combine(day, dt.time.min),
        models.DocumentSignature.completed_at < dt.datetime.combine(day + dt.timedelta(days=1), dt.time.min)
    ).count()

    # Statistiques globales
    total_completed = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status == models.DocumentSignatureStatus.completed
    ).count()

    total_pending = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status.in_([
            models.DocumentSignatureStatus.sent,
            models.DocumentSignatureStatus.partially_signed
        ])
    ).count()

    # Exécuter vérifications
    anomalies = {
        "missing_identifiers": check_missing_identifiers(db),
        "missing_files": check_missing_storage_files(db, storage_backend),
        "orphaned_yousign": check_orphaned_yousign_procedures(db),
        "stuck_partial": check_stuck_partial_signatures(db),
        "corrupted_files": check_artifact_integrity(db, storage_backend),
    }

    total_anomalies = sum(len(v) for v in anomalies.values())

    return {
        "date": day.isoformat(),
        "completed_today": completed_today,
        "total_completed": total_completed,
        "total_pending": total_pending,
        "total_anomalies": total_anomalies,
        "anomalies_by_check": {
            "missing_identifiers": len(anomalies["missing_identifiers"]),
            "missing_files": len(anomalies["missing_files"]),
            "orphaned_yousign": len(anomalies["orphaned_yousign"]),
            "stuck_partial": len(anomalies["stuck_partial"]),
            "corrupted_files": len(anomalies["corrupted_files"]),
        },
        "status": "healthy" if total_anomalies == 0 else "warning",
    }
