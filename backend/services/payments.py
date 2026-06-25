"""Payment helpers for the preconsultation pay-to-book workflow."""

from __future__ import annotations

from dataclasses import dataclass
import datetime as dt
import json
import secrets
import uuid

import models
from core.config import Settings
from sqlalchemy.orm import Session


class PaymentConfigurationError(RuntimeError):
    """Raised when payment settings are incomplete for the current environment."""


class PaymentProviderError(RuntimeError):
    """Raised when Stripe cannot create or confirm a payment resource."""


class WebhookConfigurationError(RuntimeError):
    """Raised when webhook verification settings are incomplete."""


class WebhookPayloadError(RuntimeError):
    """Raised when a webhook payload or signature is invalid."""


@dataclass(frozen=True)
class CheckoutSessionResult:
    session_id: str
    url: str
    mock: bool = False


@dataclass(frozen=True)
class WebhookProcessResult:
    status: str
    event_id: str | None
    event_type: str | None


def should_mock_checkout(settings: Settings) -> bool:
    """Return True when checkout can be mocked safely in local development."""

    if settings.stripe_mock_checkout:
        return True
    if settings.stripe_secret_key:
        return False
    if settings.environment.lower() == "production":
        raise PaymentConfigurationError("STRIPE_SECRET_KEY is required in production.")
    return True


def build_checkout_urls(settings: Settings, payment_id: int) -> tuple[str, str]:
    frontend_base = settings.frontend_base_url.rstrip("/")
    success_url = (
        f"{frontend_base}/patient?payment=success&payment_id={payment_id}"
        f"&session_id={{CHECKOUT_SESSION_ID}}"
    )
    cancel_url = f"{frontend_base}/patient?payment=cancelled&payment_id={payment_id}"
    return success_url, cancel_url


def create_preconsultation_checkout_session(
    *,
    settings: Settings,
    payment: models.Payment,
    appointment: models.Appointment,
    user: models.User,
) -> CheckoutSessionResult:
    """Create a Stripe Checkout Session, or a deterministic local mock if unconfigured."""

    success_url, cancel_url = build_checkout_urls(settings, payment.id)
    if should_mock_checkout(settings):
        session_id = f"mock_cs_preconsult_{payment.id}"
        mock_url = (
            f"{settings.frontend_base_url.rstrip('/')}/patient"
            f"?payment=mock&payment_id={payment.id}&session_id={session_id}"
        )
        return CheckoutSessionResult(session_id=session_id, url=mock_url, mock=True)

    try:
        import stripe
    except ImportError as exc:  # pragma: no cover - dependency checked in runtime env
        raise PaymentConfigurationError("The stripe Python package is not installed.") from exc

    line_item: dict
    if settings.stripe_price_preconsult:
        line_item = {"price": settings.stripe_price_preconsult, "quantity": 1}
    else:
        line_item = {
            "price_data": {
                "currency": settings.stripe_currency,
                "unit_amount": settings.stripe_preconsultation_amount_cents,
                "product_data": {"name": "Consultation prealable MedicApp"},
            },
            "quantity": 1,
        }

    metadata = {
        "payment_id": str(payment.id),
        "appointment_id": str(appointment.id),
        "user_id": str(user.id),
        "appointment_type": models.AppointmentType.preconsultation.value,
    }

    try:
        stripe.api_key = settings.stripe_secret_key
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=[line_item],
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=str(payment.id),
            customer_email=user.email,
            metadata=metadata,
            payment_intent_data={"metadata": metadata},
            idempotency_key=payment.idempotency_key,
        )
    except Exception as exc:  # noqa: BLE001
        raise PaymentProviderError(f"Stripe checkout creation failed: {exc}") from exc

    session_id = _read_stripe_value(session, "id")
    session_url = _read_stripe_value(session, "url")
    if not session_id or not session_url:
        raise PaymentProviderError("Stripe checkout response did not include id and url.")
    return CheckoutSessionResult(session_id=session_id, url=session_url, mock=False)


def _read_stripe_value(resource, key: str):
    value = getattr(resource, key, None)
    if value is not None:
        return value
    if hasattr(resource, "get"):
        return resource.get(key)
    return None


def construct_stripe_event(payload: bytes, signature: str | None, settings: Settings):
    """Verify and parse a Stripe webhook payload."""

    if settings.stripe_webhook_secret:
        if not signature:
            raise WebhookPayloadError("Missing Stripe signature header.")
        try:
            import stripe
        except ImportError as exc:  # pragma: no cover - dependency checked in runtime env
            raise WebhookConfigurationError("The stripe Python package is not installed.") from exc
        try:
            return stripe.Webhook.construct_event(
                payload,
                signature,
                settings.stripe_webhook_secret,
            )
        except Exception as exc:  # noqa: BLE001
            raise WebhookPayloadError("Invalid Stripe webhook payload or signature.") from exc

    if settings.environment.lower() == "production":
        raise WebhookConfigurationError("STRIPE_WEBHOOK_SECRET is required in production.")

    try:
        return json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise WebhookPayloadError("Invalid Stripe webhook JSON payload.") from exc


def process_stripe_webhook_event(db: Session, event) -> WebhookProcessResult:
    """Process a Stripe event once and keep duplicate deliveries harmless."""

    event_id = _read_stripe_value(event, "id")
    event_type = _read_stripe_value(event, "type")
    if not event_id or not event_type:
        raise WebhookPayloadError("Stripe event is missing id or type.")

    existing = (
        db.query(models.StripeWebhookEvent)
        .filter(models.StripeWebhookEvent.stripe_event_id == event_id)
        .first()
    )
    if existing:
        return WebhookProcessResult(
            status="ignored",
            event_id=event_id,
            event_type=event_type,
        )

    webhook_event = models.StripeWebhookEvent(
        stripe_event_id=event_id,
        type=event_type,
        status=models.StripeWebhookEventStatus.received,
    )
    db.add(webhook_event)
    db.flush()

    event_object = _event_data_object(event)
    if event_type == "checkout.session.completed":
        _mark_payment_succeeded(db, event_object)
        webhook_event.status = models.StripeWebhookEventStatus.processed
    elif event_type == "payment_intent.succeeded":
        _mark_payment_succeeded(db, event_object)
        webhook_event.status = models.StripeWebhookEventStatus.processed
    elif event_type in {"payment_intent.payment_failed", "checkout.session.expired"}:
        _mark_payment_failed(db, event_object)
        webhook_event.status = models.StripeWebhookEventStatus.processed
    else:
        webhook_event.status = models.StripeWebhookEventStatus.ignored

    webhook_event.processed_at = dt.datetime.utcnow()
    db.add(webhook_event)
    db.commit()
    return WebhookProcessResult(
        status=webhook_event.status.value,
        event_id=event_id,
        event_type=event_type,
    )


def _event_data_object(event):
    data = _read_stripe_value(event, "data") or {}
    return _read_stripe_value(data, "object") or {}


def _mark_payment_succeeded(db: Session, event_object) -> None:
    payment = _find_payment_for_event_object(db, event_object)
    if payment is None:
        raise WebhookPayloadError("Payment not found for Stripe event.")

    payment.status = models.PaymentStatus.succeeded
    payment.paid_at = payment.paid_at or dt.datetime.utcnow()
    payment.stripe_payment_intent_id = (
        _read_stripe_value(event_object, "payment_intent")
        or _read_stripe_value(event_object, "id")
        or payment.stripe_payment_intent_id
    )
    payment.stripe_invoice_id = _read_stripe_value(event_object, "invoice") or payment.stripe_invoice_id

    appointment = payment.appointment
    if appointment and appointment.status in {
        models.AppointmentStatus.awaiting_payment,
        models.AppointmentStatus.pending,
    }:
        appointment.status = models.AppointmentStatus.validated
        db.add(appointment)
        if appointment.mode == models.AppointmentMode.visio:
            ensure_teleconsultation_session(db, appointment)
    db.add(payment)


def _mark_payment_failed(db: Session, event_object) -> None:
    payment = _find_payment_for_event_object(db, event_object)
    if payment is None:
        raise WebhookPayloadError("Payment not found for Stripe event.")
    if payment.status == models.PaymentStatus.succeeded:
        db.add(payment)
        return

    payment.status = models.PaymentStatus.failed
    appointment = payment.appointment
    if appointment and appointment.status == models.AppointmentStatus.awaiting_payment:
        appointment.status = models.AppointmentStatus.cancelled
        db.add(appointment)
    db.add(payment)


def _find_payment_for_event_object(db: Session, event_object) -> models.Payment | None:
    metadata = _read_stripe_value(event_object, "metadata") or {}
    payment_id = _read_stripe_value(metadata, "payment_id")
    if payment_id:
        try:
            return db.query(models.Payment).filter(models.Payment.id == int(payment_id)).first()
        except (TypeError, ValueError):
            return None

    checkout_session_id = _read_stripe_value(event_object, "id")
    payment_intent_id = _read_stripe_value(event_object, "payment_intent") or checkout_session_id
    if checkout_session_id:
        payment = (
            db.query(models.Payment)
            .filter(models.Payment.stripe_checkout_session_id == checkout_session_id)
            .first()
        )
        if payment:
            return payment
    if payment_intent_id:
        return (
            db.query(models.Payment)
            .filter(models.Payment.stripe_payment_intent_id == payment_intent_id)
            .first()
        )
    return None


def ensure_teleconsultation_session(
    db: Session,
    appointment: models.Appointment,
) -> models.TeleconsultationSession:
    """Create the room access record for a paid visio appointment."""

    existing = appointment.teleconsultation_session
    if existing:
        return existing

    appointment_start = dt.datetime.combine(appointment.date, appointment.time)
    session = models.TeleconsultationSession(
        appointment_id=appointment.id,
        livekit_room_name=f"precons-{appointment.id}-{uuid.uuid4().hex[:12]}",
        status=models.TeleconsultationSessionStatus.scheduled,
        access_link_token=secrets.token_urlsafe(32),
        access_link_expires_at=appointment_start + dt.timedelta(hours=6),
    )
    db.add(session)
    db.flush()
    return session
