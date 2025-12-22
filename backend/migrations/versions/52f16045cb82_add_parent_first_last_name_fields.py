"""add_parent_first_last_name_fields

Revision ID: 52f16045cb82
Revises: 20241223_merge_heads
Create Date: 2025-12-22 18:11:51.615779

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '52f16045cb82'
down_revision = '20241223_merge_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add separate first_name and last_name columns for both parents
    op.add_column('procedure_cases', sa.Column('parent1_first_name', sa.String(), nullable=True))
    op.add_column('procedure_cases', sa.Column('parent1_last_name', sa.String(), nullable=True))
    op.add_column('procedure_cases', sa.Column('parent2_first_name', sa.String(), nullable=True))
    op.add_column('procedure_cases', sa.Column('parent2_last_name', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove the added columns
    op.drop_column('procedure_cases', 'parent2_last_name')
    op.drop_column('procedure_cases', 'parent2_first_name')
    op.drop_column('procedure_cases', 'parent1_last_name')
    op.drop_column('procedure_cases', 'parent1_first_name')
