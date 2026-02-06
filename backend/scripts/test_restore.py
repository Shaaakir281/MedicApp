"""Dry-run backup verification script.

This script does NOT restore data. It validates that:
1) The database is reachable and basic tables are readable.
2) Optional: Azure CLI can list recent backups (if configured).
3) Optional: Storage contains at least one recent signed document.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime, timezone

from sqlalchemy import text

import models
from core.config import get_settings
from database import SessionLocal
from services.storage import StorageError, get_storage_backend


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def check_database() -> dict:
    result: dict[str, object] = {"status": "ok"}
    with SessionLocal() as db:
        # Alembic version
        version = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        result["alembic_version"] = version

        # Basic counts (lightweight)
        result["users"] = db.query(models.User).count()
        result["appointments"] = db.query(models.Appointment).count()
        result["procedure_cases"] = db.query(models.ProcedureCase).count()
        result["document_signatures"] = db.query(models.DocumentSignature).count()

        # Sample signed document existence (if any)
        latest_doc = (
            db.query(models.DocumentSignature)
            .filter(models.DocumentSignature.signed_pdf_identifier.isnot(None))
            .order_by(models.DocumentSignature.updated_at.desc())
            .first()
        )
        if latest_doc:
            result["sample_document_identifier"] = latest_doc.signed_pdf_identifier
        else:
            result["sample_document_identifier"] = None

    return result


def check_storage(sample_identifier: str | None) -> dict:
    result: dict[str, object] = {"status": "skipped", "reason": "no sample"}
    if not sample_identifier:
        return result

    try:
        storage = get_storage_backend()
        exists = storage.exists("signed", sample_identifier)
        result["status"] = "ok" if exists else "missing"
        result["exists"] = bool(exists)
        result["identifier"] = sample_identifier
    except StorageError as exc:
        result["status"] = "error"
        result["error"] = str(exc)
    except Exception as exc:  # pragma: no cover - defensive
        result["status"] = "error"
        result["error"] = f"Unexpected error: {exc}"  # pragma: no cover

    return result


def list_azure_backups(server: str | None, resource_group: str | None, subscription: str | None) -> dict:
    if not server or not resource_group:
        return {"status": "skipped", "reason": "missing server/resource-group"}
    if shutil.which("az") is None:
        return {"status": "skipped", "reason": "Azure CLI not available"}

    cmd = [
        "az",
        "postgres",
        "flexible-server",
        "backup",
        "list",
        "--name",
        server,
        "--resource-group",
        resource_group,
        "--output",
        "json",
    ]
    if subscription:
        cmd.extend(["--subscription", subscription])

    try:
        proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
        data = json.loads(proc.stdout) if proc.stdout.strip() else []
        return {"status": "ok", "count": len(data), "backups": data}
    except subprocess.CalledProcessError as exc:
        return {
            "status": "error",
            "error": exc.stderr.strip() if exc.stderr else str(exc),
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Dry-run verification of backups/restore readiness.")
    parser.add_argument("--dry-run", action="store_true", default=True, help="No restore performed.")
    parser.add_argument("--output", help="Write JSON report to file.")
    parser.add_argument("--azure-server", help="Azure PostgreSQL flexible server name.")
    parser.add_argument("--azure-resource-group", help="Azure resource group name.")
    parser.add_argument("--azure-subscription", help="Azure subscription id (optional).")
    args = parser.parse_args()

    settings = get_settings()

    report: dict[str, object] = {
        "timestamp": _now_iso(),
        "environment": settings.environment,
        "database": {},
        "storage": {},
        "azure_backups": {},
        "dry_run": True,
    }

    try:
        db_report = check_database()
        report["database"] = db_report
        report["storage"] = check_storage(db_report.get("sample_document_identifier"))
    except Exception as exc:  # pragma: no cover - defensive
        report["database"] = {"status": "error", "error": str(exc)}

    report["azure_backups"] = list_azure_backups(
        args.azure_server,
        args.azure_resource_group,
        args.azure_subscription,
    )

    print(json.dumps(report, indent=2, ensure_ascii=False))

    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, ensure_ascii=False)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
