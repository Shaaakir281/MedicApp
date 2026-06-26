"""Teleconsultation access endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import models
import schemas
from core.config import get_settings
from database import get_db
from dependencies.auth import get_current_user, require_practitioner
from services.teleconsultation import (
    TeleconsultationAccessError,
    TeleconsultationConfigurationError,
    TeleconsultationConflictError,
    TeleconsultationNotFoundError,
    issue_patient_token,
    issue_practitioner_token,
)


router = APIRouter(prefix="/teleconsultation", tags=["teleconsultation"])


@router.get("/{appointment_id}/access", response_model=schemas.TeleconsultationToken)
def get_patient_teleconsultation_access(
    appointment_id: int,
    access_token: str = Query(..., description="Jeton d'acces a usage unique."),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings=Depends(get_settings),
) -> schemas.TeleconsultationToken:
    """Consume a patient one-time access link and return a short LiveKit token."""

    try:
        result = issue_patient_token(
            db=db,
            appointment_id=appointment_id,
            patient=current_user,
            access_token=access_token,
            settings=settings,
        )
    except TeleconsultationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except TeleconsultationConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except TeleconsultationAccessError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except TeleconsultationConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return schemas.TeleconsultationToken(**result.__dict__)


@router.get("/{appointment_id}/token", response_model=schemas.TeleconsultationToken)
def get_practitioner_teleconsultation_token(
    appointment_id: int,
    practitioner: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
    settings=Depends(get_settings),
) -> schemas.TeleconsultationToken:
    """Return a short LiveKit token for the practitioner."""

    try:
        result = issue_practitioner_token(
            db=db,
            appointment_id=appointment_id,
            practitioner=practitioner,
            settings=settings,
        )
    except TeleconsultationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except TeleconsultationAccessError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except TeleconsultationConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return schemas.TeleconsultationToken(**result.__dict__)
