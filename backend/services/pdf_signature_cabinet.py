"""Helpers to embed handwritten cabinet signatures into PDFs."""

from __future__ import annotations

import datetime as dt
import io
from typing import Iterable, Optional

from PyPDF2 import PdfReader, PdfWriter

try:  # reportlab is used to build an overlay PDF with the signature image
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
except Exception as exc:  # pragma: no cover - optional dependency
    raise RuntimeError("reportlab est requis pour incruster la signature") from exc

try:
    from weasyprint import HTML
except Exception:  # pragma: no cover - optional dependency
    HTML = None  # type: ignore


def _format_signed_at(timestamp: dt.datetime) -> str:
    return timestamp.strftime("%d/%m/%Y %H:%M")


def _build_text_lines(
    *,
    signer_label: str,
    signed_at: dt.datetime,
    ip_address: Optional[str],
    session_token: str,
) -> list[str]:
    token_display = session_token[:12]
    return [
        f"Sign\u00e9 le {_format_signed_at(signed_at)}",
        f"{signer_label}",
        f"IP: {ip_address or '-'} | Session: {token_display}",
    ]


def embed_signature(
    pdf_bytes: bytes,
    signature_png_bytes: bytes,
    *,
    signer_label: str,
    signed_at: dt.datetime,
    ip_address: Optional[str],
    session_token: str,
) -> bytes:
    """Overlay the PNG signature + audit line on the last page of the PDF."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    if not reader.pages:
        raise ValueError("PDF vide.")

    last_index = len(reader.pages) - 1
    last_page = reader.pages[last_index]
    page_width = float(last_page.mediabox.width)
    page_height = float(last_page.mediabox.height)

    overlay_buffer = io.BytesIO()
    overlay = canvas.Canvas(overlay_buffer, pagesize=(page_width, page_height))

    image_reader = ImageReader(io.BytesIO(signature_png_bytes))
    image_width, image_height = image_reader.getSize()
    max_width = min(200.0, page_width * 0.35)
    max_height = 70.0
    scale = min(max_width / image_width, max_height / image_height, 1.0)
    draw_width = image_width * scale
    draw_height = image_height * scale

    margin_x = 40.0
    margin_y = 40.0
    draw_x = page_width - draw_width - margin_x
    draw_y = margin_y

    overlay.drawImage(
        image_reader,
        draw_x,
        draw_y,
        width=draw_width,
        height=draw_height,
        mask="auto",
    )

    overlay.setFont("Helvetica", 8)
    text_lines = _build_text_lines(
        signer_label=signer_label,
        signed_at=signed_at,
        ip_address=ip_address,
        session_token=session_token,
    )
    text_y = draw_y + draw_height + 4
    for line in reversed(text_lines):
        overlay.drawRightString(page_width - margin_x, text_y, line)
        text_y += 10

    overlay.save()
    overlay_buffer.seek(0)
    overlay_pdf = PdfReader(overlay_buffer)
    overlay_page = overlay_pdf.pages[0]

    for idx, page in enumerate(reader.pages):
        if idx == last_index:
            page.merge_page(overlay_page)
        writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def render_cabinet_evidence_pdf(
    *,
    document_type: str,
    signer_label: str,
    signed_at: dt.datetime,
    ip_address: Optional[str],
    user_agent: Optional[str],
    session_token: str,
    signature_hash: str,
    document_hash: Optional[str],
) -> Optional[bytes]:
    """Create a small PDF audit trail for cabinet signatures."""
    if HTML is None:
        return None

    html = f"""
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {{ font-family: Arial, sans-serif; font-size: 11px; color: #111; }}
          h1 {{ font-size: 16px; margin-bottom: 8px; }}
          .block {{ margin-bottom: 10px; }}
          .label {{ font-weight: bold; }}
          code {{ font-family: monospace; }}
        </style>
      </head>
      <body>
        <h1>Preuve de signature en cabinet</h1>
        <div class="block"><span class="label">Document :</span> {document_type}</div>
        <div class="block"><span class="label">Signataire :</span> {signer_label}</div>
        <div class="block"><span class="label">Date :</span> {_format_signed_at(signed_at)}</div>
        <div class="block"><span class="label">IP :</span> {ip_address or "-"}</div>
        <div class="block"><span class="label">User-Agent :</span> {user_agent or "-"}</div>
        <div class="block"><span class="label">Session :</span> <code>{session_token}</code></div>
        <div class="block"><span class="label">Hash signature :</span> <code>{signature_hash}</code></div>
        <div class="block"><span class="label">Hash document :</span> <code>{document_hash or "-"}</code></div>
      </body>
    </html>
    """
    return HTML(string=html).write_pdf()
