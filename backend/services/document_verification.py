"""Service de vérification quotidienne des documents signés."""
import logging
from datetime import datetime, timedelta
from typing import List, Dict
from sqlalchemy.orm import Session

import models
from services import storage, consent_pdf, legal_documents_pdf

logger = logging.getLogger("uvicorn.error")


def check_missing_identifiers(db: Session) -> List[Dict]:
    """Vérification 1: Identifiants NULL en DB."""
    anomalies = []

    query = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status == models.DocumentSignatureStatus.completed
    )

    for doc_sig in query.all():
        missing = []
        if not doc_sig.signed_pdf_identifier:
            missing.append("signed_pdf")
        if not doc_sig.evidence_pdf_identifier:
            missing.append("evidence_pdf")
        if not doc_sig.final_pdf_identifier:
            missing.append("final_pdf")

        if missing:
            anomalies.append({
                "id": doc_sig.id,
                "case_id": doc_sig.procedure_case_id,
                "document_type": doc_sig.document_type,
                "missing_fields": missing,
                "completed_at": doc_sig.completed_at.isoformat() if doc_sig.completed_at else None,
                "severity": "HIGH"
            })

    return anomalies


def check_missing_storage_files(db: Session, storage_backend) -> List[Dict]:
    """Vérification 2: Fichiers manquants en stockage."""
    anomalies = []

    query = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status == models.DocumentSignatureStatus.completed
    )

    for doc_sig in query.all():
        doc_type = legal_documents_pdf.normalize_document_type(doc_sig.document_type)

        # Vérifier signed PDF
        if doc_sig.signed_pdf_identifier:
            signed_category = f"legal_documents_signed/{doc_type}"
            if not storage_backend.exists(signed_category, doc_sig.signed_pdf_identifier):
                anomalies.append({
                    "id": doc_sig.id,
                    "case_id": doc_sig.procedure_case_id,
                    "document_type": doc_sig.document_type,
                    "missing_file": "signed_pdf",
                    "identifier": doc_sig.signed_pdf_identifier,
                    "severity": "HIGH"
                })

        # Vérifier evidence PDF
        if doc_sig.evidence_pdf_identifier:
            evidence_category = f"legal_documents_evidence/{doc_type}"
            if not storage_backend.exists(evidence_category, doc_sig.evidence_pdf_identifier):
                anomalies.append({
                    "id": doc_sig.id,
                    "case_id": doc_sig.procedure_case_id,
                    "document_type": doc_sig.document_type,
                    "missing_file": "evidence_pdf",
                    "identifier": doc_sig.evidence_pdf_identifier,
                    "severity": "HIGH"
                })

        # Vérifier final PDF
        if doc_sig.final_pdf_identifier:
            final_category = f"legal_documents_final/{doc_type}"
            if not storage_backend.exists(final_category, doc_sig.final_pdf_identifier):
                anomalies.append({
                    "id": doc_sig.id,
                    "case_id": doc_sig.procedure_case_id,
                    "document_type": doc_sig.document_type,
                    "missing_file": "final_pdf",
                    "identifier": doc_sig.final_pdf_identifier,
                    "severity": "CRITICAL"
                })

    return anomalies


def check_orphaned_yousign_procedures(db: Session) -> List[Dict]:
    """Vérification 3: Procédures Yousign non purgées >7j."""
    anomalies = []
    threshold_date = datetime.utcnow() - timedelta(days=7)

    query = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status == models.DocumentSignatureStatus.completed,
        models.DocumentSignature.yousign_procedure_id.isnot(None),
        models.DocumentSignature.yousign_purged_at.is_(None),
        models.DocumentSignature.completed_at < threshold_date
    )

    for doc_sig in query.all():
        days_unpurged = (datetime.utcnow() - doc_sig.completed_at).days
        anomalies.append({
            "id": doc_sig.id,
            "case_id": doc_sig.procedure_case_id,
            "document_type": doc_sig.document_type,
            "yousign_procedure_id": doc_sig.yousign_procedure_id,
            "days_unpurged": days_unpurged,
            "severity": "MEDIUM" if days_unpurged < 30 else "HIGH"
        })

    return anomalies


def check_stuck_partial_signatures(db: Session) -> List[Dict]:
    """Vérification 4: Signatures partielles >30j."""
    anomalies = []
    threshold_date = datetime.utcnow() - timedelta(days=30)

    query = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status == models.DocumentSignatureStatus.partially_signed,
        models.DocumentSignature.created_at < threshold_date
    )

    for doc_sig in query.all():
        days_stuck = (datetime.utcnow() - doc_sig.created_at).days
        signed_parent = None
        pending_parent = None

        if doc_sig.parent1_status == "signed" and doc_sig.parent2_status != "signed":
            signed_parent = "parent1"
            pending_parent = "parent2"
        elif doc_sig.parent2_status == "signed" and doc_sig.parent1_status != "signed":
            signed_parent = "parent2"
            pending_parent = "parent1"

        if signed_parent:
            anomalies.append({
                "id": doc_sig.id,
                "case_id": doc_sig.procedure_case_id,
                "document_type": doc_sig.document_type,
                "signed_parent": signed_parent,
                "pending_parent": pending_parent,
                "days_stuck": days_stuck,
                "severity": "MEDIUM" if days_stuck < 60 else "HIGH"
            })

    return anomalies


def check_artifact_integrity(db: Session, storage_backend) -> List[Dict]:
    """Vérification 5: Intégrité PDFs (header %PDF)."""
    anomalies = []

    query = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status == models.DocumentSignatureStatus.completed
    ).limit(100)  # Limiter pour éviter timeout

    for doc_sig in query.all():
        if doc_sig.final_pdf_identifier:
            doc_type = legal_documents_pdf.normalize_document_type(doc_sig.document_type)
            final_category = f"legal_documents_final/{doc_type}"

            try:
                pdf_bytes = consent_pdf.load_pdf_bytes(final_category, doc_sig.final_pdf_identifier)
                if pdf_bytes and not pdf_bytes.startswith(b"%PDF"):
                    anomalies.append({
                        "id": doc_sig.id,
                        "case_id": doc_sig.procedure_case_id,
                        "document_type": doc_sig.document_type,
                        "corrupted_file": "final_pdf",
                        "severity": "CRITICAL"
                    })
            except Exception as e:
                anomalies.append({
                    "id": doc_sig.id,
                    "case_id": doc_sig.procedure_case_id,
                    "document_type": doc_sig.document_type,
                    "corrupted_file": "final_pdf",
                    "error": str(e),
                    "severity": "CRITICAL"
                })

    return anomalies
