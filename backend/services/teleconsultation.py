"""Teleconsultation access and LiveKit token helpers."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import models
from core.config import Settings
from sqlalchemy.orm import Session


class TeleconsultationNotFoundError(RuntimeError):
    """Raised when a teleconsultation resource cannot be found."""


class TeleconsultationAccessError(RuntimeError):
    """Raised when the current user cannot access the teleconsultation."""


class TeleconsultationConflictError(RuntimeError):
    """Raised when a one-time access link has already been consumed."""


class TeleconsultationConfigurationError(RuntimeError):
    """Raised when LiveKit settings are incomplete for the current environment."""


@dataclass(frozen=True)
class TeleconsultationTokenResult:
    appointment_id: int
    room_name: str
    livekit_url: str
    token: str
    expires_in: int
    mock: bool = False


def issue_patient_token(
    *,
    db: Session,
    appointment_id: int,
    patient: models.User,
    access_token: str,
    settings: Settings,
) -> TeleconsultationTokenResult:
    appointment = _get_ready_appointment(db, appointment_id)
    if appointment.user_id != patient.id:
        raise TeleconsultationAccessError("Acces refuse a cette teleconsultation.")

    session = appointment.teleconsultation_session
    if session is None:
        raise TeleconsultationNotFoundError("Session de teleconsultation introuvable.")
    if session.access_link_token != access_token:
        raise TeleconsultationAccessError("Lien de teleconsultation invalide.")
    if session.access_link_used_at is not None:
        raise TeleconsultationConflictError("Lien de teleconsultation deja utilise.")
    if session.access_link_expires_at and session.access_link_expires_at < dt.datetime.utcnow():
        raise TeleconsultationAccessError("Lien de teleconsultation expire.")

    _ensure_access_window(appointment, settings)
    result = _build_livekit_token(
        settings=settings,
        appointment_id=appointment.id,
        room_name=session.livekit_room_name,
        identity=f"patient-{patient.id}",
        display_name=patient.email or f"Patient {patient.id}",
    )
    session.access_link_used_at = dt.datetime.utcnow()
    db.add(session)
    db.commit()
    return result


def issue_practitioner_token(
    *,
    db: Session,
    appointment_id: int,
    practitioner: models.User,
    settings: Settings,
) -> TeleconsultationTokenResult:
    appointment = _get_ready_appointment(db, appointment_id)
    session = appointment.teleconsultation_session
    if session is None:
        raise TeleconsultationNotFoundError("Session de teleconsultation introuvable.")

    _ensure_access_window(appointment, settings)
    return _build_livekit_token(
        settings=settings,
        appointment_id=appointment.id,
        room_name=session.livekit_room_name,
        identity=f"practitioner-{practitioner.id}",
        display_name=practitioner.email or "Praticien",
    )


def _get_ready_appointment(db: Session, appointment_id: int) -> models.Appointment:
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if appointment is None:
        raise TeleconsultationNotFoundError("Rendez-vous introuvable.")
    if appointment.mode != models.AppointmentMode.visio:
        raise TeleconsultationAccessError("Ce rendez-vous n'est pas en teleconsultation.")
    if appointment.status != models.AppointmentStatus.validated:
        raise TeleconsultationAccessError("Paiement non valide pour cette teleconsultation.")
    if not appointment.payment or appointment.payment.status != models.PaymentStatus.succeeded:
        raise TeleconsultationAccessError("Paiement non valide pour cette teleconsultation.")
    return appointment


def _ensure_access_window(appointment: models.Appointment, settings: Settings) -> None:
    now = dt.datetime.utcnow()
    start = dt.datetime.combine(appointment.date, appointment.time)
    opens_at = start - dt.timedelta(minutes=settings.teleconsultation_access_before_minutes)
    closes_at = start + dt.timedelta(minutes=settings.teleconsultation_access_after_minutes)
    if now < opens_at:
        raise TeleconsultationAccessError("La teleconsultation n'est pas encore ouverte.")
    if now > closes_at:
        raise TeleconsultationAccessError("La teleconsultation est terminee.")


def _build_livekit_token(
    *,
    settings: Settings,
    appointment_id: int,
    room_name: str,
    identity: str,
    display_name: str,
) -> TeleconsultationTokenResult:
    expires_in = settings.livekit_token_ttl_minutes * 60
    if not (settings.livekit_url and settings.livekit_api_key and settings.livekit_api_secret):
        if settings.environment.lower() == "production":
            raise TeleconsultationConfigurationError("LiveKit configuration is required in production.")
        return TeleconsultationTokenResult(
            appointment_id=appointment_id,
            room_name=room_name,
            livekit_url=settings.livekit_url or "wss://mock.livekit.local",
            token=f"mock_livekit_token:{room_name}:{identity}",
            expires_in=expires_in,
            mock=True,
        )

    try:
        from livekit import api
    except ImportError as exc:  # pragma: no cover - dependency checked in runtime env
        raise TeleconsultationConfigurationError("The livekit-api Python package is not installed.") from exc

    grants = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
    )
    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(display_name)
        .with_grants(grants)
        .with_ttl(dt.timedelta(seconds=expires_in))
        .to_jwt()
    )
    return TeleconsultationTokenResult(
        appointment_id=appointment_id,
        room_name=room_name,
        livekit_url=settings.livekit_url,
        token=token,
        expires_in=expires_in,
        mock=False,
    )
