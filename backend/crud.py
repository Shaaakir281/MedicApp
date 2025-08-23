"""CRUD utility functions.

This module groups common database operations used by the API routes. It
handles user creation and authentication, token generation, appointment
booking and questionnaire persistence. In a real application you might
separate responsibilities into dedicated modules or classes; for this
exercise they are collected here for simplicity.
"""

from __future__ import annotations

import os
import datetime
from typing import Optional

from jose import jwt
from jose.exceptions import JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration from environment
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "changeme")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 15))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 30))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its hashed version."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Generate a signed access token.

    The token's payload must include a ``sub`` claim identifying the user.
    """
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + (expires_delta or datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")


def create_refresh_token(data: dict) -> str:
    """Generate a signed refresh token."""
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode a JWT token and return its claims. Raises on invalid tokens."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError as exc:
        raise ValueError("Invalid token") from exc


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, email: str, password: str, role: str) -> models.User:
    hashed_password = get_password_hash(password)
    user = models.User(email=email, hashed_password=hashed_password, role=models.UserRole(role))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def get_available_slots(db: Session, date: datetime.date) -> list[str]:
    """Return a list of ISO‑time strings representing available slots on a given day.

    For demonstration purposes, this returns every hour from 08:00 to 17:00 except
    those already booked in the appointments table.
    """
    all_slots = [f"{hour:02d}:00" for hour in range(8, 18)]
    booked_times = (
        db.query(models.Appointment.time)
        .filter(models.Appointment.date == date)
        .all()
    )
    booked_set = {t[0].strftime("%H:%M") for t in booked_times}
    return [slot for slot in all_slots if slot not in booked_set]


def create_appointment(db: Session, user_id: int, date: datetime.date, time: datetime.time) -> models.Appointment:
    """Create a new appointment if the slot is free. Raises ValueError if booked."""
    conflict = (
        db.query(models.Appointment)
        .filter(models.Appointment.date == date, models.Appointment.time == time)
        .first()
    )
    if conflict:
        raise ValueError("Selected slot is already booked")
    appointment = models.Appointment(user_id=user_id, date=date, time=time)
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def create_questionnaire(db: Session, appointment_id: int, data: dict) -> models.Questionnaire:
    """Save questionnaire answers associated with an appointment."""
    questionnaire = models.Questionnaire(appointment_id=appointment_id, data=data)
    db.add(questionnaire)
    db.commit()
    db.refresh(questionnaire)
    return questionnaire