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
DEFAULT_START_DATE = dt.date.today()
DEFAULT_DAYS = 28
MIN_PATIENTS_PER_DAY = 3
MAX_PATIENTS_PER_DAY = 4

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


def _build_time_grid(start: dt.time, end: dt.time, step_minutes: int) -> list[dt.time]:
    times: list[dt.time] = []
    cursor = dt.datetime.combine(dt.date.today(), start)
    end_dt = dt.datetime.combine(dt.date.today(), end)
    while cursor <= end_dt:
        times.append(cursor.time())
        cursor += dt.timedelta(minutes=step_minutes)
    return times


PRECONSULT_FALLBACK_TIMES = _build_time_grid(
    dt.time(hour=8, minute=0),
    dt.time(hour=12, minute=30),
    30,
)
ACT_FALLBACK_TIMES = _build_time_grid(
    dt.time(hour=13, minute=0),
    dt.time(hour=18, minute=0),
    30,
)


def _rotate_times(times: list[dt.time], offset: int) -> list[dt.time]:
    if not times:
        return []
    return [times[(offset + idx) % len(times)] for idx in range(len(times))]


def _dedupe_times(times: list[dt.time]) -> list[dt.time]:
    seen: set[dt.time] = set()
    deduped: list[dt.time] = []
    for time_ in times:
        if time_ in seen:
            continue
        seen.add(time_)
        deduped.append(time_)
    return deduped


def _candidate_times(
    day: dt.date,
    day_index: int,
    slot: int,
    base_times: list[dt.time],
    fallback_times: list[dt.time],
) -> list[dt.time]:
    times = _rotate_times(base_times, day_index + slot) + list(fallback_times)
    if day == dt.date.today():
        min_time = (dt.datetime.now().replace(second=0, microsecond=0) + dt.timedelta(minutes=30)).time()
        times = [time_ for time_ in times if time_ >= min_time]
    return _dedupe_times(times)


def _patients_per_day(day_index: int) -> int:
    span = MAX_PATIENTS_PER_DAY - MIN_PATIENTS_PER_DAY + 1
    if span <= 0:
        return MIN_PATIENTS_PER_DAY
    return MIN_PATIENTS_PER_DAY + (day_index % span)


def _create_appointment_with_retry(create_fn, db: Session, time_candidates: list[dt.time]):
    for time_ in time_candidates:
        try:
            return create_fn(time_)
        except ValueError as exc:
            msg = str(exc).lower()
            if "creneau" in msg or "passe" in msg:
                db.rollback()
                continue
            raise
    return None


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
        act_offset_days=15,
    ),
    CaseProfile(
        label="consentement_manquant",
        preconsult_mode=models.AppointmentMode.presentiel,
        act_offset_days=16,
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
        act_offset_days=18,
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


def case_payload(index: int, profile: CaseProfile, preconsult_date: dt.date) -> object:
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
            "parent1_phone": f"+3360000{index:04d}",
            "parent2_phone": f"+3361000{index:04d}",
            "parent1_sms_optin": True,
            "parent2_sms_optin": True,
            "parental_authority_ack": True,
            "notes": f"{DEMO_TAG} Profil {profile.label}",
            "preconsultation_date": preconsult_date,
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
    slots: int,
    patient_counter: itertools.count,
) -> None:
    for slot in range(slots):
        pre_fallback = PRECONSULT_FALLBACK_TIMES
        if day == dt.date.today():
            pre_fallback = PRECONSULT_FALLBACK_TIMES + ACT_FALLBACK_TIMES
        pre_candidates = _candidate_times(day, day_index, slot, PRECONSULT_TIMES, pre_fallback)
        if not pre_candidates:
            continue

        patient_idx = next(patient_counter)
        profile = PROFILES[(patient_idx - 1) % len(PROFILES)]
        patient = create_patient(db, patient_idx)

        payload = case_payload(patient_idx, profile, preconsult_date=day)
        case = crud.create_procedure_case(db=db, patient_id=patient.id, case_data=payload)

        pre_appt = _create_appointment_with_retry(
            lambda time_: create_preconsultation(
                db=db,
                patient=patient,
                case=case,
                date_=day,
                time_=time_,
                mode=profile.preconsult_mode,
            ),
            db,
            pre_candidates,
        )
        if pre_appt is None:
            db.delete(case)
            db.commit()
            if not db.query(models.ProcedureCase).filter(
                models.ProcedureCase.patient_id == patient.id
            ).first():
                db.delete(patient)
                db.commit()
            continue

        mark_reminder_sent(db, pre_appt, opened=(patient_idx % 2 == 0))

        if profile.act_offset_days is not None:
            acte_date = day + dt.timedelta(days=profile.act_offset_days)
            act_candidates = _candidate_times(acte_date, day_index, slot, ACT_TIMES, ACT_FALLBACK_TIMES)
            act_appt = _create_appointment_with_retry(
                lambda time_: create_act(
                    db=db,
                    patient=patient,
                    case=case,
                    date_=acte_date,
                    time_=time_,
                ),
                db,
                act_candidates,
            )
            if act_appt is not None:
                mark_reminder_sent(db, act_appt, opened=(patient_idx % 3 != 0))

        mark_case_flags(db, case, profile)


def clear_demo_data(db: Session) -> None:
    cases = db.query(models.ProcedureCase).filter(models.ProcedureCase.notes.contains(DEMO_TAG)).all()
    case_ids = [case.id for case in cases]
    if case_ids:
        appointment_rows = (
            db.query(models.Appointment.id)
            .filter(models.Appointment.procedure_id.in_(case_ids))
            .all()
        )
        appointment_ids = [row[0] for row in appointment_rows]
        if appointment_ids:
            db.query(models.SignatureCabinetSession).filter(
                models.SignatureCabinetSession.appointment_id.in_(appointment_ids)
            ).delete(synchronize_session=False)
            db.query(models.LegalAcknowledgement).filter(
                models.LegalAcknowledgement.appointment_id.in_(appointment_ids)
            ).delete(synchronize_session=False)
            db.commit()

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


def generate_demo(db: Session, days: int, reset: bool, start_date: dt.date) -> None:
    if reset:
        clear_demo_data(db)

    ensure_practitioner(db)

    patient_counter = itertools.count(1)
    for offset in range(days):
        day = start_date + dt.timedelta(days=offset)
        slots = _patients_per_day(offset)
        seed_for_day(db, day, offset, slots, patient_counter)

    print(f"[seed] Données praticien insérées pour {days} jours à partir du {start_date}.")
    print(f"[seed] Connexion praticien : {practitioner_email(1)} / password")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data for practitioner dashboard.")
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_DAYS,
        help="Nombre de jours consecutifs a generer (par defaut 28).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Supprimer les données de démonstration existantes avant insertion.",
    )
    parser.add_argument(
        "--start-date",
        type=lambda value: dt.datetime.strptime(value, "%Y-%m-%d").date(),
        help="Date de début (YYYY-MM-DD). Par défaut : aujourd'hui.",
    )
    args = parser.parse_args()

    start_date = args.start_date or DEFAULT_START_DATE

    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        generate_demo(db, days=args.days, reset=args.reset, start_date=start_date)
    finally:
        db.close()


if __name__ == "__main__":
    main()


