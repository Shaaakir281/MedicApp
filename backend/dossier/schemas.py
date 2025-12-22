from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from dossier.models import GuardianRole


class GuardianBase(BaseModel):
    role: GuardianRole
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: Optional[EmailStr] = None
    phone_e164: Optional[str] = None


class GuardianCreate(GuardianBase):
    pass


class Guardian(GuardianBase):
    id: str
    phone_verified_at: Optional[datetime] = None
    email_verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChildBase(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    birth_date: date
    weight_kg: Optional[float] = None
    medical_notes: Optional[str] = None


class ChildCreate(ChildBase):
    pass


class Child(ChildBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class DossierPayload(BaseModel):
    child: ChildCreate
    guardians: List[GuardianCreate]


class DossierResponse(BaseModel):
    child: Child
    guardians: List[Guardian]
    warnings: List[str] = Field(default_factory=list)


class SmsSendRequest(BaseModel):
    phone_e164: Optional[str] = None


class SmsSendResponse(BaseModel):
    status: str
    expires_in_sec: int
    cooldown_sec: int


class SmsVerifyRequest(BaseModel):
    code: str = Field(min_length=1)


class SmsVerifyResponse(BaseModel):
    verified: bool
    verified_at: Optional[datetime] = None


class EmailSendRequest(BaseModel):
    email: Optional[EmailStr] = None


class EmailSendResponse(BaseModel):
    status: str
    email: str


class EmailVerifyResponse(BaseModel):
    verified: bool
    verified_at: Optional[datetime] = None
