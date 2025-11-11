"""add custom prescription items/instructions.

Revision ID: b1c2d3e4f5ac
Revises: a1c2d3e4f5ab
Create Date: 2025-11-10 10:05:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "b1c2d3e4f5ac"
down_revision = "a1c2d3e4f5ab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prescriptions", sa.Column("items", sa.JSON(), nullable=True))
    op.add_column("prescriptions", sa.Column("instructions", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("prescriptions", "instructions")
    op.drop_column("prescriptions", "items")
