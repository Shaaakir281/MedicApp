"""Hard-delete a patient and all related data + blobs (RGPD)."""

from __future__ import annotations

import argparse
import sys
from typing import Iterable

from sqlalchemy.orm import Session

import models
from core.config import get_settings
from database import SessionLocal
from dossier import models as dossier_models
from repositories import user_repository
from services import pdf as base_pdf
from services import consent_pdf
from services import legal_documents_pdf
from services.storage import get_storage_backend


def _iter_case_prefixes(case_id: int) -> Iterable[tuple[str, str]]:
    doc_types = [
        "authorization",
        "consent",
        "fees",
    ]
    for doc_type in doc_types:
        yield (legal_documents_pdf.base_category_for(doc_type), f"{case_id}-")
        yield (legal_documents_pdf.signed_category_for(doc_type), f"{case_id}-")
        yield (legal_documents_pdf.evidence_category_for(doc_type), f"{case_id}-")
        yield (legal_documents_pdf.final_category_for(doc_type), f"{case_id}-")
    # Legacy granular consent categories
    yield (base_pdf.CONSENT_CATEGORY, f"{case_id}-")
    yield (consent_pdf.SIGNED_CONSENT_CATEGORY, f"{case_id}-")
    yield (consent_pdf.EVIDENCE_CATEGORY, f"{case_id}-")
    yield (consent_pdf.FINAL_CONSENT_CATEGORY, f"{case_id}-")


def _delete_blob_if_exists(storage, category: str, identifier: str, dry_run: bool) -> None:
    if not identifier:
        return
    if dry_run:
        print(f"[DRY-RUN] delete {category}/{identifier}")
        return
    if storage.__class__.__name__ == "LocalStorageBackend":
        try:
            path = storage.get_local_path(category, identifier)
            path.unlink(missing_ok=True)
        except Exception:
            return
        return

    # Azure blob deletion
    settings = get_settings()
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(settings.azure_blob_connection_string)
    container = client.get_container_client(settings.azure_blob_container)
    blob_name = f"{category}/{identifier}"
    try:
        container.delete_blob(blob_name)
    except Exception:
        return


def _delete_prefix(storage, category: str, prefix: str, dry_run: bool) -> None:
    if storage.__class__.__name__ == "LocalStorageBackend":
        try:
            root = storage._dir(category)  # type: ignore[attr-defined]
        except Exception:
            return
        for entry in root.iterdir():
            if entry.is_file() and entry.name.startswith(prefix):
                if dry_run:
                    print(f"[DRY-RUN] delete {category}/{entry.name}")
                else:
                    try:
                        entry.unlink()
                    except Exception:
                        continue
        return

    settings = get_settings()
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(settings.azure_blob_connection_string)
    container = client.get_container_client(settings.azure_blob_container)
    name_starts_with = f"{category}/{prefix}"
    for blob in container.list_blobs(name_starts_with=name_starts_with):
        if dry_run:
            print(f"[DRY-RUN] delete {blob.name}")
        else:
            try:
                container.delete_blob(blob.name)
            except Exception:
                continue


def purge_patient(db: Session, email: str, dry_run: bool) -> None:
    user = user_repository.get_by_email(db, email)
    if not user:
        raise RuntimeError(f"User not found: {email}")

    if user.role != models.UserRole.patient:
        raise RuntimeError("Only patient accounts can be purged.")

    # Gather related objects
    cases = db.query(models.ProcedureCase).filter(models.ProcedureCase.patient_id == user.id).all()
    case_ids = [case.id for case in cases]

    appointments = db.query(models.Appointment).filter(models.Appointment.user_id == user.id).all()
    appointment_ids = [appt.id for appt in appointments]

    prescriptions = []
    prescription_versions = []
    if appointment_ids:
        prescriptions = (
            db.query(models.Prescription)
            .filter(models.Prescription.appointment_id.in_(appointment_ids))
            .all()
        )
        prescription_ids = [p.id for p in prescriptions]
        if prescription_ids:
            prescription_versions = (
                db.query(models.PrescriptionVersion)
                .filter(models.PrescriptionVersion.prescription_id.in_(prescription_ids))
                .all()
            )

    document_signatures = []
    if case_ids:
        document_signatures = (
            db.query(models.DocumentSignature)
            .filter(models.DocumentSignature.procedure_case_id.in_(case_ids))
            .all()
        )

    acknowledgements = []
    if appointment_ids:
        acknowledgements = (
            db.query(models.LegalAcknowledgement)
            .filter(models.LegalAcknowledgement.appointment_id.in_(appointment_ids))
            .all()
        )

    children = (
        db.query(dossier_models.Child)
        .filter(dossier_models.Child.patient_id == user.id)
        .all()
    )
    child_ids = [child.id for child in children]

    guardians = []
    phone_verifications = []
    email_verifications = []
    if child_ids:
        guardians = (
            db.query(dossier_models.Guardian)
            .filter(dossier_models.Guardian.child_id.in_(child_ids))
            .all()
        )
        guardian_ids = [g.id for g in guardians]
        if guardian_ids:
            phone_verifications = (
                db.query(dossier_models.GuardianPhoneVerification)
                .filter(dossier_models.GuardianPhoneVerification.guardian_id.in_(guardian_ids))
                .all()
            )
            email_verifications = (
                db.query(dossier_models.GuardianEmailVerification)
                .filter(dossier_models.GuardianEmailVerification.guardian_id.in_(guardian_ids))
                .all()
            )

    # Delete blobs
    storage = get_storage_backend()
    for prescription in prescriptions:
        _delete_blob_if_exists(storage, base_pdf.PRESCRIPTIONS_CATEGORY, prescription.pdf_path, dry_run)
    for version in prescription_versions:
        _delete_blob_if_exists(storage, base_pdf.PRESCRIPTIONS_CATEGORY, version.pdf_path, dry_run)
    for case in cases:
        _delete_blob_if_exists(storage, base_pdf.ORDONNANCE_CATEGORY, case.ordonnance_pdf_path, dry_run)
        for category, prefix in _iter_case_prefixes(case.id):
            _delete_prefix(storage, category, prefix, dry_run)

    for doc_sig in document_signatures:
        _delete_blob_if_exists(storage, consent_pdf.SIGNED_CONSENT_CATEGORY, doc_sig.signed_pdf_identifier, dry_run)
        _delete_blob_if_exists(storage, consent_pdf.EVIDENCE_CATEGORY, doc_sig.evidence_pdf_identifier, dry_run)
        _delete_blob_if_exists(storage, consent_pdf.FINAL_CONSENT_CATEGORY, doc_sig.final_pdf_identifier, dry_run)

    if dry_run:
        print("[DRY-RUN] Skipping database deletes.")
        return

    # Delete DB rows (reverse dependency order)
    for entry in phone_verifications:
        db.delete(entry)
    for entry in email_verifications:
        db.delete(entry)
    for entry in guardians:
        db.delete(entry)
    for entry in children:
        db.delete(entry)
    for entry in acknowledgements:
        db.delete(entry)
    for entry in document_signatures:
        db.delete(entry)
    for entry in prescription_versions:
        db.delete(entry)
    for entry in prescriptions:
        db.delete(entry)
    for entry in appointments:
        db.delete(entry)
    for entry in cases:
        db.delete(entry)
    db.delete(user)
    db.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description="Hard delete patient data (RGPD).")
    parser.add_argument("--email", required=True, help="Patient email to purge.")
    parser.add_argument(
        "--confirm",
        required=True,
        help="Must match the email to confirm the purge.",
    )
    parser.add_argument("--dry-run", action="store_true", help="List items without deleting.")
    parser.add_argument("--yes", action="store_true", help="Actually perform the purge.")
    args = parser.parse_args()

    if args.confirm.strip().lower() != args.email.strip().lower():
        print("Confirmation mismatch. --confirm must match --email.")
        return 2
    if not args.dry_run and not args.yes:
        print("Refusing to purge without --yes. Use --dry-run to preview.")
        return 2

    db = SessionLocal()
    try:
        purge_patient(db, args.email.strip(), args.dry_run)
    finally:
        db.close()
    print("Purge completed." if not args.dry_run else "Dry-run completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
