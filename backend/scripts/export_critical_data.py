"""Export critical data to JSON/ZIP (manual backup).

Usage examples:
  # Requires: EXPORT_CRITICAL_DATA_ALLOWED=true + --reason
  python -m scripts.export_critical_data --output-dir ./exports --reason "RGPD-REQ-123"
  python -m scripts.export_critical_data --output-dir ./exports --anonymize --reason "PRA-TEST-2026-01"
  python -m scripts.export_critical_data --output-dir ./exports --since 2026-01-01 --reason "PCA-001"
  python -m scripts.export_critical_data --output-dir ./exports --encrypt --password "..." --reason "RGPD-REQ-456"
"""

from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import json
import os
import platform
import shutil
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet

import models
from database import SessionLocal


def _iso(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _mask_email(email: str | None) -> str | None:
    if not email:
        return None
    try:
        local, domain = email.split("@", 1)
    except ValueError:
        return "***"
    if len(local) <= 2:
        masked = "*" * len(local)
    else:
        masked = f"{local[0]}***{local[-1]}"
    return f"{masked}@{domain}"


def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 4:
        return "***"
    return f"***{digits[-4:]}"


def _mask_name(name: str | None) -> str | None:
    if not name:
        return None
    parts = name.strip().split()
    if not parts:
        return None
    masked = []
    for part in parts:
        if len(part) <= 2:
            masked.append(part[0] + "*")
        else:
            masked.append(part[0] + "*" * (len(part) - 2) + part[-1])
    return " ".join(masked)


def _apply_anonymization(payload: dict[str, Any]) -> dict[str, Any]:
    anonymized = dict(payload)
    for key in ("email", "patient_email", "parent1_email", "parent2_email"):
        if key in anonymized:
            anonymized[key] = _mask_email(anonymized.get(key))
    for key in ("parent1_phone", "parent2_phone", "phone"):
        if key in anonymized:
            anonymized[key] = _mask_phone(anonymized.get(key))
    for key in ("child_full_name", "parent1_name", "parent2_name"):
        if key in anonymized:
            anonymized[key] = _mask_name(anonymized.get(key))
    return anonymized


def _serialize_list(rows: list[Any], fields: list[str], anonymize: bool) -> list[dict[str, Any]]:
    serialized: list[dict[str, Any]] = []
    for row in rows:
        entry = {field: _iso(getattr(row, field, None)) for field in fields}
        if anonymize:
            entry = _apply_anonymization(entry)
        serialized.append(entry)
    return serialized


def _derive_fernet_key(password: str) -> bytes:
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Export critical MedicApp data.")
    parser.add_argument("--output-dir", required=True, help="Directory to store export files.")
    parser.add_argument("--since", help="Filter by created_at >= YYYY-MM-DD (when available).")
    parser.add_argument("--anonymize", action="store_true", help="Mask PII fields.")
    parser.add_argument("--encrypt", action="store_true", help="Encrypt the ZIP archive with a password.")
    parser.add_argument("--password", help="Password used for encryption (required if --encrypt).")
    parser.add_argument("--keep-plain", action="store_true", help="Keep the plain ZIP when encrypted.")
    parser.add_argument(
        "--reason",
        required=True,
        help="Reason/ticket for export (required for RGPD traceability).",
    )
    parser.add_argument(
        "--requested-by",
        help="Person or service requesting the export (defaults to current user).",
    )
    args = parser.parse_args()

    allow_export = os.getenv("EXPORT_CRITICAL_DATA_ALLOWED", "").strip().lower()
    if allow_export not in {"true", "1", "yes"}:
        raise SystemExit(
            "Export blocked: set EXPORT_CRITICAL_DATA_ALLOWED=true in the environment "
            "and provide --reason for RGPD traceability."
        )

    if args.encrypt and not args.password:
        raise SystemExit("Missing --password for encryption.")

    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    since_dt: datetime | None = None
    if args.since:
        since_dt = datetime.fromisoformat(args.since)

    with SessionLocal() as db:
        users_query = db.query(models.User).filter(models.User.role == models.UserRole.patient)
        appointments_query = db.query(models.Appointment)
        cases_query = db.query(models.ProcedureCase)
        signatures_query = db.query(models.DocumentSignature)
        prescriptions_query = db.query(models.Prescription)

        if since_dt:
            users_query = users_query.filter(models.User.created_at >= since_dt)
            appointments_query = appointments_query.filter(models.Appointment.created_at >= since_dt)
            cases_query = cases_query.filter(models.ProcedureCase.created_at >= since_dt)
            signatures_query = signatures_query.filter(models.DocumentSignature.created_at >= since_dt)
            prescriptions_query = prescriptions_query.filter(models.Prescription.created_at >= since_dt)

        users = users_query.all()
        appointments = appointments_query.all()
        cases = cases_query.all()
        signatures = signatures_query.all()
        prescriptions = prescriptions_query.all()

    export_date = datetime.utcnow().strftime("%Y-%m-%d")
    export_root = output_dir / f"export_{export_date}"
    export_root.mkdir(parents=True, exist_ok=True)

    users_payload = _serialize_list(
        users,
        ["id", "email", "role", "created_at", "email_verified"],
        args.anonymize,
    )
    appointments_payload = _serialize_list(
        appointments,
        ["id", "user_id", "procedure_case_id", "date", "time", "status", "appointment_type", "mode", "created_at"],
        args.anonymize,
    )
    cases_payload = _serialize_list(
        cases,
        [
            "id",
            "patient_id",
            "procedure_type",
            "child_full_name",
            "child_birthdate",
            "parent1_name",
            "parent1_email",
            "parent2_name",
            "parent2_email",
            "parent1_phone",
            "parent2_phone",
            "dossier_completed",
            "created_at",
            "updated_at",
        ],
        args.anonymize,
    )
    signatures_payload = _serialize_list(
        signatures,
        [
            "id",
            "procedure_case_id",
            "document_type",
            "overall_status",
            "parent1_status",
            "parent2_status",
            "signed_pdf_identifier",
            "final_pdf_identifier",
            "created_at",
            "updated_at",
            "completed_at",
        ],
        args.anonymize,
    )
    prescriptions_payload = _serialize_list(
        prescriptions,
        [
            "id",
            "appointment_id",
            "reference",
            "pdf_path",
            "sent_at",
            "sent_via",
            "signed_at",
            "created_at",
        ],
        args.anonymize,
    )

    _write_json(export_root / "patients.json", users_payload)
    _write_json(export_root / "appointments.json", appointments_payload)
    _write_json(export_root / "procedure_cases.json", cases_payload)
    _write_json(export_root / "signatures.json", signatures_payload)
    _write_json(export_root / "prescriptions.json", prescriptions_payload)

    metadata = {
        "exported_at": datetime.utcnow().isoformat(),
        "since": args.since,
        "anonymized": args.anonymize,
        "reason": args.reason,
        "requested_by": args.requested_by or getpass.getuser(),
        "executed_by": getpass.getuser(),
        "host": platform.node(),
        "pid": os.getpid(),
        "counts": {
            "patients": len(users_payload),
            "appointments": len(appointments_payload),
            "procedure_cases": len(cases_payload),
            "signatures": len(signatures_payload),
            "prescriptions": len(prescriptions_payload),
        },
    }
    _write_json(export_root / "metadata.json", metadata)

    zip_path = output_dir / f"export_{export_date}.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zipf:
        for file_path in export_root.rglob("*.json"):
            zipf.write(file_path, arcname=file_path.relative_to(export_root))

    if args.encrypt:
        key = _derive_fernet_key(args.password)
        fernet = Fernet(key)
        encrypted = fernet.encrypt(zip_path.read_bytes())
        encrypted_path = output_dir / f"export_{export_date}.zip.enc"
        encrypted_path.write_bytes(encrypted)
        if not args.keep_plain:
            zip_path.unlink(missing_ok=True)
        metadata["encrypted_path"] = str(encrypted_path)
    else:
        metadata["zip_path"] = str(zip_path)

    # Optional cleanup of raw folder (keep if needed for audit)
    if not args.keep_plain:
        shutil.rmtree(export_root, ignore_errors=True)

    audit_path = output_dir / "export_audit.jsonl"
    with audit_path.open("a", encoding="utf-8") as audit_file:
        audit_file.write(json.dumps(metadata, ensure_ascii=False) + "\n")

    print(f"Export termine dans {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

