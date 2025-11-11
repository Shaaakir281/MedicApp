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
    Boolean,
    Float,
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


class AppointmentType(str, enum.Enum):
    """Differentiate appointment categories (general, pre-consultation, act)."""

    general = "general"
    preconsultation = "preconsultation"
    act = "act"


class AppointmentMode(str, enum.Enum):
    """Mode of the appointment."""

    visio = "visio"
    presentiel = "presentiel"


class ProcedureType(str, enum.Enum):
    """Supported procedure types."""

    circumcision = "circumcision"
    other = "autre"


class User(Base):
    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, index=True)
    email: str = Column(String, unique=True, index=True, nullable=False)
    hashed_password: str = Column(String, nullable=False)
    role: UserRole = Column(Enum(UserRole), nullable=False)
    email_verified: bool = Column(Boolean, nullable=False, default=False)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    appointments = relationship("Appointment", back_populates="user", cascade="all,delete-orphan")
    email_tokens = relationship(
        "EmailVerificationToken", back_populates="user", cascade="all,delete-orphan"
    )
    procedure_cases = relationship(
        "ProcedureCase",
        back_populates="patient",
        cascade="all,delete-orphan",
    )


class Appointment(Base):
    __tablename__ = "appointments"

    id: int = Column(Integer, primary_key=True, index=True)
    user_id: int = Column(Integer, ForeignKey("users.id"), nullable=False)
    date: datetime.date = Column(Date, nullable=False)
    time: datetime.time = Column(Time, nullable=False)
    status: AppointmentStatus = Column(
        Enum(AppointmentStatus), default=AppointmentStatus.pending, nullable=False
    )
    appointment_type: AppointmentType = Column(
        Enum(AppointmentType), default=AppointmentType.general, nullable=False
    )
    mode: AppointmentMode | None = Column(Enum(AppointmentMode), nullable=True)
    procedure_id: int | None = Column(Integer, ForeignKey("procedure_cases.id"), nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    reminder_sent_at: datetime.datetime | None = Column(DateTime, nullable=True)
    reminder_opened_at: datetime.datetime | None = Column(DateTime, nullable=True)
    reminder_token: str | None = Column(String(128), nullable=True, index=True)

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
    procedure_case = relationship("ProcedureCase", back_populates="appointments")


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: int = Column(Integer, primary_key=True, index=True)
    user_id: int = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: str = Column(String, unique=True, nullable=False, index=True)
    expires_at: datetime.datetime = Column(DateTime, nullable=False)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    consumed_at: datetime.datetime | None = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="email_tokens")


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
    items: list[str] | None = Column(JSON, nullable=True)
    instructions: str | None = Column(String, nullable=True)
    sent_at: datetime.datetime | None = Column(DateTime, nullable=True)
    sent_via: str | None = Column(String(32), nullable=True)
    download_count: int = Column(Integer, nullable=False, default=0)
    last_download_at: datetime.datetime | None = Column(DateTime, nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    appointment = relationship("Appointment", back_populates="prescription")
    versions = relationship(
        "PrescriptionVersion",
        back_populates="prescription",
        cascade="all,delete-orphan",
    )


class PrescriptionVersion(Base):
    __tablename__ = "prescription_versions"

    id: int = Column(Integer, primary_key=True, index=True)
    prescription_id: int = Column(
        Integer,
        ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    appointment_id: int = Column(
        Integer,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    appointment_type: str = Column(String(32), nullable=False)
    pdf_path: str = Column(String, nullable=False)
    items: list[str] | None = Column(JSON, nullable=True)
    instructions: str | None = Column(String, nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    prescription = relationship("Prescription", back_populates="versions")
    appointment = relationship("Appointment")
    downloads = relationship(
        "PrescriptionDownloadLog",
        back_populates="version",
        cascade="all,delete-orphan",
    )


class PrescriptionDownloadLog(Base):
    __tablename__ = "prescription_download_logs"

    id: int = Column(Integer, primary_key=True, index=True)
    version_id: int = Column(
        Integer,
        ForeignKey("prescription_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor: str = Column(String(32), nullable=False, default="unknown")
    channel: str = Column(String(32), nullable=False, default="download")
    downloaded_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    version = relationship("PrescriptionVersion", back_populates="downloads")


class ProcedureCase(Base):
    __tablename__ = "procedure_cases"

    id: int = Column(Integer, primary_key=True, index=True)
    patient_id: int = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    procedure_type: ProcedureType = Column(
        Enum(ProcedureType), nullable=False, default=ProcedureType.circumcision
    )
    child_full_name: str = Column(String, nullable=False)
    child_birthdate: datetime.date = Column(Date, nullable=False)
    child_weight_kg: float | None = Column(Float, nullable=True)
    parent1_name: str = Column(String, nullable=False)
    parent1_email: str | None = Column(String, nullable=True)
    parent2_name: str | None = Column(String, nullable=True)
    parent2_email: str | None = Column(String, nullable=True)
    parental_authority_ack: bool = Column(Boolean, nullable=False, default=False)
    notes: str | None = Column(String, nullable=True)
    checklist_pdf_path: str | None = Column(String, nullable=True)
    consent_pdf_path: str | None = Column(String, nullable=True)
    consent_download_token: str | None = Column(String, nullable=True, unique=True)
    ordonnance_pdf_path: str | None = Column(String, nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    updated_at: datetime.datetime = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    patient = relationship("User", back_populates="procedure_cases")
    appointments = relationship(
        "Appointment",
        back_populates="procedure_case",
        cascade="all,delete-orphan",
    )
