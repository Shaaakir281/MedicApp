"""Directory endpoints for pharmacies and healthcare contacts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from dependencies.auth import require_practitioner
from services import pharmacy_directory


router = APIRouter(prefix="/directory", tags=["directory"])


@router.get(
    "/pharmacies",
    response_model=schemas.PharmacySearchResponse,
    summary="Rechercher une pharmacie dans l'annuaire national",
)
def search_pharmacies(
    query: str = Query(..., min_length=2),
    city: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> schemas.PharmacySearchResponse:
    pharmacy_directory.bootstrap_if_empty(db)
    items, total = crud.search_pharmacies(
        db,
        query=query,
        city=city,
        limit=limit,
        offset=offset,
    )
    return schemas.PharmacySearchResponse(total=total, items=items)


@router.post(
    "/pharmacies",
    response_model=schemas.PharmacyContact,
    dependencies=[Depends(require_practitioner)],
    summary="Créer ou mettre à jour une entrée de pharmacie",
)
def upsert_pharmacy_contact(
    payload: schemas.PharmacyContactCreate,
    db: Session = Depends(get_db),
) -> schemas.PharmacyContact:
    entry = crud.upsert_pharmacy_contact(db, payload)
    return entry
