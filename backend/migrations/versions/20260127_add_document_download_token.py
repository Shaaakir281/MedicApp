"""add_document_download_token

Revision ID: 20260127_add_document_download_token
Revises: 52f16045cb82
Create Date: 2026-01-27
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260127_add_document_download_token'
down_revision = '52f16045cb82'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'procedure_cases',
        sa.Column('document_download_token', sa.String(length=64), nullable=True),
    )
    op.create_unique_constraint(
        'uq_procedure_cases_document_download_token',
        'procedure_cases',
        ['document_download_token'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_procedure_cases_document_download_token',
        'procedure_cases',
        type_='unique',
    )
    op.drop_column('procedure_cases', 'document_download_token')
