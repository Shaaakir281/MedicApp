"""Payment helpers for the preconsultation pay-to-book workflow."""

from __future__ import annotations

from dataclasses import dataclass

import models
from core.config import Settings


class PaymentConfigurationError(RuntimeError):
    """Raised when payment settings are incomplete for the current environment."""


class PaymentProviderError(RuntimeError):
    """Raised when Stripe cannot create or confirm a payment resource."""


@dataclass(frozen=True)
class CheckoutSessionResult:
    session_id: str
    url: str
    mock: bool = False


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
            metadata={
                "payment_id": str(payment.id),
                "appointment_id": str(appointment.id),
                "user_id": str(user.id),
                "appointment_type": models.AppointmentType.preconsultation.value,
            },
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
