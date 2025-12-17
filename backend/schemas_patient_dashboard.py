"""Pydantic models for the patient dashboard read model."""

from __future__ import annotations

from datetime import date, datetime, time as time_type
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

import schemas


class DashboardChild(BaseModel):
    full_name: Optional[str] = None
    birthdate: Optional[date] = None
    weight_kg: Optional[float] = None
    notes: Optional[str] = None


class GuardianContact(BaseModel):
    label: str
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    sms_optin: bool = False
    receives_codes: bool = False
    phone_verified_at: Optional[datetime] = None
    signature_link: Optional[str] = None


class ContactVerificationStatus(BaseModel):
    parent1_verified: bool = False
    parent2_verified: bool = False
    parent1_verified_at: Optional[datetime] = None
    parent2_verified_at: Optional[datetime] = None


class DashboardAppointment(BaseModel):
    id: int
    date: date
    time: time_type
    appointment_type: str
    status: str
    mode: Optional[str] = None
    procedure_id: Optional[int] = None
    prescription_id: Optional[int] = None
    prescription_signed_at: Optional[datetime] = None
    prescription_signed: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class AppointmentsBlock(BaseModel):
    upcoming: List[DashboardAppointment] = Field(default_factory=list)
    history: List[DashboardAppointment] = Field(default_factory=list)


class SignatureEntry(BaseModel):
    signer_role: str
    status: Optional[str] = None
    sent_at: Optional[datetime] = None
    signed_at: Optional[datetime] = None
    method: Optional[str] = None
    signature_link: Optional[str] = None


class SignatureBlock(BaseModel):
    yousign_procedure_id: Optional[str] = None
    signed_pdf_url: Optional[str] = None
    evidence_pdf_url: Optional[str] = None
    entries: List[SignatureEntry] = Field(default_factory=list)


class PatientDashboard(BaseModel):
    appointment_id: int
    patient_id: Optional[int] = None
    procedure_case_id: Optional[int] = None
    child: DashboardChild
    guardians: List[GuardianContact] = Field(default_factory=list)
    contact_verification: Optional[ContactVerificationStatus] = None
    appointments: AppointmentsBlock
    legal_status: Optional[schemas.LegalStatusResponse] = None
    signature: SignatureBlock
