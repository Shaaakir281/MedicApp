from __future__ import annotations

import enum
import uuid

import sqlalchemy as sa
from sqlalchemy.orm import relationship

from database import Base


class GuardianRole(str, enum.Enum):
    parent1 = "PARENT_1"
    parent2 = "PARENT_2"
    other = "OTHER_GUARDIAN"


class Child(Base):
    __tablename__ = "children"

    id: str = sa.Column(sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: int | None = sa.Column(
        sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    procedure_case_id: int | None = sa.Column(
        sa.Integer, sa.ForeignKey("procedure_cases.id", ondelete="SET NULL"), nullable=True, index=True
    )
    first_name: str = sa.Column(sa.String, nullable=False)
    last_name: str = sa.Column(sa.String, nullable=False)
    birth_date = sa.Column(sa.Date, nullable=False)
    weight_kg = sa.Column(sa.Numeric(5, 2), nullable=True)
    medical_notes: str | None = sa.Column(sa.Text, nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
    updated_at = sa.Column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    guardians = relationship("Guardian", back_populates="child", cascade="all, delete-orphan")


class Guardian(Base):
    __tablename__ = "guardians"

    id: str = sa.Column(sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    child_id: str = sa.Column(
        sa.String(36), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: str = sa.Column(sa.String(32), nullable=False)
    first_name: str = sa.Column(sa.String, nullable=False)
    last_name: str = sa.Column(sa.String, nullable=False)
    email: str | None = sa.Column(sa.String, nullable=True)
    phone_e164: str | None = sa.Column(sa.String(32), nullable=True)
    phone_verified_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    created_at = sa.Column(sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
    updated_at = sa.Column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    child = relationship("Child", back_populates="guardians")
    verifications = relationship(
        "GuardianPhoneVerification", back_populates="guardian", cascade="all, delete-orphan"
    )

    __table_args__ = (
        sa.UniqueConstraint("child_id", "role", name="uq_guardian_role_per_child"),
        sa.Index("ix_guardian_phone_e164", "phone_e164"),
        sa.CheckConstraint(
            "role in ('PARENT_1','PARENT_2','OTHER_GUARDIAN')",
            name="ck_guardian_role",
        ),
    )


class VerificationStatus(str, enum.Enum):
    sent = "SENT"
    verified = "VERIFIED"
    expired = "EXPIRED"
    locked = "LOCKED"


class GuardianPhoneVerification(Base):
    __tablename__ = "guardian_phone_verifications"

    id: str = sa.Column(sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    guardian_id: str = sa.Column(
        sa.String(36),
        sa.ForeignKey("guardians.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    phone_e164: str = sa.Column(sa.String(32), nullable=False)
    code_hash: str = sa.Column(sa.String(128), nullable=False)
    expires_at = sa.Column(sa.DateTime(timezone=True), nullable=False)
    cooldown_until = sa.Column(sa.DateTime(timezone=True), nullable=True)
    attempt_count: int = sa.Column(sa.Integer, nullable=False, default=0)
    max_attempts: int = sa.Column(sa.Integer, nullable=False, default=5)
    status: str = sa.Column(sa.String(16), nullable=False)
    sent_at = sa.Column(sa.DateTime(timezone=True), nullable=False)
    verified_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    ip_address: str | None = sa.Column(sa.String(64), nullable=True)
    user_agent: str | None = sa.Column(sa.String(255), nullable=True)

    guardian = relationship("Guardian", back_populates="verifications")

    __table_args__ = (
        sa.CheckConstraint(
            "status in ('SENT','VERIFIED','EXPIRED','LOCKED')",
            name="ck_guardian_verification_status",
        ),
    )
