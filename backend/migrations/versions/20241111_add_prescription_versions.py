"""add table to store prescription versions"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "c1d2e3f4a5b6"
down_revision = "b1c2d3e4f5ac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prescription_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "prescription_id",
            sa.Integer(),
            sa.ForeignKey("prescriptions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "appointment_id",
            sa.Integer(),
            sa.ForeignKey("appointments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("appointment_type", sa.String(length=32), nullable=False),
        sa.Column("pdf_path", sa.String(), nullable=False),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("instructions", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_prescription_versions_prescription_id",
        "prescription_versions",
        ["prescription_id"],
    )
    op.create_index(
        "ix_prescription_versions_appointment_id",
        "prescription_versions",
        ["appointment_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_prescription_versions_appointment_id", table_name="prescription_versions")
    op.drop_index("ix_prescription_versions_prescription_id", table_name="prescription_versions")
    op.drop_table("prescription_versions")
