"""Procedure routes dedicated to the circumcision workflow."""

from __future__ import annotations

from datetime import date as date_cls
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from dependencies.auth import get_current_user
from core.config import get_settings
from services import pdf as pdf_service
from services import email as email_service


router = APIRouter(prefix="/procedures", tags=["procedures"])

PATIENT_INFO: Dict[str, Any] = {
    "title": "Circoncision rituelle - informations patients",
    "sections": [
        {
            "heading": "Avant la consultation pre-operatoire",
            "items": [
                "Indiquer l'age, le poids, les allergies et traitements de l'enfant.",
                "Confirmer l'autorite parentale ou disposer de l'accord ecrit du second parent.",
                "Reconnaitre que l'intervention comporte des risques (saignement, infection, douleur, cicatrisation).",
            ],
        },
        {
            "heading": "Etapes du parcours",
            "items": [
                "Consultation pre-operatoire (visio ou presentiel) pour valider l'intervention et repondre aux questions.",
                "Signature du consentement eclaire par les deux parents ou representants legaux (telechargement ou signature sur place).",
                "Planification de l'acte et preparation du materiel prescrit (ordonnance fournie).",
            ],
        },
        {
            "heading": "Materiel a preparer",
            "items": [
                "Antiseptique chirurgical, pansements steriles, compresses, gants steriles.",
                "Creme cicatrisante, antalgique pediatrique adapte au poids, serum physiologique.",
                "Vaseline ou coton selon les recommandations du praticien.",
            ],
        },
    ],
}


def _serialize_case(case) -> schemas.ProcedureCase:
    today = date_cls.today()
    child_age_years = (today - case.child_birthdate).days / 365.25
    appointments = [
        schemas.Appointment.model_validate(appt, from_attributes=True)
        for appt in case.appointments
    ]
    download_url = None
    if case.consent_download_token and case.consent_pdf_path:
        base_url = get_settings().app_base_url.rstrip("/")
        download_url = f"{base_url}/procedures/{case.consent_download_token}/consent.pdf"

    return schemas.ProcedureCase(
        id=case.id,
        procedure_type=case.procedure_type.value,
        child_full_name=case.child_full_name,
        child_birthdate=case.child_birthdate,
        child_weight_kg=case.child_weight_kg,
        parent1_name=case.parent1_name,
        parent1_email=case.parent1_email,
        parent2_name=case.parent2_name,
        parent2_email=case.parent2_email,
        parental_authority_ack=case.parental_authority_ack,
        notes=case.notes,
        created_at=case.created_at,
        updated_at=case.updated_at,
        checklist_pdf_path=case.checklist_pdf_path,
        consent_pdf_path=case.consent_pdf_path,
        consent_download_url=download_url,
        ordonnance_pdf_path=case.ordonnance_pdf_path,
        child_age_years=round(child_age_years, 2),
        appointments=appointments,
    )


@router.get("/info")
def get_procedure_information() -> Dict[str, Any]:
    """Return informational content for the circumcision workflow."""
    return PATIENT_INFO


@router.get("/current", response_model=schemas.ProcedureCase)
def get_current_procedure(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.ProcedureCase:
    case = crud.get_active_procedure_case(db, current_user.id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune procedure en cours.",
        )
    return _serialize_case(case)


@router.post("", response_model=schemas.ProcedureCase, status_code=status.HTTP_201_CREATED)
def create_or_update_procedure(
    payload: schemas.ProcedureCaseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.ProcedureCase:
    existing = crud.get_active_procedure_case(db, current_user.id)
    if existing:
        case = crud.update_procedure_case(db, existing, payload)
    else:
        case = crud.create_procedure_case(db, current_user.id, payload)

    db.refresh(case)
    return _serialize_case(case)


@router.post("/send-consent-link", status_code=status.HTTP_202_ACCEPTED)
def send_consent_link(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Send the consent download link by email to the recorded parents."""
    case = crud.get_active_procedure_case(db, current_user.id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune procedure en cours.",
        )

    if not case.consent_download_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le consentement n'est pas encore disponible.",
        )

    recipients = [
        email for email in (case.parent1_email, case.parent2_email) if email
    ]
    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune adresse e-mail valide n'est associee au dossier.",
        )

    base_url = get_settings().app_base_url.rstrip("/")
    download_url = f"{base_url}/procedures/{case.consent_download_token}/consent.pdf"

    for recipient in recipients:
        email_service.send_consent_download_email(
            recipient,
            case.child_full_name,
            download_url,
        )

    return {"detail": "Lien de consentement envoye.", "recipients": recipients}


@router.get("/{token}/consent.pdf")
def download_consent_pdf(
    token: str,
    db: Session = Depends(get_db),
) -> FileResponse:
    case = crud.get_procedure_case_by_token(db, token)
    if case is None or not case.consent_pdf_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consentement introuvable.",
        )

    file_path = Path(pdf_service.CONSENTS_DIR) / case.consent_pdf_path
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier manquant sur le serveur.",
        )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=f"consentement-{case.child_full_name.replace(' ', '_')}.pdf",
    )
