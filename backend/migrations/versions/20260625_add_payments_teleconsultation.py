"""add payments and teleconsultation scaffolding

Revision ID: 20260625_payments_teleconsult
Revises: 20260130_cabinet_signatures
Create Date: 2026-06-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260625_payments_teleconsult"
down_revision = "20260130_cabinet_signatures"
branch_labels = None
depends_on = None


payment_status = sa.Enum(
    "requires_payment",
    "processing",
    "succeeded",
    "failed",
    "refunded",
    name="paymentstatus",
)
stripe_webhook_event_status = sa.Enum(
    "received",
    "processed",
    "ignored",
    name="stripewebhookeventstatus",
)
teleconsultation_session_status = sa.Enum(
    "scheduled",
    "active",
    "ended",
    name="teleconsultationsessionstatus",
)


def upgrade() -> None:
    op.execute("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'awaiting_payment'")
    op.execute("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'cancelled'")

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "appointment_id",
            sa.Integer(),
            sa.ForeignKey("appointments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="eur"),
        sa.Column("status", payment_status, nullable=False, server_default="requires_payment"),
        sa.Column("stripe_checkout_session_id", sa.String(length=255), nullable=True),
        sa.Column("checkout_url", sa.String(length=1024), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_invoice_id", sa.String(length=255), nullable=True),
        sa.Column("invoice_hds_path", sa.String(length=512), nullable=True),
        sa.Column("invoice_download_token", sa.String(length=128), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
    )
    op.create_index(op.f("ix_payments_user_id"), "payments", ["user_id"], unique=False)
    op.create_index(op.f("ix_payments_status"), "payments", ["status"], unique=False)
    op.create_index(
        op.f("ix_payments_stripe_payment_intent_id"),
        "payments",
        ["stripe_payment_intent_id"],
        unique=False,
    )
    op.create_unique_constraint(
        op.f("uq_payments_stripe_checkout_session_id"),
        "payments",
        ["stripe_checkout_session_id"],
    )
    op.create_unique_constraint(
        op.f("uq_payments_invoice_download_token"),
        "payments",
        ["invoice_download_token"],
    )
    op.create_unique_constraint(
        op.f("uq_payments_idempotency_key"),
        "payments",
        ["idempotency_key"],
    )

    op.create_table(
        "stripe_webhook_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stripe_event_id", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=128), nullable=False),
        sa.Column("received_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("status", stripe_webhook_event_status, nullable=False, server_default="received"),
    )
    op.create_index(
        op.f("ix_stripe_webhook_events_stripe_event_id"),
        "stripe_webhook_events",
        ["stripe_event_id"],
        unique=True,
    )

    op.create_table(
        "teleconsultation_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "appointment_id",
            sa.Integer(),
            sa.ForeignKey("appointments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("livekit_room_name", sa.String(length=128), nullable=False),
        sa.Column(
            "status",
            teleconsultation_session_status,
            nullable=False,
            server_default="scheduled",
        ),
        sa.Column("access_link_token", sa.String(length=128), nullable=True),
        sa.Column("access_link_expires_at", sa.DateTime(), nullable=True),
        sa.Column("access_link_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        op.f("uq_teleconsultation_sessions_livekit_room_name"),
        "teleconsultation_sessions",
        ["livekit_room_name"],
    )
    op.create_unique_constraint(
        op.f("uq_teleconsultation_sessions_access_link_token"),
        "teleconsultation_sessions",
        ["access_link_token"],
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("uq_teleconsultation_sessions_access_link_token"),
        "teleconsultation_sessions",
        type_="unique",
    )
    op.drop_constraint(
        op.f("uq_teleconsultation_sessions_livekit_room_name"),
        "teleconsultation_sessions",
        type_="unique",
    )
    op.drop_table("teleconsultation_sessions")

    op.drop_index(
        op.f("ix_stripe_webhook_events_stripe_event_id"),
        table_name="stripe_webhook_events",
    )
    op.drop_table("stripe_webhook_events")

    op.drop_constraint(op.f("uq_payments_idempotency_key"), "payments", type_="unique")
    op.drop_constraint(op.f("uq_payments_invoice_download_token"), "payments", type_="unique")
    op.drop_constraint(
        op.f("uq_payments_stripe_checkout_session_id"),
        "payments",
        type_="unique",
    )
    op.drop_index(op.f("ix_payments_stripe_payment_intent_id"), table_name="payments")
    op.drop_index(op.f("ix_payments_status"), table_name="payments")
    op.drop_index(op.f("ix_payments_user_id"), table_name="payments")
    op.drop_table("payments")

    teleconsultation_session_status.drop(op.get_bind(), checkfirst=True)
    stripe_webhook_event_status.drop(op.get_bind(), checkfirst=True)
    payment_status.drop(op.get_bind(), checkfirst=True)
