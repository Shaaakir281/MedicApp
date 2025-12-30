"""Rebuild final legal PDFs for completed document signatures."""
from __future__ import annotations

import argparse

from sqlalchemy.orm import Session

import models
from database import SessionLocal
from services import document_signature_service


def rebuild_finals(db: Session, case_id: int | None = None) -> int:
    query = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.overall_status == models.DocumentSignatureStatus.completed
    )
    if case_id is not None:
        query = query.filter(models.DocumentSignature.procedure_case_id == case_id)

    updated = 0
    for doc_sig in query.all():
        before = doc_sig.final_pdf_identifier
        doc_sig = document_signature_service.ensure_final_document(db, doc_sig)
        if doc_sig.final_pdf_identifier and doc_sig.final_pdf_identifier != before:
            updated += 1
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild final legal PDFs for completed signatures.")
    parser.add_argument("--case-id", type=int, default=None, help="Restrict to a single procedure case.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        updated = rebuild_finals(db, case_id=args.case_id)
    finally:
        db.close()

    scope = f"case={args.case_id}" if args.case_id else "all cases"
    print(f"[repair] rebuilt finals: {updated} ({scope})")


if __name__ == "__main__":
    main()
