"""add table for prescription download logs"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "d1e2f3a4b5c6"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prescription_download_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "version_id",
            sa.Integer(),
            sa.ForeignKey("prescription_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("actor", sa.String(length=32), nullable=False, server_default="unknown"),
        sa.Column("channel", sa.String(length=32), nullable=False, server_default="download"),
        sa.Column("downloaded_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_prescription_download_logs_version_id",
        "prescription_download_logs",
        ["version_id"],
    )
    op.alter_column(
        "prescription_download_logs",
        "actor",
        server_default=None,
    )
    op.alter_column(
        "prescription_download_logs",
        "channel",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_index("ix_prescription_download_logs_version_id", table_name="prescription_download_logs")
    op.drop_table("prescription_download_logs")
