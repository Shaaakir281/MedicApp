"""add_login_attempts_table

Revision ID: 20260129_add_login_attempts_table
Revises: 20260129_add_mfa_codes_table
Create Date: 2026-01-29
"""

from alembic import op
import sqlalchemy as sa


revision = "20260129_add_login_attempts_table"
down_revision = "20260129_add_mfa_codes_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, default=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_login_attempts_user_created",
        "login_attempts",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_login_attempts_user_created", table_name="login_attempts")
    op.drop_table("login_attempts")
