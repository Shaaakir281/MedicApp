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
    """
    Render a neutral consent PDF to a temporary file and return its path.

    DEPRECATED: Utiliser render_neutral_document_pdf() pour l'architecture granulaire.
    """
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


def render_neutral_document_pdf(
    document_type: str,
    consent_id: str,
    document_version: Optional[str] = None,
    consent_hash: Optional[str] = None,
) -> Path:
    """
    Génère un PDF neutre SPÉCIFIQUE à un type de document.

    Architecture granulaire: 1 PDF neutre = 1 document médical.

    Args:
        document_type: "authorization", "consent", "fees"
        consent_id: Identifiant du case (UUID ou ID)
        document_version: Version du document (ex: "v1.0", "v2.1")
        consent_hash: Hash SHA-256 du PDF médical complet (optionnel)

    RGPD: Aucune donnée médicale, aucun nom de patient.

    Exemples de contenu:
    - "Je confirme mon consentement pour le document AUTORISATION D'INTERVENTION"
    - "Je confirme mon consentement pour le document CONSENTEMENT ÉCLAIRÉ"
    - "Je confirme mon consentement pour le document HONORAIRES"
    """
    if base_pdf.HTML is None:
        raise RuntimeError("WeasyPrint is not installed in this environment")

    # Labels des documents
    doc_labels = {
        "authorization": "AUTORISATION D'INTERVENTION",
        "consent": "CONSENTEMENT ÉCLAIRÉ",
        "fees": "HONORAIRES ET MODALITÉS FINANCIÈRES",
    }
    document_label = doc_labels.get(document_type, document_type.upper())

    # Référence complète
    full_reference = f"{consent_id}-{document_type}"
    if document_version:
        full_reference += f"-{document_version}"

    env = _env()
    template = env.get_template("consent_neutral_document.html")
    html = template.render(
        document_label=document_label,
        full_reference=full_reference,
        consent_hash=consent_hash,
    )
    pdf_bytes = base_pdf.HTML(string=html).write_pdf()

    temp_dir = Path(tempfile.mkdtemp(prefix="consent-neutral-doc-"))
    filename = f"yousign-neutral-{document_type}-{uuid.uuid4().hex}.pdf"
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


def list_local_files_for_case(category: str, case_id: int) -> list[str]:
    """Return the list of stored identifiers for a given case (local storage only)."""
    storage = get_storage_backend()
    if not isinstance(storage, type(get_storage_backend())):  # just to satisfy type checkers
        pass
    # Only implemented for LocalStorageBackend
    if storage.__class__.__name__ != "LocalStorageBackend":
        return []
    try:
        dir_path = storage._dir(category)  # type: ignore[attr-defined]
    except Exception:
        return []
    try:
        return [
            entry.name
            for entry in dir_path.iterdir()
            if entry.is_file() and entry.name.startswith(f"{case_id}-")
        ]
    except Exception:
        return []


def prune_case_files(category: str, case_id: int, keep_latest: int = 2) -> None:
    """Keep only the N most recent files for a case (local storage only)."""
    storage = get_storage_backend()
    if storage.__class__.__name__ != "LocalStorageBackend":  # pragma: no cover - safety
        return
    try:
        dir_path = storage._dir(category)  # type: ignore[attr-defined]
        files = [
            entry for entry in dir_path.iterdir() if entry.is_file() and entry.name.startswith(f"{case_id}-")
        ]
        files_sorted = sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)
        for entry in files_sorted[keep_latest:]:
            try:
                entry.unlink()
            except Exception:
                continue
    except Exception:
        return


def compose_final_consent(
    *,
    full_consent_id: str,
    case_id: int,
    signed_ids: list[str] | None = None,
    evidence_ids: list[str] | None = None,
) -> Optional[str]:
    """
    Merge consent + audits + signed neutral PDFs into a single PDF (local storage only).

    DEPRECATED: Utiliser compose_final_document_consent() pour l'architecture granulaire.
    """
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
    merger.append(str(full_path))

    for evid in evidence_ids or []:
        try:
            evidence_path = storage.get_local_path(EVIDENCE_CATEGORY, evid)
            merger.append(str(evidence_path))
        except StorageError:
            continue

    for signed in signed_ids or []:
        try:
            signed_path = storage.get_local_path(SIGNED_CONSENT_CATEGORY, signed)
            merger.append(str(signed_path))
        except StorageError:
            continue

    temp_dir = Path(tempfile.mkdtemp(prefix="consent-final-"))
    filename = f"consent-final-{uuid.uuid4().hex}.pdf"
    output_path = temp_dir / filename
    with output_path.open("wb") as f:
        merger.write(f)
    merger.close()
    stored_id = store_pdf_bytes(FINAL_CONSENT_CATEGORY, f"{case_id}-final-consent", output_path.read_bytes())
    prune_case_files(FINAL_CONSENT_CATEGORY, case_id, keep_latest=1)
    return stored_id


def compose_final_document_consent(
    *,
    full_consent_id: str,
    document_type: str,
    case_id: int,
    signed_ids: list[str] | None = None,
    evidence_ids: list[str] | None = None,
) -> Optional[str]:
    """
    Assemble le package final pour UN document spécifique.

    Architecture granulaire: 1 package = 1 document médical.

    Contenu:
    1. PDF médical complet du document_type
    2. Audit trail(s) Yousign
    3. PDF(s) neutre(s) signé(s)

    Stockage en HDS uniquement.
    """
    try:
        from PyPDF2 import PdfMerger
    except Exception as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("PyPDF2 est requis pour assembler le PDF final") from exc

    storage = get_storage_backend()

    # TODO: Adapter pour charger le PDF spécifique au document_type
    # Pour l'instant, on utilise le full_consent_id global
    try:
        full_path = storage.get_local_path(base_pdf.CONSENT_CATEGORY, full_consent_id)
    except StorageError:
        return None

    merger = PdfMerger()
    merger.append(str(full_path))

    # Ajouter les audit trails
    for evid in evidence_ids or []:
        try:
            evidence_path = storage.get_local_path(EVIDENCE_CATEGORY, evid)
            merger.append(str(evidence_path))
        except StorageError:
            continue

    # Ajouter les PDFs neutres signés
    for signed in signed_ids or []:
        try:
            signed_path = storage.get_local_path(SIGNED_CONSENT_CATEGORY, signed)
            merger.append(str(signed_path))
        except StorageError:
            continue

    temp_dir = Path(tempfile.mkdtemp(prefix="consent-final-doc-"))
    filename = f"consent-final-{document_type}-{uuid.uuid4().hex}.pdf"
    output_path = temp_dir / filename

    with output_path.open("wb") as f:
        merger.write(f)
    merger.close()

    # Stocker avec nom explicite
    stored_id = store_pdf_bytes(
        FINAL_CONSENT_CATEGORY,
        f"{case_id}-{document_type}-final",
        output_path.read_bytes()
    )

    # Pruning : garder 1 version max par document
    prune_case_files(FINAL_CONSENT_CATEGORY, case_id, keep_latest=3)

    return stored_id
