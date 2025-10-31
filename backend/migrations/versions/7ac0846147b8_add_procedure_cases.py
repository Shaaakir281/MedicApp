"""Add procedure cases workflow tables and fields."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "7ac0846147b8"
down_revision = "cc3a3049ab5d"
branch_labels = None
depends_on = None


procedure_type_enum = postgresql.ENUM(
    "circumcision",
    "autre",
    name="proceduretype",
    create_type=False,
)
appointment_type_enum = postgresql.ENUM(
    "general",
    "preconsultation",
    "act",
    name="appointmenttype",
    create_type=False,
)
appointment_mode_enum = postgresql.ENUM(
    "visio",
    "presentiel",
    name="appointmentmode",
    create_type=False,
)


def upgrade() -> None:
    op.execute("DROP TYPE IF EXISTS proceduretype CASCADE;")
    op.execute("DROP TYPE IF EXISTS appointmenttype CASCADE;")
    op.execute("DROP TYPE IF EXISTS appointmentmode CASCADE;")

    op.execute("CREATE TYPE proceduretype AS ENUM ('circumcision', 'autre');")
    op.execute(
        "CREATE TYPE appointmenttype AS ENUM ('general', 'preconsultation', 'act');"
    )
    op.execute("CREATE TYPE appointmentmode AS ENUM ('visio', 'presentiel');")

    op.create_table(
        "procedure_cases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "procedure_type",
            procedure_type_enum,
            nullable=False,
            server_default="circumcision",
        ),
        sa.Column("child_full_name", sa.String(), nullable=False),
        sa.Column("child_birthdate", sa.Date(), nullable=False),
        sa.Column("child_weight_kg", sa.Float(), nullable=True),
        sa.Column("parent1_name", sa.String(), nullable=False),
        sa.Column("parent1_email", sa.String(), nullable=True),
        sa.Column("parent2_name", sa.String(), nullable=True),
        sa.Column("parent2_email", sa.String(), nullable=True),
        sa.Column(
            "parental_authority_ack",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("checklist_pdf_path", sa.String(), nullable=True),
        sa.Column("consent_pdf_path", sa.String(), nullable=True),
        sa.Column("consent_download_token", sa.String(), nullable=True, unique=True),
        sa.Column("ordonnance_pdf_path", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index("ix_procedure_cases_id", "procedure_cases", ["id"])
    op.create_index("ix_procedure_cases_patient_id", "procedure_cases", ["patient_id"])

    op.add_column(
        "appointments",
        sa.Column(
            "appointment_type",
            appointment_type_enum,
            nullable=False,
            server_default="general",
        ),
    )
    op.add_column(
        "appointments",
        sa.Column(
            "mode",
            appointment_mode_enum,
            nullable=True,
        ),
    )
    op.add_column(
        "appointments",
        sa.Column("procedure_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_appointments_procedure_cases",
        "appointments",
        "procedure_cases",
        ["procedure_id"],
        ["id"],
    )

    op.alter_column("procedure_cases", "procedure_type", server_default=None)
    op.alter_column("appointments", "appointment_type", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "fk_appointments_procedure_cases",
        "appointments",
        type_="foreignkey",
    )
    op.drop_column("appointments", "procedure_id")
    op.drop_column("appointments", "mode")
    op.drop_column("appointments", "appointment_type")

    op.drop_index("ix_procedure_cases_patient_id", table_name="procedure_cases")
    op.drop_index("ix_procedure_cases_id", table_name="procedure_cases")
    op.drop_table("procedure_cases")

    op.execute("DROP TYPE IF EXISTS appointmentmode CASCADE;")
    op.execute("DROP TYPE IF EXISTS appointmenttype CASCADE;")
    op.execute("DROP TYPE IF EXISTS proceduretype CASCADE;")
