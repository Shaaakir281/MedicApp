"""drop_legacy_consent_fields

Revision ID: 20260104_drop_legacy_consent_fields
Revises: 52f16045cb82
Create Date: 2026-01-04
"""

from alembic import op


revision = "20260104_drop_legacy_consent_fields"
down_revision = "52f16045cb82"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op placeholder. Schema already migrated in existing environments.
    pass


def downgrade() -> None:
    # No-op placeholder.
    pass
