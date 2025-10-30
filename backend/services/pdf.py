"""PDF generation helpers (Jinja2 + WeasyPrint).

This module renders a Jinja2 template and writes a PDF to
`backend/storage/prescriptions/` returning the relative filename.
"""
from __future__ import annotations

import os
import uuid
from typing import Dict, Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

try:
    # WeasyPrint is optional in tests/environments; import where available
    from weasyprint import HTML
except Exception:  # pragma: no cover - import error handled at runtime
    HTML = None  # type: ignore

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STORAGE_DIR = os.path.join(BASE_DIR, "storage", "prescriptions")


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )


def generate_prescription_pdf(template_name: str, context: Dict[str, Any]) -> str:
    """Render `template_name` with `context`, write PDF into storage and
    return the relative filename.

    Raises RuntimeError if WeasyPrint is not available.
    """
    if HTML is None:
        raise RuntimeError("WeasyPrint is not installed in this environment")

    os.makedirs(STORAGE_DIR, exist_ok=True)

    env = _env()
    template = env.get_template(template_name)
    html = template.render(**context)

    filename = f"{uuid.uuid4()}.pdf"
    out_path = os.path.join(STORAGE_DIR, filename)

    # Write PDF
    HTML(string=html).write_pdf(out_path)

    # Return filename relative to storage/prescriptions
    return filename
