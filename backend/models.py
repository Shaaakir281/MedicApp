"""SQLAlchemy ORM models for the MedicApp backend.

This module defines the database tables and relationships used in the
application. The models correspond to the initial data model described in
Sprint 1: users, appointments, questionnaires and prescriptions.
"""

import datetime
import enum

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Time,
    JSON,
)
from sqlalchemy.orm import relationship

from database import Base


class UserRole(str, enum.Enum):
    """Enumerate the possible roles for a user."""

    patient = "patient"
    praticien = "praticien"


class AppointmentStatus(str, enum.Enum):
    """Enumerate the possible statuses for an appointment."""

    pending = "pending"
    validated = "validated"


class User(Base):
    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, index=True)
    email: str = Column(String, unique=True, index=True, nullable=False)
    hashed_password: str = Column(String, nullable=False)
    role: UserRole = Column(Enum(UserRole), nullable=False)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    appointments = relationship("Appointment", back_populates="user", cascade="all,delete-orphan")


class Appointment(Base):
    __tablename__ = "appointments"

    id: int = Column(Integer, primary_key=True, index=True)
    user_id: int = Column(Integer, ForeignKey("users.id"), nullable=False)
    date: datetime.date = Column(Date, nullable=False)
    time: datetime.time = Column(Time, nullable=False)
    status: AppointmentStatus = Column(
        Enum(AppointmentStatus), default=AppointmentStatus.pending, nullable=False
    )
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    user = relationship("User", back_populates="appointments")
    questionnaire = relationship(
        "Questionnaire",
        back_populates="appointment",
        uselist=False,
        cascade="all,delete-orphan",
    )
    prescription = relationship(
        "Prescription",
        back_populates="appointment",
        uselist=False,
        cascade="all,delete-orphan",
    )


class Questionnaire(Base):
    __tablename__ = "questionnaires"

    id: int = Column(Integer, primary_key=True, index=True)
    appointment_id: int = Column(
        Integer, ForeignKey("appointments.id"), nullable=False, unique=True
    )
    data: dict = Column(JSON, nullable=False)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    appointment = relationship("Appointment", back_populates="questionnaire")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: int = Column(Integer, primary_key=True, index=True)
    appointment_id: int = Column(
        Integer, ForeignKey("appointments.id"), nullable=False, unique=True
    )
    pdf_path: str | None = Column(String, nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    appointment = relationship("Appointment", back_populates="prescription")