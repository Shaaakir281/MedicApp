"""Add pharmacy directory and prescription QR tracking tables."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "b6c7d8e9f0a1"
down_revision = "a5d4c3b2e1f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prescriptions", sa.Column("reference", sa.String(length=64), nullable=True))
    op.create_index(
        op.f("ix_prescriptions_reference"),
        "prescriptions",
        ["reference"],
        unique=True,
    )
    op.add_column("prescription_versions", sa.Column("reference", sa.String(length=64), nullable=True))
    op.create_index(
        op.f("ix_prescription_versions_reference"),
        "prescription_versions",
        ["reference"],
        unique=False,
    )

    op.execute(
        """
        UPDATE prescriptions AS p
        SET reference = 'ORD-' || LPAD(p.appointment_id::text, 6, '0') || '-' ||
                        COALESCE(TO_CHAR(a.date, 'MMYY'), '0000')
        FROM appointments AS a
        WHERE a.id = p.appointment_id AND p.reference IS NULL
        """
    )
    op.execute(
        """
        UPDATE prescription_versions AS pv
        SET reference = p.reference
        FROM prescriptions AS p
        WHERE pv.prescription_id = p.id AND pv.reference IS NULL
        """
    )
    op.alter_column("prescriptions", "reference", existing_type=sa.String(length=64), nullable=False)
    op.alter_column("prescription_versions", "reference", existing_type=sa.String(length=64), nullable=False)

    op.create_table(
        "pharmacy_contacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_id", sa.String(length=64), nullable=True),
        sa.Column("ms_sante_address", sa.String(length=128), nullable=True),
        sa.Column("type", sa.String(length=32), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=True),
        sa.Column("address_line1", sa.String(length=255), nullable=False),
        sa.Column("address_line2", sa.String(length=255), nullable=True),
        sa.Column("postal_code", sa.String(length=16), nullable=False),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("department_code", sa.String(length=8), nullable=True),
        sa.Column("region", sa.String(length=64), nullable=True),
        sa.Column("country", sa.String(length=64), nullable=False, server_default="France"),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=128), nullable=True),
        sa.Column("website", sa.String(length=128), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("extra_data", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_pharmacy_contacts_city"), "pharmacy_contacts", ["city"], unique=False)
    op.create_index(
        op.f("ix_pharmacy_contacts_external_id"), "pharmacy_contacts", ["external_id"], unique=True
    )
    op.create_index(
        op.f("ix_pharmacy_contacts_ms_sante_address"),
        "pharmacy_contacts",
        ["ms_sante_address"],
        unique=True,
    )
    op.create_index(
        op.f("ix_pharmacy_contacts_name_city"),
        "pharmacy_contacts",
        ["name", "city"],
        unique=False,
    )

    op.create_table(
        "prescription_qr_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("prescription_id", sa.Integer(), nullable=False),
        sa.Column("version_id", sa.Integer(), nullable=True),
        sa.Column("reference", sa.String(length=64), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("verification_url", sa.String(length=512), nullable=False),
        sa.Column("qr_payload", sa.JSON(), nullable=True),
        sa.Column("scan_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_scanned_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["prescription_id"],
            ["prescriptions.id"],
            name="fk_prescription_qr_codes_prescription_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["version_id"],
            ["prescription_versions.id"],
            name="fk_prescription_qr_codes_version_id",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        op.f("ix_prescription_qr_codes_reference"),
        "prescription_qr_codes",
        ["reference"],
        unique=False,
    )
    op.create_index(
        op.f("ix_prescription_qr_codes_slug"),
        "prescription_qr_codes",
        ["slug"],
        unique=True,
    )

    op.create_table(
        "prescription_qr_scans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("qr_code_id", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("channel", sa.String(length=32), nullable=False, server_default="qr"),
        sa.Column("actor", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["qr_code_id"],
            ["prescription_qr_codes.id"],
            name="fk_prescription_qr_scans_qr_code_id",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        op.f("ix_prescription_qr_scans_qr_code_id"),
        "prescription_qr_scans",
        ["qr_code_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_prescription_qr_scans_qr_code_id"), table_name="prescription_qr_scans")
    op.drop_table("prescription_qr_scans")

    op.drop_index(op.f("ix_prescription_qr_codes_slug"), table_name="prescription_qr_codes")
    op.drop_index(op.f("ix_prescription_qr_codes_reference"), table_name="prescription_qr_codes")
    op.drop_table("prescription_qr_codes")

    op.drop_index(op.f("ix_pharmacy_contacts_name_city"), table_name="pharmacy_contacts")
    op.drop_index(op.f("ix_pharmacy_contacts_ms_sante_address"), table_name="pharmacy_contacts")
    op.drop_index(op.f("ix_pharmacy_contacts_external_id"), table_name="pharmacy_contacts")
    op.drop_index(op.f("ix_pharmacy_contacts_city"), table_name="pharmacy_contacts")
    op.drop_table("pharmacy_contacts")

    op.drop_index(op.f("ix_prescription_versions_reference"), table_name="prescription_versions")
    op.drop_column("prescription_versions", "reference")
    op.drop_index(op.f("ix_prescriptions_reference"), table_name="prescriptions")
    op.drop_column("prescriptions", "reference")
