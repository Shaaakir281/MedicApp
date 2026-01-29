"""add_mfa_codes_table

Revision ID: 20260129_add_mfa_codes_table
Revises: 20260127_add_document_download_token
Create Date: 2026-01-29
"""

from alembic import op
import sqlalchemy as sa


revision = "20260129_add_mfa_codes_table"
down_revision = "20260127_add_document_download_token"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mfa_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(length=6), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_mfa_codes_user_code_expires",
        "mfa_codes",
        ["user_id", "code", "expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_mfa_codes_user_code_expires", table_name="mfa_codes")
    op.drop_table("mfa_codes")
