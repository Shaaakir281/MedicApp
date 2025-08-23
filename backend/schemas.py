"""Pydantic models (schemas) for API requests and responses.

These schemas determine the shape of the JSON accepted and returned by the
FastAPI endpoints. They use Pydantic's ``BaseModel`` for data validation
and documentation generation.
"""

from __future__ import annotations

from datetime import date, time, datetime
from typing import Any, Dict

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    """Represent both access and refresh tokens in the login response."""

    access_token: str
    refresh_token: str
    token_type: str = Field(default="bearer")


class TokenRefresh(BaseModel):
    """Represent a newly issued access token in a refresh operation."""

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

    class Config:
        orm_mode = True


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

    class Config:
        orm_mode = True


class QuestionnaireTemplate(BaseModel):
    template: Dict[str, Any]


class QuestionnaireCreate(BaseModel):
    data: Dict[str, Any]


class Questionnaire(BaseModel):
    id: int
    appointment_id: int
    data: Dict[str, Any]
    created_at: datetime

    class Config:
        orm_mode = True