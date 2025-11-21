"""add procedure case flags for steps and dossier completion"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "procedure_cases",
        sa.Column("steps_acknowledged", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "procedure_cases",
        sa.Column("dossier_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "procedure_cases",
        sa.Column("missing_fields", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.execute("UPDATE procedure_cases SET steps_acknowledged = false WHERE steps_acknowledged IS NULL")
    op.execute("UPDATE procedure_cases SET dossier_completed = false WHERE dossier_completed IS NULL")
    op.execute("UPDATE procedure_cases SET missing_fields = '[]'::json WHERE missing_fields IS NULL")
    op.alter_column("procedure_cases", "steps_acknowledged", server_default=None)
    op.alter_column("procedure_cases", "dossier_completed", server_default=None)
    op.alter_column("procedure_cases", "missing_fields", server_default=None)


def downgrade() -> None:
    op.drop_column("procedure_cases", "missing_fields")
    op.drop_column("procedure_cases", "dossier_completed")
    op.drop_column("procedure_cases", "steps_acknowledged")
