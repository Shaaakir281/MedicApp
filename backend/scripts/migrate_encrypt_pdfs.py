"""Migrate existing PDFs in Azure Blob storage to encrypted versions."""

from __future__ import annotations

import argparse
import sys

from services.storage import get_storage_backend, StorageError


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Encrypt legacy PDFs in Azure Blob storage.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without uploading.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    storage = get_storage_backend()
    if not hasattr(storage, "_container"):
        print("This script only supports Azure storage backend.", file=sys.stderr)
        return 1

    container = storage._container  # type: ignore[attr-defined]
    blobs = list(container.list_blobs())
    total = len(blobs)
    migrated = 0

    for index, blob in enumerate(blobs, start=1):
        name = blob.name
        metadata = blob.metadata or {}
        encrypted = metadata.get("encrypted") == "true"
        if encrypted or name.endswith(".enc"):
            continue

        print(f"[{index}/{total}] Encrypting {name}")
        if args.dry_run:
            continue

        try:
            data = container.download_blob(name).readall()
            # Use storage save_pdf path to ensure encryption + metadata
            category, filename = name.split("/", 1) if "/" in name else ("misc", name)
            storage.save_pdf(category, filename, data)
            container.delete_blob(name)
            migrated += 1
        except StorageError as exc:
            print(f"Failed to encrypt {name}: {exc}", file=sys.stderr)
        except Exception as exc:  # pragma: no cover - network errors
            print(f"Unexpected error for {name}: {exc}", file=sys.stderr)

    print(f"Done. Migrated {migrated} file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
