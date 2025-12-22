"""Add guardian email verification

Revision ID: 20241221_add_guardian_email_verification
Revises: 20241222_add_dossier_tables
Create Date: 2024-12-21 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20241221_add_guardian_email_verification'
down_revision = '20241222_add_dossier_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Add email_verified_at column to guardians table
    op.add_column('guardians', sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True))

    # Create guardian_email_verifications table
    op.create_table(
        'guardian_email_verifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('guardian_id', sa.String(36), sa.ForeignKey('guardians.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token_hash', sa.String(128), nullable=False, unique=True, index=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.String(255), nullable=True),
        sa.CheckConstraint(
            "status in ('SENT','VERIFIED','EXPIRED')",
            name='ck_guardian_email_verification_status',
        ),
    )


def downgrade():
    op.drop_table('guardian_email_verifications')
    op.drop_column('guardians', 'email_verified_at')
