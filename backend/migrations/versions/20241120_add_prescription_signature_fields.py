"""add signature metadata to prescriptions"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "a5d4c3b2e1f0"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prescriptions", sa.Column("signed_at", sa.DateTime(), nullable=True))
    op.add_column("prescriptions", sa.Column("signed_by_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_prescriptions_signed_by_id_users",
        "prescriptions",
        "users",
        ["signed_by_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_prescriptions_signed_by_id_users", "prescriptions", type_="foreignkey")
    op.drop_column("prescriptions", "signed_by_id")
    op.drop_column("prescriptions", "signed_at")
