"""Add consent tracking fields for Yousign and SMS."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c1d2e3f4g5h6"
down_revision = "b6c7d8e9f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("procedure_cases", sa.Column("parent1_phone", sa.String(length=32), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_phone", sa.String(length=32), nullable=True))
    op.add_column(
        "procedure_cases",
        sa.Column("parent1_sms_optin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "procedure_cases",
        sa.Column("parent2_sms_optin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("procedure_cases", sa.Column("consent_signed_pdf_url", sa.String(), nullable=True))
    op.add_column("procedure_cases", sa.Column("consent_evidence_pdf_url", sa.String(), nullable=True))
    op.add_column("procedure_cases", sa.Column("consent_last_status", sa.String(length=64), nullable=True))
    op.add_column("procedure_cases", sa.Column("consent_ready_at", sa.DateTime(), nullable=True))
    op.add_column("procedure_cases", sa.Column("yousign_procedure_id", sa.String(length=128), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent1_yousign_signer_id", sa.String(length=128), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_yousign_signer_id", sa.String(length=128), nullable=True))
    op.add_column(
        "procedure_cases",
        sa.Column("parent1_consent_status", sa.String(length=32), nullable=False, server_default="pending"),
    )
    op.add_column(
        "procedure_cases",
        sa.Column("parent2_consent_status", sa.String(length=32), nullable=False, server_default="pending"),
    )
    op.add_column("procedure_cases", sa.Column("parent1_consent_sent_at", sa.DateTime(), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_consent_sent_at", sa.DateTime(), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent1_consent_signed_at", sa.DateTime(), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_consent_signed_at", sa.DateTime(), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent1_consent_method", sa.String(length=32), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_consent_method", sa.String(length=32), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent1_signature_link", sa.String(), nullable=True))
    op.add_column("procedure_cases", sa.Column("parent2_signature_link", sa.String(), nullable=True))
    op.add_column("procedure_cases", sa.Column("preconsultation_date", sa.Date(), nullable=True))
    op.add_column("procedure_cases", sa.Column("signature_open_at", sa.Date(), nullable=True))
    op.create_index(
        "ix_procedure_cases_yousign_procedure_id",
        "procedure_cases",
        ["yousign_procedure_id"],
        unique=False,
    )
    op.alter_column("procedure_cases", "parent1_sms_optin", server_default=None)
    op.alter_column("procedure_cases", "parent2_sms_optin", server_default=None)
    op.alter_column("procedure_cases", "parent1_consent_status", server_default=None)
    op.alter_column("procedure_cases", "parent2_consent_status", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_procedure_cases_yousign_procedure_id", table_name="procedure_cases")
    op.drop_column("procedure_cases", "signature_open_at")
    op.drop_column("procedure_cases", "preconsultation_date")
    op.drop_column("procedure_cases", "parent2_signature_link")
    op.drop_column("procedure_cases", "parent1_signature_link")
    op.drop_column("procedure_cases", "parent2_consent_method")
    op.drop_column("procedure_cases", "parent1_consent_method")
    op.drop_column("procedure_cases", "parent2_consent_signed_at")
    op.drop_column("procedure_cases", "parent1_consent_signed_at")
    op.drop_column("procedure_cases", "parent2_consent_sent_at")
    op.drop_column("procedure_cases", "parent1_consent_sent_at")
    op.drop_column("procedure_cases", "parent2_consent_status")
    op.drop_column("procedure_cases", "parent1_consent_status")
    op.drop_column("procedure_cases", "parent2_yousign_signer_id")
    op.drop_column("procedure_cases", "parent1_yousign_signer_id")
    op.drop_column("procedure_cases", "yousign_procedure_id")
    op.drop_column("procedure_cases", "consent_ready_at")
    op.drop_column("procedure_cases", "consent_last_status")
    op.drop_column("procedure_cases", "consent_evidence_pdf_url")
    op.drop_column("procedure_cases", "consent_signed_pdf_url")
    op.drop_column("procedure_cases", "parent2_sms_optin")
    op.drop_column("procedure_cases", "parent1_sms_optin")
    op.drop_column("procedure_cases", "parent2_phone")
    op.drop_column("procedure_cases", "parent1_phone")
