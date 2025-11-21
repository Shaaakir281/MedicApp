"""CRUD utility functions.

This module groups common database operations used by the API routes. It
handles user creation and authentication, token generation, appointment
booking and questionnaire persistence. In a real application you might
separate responsibilities into dedicated modules or classes; for this
exercise they are collected here for simplicity.
"""

from __future__ import annotations

import datetime
import secrets
from typing import Optional, Dict, Any

import sqlalchemy as sa
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from core.config import get_settings
from services.ordonnances import build_ordonnance_context
from services.pdf import (
    generate_checklist_pdf,
    generate_consent_pdf,
)


def _normalize_procedure_type(
    value: str | models.ProcedureType,
) -> models.ProcedureType:
    if isinstance(value, models.ProcedureType):
        return value

    normalized = value
    if value in {"circumcision", "circoncision"}:
        normalized = "circumcision"

    return models.ProcedureType(normalized)


def get_available_slots(db: Session, date: datetime.date) -> list[str]:
    """Return a list of ISO-time strings representing available slots on a given day.

    For demonstration purposes, this returns every hour from 08:00 to 17:00 except
    those already booked in the appointments table.
    """
    today = datetime.date.today()
    if date < today:
        return []

    all_slots = [f"{hour:02d}:00" for hour in range(8, 18)]
    booked_times = (
        db.query(models.Appointment.time)
        .filter(models.Appointment.date == date)
        .all()
    )
    booked_set = {t[0].strftime("%H:%M") for t in booked_times}
    available = [slot for slot in all_slots if slot not in booked_set]

    if date == today:
        now_time = datetime.datetime.now().time().replace(second=0, microsecond=0)
        available = [
            slot for slot in available
            if datetime.datetime.strptime(slot, "%H:%M").time() >= now_time
        ]

    return available




def create_appointment(
    db: Session,
    user_id: int,
    date: datetime.date,
    time: datetime.time,
    appointment_type: str | models.AppointmentType = models.AppointmentType.general,
    procedure_id: int | None = None,
    mode: str | models.AppointmentMode | None = None,
) -> models.Appointment:
    """Create a new appointment if the slot is free. Raises ValueError if invalid."""
    appointment_dt = datetime.datetime.combine(date, time)
    if appointment_dt < datetime.datetime.now():
        raise ValueError("Impossible de planifier un rendez-vous dans le passe")

    if isinstance(appointment_type, str):
        appointment_type = models.AppointmentType(appointment_type)

    mode_enum = None
    if mode is not None:
        if isinstance(mode, str):
            try:
                mode_enum = models.AppointmentMode(mode)
            except ValueError as exc:
                raise ValueError("Mode de rendez-vous invalide") from exc
        else:
            mode_enum = mode

    conflict = (
        db.query(models.Appointment)
        .filter(models.Appointment.date == date, models.Appointment.time == time)
        .first()
    )
    if conflict:
        raise ValueError("Le creneau selectionne est deja reserve")

    procedure_case: models.ProcedureCase | None = None
    if appointment_type in {
        models.AppointmentType.preconsultation,
        models.AppointmentType.act,
    }:
        if procedure_id is None:
            procedure_case = get_active_procedure_case(db, user_id)
            if procedure_case is None:
                raise ValueError("Aucune procedure en cours pour ce patient")
        else:
            procedure_case = get_procedure_case_by_id(db, procedure_id, user_id=user_id)
            if procedure_case is None:
                raise ValueError("Procedure introuvable pour ce patient")

        if not procedure_case.parental_authority_ack:
            raise ValueError("Veuillez confirmer l'autorite parentale avant de reserver")

        existing_types = {
            appt.appointment_type for appt in procedure_case.appointments
        }
        if appointment_type in existing_types:
            raise ValueError("Un rendez-vous de ce type est deja planifie")

        if appointment_type == models.AppointmentType.act:
            if models.AppointmentType.preconsultation not in existing_types:
                raise ValueError("Planifiez d'abord la consultation pre-operatoire")
            pre_appt = next(
                (
                    appt
                    for appt in procedure_case.appointments
                    if appt.appointment_type == models.AppointmentType.preconsultation
                ),
                None,
            )
            if pre_appt:
                earliest_act_date = pre_appt.date + datetime.timedelta(days=14)
                if date < earliest_act_date:
                    raise ValueError(
                        f"Acte disponible a partir du {earliest_act_date.isoformat()} (14 jours apres la pre-consultation)."
                    )
        elif appointment_type == models.AppointmentType.preconsultation:
            act_appointments = [
                appt for appt in procedure_case.appointments if appt.appointment_type == models.AppointmentType.act
            ]
            if act_appointments:
                latest_allowed = min(appt.date for appt in act_appointments) - datetime.timedelta(days=14)
                if date > latest_allowed:
                    raise ValueError(
                        f"La pre-consultation doit avoir lieu au plus tard le {latest_allowed.isoformat()} "
                        "afin de respecter le delai de 14 jours avant l'acte."
                    )

    appointment = models.Appointment(
        user_id=user_id,
        date=date,
        time=time,
        appointment_type=appointment_type,
        procedure_id=procedure_case.id if procedure_case else None,
        mode=mode_enum,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    if procedure_case and appointment_type == models.AppointmentType.act:
        refreshed_case = get_procedure_case_by_id(db, procedure_case.id)
        if refreshed_case is not None:
            _ensure_consent_pdf(refreshed_case)
            db.add(refreshed_case)
            db.commit()
            db.refresh(refreshed_case)

    return appointment


def create_questionnaire(db: Session, appointment_id: int, data: dict) -> models.Questionnaire:
    """Persist questionnaire answers associated with an appointment."""
    questionnaire = models.Questionnaire(appointment_id=appointment_id, data=data)
    db.add(questionnaire)
    db.commit()
    db.refresh(questionnaire)
    return questionnaire




def get_procedure_case_by_id(
    db: Session,
    procedure_id: int,
    user_id: int | None = None,
) -> Optional[models.ProcedureCase]:
    query = (
        db.query(models.ProcedureCase)
        .options(joinedload(models.ProcedureCase.appointments))
        .filter(models.ProcedureCase.id == procedure_id)
    )
    if user_id is not None:
        query = query.filter(models.ProcedureCase.patient_id == user_id)
    return query.first()


def get_procedure_case_by_token(
    db: Session,
    token: str,
) -> Optional[models.ProcedureCase]:
    return (
        db.query(models.ProcedureCase)
        .filter(models.ProcedureCase.consent_download_token == token)
        .first()
    )


def get_active_procedure_case(db: Session, patient_id: int) -> Optional[models.ProcedureCase]:
    return (
        db.query(models.ProcedureCase)
        .options(
            joinedload(models.ProcedureCase.appointments).joinedload(models.Appointment.prescription)
        )
        .filter(models.ProcedureCase.patient_id == patient_id)
        .order_by(models.ProcedureCase.created_at.desc())
        .first()
    )


def _recompute_case_flags(case: models.ProcedureCase) -> None:
    missing = []
    if not case.child_full_name:
        missing.append("child_full_name")
    if not case.child_birthdate:
        missing.append("child_birthdate")
    if not case.parent1_name:
        missing.append("parent1_name")
    if not case.parent1_email:
        missing.append("parent1_email")
    if not case.parental_authority_ack:
        missing.append("parental_authority_ack")
    if not case.parent2_name or not case.parent2_email:
        missing.append("parent2_contact")
    case.missing_fields = missing
    required_fields = [case.child_full_name, case.child_birthdate, case.parent1_name, case.parent1_email]
    case.dossier_completed = all(required_fields) and bool(case.parental_authority_ack)


def _build_checklist_context(case: models.ProcedureCase) -> Dict[str, Any]:
    checklist_items = [
        {
            "label": (
                "Je comprends que la circoncision rituelle n'est pas "
                "motivee par une pathologie."
            ),
            "checked": case.parental_authority_ack,
        },
        {
            "label": (
                "Je suis titulaire de l'autorite parentale ou dispose de "
                "l'accord ecrit du second parent."
            ),
            "checked": case.parental_authority_ack,
        },
        {
            "label": (
                "J'ai fourni les informations medicales de l'enfant "
                "(age, poids, allergies, traitements)."
            ),
            "checked": bool(case.child_weight_kg is not None),
        },
        {
            "label": (
                "Je suis informe(e) des risques "
                "(saignement, infection, douleur, cicatrisation)."
            ),
            "checked": case.parental_authority_ack,
        },
    ]
    return {
        "checklist_items": checklist_items,
        "parent1_name": case.parent1_name,
        "parent2_name": case.parent2_name,
        "child_full_name": case.child_full_name,
        "child_birthdate": case.child_birthdate.strftime('%d/%m/%Y'),
        "child_weight": case.child_weight_kg or '',
    }


def _build_consent_context(case: models.ProcedureCase) -> Dict[str, Any]:
    return {
        "parent1_name": case.parent1_name,
        "parent1_email": case.parent1_email,
        "parent2_name": case.parent2_name,
        "parent2_email": case.parent2_email,
        "child_full_name": case.child_full_name,
        "child_birthdate": case.child_birthdate.strftime('%d/%m/%Y'),
        "child_weight": case.child_weight_kg or '',
        "checklist_notes": case.notes or '',
        "parent1_signed_at": None,
        "parent2_signed_at": None,
    }


def _build_ordonnance_context(case: models.ProcedureCase) -> Dict[str, Any]:
    act_appointment = next(
        (
            appt
            for appt in case.appointments
            if appt.appointment_type == models.AppointmentType.act
        ),
        None,
    )

    settings = get_settings()
    reference = f"ORD-{case.id:05d}-{datetime.date.today():%m%y}"
    verification_url = (
        f"{settings.app_base_url.rstrip('/')}/patients/cases/{case.id}/ordonnance/{reference}"
    )
    context = build_ordonnance_context(
        patient_name=case.child_full_name,
        patient_birthdate=case.child_birthdate,
        patient_weight=case.child_weight_kg,
        intervention_date=act_appointment.date if act_appointment else None,
        appointment_type="act",
        reference=reference,
        verification_url=verification_url,
        guardian_name=case.parent1_name,
        guardian_email=case.parent1_email,
    )
    return context


def _ensure_consent_pdf(case: models.ProcedureCase) -> None:
    try:
        case.checklist_pdf_path = generate_checklist_pdf(
            _build_checklist_context(case)
        )
        case.consent_pdf_path = generate_consent_pdf(_build_consent_context(case))
        if not case.consent_download_token:
            case.consent_download_token = secrets.token_urlsafe(24)
    except Exception:
        pass


def create_procedure_case(
    db: Session,
    patient_id: int,
    case_data,
) -> models.ProcedureCase:
    procedure_type = _normalize_procedure_type(case_data.procedure_type)
    procedure = models.ProcedureCase(
        patient_id=patient_id,
        procedure_type=procedure_type,
        child_full_name=case_data.child_full_name,
        child_birthdate=case_data.child_birthdate,
        child_weight_kg=case_data.child_weight_kg,
        parent1_name=case_data.parent1_name,
        parent1_email=case_data.parent1_email,
        parent2_name=case_data.parent2_name,
        parent2_email=case_data.parent2_email,
        parental_authority_ack=case_data.parental_authority_ack,
        notes=case_data.notes,
        consent_download_token=secrets.token_urlsafe(24),
    )
    _recompute_case_flags(procedure)
    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    _ensure_consent_pdf(procedure)
    _recompute_case_flags(procedure)
    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    return procedure


def update_procedure_case(
    db: Session,
    procedure: models.ProcedureCase,
    case_data,
) -> models.ProcedureCase:
    procedure.procedure_type = _normalize_procedure_type(case_data.procedure_type)
    procedure.child_full_name = case_data.child_full_name
    procedure.child_birthdate = case_data.child_birthdate
    procedure.child_weight_kg = case_data.child_weight_kg
    procedure.parent1_name = case_data.parent1_name
    procedure.parent1_email = case_data.parent1_email
    procedure.parent2_name = case_data.parent2_name
    procedure.parent2_email = case_data.parent2_email
    procedure.parental_authority_ack = case_data.parental_authority_ack
    procedure.notes = case_data.notes
    _recompute_case_flags(procedure)
    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    _ensure_consent_pdf(procedure)
    _recompute_case_flags(procedure)
    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    return procedure


def upsert_pharmacy_contact(
    db: Session,
    payload: schemas.PharmacyContactCreate,
) -> models.PharmacyContact:
    """Insert or update a pharmacy contact entry from the national directory."""
    data = payload.model_dump(exclude_unset=True)
    external_id = data.get("external_id")
    ms_sante_address = data.get("ms_sante_address")

    query = db.query(models.PharmacyContact)
    entry = None
    if external_id:
        entry = query.filter(models.PharmacyContact.external_id == external_id).first()
    if entry is None and ms_sante_address:
        entry = query.filter(models.PharmacyContact.ms_sante_address == ms_sante_address).first()
    if entry is None:
        entry = (
            query.filter(
                sa.func.lower(models.PharmacyContact.name) == data["name"].lower(),
                models.PharmacyContact.postal_code == data["postal_code"],
            )
            .order_by(models.PharmacyContact.id.asc())
            .first()
        )

    if entry:
        for field, value in data.items():
            if value is not None:
                setattr(entry, field, value)
    else:
        entry = models.PharmacyContact(**data)
        db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def search_pharmacies(
    db: Session,
    *,
    query: str,
    city: str | None = None,
    limit: int = 10,
    offset: int = 0,
) -> tuple[list[models.PharmacyContact], int]:
    normalized = f"%{query.lower()}%"
    stmt = db.query(models.PharmacyContact).filter(models.PharmacyContact.is_active.is_(True))
    stmt = stmt.filter(
        sa.or_(
            sa.func.lower(models.PharmacyContact.name).like(normalized),
            sa.func.lower(models.PharmacyContact.city).like(normalized),
            sa.func.lower(models.PharmacyContact.postal_code).like(normalized),
            sa.func.lower(models.PharmacyContact.ms_sante_address).like(normalized),
        )
    )
    if city:
        stmt = stmt.filter(sa.func.lower(models.PharmacyContact.city) == city.lower())
    total = stmt.count()
    entries = (
        stmt.order_by(models.PharmacyContact.name.asc())
        .offset(max(0, offset))
        .limit(min(limit, 50))
        .all()
    )
    return entries, total

