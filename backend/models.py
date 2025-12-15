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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from domain.legal_documents.types import DocumentType, SignerRole
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
    password_reset_tokens = relationship(
        "PasswordResetToken", back_populates="user", cascade="all,delete-orphan"
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


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: int = Column(Integer, primary_key=True, index=True)
    user_id: int = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: str = Column(String, unique=True, nullable=False, index=True)
    expires_at: datetime.datetime = Column(DateTime, nullable=False)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    consumed_at: datetime.datetime | None = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="password_reset_tokens")


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
    reference: str = Column(String(64), nullable=False, unique=True, index=True)
    pdf_path: str | None = Column(String, nullable=True)
    items: list[str] | None = Column(JSON, nullable=True)
    instructions: str | None = Column(String, nullable=True)
    sent_at: datetime.datetime | None = Column(DateTime, nullable=True)
    sent_via: str | None = Column(String(32), nullable=True)
    download_count: int = Column(Integer, nullable=False, default=0)
    last_download_at: datetime.datetime | None = Column(DateTime, nullable=True)
    signed_at: datetime.datetime | None = Column(DateTime, nullable=True)
    signed_by_id: int | None = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    appointment = relationship("Appointment", back_populates="prescription")
    signed_by = relationship("User", foreign_keys=[signed_by_id])
    versions = relationship(
        "PrescriptionVersion",
        back_populates="prescription",
        cascade="all,delete-orphan",
    )
    qr_codes = relationship(
        "PrescriptionQRCode",
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
    reference: str = Column(String(64), nullable=False)
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


class PrescriptionQRCode(Base):
    __tablename__ = "prescription_qr_codes"

    id: int = Column(Integer, primary_key=True, index=True)
    prescription_id: int = Column(
        Integer,
        ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_id: int | None = Column(
        Integer,
        ForeignKey("prescription_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    reference: str = Column(String(64), nullable=False, index=True)
    slug: str = Column(String(64), nullable=False, unique=True, index=True)
    verification_url: str = Column(String(512), nullable=False)
    qr_payload: dict | None = Column(JSON, nullable=True)
    scan_count: int = Column(Integer, nullable=False, default=0)
    last_scanned_at: datetime.datetime | None = Column(DateTime, nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    expires_at: datetime.datetime | None = Column(DateTime, nullable=True)

    prescription = relationship("Prescription", back_populates="qr_codes")
    version = relationship("PrescriptionVersion")
    scans = relationship(
        "PrescriptionQRScan",
        back_populates="qr_code",
        cascade="all,delete-orphan",
    )


class PrescriptionQRScan(Base):
    __tablename__ = "prescription_qr_scans"

    id: int = Column(Integer, primary_key=True, index=True)
    qr_code_id: int = Column(
        Integer,
        ForeignKey("prescription_qr_codes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ip_address: str | None = Column(String(64), nullable=True)
    user_agent: str | None = Column(String(255), nullable=True)
    channel: str = Column(String(32), nullable=False, default="qr")
    actor: str | None = Column(String(32), nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )

    qr_code = relationship("PrescriptionQRCode", back_populates="scans")


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
    parent1_phone: str | None = Column(String(32), nullable=True)
    parent2_phone: str | None = Column(String(32), nullable=True)
    parent1_sms_optin: bool = Column(Boolean, nullable=False, default=False)
    parent2_sms_optin: bool = Column(Boolean, nullable=False, default=False)
    parent1_phone_verified_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent2_phone_verified_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent1_phone_otp_code: str | None = Column(String(6), nullable=True)
    parent2_phone_otp_code: str | None = Column(String(6), nullable=True)
    parent1_phone_otp_expires_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent2_phone_otp_expires_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parental_authority_ack: bool = Column(Boolean, nullable=False, default=False)
    notes: str | None = Column(String, nullable=True)
    checklist_pdf_path: str | None = Column(String, nullable=True)
    consent_pdf_path: str | None = Column(String, nullable=True)
    consent_download_token: str | None = Column(String, nullable=True, unique=True)
    consent_signed_pdf_url: str | None = Column(String, nullable=True)
    consent_evidence_pdf_url: str | None = Column(String, nullable=True)
    consent_last_status: str | None = Column(String(64), nullable=True)
    consent_ready_at: datetime.datetime | None = Column(DateTime, nullable=True)
    yousign_procedure_id: str | None = Column(String(128), nullable=True, index=True)
    parent1_yousign_signer_id: str | None = Column(String(128), nullable=True)
    parent2_yousign_signer_id: str | None = Column(String(128), nullable=True)
    parent1_consent_status: str = Column(String(32), nullable=False, default="pending")
    parent2_consent_status: str = Column(String(32), nullable=False, default="pending")
    parent1_consent_sent_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent2_consent_sent_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent1_consent_signed_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent2_consent_signed_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent1_consent_method: str | None = Column(String(32), nullable=True)
    parent2_consent_method: str | None = Column(String(32), nullable=True)
    parent1_signature_link: str | None = Column(String, nullable=True)
    parent2_signature_link: str | None = Column(String, nullable=True)
    preconsultation_date: datetime.date | None = Column(Date, nullable=True)
    signature_open_at: datetime.date | None = Column(Date, nullable=True)
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
    steps_acknowledged: bool = Column(Boolean, nullable=False, default=False)
    dossier_completed: bool = Column(Boolean, nullable=False, default=False)
    missing_fields: list[str] = Column(JSON, nullable=False, default=list)

    patient = relationship("User", back_populates="procedure_cases")
    appointments = relationship(
        "Appointment",
        back_populates="procedure_case",
        cascade="all,delete-orphan",
    )


class SignatureCabinetSessionStatus(str, enum.Enum):
    active = "active"
    consumed = "consumed"
    expired = "expired"


class LegalAcknowledgement(Base):
    __tablename__ = "legal_acknowledgements"
    __table_args__ = (
        UniqueConstraint(
            "appointment_id",
            "document_type",
            "signer_role",
            "case_key",
            name="uq_legal_acknowledgement_case",
        ),
    )

    id: int = Column(Integer, primary_key=True, index=True)
    appointment_id: int = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    document_type: DocumentType = Column(
        Enum(DocumentType, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    signer_role: SignerRole = Column(Enum(SignerRole), nullable=False)
    case_key: str = Column(String(128), nullable=False)
    case_text: str = Column(String(2048), nullable=False)
    catalog_version: str = Column(String(32), nullable=False, default="v1")
    acknowledged_at: datetime.datetime = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    ip: str | None = Column(String(64), nullable=True)
    user_agent: str | None = Column(String(255), nullable=True)
    source: str | None = Column(String(32), nullable=True, default="remote")

    appointment = relationship("Appointment")


class SignatureCabinetSession(Base):
    __tablename__ = "signature_cabinet_sessions"

    id: int = Column(Integer, primary_key=True, index=True)
    appointment_id: int = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    signer_role: SignerRole = Column(Enum(SignerRole), nullable=False)
    token_hash: str = Column(String(128), nullable=False, unique=True, index=True)
    expires_at: datetime.datetime = Column(DateTime, nullable=False)
    consumed_at: datetime.datetime | None = Column(DateTime, nullable=True)
    created_by_practitioner_id: int | None = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: SignatureCabinetSessionStatus = Column(
        Enum(SignatureCabinetSessionStatus), nullable=False, default=SignatureCabinetSessionStatus.active
    )
    created_at: datetime.datetime = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    appointment = relationship("Appointment")
    created_by_practitioner = relationship("User", foreign_keys=[created_by_practitioner_id])


class PharmacyContact(Base):
    __tablename__ = "pharmacy_contacts"

    id: int = Column(Integer, primary_key=True, index=True)
    external_id: str | None = Column(String(64), unique=True, index=True, nullable=True)
    ms_sante_address: str | None = Column(String(128), unique=True, nullable=True)
    type: str | None = Column(String(32), nullable=True)
    name: str = Column(String(255), nullable=False)
    legal_name: str | None = Column(String(255), nullable=True)
    address_line1: str = Column(String(255), nullable=False)
    address_line2: str | None = Column(String(255), nullable=True)
    postal_code: str = Column(String(16), nullable=False)
    city: str = Column(String(128), nullable=False, index=True)
    department_code: str | None = Column(String(8), nullable=True)
    region: str | None = Column(String(64), nullable=True)
    country: str = Column(String(64), nullable=False, default="France")
    latitude: float | None = Column(Float, nullable=True)
    longitude: float | None = Column(Float, nullable=True)
    phone: str | None = Column(String(32), nullable=True)
    email: str | None = Column(String(128), nullable=True)
    website: str | None = Column(String(128), nullable=True)
    source: str | None = Column(String(64), nullable=True)
    extra_data: dict | None = Column(JSON, nullable=False, default=dict)
    is_active: bool = Column(Boolean, nullable=False, default=True)
    last_synced_at: datetime.datetime | None = Column(DateTime, nullable=True)
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    updated_at: datetime.datetime = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )
