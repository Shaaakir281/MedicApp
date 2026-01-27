"""Read-model aggregation service for the patient dashboard."""

from __future__ import annotations

import datetime as dt

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

import models
import schemas
import schemas_patient_dashboard as dashboard_schemas
from services import legal as legal_service


def _load_appointment(db: Session, appointment_id: int) -> models.Appointment:
    appointment = (
        db.query(models.Appointment)
        .options(
            joinedload(models.Appointment.user),
            joinedload(models.Appointment.procedure_case)
            .joinedload(models.ProcedureCase.appointments)
            .joinedload(models.Appointment.prescription),
        )
        .filter(models.Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable.")
    return appointment


def _serialize_appointment(appt: models.Appointment) -> dashboard_schemas.DashboardAppointment:
    prescription = getattr(appt, "prescription", None)
    return dashboard_schemas.DashboardAppointment(
        id=appt.id,
        date=appt.date,
        time=appt.time,
        appointment_type=appt.appointment_type.value if hasattr(appt.appointment_type, "value") else appt.appointment_type,
        status=appt.status.value if hasattr(appt.status, "value") else appt.status,
        mode=appt.mode.value if hasattr(appt.mode, "value") else appt.mode,
        procedure_id=appt.procedure_id,
        prescription_id=prescription.id if prescription else None,
        prescription_signed_at=prescription.signed_at if prescription else None,
        prescription_signed=bool(prescription and prescription.signed_at),
    )


def get_appointment(db: Session, appointment_id: int) -> models.Appointment:
    """Return appointment with related case/prescriptions loaded."""
    return _load_appointment(db, appointment_id)


def build_dashboard(db: Session, appointment: models.Appointment) -> dashboard_schemas.PatientDashboard:
    """Assemble the patient dashboard read model without mutating state."""
    case = appointment.procedure_case
    patient = appointment.user

    child = dashboard_schemas.DashboardChild(
        full_name=getattr(case, "child_full_name", None),
        birthdate=getattr(case, "child_birthdate", None),
        weight_kg=getattr(case, "child_weight_kg", None),
        notes=getattr(case, "notes", None),
    )

    guardians: list[dashboard_schemas.GuardianContact] = []
    contact_verification = None

    if case:
        guardians.append(
            dashboard_schemas.GuardianContact(
                label="parent1",
                name=case.parent1_name,
                email=case.parent1_email,
                phone=case.parent1_phone,
                sms_optin=case.parent1_sms_optin,
                receives_codes=case.parent1_sms_optin,
                phone_verified_at=case.parent1_phone_verified_at,
            )
        )

        if case.parent2_name or case.parent2_email or case.parent2_phone:
            guardians.append(
                dashboard_schemas.GuardianContact(
                    label="parent2",
                    name=case.parent2_name,
                    email=case.parent2_email,
                    phone=case.parent2_phone,
                    sms_optin=case.parent2_sms_optin,
                    receives_codes=case.parent2_sms_optin,
                    phone_verified_at=case.parent2_phone_verified_at,
                )
            )

        contact_verification = dashboard_schemas.ContactVerificationStatus(
            parent1_verified=bool(case.parent1_phone_verified_at),
            parent1_verified_at=case.parent1_phone_verified_at,
            parent2_verified=bool(case.parent2_phone_verified_at),
            parent2_verified_at=case.parent2_phone_verified_at,
        )
    else:
        guardians.append(
            dashboard_schemas.GuardianContact(
                label="patient",
                name=None,
                email=getattr(patient, "email", None),
                phone=None,
                sms_optin=False,
                receives_codes=False,
                phone_verified_at=None,
            )
        )

    appointments_source = case.appointments if case and case.appointments else [appointment]
    upcoming: list[dashboard_schemas.DashboardAppointment] = []
    history: list[dashboard_schemas.DashboardAppointment] = []
    now = dt.datetime.utcnow()
    for appt in sorted(appointments_source, key=lambda a: (a.date, a.time)):
        entry = _serialize_appointment(appt)
        appt_dt = dt.datetime.combine(appt.date, appt.time)
        if appt_dt >= now:
            upcoming.append(entry)
        else:
            history.append(entry)

    legal_status: schemas.LegalStatusResponse | None = None
    try:
        legal_status = legal_service.compute_status(db, appointment.id)
    except HTTPException:
        # Preserve existing behaviour: dashboard should still render if legal status fails
        legal_status = None

    appointments_block = dashboard_schemas.AppointmentsBlock(upcoming=upcoming, history=history)

    return dashboard_schemas.PatientDashboard(
        appointment_id=appointment.id,
        patient_id=patient.id if patient else None,
        procedure_case_id=case.id if case else None,
        child=child,
        guardians=guardians,
        contact_verification=contact_verification,
        appointments=appointments_block,
        legal_status=legal_status,
    )
