"""Seed dataset for the practitioner dashboard demo.

This script inserts patients, procedure cases and appointments covering
23 jours consécutifs à partir du 3 février 2026. Les données portent
le tag ``[demo]`` pour permettre un nettoyage ultérieur.
"""
from __future__ import annotations

import argparse
import datetime as dt
import itertools
from dataclasses import dataclass

from sqlalchemy.orm import Session

import crud
from core import security
import models
from database import SessionLocal, engine

DEMO_TAG = "[demo]"
DEFAULT_PASSWORD_HASH = (
    "$2b$12$F0iUOJ6Q0iog8EPb28u16uJNmZQ7M1pJ2B8MblU5ZLsBLAiNrLyZu"  # "password"
)
DEMO_DOMAIN = "demo.medicapp"
START_DATE = dt.date(2026, 2, 3)
DEFAULT_DAYS = 23
PATIENTS_PER_DAY = 3

PRECONSULT_TIMES = [
    dt.time(hour=8, minute=30),
    dt.time(hour=10, minute=0),
    dt.time(hour=11, minute=30),
    dt.time(hour=9, minute=15),
]

ACT_TIMES = [
    dt.time(hour=14, minute=0),
    dt.time(hour=15, minute=30),
    dt.time(hour=17, minute=0),
    dt.time(hour=13, minute=45),
]


@dataclass
class CaseProfile:
    label: str
    preconsult_mode: models.AppointmentMode
    act_offset_days: int | None
    mark_missing_consent: bool = False
    add_followup_note: str | None = None
    mark_requires_call: bool = False


PROFILES: list[CaseProfile] = [
    CaseProfile(
        label="complet",
        preconsult_mode=models.AppointmentMode.visio,
        act_offset_days=7,
    ),
    CaseProfile(
        label="consentement_manquant",
        preconsult_mode=models.AppointmentMode.presentiel,
        act_offset_days=10,
        mark_missing_consent=True,
        add_followup_note="Consentement à relancer - en attente de signature.",
    ),
    CaseProfile(
        label="preconsult_seule",
        preconsult_mode=models.AppointmentMode.visio,
        act_offset_days=None,
        mark_requires_call=True,
        add_followup_note="Pré-consultation terminée, acte à programmer.",
    ),
    CaseProfile(
        label="acte_planifie",
        preconsult_mode=models.AppointmentMode.presentiel,
        act_offset_days=14,
    ),
]


def practitioner_email(index: int) -> str:
    return f"praticien.demo{index}@{DEMO_DOMAIN}"


def patient_email(index: int) -> str:
    return f"patient{index:03d}@{DEMO_DOMAIN}"


def parent_email(index: int, suffix: str) -> str:
    return f"parent{index:03d}{suffix}@{DEMO_DOMAIN}"


def ensure_practitioner(db: Session) -> models.User:
    email = practitioner_email(1)
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        return user

    user = models.User(
        email=email,
        hashed_password=security.hash_password("password"),
        role=models.UserRole.praticien,
        email_verified=True,
        created_at=dt.datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_patient(db: Session, index: int) -> models.User:
    email = patient_email(index)
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        return existing

    patient = models.User(
        email=email,
        hashed_password=DEFAULT_PASSWORD_HASH,
        role=models.UserRole.patient,
        email_verified=True,
        created_at=dt.datetime.utcnow(),
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def case_payload(index: int, profile: CaseProfile) -> object:
    child_birthdate = dt.date(2024, 6, 1) + dt.timedelta(days=index * 9)
    return type(
        "CaseData",
        (object,),
        {
            "procedure_type": "circumcision",
            "child_full_name": f"Enfant Demo {index:03d}",
            "child_birthdate": child_birthdate,
            "child_weight_kg": round(6.0 + (index % 5) * 0.4, 1),
            "parent1_name": f"Parent A Demo {index:03d}",
            "parent1_email": parent_email(index, "a"),
            "parent2_name": f"Parent B Demo {index:03d}",
            "parent2_email": parent_email(index, "b"),
            "parental_authority_ack": True,
            "notes": f"{DEMO_TAG} Profil {profile.label}",
        },
    )()


def mark_case_flags(db: Session, case: models.ProcedureCase, profile: CaseProfile) -> None:
    updated = False
    if profile.mark_missing_consent:
        case.consent_pdf_path = None
        case.consent_download_token = None
        case.checklist_pdf_path = None
        updated = True
    if profile.add_followup_note:
        case.notes = f"{case.notes} | {profile.add_followup_note}".strip()
        updated = True
    if profile.mark_requires_call:
        case.notes = f"{case.notes} | {DEMO_TAG} Relance téléphonique".strip()
        updated = True
    if updated:
        db.add(case)
        db.commit()
        db.refresh(case)


def create_preconsultation(
    db: Session,
    patient: models.User,
    case: models.ProcedureCase,
    date_: dt.date,
    time_: dt.time,
    mode: models.AppointmentMode,
) -> models.Appointment:
    return crud.create_appointment(
        db=db,
        user_id=patient.id,
        date=date_,
        time=time_,
        appointment_type=models.AppointmentType.preconsultation,
        procedure_id=case.id,
        mode=mode.value,
    )


def create_act(
    db: Session,
    patient: models.User,
    case: models.ProcedureCase,
    date_: dt.date,
    time_: dt.time,
) -> models.Appointment:
    return crud.create_appointment(
        db=db,
        user_id=patient.id,
        date=date_,
        time=time_,
        appointment_type=models.AppointmentType.act,
        procedure_id=case.id,
        mode=models.AppointmentMode.presentiel.value,
    )


def mark_reminder_sent(
    db: Session,
    appointment: models.Appointment,
    opened: bool = False,
) -> None:
    send_at = dt.datetime.combine(appointment.date, appointment.time) - dt.timedelta(days=7)
    if send_at > dt.datetime.utcnow():
        send_at = dt.datetime.utcnow() - dt.timedelta(hours=1)
    appointment.reminder_sent_at = send_at
    appointment.reminder_opened_at = send_at + dt.timedelta(hours=2) if opened else None
    db.add(appointment)
    db.commit()
    db.refresh(appointment)


def seed_for_day(
    db: Session,
    day: dt.date,
    day_index: int,
    patient_counter: itertools.count,
) -> None:
    for slot in range(PATIENTS_PER_DAY):
        profile = PROFILES[(day_index * PATIENTS_PER_DAY + slot) % len(PROFILES)]
        patient_idx = next(patient_counter)
        patient = create_patient(db, patient_idx)

        payload = case_payload(patient_idx, profile)
        case = crud.create_procedure_case(db=db, patient_id=patient.id, case_data=payload)

        pre_time = PRECONSULT_TIMES[(day_index + slot) % len(PRECONSULT_TIMES)]
        pre_appt = create_preconsultation(
            db=db,
            patient=patient,
            case=case,
            date_=day,
            time_=pre_time,
            mode=profile.preconsult_mode,
        )
        mark_reminder_sent(db, pre_appt, opened=(patient_idx % 2 == 0))

        if profile.act_offset_days is not None:
            acte_date = day + dt.timedelta(days=profile.act_offset_days)
            act_time = ACT_TIMES[(day_index + slot) % len(ACT_TIMES)]
            act_appt = create_act(db=db, patient=patient, case=case, date_=acte_date, time_=act_time)
            mark_reminder_sent(db, act_appt, opened=(patient_idx % 3 != 0))

        mark_case_flags(db, case, profile)


def clear_demo_data(db: Session) -> None:
    cases = db.query(models.ProcedureCase).filter(models.ProcedureCase.notes.contains(DEMO_TAG)).all()
    for case in cases:
        db.delete(case)
    db.commit()

    demo_users = (
        db.query(models.User)
        .filter(models.User.email.like(f"%@{DEMO_DOMAIN}"))
        .filter(models.User.role == models.UserRole.patient)
        .all()
    )
    for user in demo_users:
        db.delete(user)
    db.commit()


def generate_demo(db: Session, days: int, reset: bool) -> None:
    if reset:
        clear_demo_data(db)

    ensure_practitioner(db)

    patient_counter = itertools.count(1)
    for offset in range(days):
        day = START_DATE + dt.timedelta(days=offset)
        seed_for_day(db, day, offset, patient_counter)

    print(f"[seed] Données praticien insérées pour {days} jours à partir du {START_DATE}.")
    print(f"[seed] Connexion praticien : {practitioner_email(1)} / password")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data for practitioner dashboard.")
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_DAYS,
        help="Nombre de jours consécutifs à générer (par défaut 23).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Supprimer les données de démonstration existantes avant insertion.",
    )
    args = parser.parse_args()

    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        generate_demo(db, days=args.days, reset=args.reset)
    finally:
        db.close()


if __name__ == "__main__":
    main()


