"""Pydantic models for API requests and responses."""

from __future__ import annotations

from datetime import date, datetime, time as time_type
import datetime as dt
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = Field(default="bearer")


class TokenRefresh(BaseModel):
    access_token: str
    token_type: str = Field(default="bearer")


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    role: str


class User(UserBase):
    id: int
    role: str
    created_at: datetime
    email_verified: bool

    model_config = ConfigDict(from_attributes=True)


class AppointmentBase(BaseModel):
    date: date
    time: time_type


class AppointmentCreate(AppointmentBase):
    pass


class Appointment(AppointmentBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    appointment_type: str
    mode: Optional[str] = None
    procedure_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class QuestionnaireTemplate(BaseModel):
    template: Dict[str, Any]


class QuestionnaireCreate(BaseModel):
    data: Dict[str, Any]


class Questionnaire(BaseModel):
    id: int
    appointment_id: int
    data: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    detail: str


class ProcedureCaseBase(BaseModel):
    procedure_type: str = Field(default="circumcision")
    child_full_name: str
    child_birthdate: date
    child_weight_kg: Optional[float] = None
    parent1_name: str
    parent1_email: Optional[EmailStr] = None
    parent2_name: Optional[str] = None
    parent2_email: Optional[EmailStr] = None
    parental_authority_ack: bool = False
    notes: Optional[str] = None


class ProcedureCaseCreate(ProcedureCaseBase):
    pass


class ProcedureCase(ProcedureCaseBase):
    id: int
    created_at: datetime
    updated_at: datetime
    checklist_pdf_path: Optional[str] = None
    consent_pdf_path: Optional[str] = None
    consent_download_url: Optional[str] = None
    ordonnance_pdf_path: Optional[str] = None
    child_age_years: float
    appointments: List[Appointment] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PractitionerPatientSummary(BaseModel):
    id: int
    email: EmailStr
    child_full_name: str


class PractitionerCaseStatus(BaseModel):
    case_id: int
    child_birthdate: date
    child_full_name: Optional[str] = None
    child_weight_kg: Optional[float] = None
    parent1_name: Optional[str] = None
    parent1_email: Optional[EmailStr] = None
    parent2_name: Optional[str] = None
    parent2_email: Optional[EmailStr] = None
    parental_authority_ack: bool
    has_checklist: bool
    has_consent: bool
    has_ordonnance: bool
    has_preconsultation: bool
    has_act_planned: bool
    next_act_date: Optional[date] = None
    next_preconsultation_date: Optional[date] = None
    notes: Optional[str] = None
    missing_items: List[str] = Field(default_factory=list)
    needs_follow_up: bool
    appointments_overview: List["PractitionerAppointmentSummary"] = Field(default_factory=list)
    consent_download_url: Optional[str] = None


class PractitionerAppointmentSummary(BaseModel):
    appointment_id: int
    appointment_type: str
    date: date
    time: time_type
    status: str
    mode: Optional[str] = None


class PractitionerAppointmentCreate(BaseModel):
    case_id: int
    appointment_type: str
    date: date
    time: time_type
    mode: Optional[str] = None


class PractitionerAppointmentEntry(BaseModel):
    appointment_id: int
    date: date
    time: time_type
    appointment_type: str
    status: str
    mode: Optional[str] = None
    patient: PractitionerPatientSummary
    procedure: PractitionerCaseStatus
    reminder_sent_at: Optional[datetime] = None
    reminder_opened_at: Optional[datetime] = None
    prescription_sent_at: Optional[datetime] = None
    prescription_last_download_at: Optional[datetime] = None
    prescription_download_count: int = 0
    prescription_items: Optional[List[str]] = None
    prescription_instructions: Optional[str] = None
    prescription_id: Optional[int] = None
    prescription_url: Optional[str] = None


class PractitionerAgendaDay(BaseModel):
    date: date
    appointments: List[PractitionerAppointmentEntry] = Field(default_factory=list)


class PractitionerAgendaResponse(BaseModel):
    start: date
    end: date
    days: List[PractitionerAgendaDay]


class PractitionerStats(BaseModel):
    date: date
    total_appointments: int
    bookings_created: int
    new_patients: int
    new_patients_week: int
    follow_ups_required: int
    pending_consents: int


class PractitionerNewPatient(BaseModel):
    case_id: int
    created_at: datetime
    child_full_name: str
    patient_email: EmailStr
    next_preconsultation_date: Optional[date] = None
    next_act_date: Optional[date] = None
    procedure: PractitionerCaseStatus


class PractitionerCaseUpdate(BaseModel):
    child_full_name: Optional[str] = None
    child_birthdate: Optional[date] = None
    child_weight_kg: Optional[float] = Field(default=None, ge=0)
    parent1_name: Optional[str] = None
    parent1_email: Optional[EmailStr] = None
    parent2_name: Optional[str] = None
    parent2_email: Optional[EmailStr] = None
    parental_authority_ack: Optional[bool] = None
    notes: Optional[str] = None
    procedure_type: Optional[str] = None


class AppointmentRescheduleRequest(BaseModel):
    date: Optional[dt.date] = None
    time: Optional[time_type] = None
    appointment_type: Optional[str] = None
    mode: Optional[str] = None
    status: Optional[str] = None


class PrescriptionVersionEntry(BaseModel):
    id: int
    appointment_id: int
    appointment_type: str
    created_at: datetime
    url: str
    items: Optional[List[str]] = None
    instructions: Optional[str] = None
    downloads: List['PrescriptionDownloadEntry'] = Field(default_factory=list)


class PrescriptionDownloadEntry(BaseModel):
    id: int
    actor: str
    channel: str
    downloaded_at: datetime


class PractitionerCaseUpdate(BaseModel):
    child_full_name: Optional[str] = None
    child_birthdate: Optional[date] = None
    child_weight_kg: Optional[float] = Field(default=None, ge=0)
    parent1_name: Optional[str] = None
    parent1_email: Optional[EmailStr] = None
    parent2_name: Optional[str] = None
    parent2_email: Optional[EmailStr] = None
    parental_authority_ack: Optional[bool] = None
    notes: Optional[str] = None
    procedure_type: Optional[str] = None


class AppointmentRescheduleRequest(BaseModel):
    date: Optional[dt.date] = None
    time: Optional[time_type] = None
    appointment_type: Optional[str] = None
    mode: Optional[str] = None
    status: Optional[str] = None


class PrescriptionVersionEntry(BaseModel):
    id: int
    appointment_id: int
    appointment_type: str
    created_at: datetime
    url: str
    items: Optional[List[str]] = None
    instructions: Optional[str] = None
