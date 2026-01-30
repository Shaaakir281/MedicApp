"""add_cabinet_signature_tables

Revision ID: 20260130_add_cabinet_signature_tables
Revises: 20260129_add_login_attempts_table
Create Date: 2026-01-30
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260130_add_cabinet_signature_tables"
down_revision = "20260129_add_login_attempts_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    signer_enum = postgresql.ENUM(
        "parent1",
        "parent2",
        "other_guardian",
        name="signerrole",
        create_type=False,
    )

    op.create_table(
        "cabinet_signature_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "document_signature_id",
            sa.Integer(),
            sa.ForeignKey("document_signatures.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("parent_role", signer_enum, nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "initiated_by_practitioner_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("document_hash", sa.String(length=128), nullable=True),
        sa.Column("device_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_cabinet_signature_sessions_token",
        "cabinet_signature_sessions",
        ["token"],
        unique=True,
    )
    op.create_index(
        "ix_cabinet_signature_sessions_document",
        "cabinet_signature_sessions",
        ["document_signature_id"],
        unique=False,
    )

    op.create_table(
        "cabinet_signatures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "document_signature_id",
            sa.Integer(),
            sa.ForeignKey("document_signatures.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("parent_role", signer_enum, nullable=False),
        sa.Column("signature_image_base64", sa.Text(), nullable=False),
        sa.Column("signature_hash", sa.String(length=128), nullable=True),
        sa.Column("consent_confirmed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("signed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_cabinet_signatures_document",
        "cabinet_signatures",
        ["document_signature_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_cabinet_signatures_document", table_name="cabinet_signatures")
    op.drop_table("cabinet_signatures")

    op.drop_index("ix_cabinet_signature_sessions_document", table_name="cabinet_signature_sessions")
    op.drop_index("ix_cabinet_signature_sessions_token", table_name="cabinet_signature_sessions")
    op.drop_table("cabinet_signature_sessions")
