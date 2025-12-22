"""Add document_signatures table for granular Yousign signatures

Revision ID: 20241222_add_document_signatures
Revises: 20241222_add_dossier_tables
Create Date: 2025-12-22 14:00:00.000000

This migration introduces the `document_signatures` table to support
granular signature tracking (1 Signature Request per document type).

Architecture change:
- BEFORE: 1 ProcedureCase → 1 Yousign SR (all documents)
- AFTER:  1 ProcedureCase → N DocumentSignature (1 per document type)

RGPD/HDS compliance:
- Each document has its own signature tracking
- Yousign purge per document (not global)
- Audit trail per document
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20241222_add_document_signatures'
down_revision = '20241222_add_dossier_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Create document_signatures table
    op.create_table(
        'document_signatures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('procedure_case_id', sa.Integer(), nullable=False),
        sa.Column('document_type', sa.String(length=64), nullable=False),
        sa.Column('document_version', sa.String(length=32), nullable=True),

        # Yousign Signature Request
        sa.Column('yousign_procedure_id', sa.String(length=128), nullable=True),

        # Parent 1 (signataire principal)
        sa.Column('parent1_yousign_signer_id', sa.String(length=128), nullable=True),
        sa.Column('parent1_signature_link', sa.String(), nullable=True),
        sa.Column('parent1_status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('parent1_sent_at', sa.DateTime(), nullable=True),
        sa.Column('parent1_signed_at', sa.DateTime(), nullable=True),
        sa.Column('parent1_method', sa.String(length=32), nullable=True),

        # Parent 2 (signataire secondaire)
        sa.Column('parent2_yousign_signer_id', sa.String(length=128), nullable=True),
        sa.Column('parent2_signature_link', sa.String(), nullable=True),
        sa.Column('parent2_status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('parent2_sent_at', sa.DateTime(), nullable=True),
        sa.Column('parent2_signed_at', sa.DateTime(), nullable=True),
        sa.Column('parent2_method', sa.String(length=32), nullable=True),

        # État global
        sa.Column('overall_status', sa.String(length=32), nullable=False, server_default='draft'),

        # Artefacts (stockage HDS)
        sa.Column('signed_pdf_identifier', sa.String(), nullable=True),
        sa.Column('evidence_pdf_identifier', sa.String(), nullable=True),
        sa.Column('final_pdf_identifier', sa.String(), nullable=True),

        # Métadonnées
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('yousign_purged_at', sa.DateTime(), nullable=True),

        # Contraintes
        sa.ForeignKeyConstraint(['procedure_case_id'], ['procedure_cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('procedure_case_id', 'document_type', name='uq_document_signature_per_case'),
        sa.UniqueConstraint('yousign_procedure_id', name='uq_yousign_procedure_id'),
    )

    # Indexes pour performance
    op.create_index('ix_document_signatures_procedure_case_id', 'document_signatures', ['procedure_case_id'])
    op.create_index('ix_document_signatures_document_type', 'document_signatures', ['document_type'])
    op.create_index('ix_document_signatures_yousign_procedure_id', 'document_signatures', ['yousign_procedure_id'])
    op.create_index('ix_document_signatures_overall_status', 'document_signatures', ['overall_status'])

    # Add legacy migration flag to procedure_cases
    op.add_column('procedure_cases', sa.Column('legacy_consent_migrated', sa.Boolean(), nullable=False, server_default='false'))

    # --- Data migration: migrate existing consents to granular architecture ---
    # Pour chaque ProcedureCase ayant un yousign_procedure_id existant,
    # créer un DocumentSignature avec document_type="consent" (legacy global)

    # Note: Cette migration utilise des opérations SQL brutes pour compatibilité multi-DB
    connection = op.get_bind()

    # Migrer les anciens consentements globaux
    migration_query = """
        INSERT INTO document_signatures (
            procedure_case_id,
            document_type,
            document_version,
            yousign_procedure_id,
            parent1_yousign_signer_id,
            parent2_yousign_signer_id,
            parent1_status,
            parent2_status,
            parent1_sent_at,
            parent2_sent_at,
            parent1_signed_at,
            parent2_signed_at,
            parent1_method,
            parent2_method,
            parent1_signature_link,
            parent2_signature_link,
            overall_status,
            signed_pdf_identifier,
            evidence_pdf_identifier,
            completed_at,
            created_at,
            updated_at
        )
        SELECT
            id AS procedure_case_id,
            'consent' AS document_type,
            'legacy' AS document_version,
            yousign_procedure_id,
            parent1_yousign_signer_id,
            parent2_yousign_signer_id,
            parent1_consent_status AS parent1_status,
            parent2_consent_status AS parent2_status,
            parent1_consent_sent_at AS parent1_sent_at,
            parent2_consent_sent_at AS parent2_sent_at,
            parent1_consent_signed_at AS parent1_signed_at,
            parent2_consent_signed_at AS parent2_signed_at,
            parent1_consent_method AS parent1_method,
            parent2_consent_method AS parent2_method,
            parent1_signature_link,
            parent2_signature_link,
            CASE
                WHEN parent1_consent_status = 'signed' AND parent2_consent_status = 'signed' THEN 'completed'
                WHEN parent1_consent_status = 'sent' OR parent2_consent_status = 'sent' THEN 'sent'
                ELSE 'draft'
            END AS overall_status,
            consent_signed_pdf_url AS signed_pdf_identifier,
            consent_evidence_pdf_url AS evidence_pdf_identifier,
            consent_ready_at AS completed_at,
            created_at,
            updated_at
        FROM procedure_cases
        WHERE yousign_procedure_id IS NOT NULL
    """

    connection.execute(sa.text(migration_query))

    # Marquer les cases migrés
    connection.execute(sa.text("""
        UPDATE procedure_cases
        SET legacy_consent_migrated = true
        WHERE yousign_procedure_id IS NOT NULL
    """))

    connection.commit()


def downgrade():
    # Rollback: supprimer les données migrées et la table
    op.drop_column('procedure_cases', 'legacy_consent_migrated')

    op.drop_index('ix_document_signatures_overall_status', table_name='document_signatures')
    op.drop_index('ix_document_signatures_yousign_procedure_id', table_name='document_signatures')
    op.drop_index('ix_document_signatures_document_type', table_name='document_signatures')
    op.drop_index('ix_document_signatures_procedure_case_id', table_name='document_signatures')

    op.drop_table('document_signatures')
