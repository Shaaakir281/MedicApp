"""Helpers to populate or synchronize the pharmacy directory."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from sqlalchemy.orm import Session

import crud
import models
import schemas

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "data" / "pharmacies_mssante_sample.json"


def load_fixture_entries() -> Iterable[schemas.PharmacyContactCreate]:
    if not FIXTURE_PATH.exists():
        return []
    with FIXTURE_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    for entry in payload:
        yield schemas.PharmacyContactCreate.model_validate(entry)


def bootstrap_if_empty(db: Session) -> bool:
    """Insert the sample list if the directory has no entries yet."""
    existing = db.query(models.PharmacyContact.id).limit(1).first()
    if existing:
        return False

    created = 0
    for payload in load_fixture_entries():
        crud.upsert_pharmacy_contact(db, payload)
        created += 1
    return created > 0
