"""Payment endpoints used by the patient flow."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from core.config import get_settings
from database import get_db
from dependencies.auth import get_current_user
from services.payments import MockPaymentConfirmationError, confirm_mock_payment


router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/{payment_id}/mock-confirm", response_model=schemas.Message)
def confirm_local_mock_payment(
    payment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings=Depends(get_settings),
) -> schemas.Message:
    """Confirm a local mock payment while Stripe credentials are not available."""

    try:
        confirm_mock_payment(db=db, payment_id=payment_id, user=current_user, settings=settings)
    except MockPaymentConfirmationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return schemas.Message(detail="Paiement de test confirme.")
