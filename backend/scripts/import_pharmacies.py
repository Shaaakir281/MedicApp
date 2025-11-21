"\"\"\"Utility script to import pharmacies from a JSON file.\"\"\"

from __future__ import annotations

import json
import sys
from pathlib import Path

import typer
from sqlalchemy.orm import Session

import crud
import schemas
from database import SessionLocal

app = typer.Typer(help="Importer des pharmacies depuis un export JSON MS Santé.")


def load_payload(path: Path):
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, dict):
        entries = data.get("items") or data.get("results") or []
    else:
        entries = data
    for entry in entries:
        yield schemas.PharmacyContactCreate.model_validate(entry)


@app.command()
def import_file(filename: str):
    """Importer un fichier JSON contenant une liste de pharmacies."""
    path = Path(filename)
    if not path.exists():
        typer.echo(f"Fichier introuvable: {filename}", err=True)
        raise typer.Exit(code=1)

    session: Session = SessionLocal()
    created = 0
    try:
        for payload in load_payload(path):
            crud.upsert_pharmacy_contact(session, payload)
            created += 1
    finally:
        session.close()
    typer.echo(f"Import terminé. {created} fiches synchronisées.")


if __name__ == "__main__":
    app()
