"""Add legal acknowledgements and cabinet signature sessions tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e7f8g9h0i1j2"
down_revision = "d2f3c4b5a6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Clean up enum types if a previous attempt created them without tables
    op.execute("DROP TYPE IF EXISTS signaturecabinetsessionstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS signerrole CASCADE")
    op.execute("DROP TYPE IF EXISTS documenttype CASCADE")

    # Ensure enums exist once (idempotent when partial migrations ran)
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'documenttype') THEN
                CREATE TYPE documenttype AS ENUM ('surgical_authorization_minor', 'informed_consent', 'fees_consent_quote');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signerrole') THEN
                CREATE TYPE signerrole AS ENUM ('parent1', 'parent2', 'other_guardian');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signaturecabinetsessionstatus') THEN
                CREATE TYPE signaturecabinetsessionstatus AS ENUM ('active', 'consumed', 'expired');
            END IF;
        END$$;
        """
    )

    document_enum = postgresql.ENUM(
        "surgical_authorization_minor",
        "informed_consent",
        "fees_consent_quote",
        name="documenttype",
        create_type=False,
    )
    signer_enum = postgresql.ENUM("parent1", "parent2", "other_guardian", name="signerrole", create_type=False)
    session_status_enum = postgresql.ENUM(
        "active", "consumed", "expired", name="signaturecabinetsessionstatus", create_type=False
    )

    op.create_table(
        "legal_acknowledgements",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id"), nullable=False, index=True),
        sa.Column("document_type", document_enum, nullable=False),
        sa.Column("signer_role", signer_enum, nullable=False),
        sa.Column("case_key", sa.String(length=128), nullable=False),
        sa.Column("case_text", sa.String(length=2048), nullable=False),
        sa.Column("catalog_version", sa.String(length=32), nullable=False, server_default="v1"),
        sa.Column("acknowledged_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=True, server_default="remote"),
        sa.UniqueConstraint(
            "appointment_id",
            "document_type",
            "signer_role",
            "case_key",
            name="uq_legal_acknowledgement_case",
        ),
    )
    op.create_index(
        "ix_legal_acknowledgements_appointment",
        "legal_acknowledgements",
        ["appointment_id"],
        unique=False,
    )

    op.create_table(
        "signature_cabinet_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id"), nullable=False, index=True),
        sa.Column("signer_role", signer_enum, nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_practitioner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", session_status_enum, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_signature_cabinet_sessions_token_hash",
        "signature_cabinet_sessions",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_signature_cabinet_sessions_appointment",
        "signature_cabinet_sessions",
        ["appointment_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_signature_cabinet_sessions_appointment", table_name="signature_cabinet_sessions")
    op.drop_index("ix_signature_cabinet_sessions_token_hash", table_name="signature_cabinet_sessions")
    op.drop_table("signature_cabinet_sessions")

    op.drop_index("ix_legal_acknowledgements_appointment", table_name="legal_acknowledgements")
    op.drop_table("legal_acknowledgements")

    op.execute("DROP TYPE IF EXISTS signaturecabinetsessionstatus")
    op.execute("DROP TYPE IF EXISTS signerrole")
    op.execute("DROP TYPE IF EXISTS documenttype")
