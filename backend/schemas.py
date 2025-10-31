"""Pydantic models for API requests and responses."""

from __future__ import annotations

from datetime import date, datetime, time
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
    time: time


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
