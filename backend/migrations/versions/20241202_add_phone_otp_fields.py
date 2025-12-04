"""Add phone verification OTP fields for parents."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d2f3c4b5a6e7"
down_revision = "c1d2e3f4g5h6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("procedure_cases", sa.Column("parent1_phone_verified_at", sa.DateTime(), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_phone_verified_at", sa.DateTime(), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent1_phone_otp_code", sa.String(length=6), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_phone_otp_code", sa.String(length=6), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent1_phone_otp_expires_at", sa.DateTime(), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_phone_otp_expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("procedure_cases", "parent2_phone_otp_expires_at")
    op.drop_column("procedure_cases", "parent1_phone_otp_expires_at")
    op.drop_column("procedure_cases", "parent2_phone_otp_code")
    op.drop_column("procedure_cases", "parent1_phone_otp_code")
    op.drop_column("procedure_cases", "parent2_phone_verified_at")
    op.drop_column("procedure_cases", "parent1_phone_verified_at")
