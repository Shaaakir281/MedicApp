"""Helpers for neutral consent PDF generation and hashing (no PHI inside)."""

from __future__ import annotations

import hashlib
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from services import pdf as base_pdf
from services.storage import StorageError, get_storage_backend

SIGNED_CONSENT_CATEGORY = "signed_consents"
EVIDENCE_CATEGORY = "consent_evidences"
FINAL_CONSENT_CATEGORY = "final_consents"


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(base_pdf.TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )


def compute_pdf_sha256(data: bytes) -> str:
    """Return the SHA-256 hex digest of the provided bytes."""
    return hashlib.sha256(data).hexdigest()


def compute_file_sha256(path: Path) -> Optional[str]:
    """Compute SHA-256 for a file path; return None if file missing."""
    try:
        data = path.read_bytes()
    except FileNotFoundError:
        return None
    return compute_pdf_sha256(data)


def load_pdf_bytes(category: str, identifier: str) -> Optional[bytes]:
    """Attempt to load a stored PDF into memory (local storage only)."""
    storage = get_storage_backend()
    try:
        local_path = storage.get_local_path(category, identifier)
    except StorageError:
        return None
    try:
        return local_path.read_bytes()
    except FileNotFoundError:
        return None


def render_neutral_consent_pdf(consent_id: str, consent_hash: Optional[str] = None) -> Path:
    """Render a neutral consent PDF to a temporary file and return its path."""
    if base_pdf.HTML is None:
        raise RuntimeError("WeasyPrint is not installed in this environment")

    env = _env()
    template = env.get_template("consent_neutral.html")
    html = template.render(consent_id=consent_id, consent_hash=consent_hash)
    pdf_bytes = base_pdf.HTML(string=html).write_pdf()

    temp_dir = Path(tempfile.mkdtemp(prefix="consent-neutral-"))
    filename = f"yousign-neutral-consent-{uuid.uuid4().hex}.pdf"
    path = temp_dir / filename
    path.write_bytes(pdf_bytes)
    return path


def store_pdf_bytes(category: str, prefix: str, data: bytes) -> str:
    """Persist bytes as PDF into the chosen category and return the identifier."""
    storage = get_storage_backend()
    filename = f"{prefix}-{uuid.uuid4().hex}.pdf"
    return storage.save_pdf(category, filename, data)


def store_signed_pdf(data: bytes, prefix: str) -> str:
    """Persist signed PDF (from Yousign) inside HDS storage."""
    return store_pdf_bytes(SIGNED_CONSENT_CATEGORY, prefix, data)


def store_evidence_pdf(data: bytes, prefix: str) -> str:
    """Persist audit/evidence PDF inside HDS storage."""
    return store_pdf_bytes(EVIDENCE_CATEGORY, prefix, data)


def compose_final_consent(
    *,
    full_consent_id: str,
    signed_id: Optional[str],
    evidence_id: Optional[str],
) -> Optional[str]:
    """Merge consent + audit + signed neutral PDF into a single final PDF (local storage only)."""
    try:
        from PyPDF2 import PdfMerger
    except Exception as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("PyPDF2 est requis pour assembler le PDF final") from exc

    storage = get_storage_backend()
    try:
        full_path = storage.get_local_path(base_pdf.CONSENT_CATEGORY, full_consent_id)
    except StorageError:
        return None

    merger = PdfMerger()
    try:
        merger.append(str(full_path))
        if evidence_id:
            try:
                evidence_path = storage.get_local_path(EVIDENCE_CATEGORY, evidence_id)
                merger.append(str(evidence_path))
            except StorageError:
                pass
        if signed_id:
            try:
                signed_path = storage.get_local_path(SIGNED_CONSENT_CATEGORY, signed_id)
                merger.append(str(signed_path))
            except StorageError:
                pass

        temp_dir = Path(tempfile.mkdtemp(prefix="consent-final-"))
        filename = f"consent-final-{uuid.uuid4().hex}.pdf"
        output_path = temp_dir / filename
        with output_path.open("wb") as f:
            merger.write(f)
        merger.close()
        return store_pdf_bytes(FINAL_CONSENT_CATEGORY, "final-consent", output_path.read_bytes())
    finally:
        try:
            merger.close()
        except Exception:
            pass
