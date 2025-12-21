"""Add dossier tables for children, guardians and phone verifications."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20241222_add_dossier_tables"
down_revision = "e7f8g9h0i1j2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "children",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "procedure_case_id",
            sa.Integer(),
            sa.ForeignKey("procedure_cases.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(5, 2), nullable=True),
        sa.Column("medical_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_children_patient_id"), "children", ["patient_id"], unique=False)
    op.create_index(op.f("ix_children_procedure_case_id"), "children", ["procedure_case_id"], unique=False)

    op.create_table(
        "guardians",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("child_id", sa.String(length=36), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone_e164", sa.String(length=32), nullable=True),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("child_id", "role", name="uq_guardian_role_per_child"),
        sa.CheckConstraint(
            "role in ('PARENT_1','PARENT_2','OTHER_GUARDIAN')",
            name="ck_guardian_role",
        ),
    )
    op.create_index("ix_guardian_phone_e164", "guardians", ["phone_e164"], unique=False)

    op.create_table(
        "guardian_phone_verifications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "guardian_id",
            sa.String(length=36),
            sa.ForeignKey("guardians.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phone_e164", sa.String(length=32), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status in ('SENT','VERIFIED','EXPIRED','LOCKED')",
            name="ck_guardian_verification_status",
        ),
    )
    op.create_index(
        op.f("ix_guardian_phone_verifications_guardian_id"),
        "guardian_phone_verifications",
        ["guardian_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_guardian_phone_verifications_guardian_id"), table_name="guardian_phone_verifications")
    op.drop_table("guardian_phone_verifications")
    op.drop_index("ix_guardian_phone_e164", table_name="guardians")
    op.drop_table("guardians")
    op.drop_index(op.f("ix_children_procedure_case_id"), table_name="children")
    op.drop_index(op.f("ix_children_patient_id"), table_name="children")
    op.drop_table("children")
