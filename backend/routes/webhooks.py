"""Webhook endpoints for external providers."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

import schemas
from core.config import get_settings
from database import get_db
from services.payments import (
    WebhookConfigurationError,
    WebhookPayloadError,
    construct_stripe_event,
    process_stripe_webhook_event,
)


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe", response_model=schemas.StripeWebhookResult)
async def handle_stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="stripe-signature"),
    db: Session = Depends(get_db),
    settings=Depends(get_settings),
) -> schemas.StripeWebhookResult:
    """Receive Stripe events and update payment / appointment state idempotently."""

    payload = await request.body()
    try:
        event = construct_stripe_event(payload, stripe_signature, settings)
        result = process_stripe_webhook_event(db, event)
    except WebhookPayloadError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except WebhookConfigurationError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return schemas.StripeWebhookResult(
        status=result.status,
        event_id=result.event_id,
        event_type=result.event_type,
    )
