"""add prescription tracking fields and reminder metadata.

Revision ID: a1c2d3e4f5ab
Revises: 7ac0846147b8
Create Date: 2025-11-10 09:15:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1c2d3e4f5ab"
down_revision = "7ac0846147b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prescriptions", sa.Column("sent_at", sa.DateTime(), nullable=True))
    op.add_column("prescriptions", sa.Column("sent_via", sa.String(length=32), nullable=True))
    op.add_column(
        "prescriptions",
        sa.Column("download_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("prescriptions", sa.Column("last_download_at", sa.DateTime(), nullable=True))
    op.alter_column("prescriptions", "download_count", server_default=None)

    op.add_column("appointments", sa.Column("reminder_sent_at", sa.DateTime(), nullable=True))
    op.add_column("appointments", sa.Column("reminder_opened_at", sa.DateTime(), nullable=True))
    op.add_column("appointments", sa.Column("reminder_token", sa.String(length=128), nullable=True))
    op.create_index("ix_appointments_reminder_token", "appointments", ["reminder_token"])


def downgrade() -> None:
    op.drop_index("ix_appointments_reminder_token", table_name="appointments")
    op.drop_column("appointments", "reminder_token")
    op.drop_column("appointments", "reminder_opened_at")
    op.drop_column("appointments", "reminder_sent_at")

    op.drop_column("prescriptions", "last_download_at")
    op.drop_column("prescriptions", "download_count")
    op.drop_column("prescriptions", "sent_via")
    op.drop_column("prescriptions", "sent_at")
