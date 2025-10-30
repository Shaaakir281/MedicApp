"""Prescriptions endpoints.

POST /prescriptions/{appointment_id} -> generate or return existing prescription
GET /prescriptions/{prescription_id} -> return PDF file
"""
from __future__ import annotations

from pathlib import Path
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import crud
import models
from database import get_db
from services.pdf import generate_prescription_pdf


router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


@router.post("/{appointment_id}")
def create_prescription(appointment_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    # Verify appointment existence
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    # If prescription already exists, return it
    if appt.prescription:
        pres = appt.prescription
        return {"id": pres.id, "appointment_id": pres.appointment_id, "url": f"/prescriptions/{pres.id}", "created_at": pres.created_at}

    # Minimal context: pull appointment + user info; in real app include questionnaire results
    context = {
        "appointment": appt,
        "user": appt.user,
        "generated_at": datetime.utcnow(),
    }

    try:
        filename = generate_prescription_pdf("prescription.html", context)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Persist a Prescription row
    pres = models.Prescription(appointment_id=appointment_id, pdf_path=filename)
    db.add(pres)
    db.commit()
    db.refresh(pres)

    return {"id": pres.id, "appointment_id": pres.appointment_id, "url": f"/prescriptions/{pres.id}", "created_at": pres.created_at}


@router.get("/{prescription_id}")
def get_prescription(prescription_id: int, db: Session = Depends(get_db)) -> FileResponse:
    # Lookup prescription in DB to get the stored pdf_path
    pres = db.query(models.Prescription).filter(models.Prescription.id == prescription_id).first()
    if not pres or not pres.pdf_path:
        raise HTTPException(status_code=404, detail="Prescription not found")
    # Build storage path relative to backend/ (two levels up from this file)
    storage_path = Path(__file__).resolve().parents[1] / "storage" / "prescriptions"
    fpath = storage_path / pres.pdf_path
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="Prescription file missing on disk")

    try:
        # Use FileResponse which is more efficient and sets appropriate headers
        return FileResponse(path=str(fpath), media_type="application/pdf", filename=fpath.name)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Error reading prescription file: {exc}")
