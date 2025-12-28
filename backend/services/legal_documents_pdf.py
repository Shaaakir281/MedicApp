"""PDF generation for legal documents (authorization/consent/fees)."""

from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape

import models
from domain.legal_documents import LEGAL_CATALOG
from domain.legal_documents.types import DocumentType
from services import pdf as base_pdf
from services.storage import get_storage_backend

LEGAL_DOCUMENT_CATEGORY_PREFIX = "legal_documents"
SIGNED_DOCUMENT_CATEGORY_PREFIX = "legal_documents_signed"
EVIDENCE_DOCUMENT_CATEGORY_PREFIX = "legal_documents_evidence"
FINAL_DOCUMENT_CATEGORY_PREFIX = "legal_documents_final"

_DOCUMENT_FOLDER = {
    DocumentType.SURGICAL_AUTHORIZATION_MINOR: "authorization",
    DocumentType.INFORMED_CONSENT: "consent",
    DocumentType.FEES_CONSENT_QUOTE: "fees",
}

_DOCUMENT_TYPE_ALIASES = {
    "authorization": "surgical_authorization_minor",
    "consent": "informed_consent",
    "fees": "fees_consent_quote",
}

def normalize_document_type(value: str | DocumentType) -> DocumentType:
    if isinstance(value, DocumentType):
        return value
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type de document manquant.",
        )
    normalized = _DOCUMENT_TYPE_ALIASES.get(value, value)
    try:
        return DocumentType(normalized)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de document invalide: {value}",
        ) from exc


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(base_pdf.TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )


def base_category_for(document_type: str | DocumentType) -> str:
    doc_type = normalize_document_type(document_type)
    return f"{LEGAL_DOCUMENT_CATEGORY_PREFIX}/{_DOCUMENT_FOLDER[doc_type]}"


def signed_category_for(document_type: str | DocumentType) -> str:
    doc_type = normalize_document_type(document_type)
    return f"{SIGNED_DOCUMENT_CATEGORY_PREFIX}/{_DOCUMENT_FOLDER[doc_type]}"


def evidence_category_for(document_type: str | DocumentType) -> str:
    doc_type = normalize_document_type(document_type)
    return f"{EVIDENCE_DOCUMENT_CATEGORY_PREFIX}/{_DOCUMENT_FOLDER[doc_type]}"


def final_category_for(document_type: str | DocumentType) -> str:
    doc_type = normalize_document_type(document_type)
    return f"{FINAL_DOCUMENT_CATEGORY_PREFIX}/{_DOCUMENT_FOLDER[doc_type]}"


def _build_context(case: models.ProcedureCase, document_type: DocumentType) -> dict[str, Any]:
    doc_def = LEGAL_CATALOG[document_type]
    child_birthdate = case.child_birthdate.strftime("%d/%m/%Y") if case.child_birthdate else ""
    return {
        "document_title": doc_def.title,
        "document_version": doc_def.version,
        "document_type": document_type.value,
        "reference": f"{case.id}-{document_type.value}",
        "child_full_name": case.child_full_name or "",
        "child_birthdate": child_birthdate,
        "parent1_name": case.parent1_name or "",
        "parent2_name": case.parent2_name or "",
        "cases": [item.text for item in doc_def.cases],
        "generated_at": dt.datetime.utcnow().strftime("%d/%m/%Y"),
    }


def ensure_legal_document_pdf(case: models.ProcedureCase, document_type: str | DocumentType) -> str:
    """Ensure the legal document PDF exists locally and return its identifier."""
    doc_type = normalize_document_type(document_type)
    doc_def = LEGAL_CATALOG[doc_type]
    filename = f"{case.id}-{doc_type.value}-{doc_def.version}.pdf"

    category = base_category_for(doc_type)
    storage = get_storage_backend()
    if storage.exists(category, filename):
        return filename

    if base_pdf.HTML is None:
        raise RuntimeError("WeasyPrint is not installed in this environment")

    env = _env()
    template = env.get_template("legal_document.html")
    html = template.render(**_build_context(case, doc_type))
    pdf_bytes = base_pdf.HTML(string=html).write_pdf()
    return storage.save_pdf(category, filename, pdf_bytes)
