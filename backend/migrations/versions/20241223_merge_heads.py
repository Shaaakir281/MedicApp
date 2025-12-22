"""Merge heads for guardian verification and document signatures."""

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

# revision identifiers, used by Alembic.
revision = "20241223_merge_heads"
down_revision = ("20241221_add_guardian_email_verification", "20241222_add_document_signatures")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
