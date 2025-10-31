"""PDF generation helpers (Jinja2 + WeasyPrint).

This module renders a Jinja2 template and writes a PDF to
`backend/storage/...` returning the relative filename.
"""
from __future__ import annotations

import os
import uuid
from typing import Dict, Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

try:
    # WeasyPrint is optional in tests/environments; import where available
    from weasyprint import HTML
    import pydyf  # type: ignore

    _pdf_init = getattr(getattr(pydyf, "PDF", None), "__init__", None)
    _needs_patch = False
    if callable(_pdf_init):
        code = getattr(_pdf_init, "__code__", None)
        if code is not None and code.co_argcount == 1:  # type: ignore[attr-defined]
            _needs_patch = True

    if _needs_patch:
        _original_pdf_init = pydyf.PDF.__init__

        def _patched_pdf_init(self, version=None, identifier=None):  # type: ignore[override]
            _original_pdf_init(self)
            version_bytes = version if isinstance(version, (bytes, bytearray)) else None
            if version_bytes is None:
                if isinstance(version, str):
                    version_bytes = version.encode("ascii", errors="ignore")
                elif version is None:
                    version_bytes = b"1.7"
            self.version = version_bytes or b"1.7"  # type: ignore[attr-defined]
            self.identifier = identifier  # type: ignore[attr-defined]

        pydyf.PDF.__init__ = _patched_pdf_init  # type: ignore[attr-defined]
except Exception:  # pragma: no cover - import error handled at runtime
    HTML = None  # type: ignore

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STORAGE_DIR = os.path.join(BASE_DIR, "storage", "prescriptions")
CHECKLIST_DIR = os.path.join(BASE_DIR, "storage", "checklists")
CONSENTS_DIR = os.path.join(BASE_DIR, "storage", "consents")
ORDONNANCES_DIR = os.path.join(BASE_DIR, "storage", "ordonnances")


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )


def _render_to_pdf(template_name: str, storage_dir: str, context: Dict[str, Any]) -> str:
    if HTML is None:
        raise RuntimeError("WeasyPrint is not installed in this environment")

    os.makedirs(storage_dir, exist_ok=True)

    env = _env()
    template = env.get_template(template_name)
    html = template.render(**context)

    filename = f"{uuid.uuid4()}.pdf"
    out_path = os.path.join(storage_dir, filename)

    # Write PDF
    HTML(string=html).write_pdf(out_path)

    # Return filename relative to the storage subdir
    return filename


def generate_prescription_pdf(template_name: str, context: Dict[str, Any]) -> str:
    """Render `template_name` with `context`, write PDF into storage and
    return the relative filename."""
    return _render_to_pdf(template_name, STORAGE_DIR, context)


def generate_checklist_pdf(context: Dict[str, Any]) -> str:
    """Generate the checklist PDF and return stored filename."""
    return _render_to_pdf("checklist.html", CHECKLIST_DIR, context)


def generate_consent_pdf(context: Dict[str, Any]) -> str:
    """Generate the parental consent PDF."""
    return _render_to_pdf("consent.html", CONSENTS_DIR, context)


def generate_ordonnance_pdf(context: Dict[str, Any]) -> str:
    """Generate the ordonnance PDF for the intervention."""
    return _render_to_pdf("ordonnance.html", ORDONNANCES_DIR, context)
