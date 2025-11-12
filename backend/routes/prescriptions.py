"""Prescriptions endpoints.

POST /prescriptions/{appointment_id} -> generate or return existing prescription
GET /prescriptions/{prescription_id} -> return PDF file
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload

import crud
import models
import schemas
from database import get_db
from services.pdf import generate_ordonnance_pdf, ORDONNANCE_CATEGORY
from services.email import send_prescription_email
from services.storage import StorageError, get_storage_backend
from services import download_links
from core.config import get_settings
from pydantic import BaseModel, Field
from dependencies.auth import get_current_user, require_practitioner


router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])
settings = get_settings()


def _build_prescription_access_path(*, prescription_id: int, actor: str, channel: str) -> str:
    token = download_links.create_prescription_download_token(
        prescription_id,
        actor=actor,
        channel=channel,
    )
    return f"/prescriptions/access/{token}"


def _build_prescription_version_access_path(*, version_id: int, actor: str, channel: str) -> str:
    token = download_links.create_prescription_version_download_token(
        version_id,
        actor=actor,
        channel=channel,
    )
    return f"/prescriptions/versions/access/{token}"


ACT_PRESCRIPTIONS: List[str] = [
    "Bactigras 10x10 cm x 5",
    "Compresses stériles 5x5 cm x 10",
    "Set de pansement stérile",
    "Doliprane 2,4% (adapté au poids)",
    "Pansements compressifs 3x3 cm",
]

PRECONSULT_PRESCRIPTIONS: List[str] = [
    "Doliprane 2,4% (adapté au poids)",
    "Thermomètre électronique",
    "Carnet de santé",
]

DEFAULT_INSTRUCTIONS = (
    "Acheter ces éléments au plus tard 24h avant l'intervention et les conserver stériles. "
    "Apporter tout le matériel le jour J. En cas de complication (douleur importante, saignement, fièvre), contacter immédiatement votre praticien."
)


def _default_items_for_type(appointment_type: str) -> List[str]:
    return ACT_PRESCRIPTIONS if appointment_type == "act" else PRECONSULT_PRESCRIPTIONS


def _build_prescription_context(appointment: models.Appointment) -> Dict[str, Any]:
    procedure = appointment.procedure_case
    child_name = procedure.child_full_name if procedure else appointment.user.email
    child_birthdate = (
        procedure.child_birthdate.strftime("%d/%m/%Y") if procedure and procedure.child_birthdate else "N/D"
    )
    child_weight = procedure.child_weight_kg if procedure and procedure.child_weight_kg else "N/D"

    props = appointment.prescription
    prescriptions = props.items if props and props.items else _default_items_for_type(appointment.appointment_type.value)
    instructions = props.instructions if props and props.instructions else DEFAULT_INSTRUCTIONS

    return {
        "praticien_nom": "Dr MedicApp",
        "date_ordonnance": datetime.utcnow().strftime("%d/%m/%Y"),
        "enfant_nom": child_name,
        "enfant_ddn": child_birthdate,
        "enfant_poids": child_weight,
        "date_intervention": appointment.date.strftime("%d/%m/%Y"),
        "prescriptions": prescriptions,
        "instructions": instructions,
    }


def _append_version_entry(
    db: Session,
    appointment: models.Appointment,
    prescription: models.Prescription,
    pdf_path: str,
) -> None:
    version = models.PrescriptionVersion(
        prescription_id=prescription.id,
        appointment_id=appointment.id,
        appointment_type=appointment.appointment_type.value,
        pdf_path=pdf_path,
        items=prescription.items,
        instructions=prescription.instructions,
    )
    db.add(version)


def _resolve_actor_channel(request: Request, default_actor: str = "patient") -> tuple[str, str]:
    actor = request.query_params.get("actor") or default_actor
    channel = request.query_params.get("channel") or "download"
    return actor, channel


def _log_download(
    db: Session,
    version: Optional[models.PrescriptionVersion],
    actor: str,
    channel: str,
) -> None:
    if version is None:
        return
    log = models.PrescriptionDownloadLog(
        version_id=version.id,
        actor=actor,
        channel=channel,
    )
    db.add(log)
    db.commit()


def _serve_prescription_file(
    pres: models.Prescription,
    *,
    actor: str,
    channel: str,
    inline: bool,
    request: Request,
    db: Session,
) -> Response:
    storage = get_storage_backend()
    filename = pres.pdf_path or f"prescription-{pres.id}.pdf"

    pres.download_count = (pres.download_count or 0) + 1
    pres.last_download_at = datetime.utcnow()
    db.add(pres)
    version = (
        db.query(models.PrescriptionVersion)
        .filter(models.PrescriptionVersion.prescription_id == pres.id)
        .order_by(models.PrescriptionVersion.created_at.desc())
        .first()
    )
    db.commit()
    _log_download(db, version, actor, channel)

    if storage.supports_presigned_urls:
        try:
            url = storage.generate_presigned_url(
                ORDONNANCE_CATEGORY,
                pres.pdf_path,
                download_name=filename,
                inline=inline,
            )
            return RedirectResponse(url, status_code=307)
        except StorageError:
            pass

    try:
        return storage.build_file_response(
            ORDONNANCE_CATEGORY,
            pres.pdf_path,
            download_name=filename,
            inline=inline,
        )
    except StorageError as exc:
        raise HTTPException(status_code=404, detail="Prescription file missing on disk") from exc


def _serve_prescription_version_file(
    version: models.PrescriptionVersion,
    *,
    actor: str,
    channel: str,
    inline: bool,
    request: Request,
    db: Session,
) -> Response:
    storage = get_storage_backend()
    filename = version.pdf_path or f"prescription-version-{version.id}.pdf"

    parent = version.prescription
    if parent:
        parent.download_count = (parent.download_count or 0) + 1
        parent.last_download_at = datetime.utcnow()
        db.add(parent)
    db.commit()
    _log_download(db, version, actor, channel)

    if storage.supports_presigned_urls:
        try:
            url = storage.generate_presigned_url(
                ORDONNANCE_CATEGORY,
                version.pdf_path,
                download_name=filename,
                inline=inline,
            )
            return RedirectResponse(url, status_code=307)
        except StorageError:
            pass

    try:
        return storage.build_file_response(
            ORDONNANCE_CATEGORY,
            version.pdf_path,
            download_name=filename,
            inline=inline,
        )
    except StorageError as exc:
        raise HTTPException(status_code=404, detail="Prescription file missing on disk") from exc


def _ensure_prescription(db: Session, appointment: models.Appointment) -> models.Prescription:
    if appointment.prescription:
        return appointment.prescription

    context = _build_prescription_context(appointment)
    try:
        filename = generate_ordonnance_pdf(context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    prescription = models.Prescription(
        appointment_id=appointment.id,
        pdf_path=filename,
        download_count=0,
        items=context["prescriptions"],
        instructions=context["instructions"],
    )
    db.add(prescription)
    if appointment.procedure_case and not appointment.procedure_case.ordonnance_pdf_path:
        appointment.procedure_case.ordonnance_pdf_path = filename
        db.add(appointment.procedure_case)
    db.flush()
    _append_version_entry(db, appointment, prescription, filename)
    db.commit()
    db.refresh(prescription)
    return prescription


@router.post("/{appointment_id}")
def create_prescription(
    appointment_id: int,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    # Verify appointment existence
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    pres = _ensure_prescription(db, appt)
    return {
        "id": pres.id,
        "appointment_id": pres.appointment_id,
        "url": _build_prescription_access_path(
            prescription_id=pres.id,
            actor="practitioner",
            channel="api",
        ),
        "items": pres.items,
        "instructions": pres.instructions,
        "created_at": pres.created_at,
    }


@router.get("/{prescription_id}")
def get_prescription(
    prescription_id: int,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    # Lookup prescription in DB to get the stored pdf_path
    pres = (
        db.query(models.Prescription)
        .options(
            joinedload(models.Prescription.appointment).joinedload(models.Appointment.user)
        )
        .filter(models.Prescription.id == prescription_id)
        .first()
    )
    if not pres or not pres.pdf_path:
        raise HTTPException(status_code=404, detail="Prescription not found")
    appointment = pres.appointment
    if current_user.role != models.UserRole.praticien:
        if appointment is None or appointment.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès interdit à cette ordonnance.")

    default_actor = getattr(current_user.role, "value", current_user.role)
    actor, channel = _resolve_actor_channel(request, default_actor=default_actor)
    inline = request.query_params.get("mode") == "inline"
    return _serve_prescription_file(
        pres,
        actor=actor,
        channel=channel,
        inline=inline,
        request=request,
        db=db,
    )


@router.get("/{appointment_id}/history", response_model=List[schemas.PrescriptionVersionEntry])
def list_prescription_versions(
    appointment_id: int,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> List[schemas.PrescriptionVersionEntry]:
    appointment = (
        db.query(models.Appointment)
        .options(joinedload(models.Appointment.prescription))
        .filter(models.Appointment.id == appointment_id)
        .first()
    )
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    prescription = appointment.prescription
    if prescription is None:
        return []

    versions = (
        db.query(models.PrescriptionVersion)
        .filter(models.PrescriptionVersion.prescription_id == prescription.id)
        .order_by(models.PrescriptionVersion.created_at.desc())
        .all()
    )
    entries: List[schemas.PrescriptionVersionEntry] = []
    for version in versions:
        downloads = [
            schemas.PrescriptionDownloadEntry(
                id=log.id,
                actor=log.actor,
                channel=log.channel,
                downloaded_at=log.downloaded_at,
            )
            for log in sorted(version.downloads, key=lambda l: l.downloaded_at, reverse=True)
        ]
        entries.append(
            schemas.PrescriptionVersionEntry(
                id=version.id,
                appointment_id=version.appointment_id,
                appointment_type=version.appointment_type,
                created_at=version.created_at,
                items=version.items,
                instructions=version.instructions,
                url=_build_prescription_version_access_path(
                    version_id=version.id,
                    actor="practitioner",
                    channel="history",
                ),
                downloads=downloads,
            )
        )
    return entries


@router.get("/versions/{version_id}")
def get_prescription_version(
    version_id: int,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    version = (
        db.query(models.PrescriptionVersion)
        .options(
            joinedload(models.PrescriptionVersion.prescription)
            .joinedload(models.Prescription.appointment)
            .joinedload(models.Appointment.user)
        )
        .filter(models.PrescriptionVersion.id == version_id)
        .first()
    )
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription version not found")

    parent = version.prescription
    appointment = parent.appointment if parent else None
    if current_user.role != models.UserRole.praticien:
        if appointment is None or appointment.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès interdit à cette version d'ordonnance.")

    default_actor = getattr(current_user.role, "value", current_user.role)
    actor, channel = _resolve_actor_channel(request, default_actor=default_actor)
    inline = request.query_params.get("mode") == "inline"
    return _serve_prescription_version_file(
        version,
        actor=actor,
        channel=channel,
        inline=inline,
        request=request,
        db=db,
    )


@router.get("/access/{download_token}")
def download_prescription_with_token(
    download_token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    try:
        prescription_id, actor_claim, channel_claim = download_links.resolve_prescription_download_token(download_token)
    except download_links.InvalidDownloadTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien de téléchargement invalide ou expiré.",
        )

    pres = (
        db.query(models.Prescription)
        .options(joinedload(models.Prescription.appointment).joinedload(models.Appointment.user))
        .filter(models.Prescription.id == prescription_id)
        .first()
    )
    if not pres or not pres.pdf_path:
        raise HTTPException(status_code=404, detail="Prescription not found")

    actor = request.query_params.get("actor") or actor_claim or "anonymous"
    channel = request.query_params.get("channel") or channel_claim or "download_link"
    inline = request.query_params.get("mode") == "inline"
    return _serve_prescription_file(
        pres,
        actor=actor,
        channel=channel,
        inline=inline,
        request=request,
        db=db,
    )


@router.get("/versions/access/{download_token}")
def download_prescription_version_with_token(
    download_token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    try:
        version_id, actor_claim, channel_claim = download_links.resolve_prescription_version_download_token(download_token)
    except download_links.InvalidDownloadTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien de téléchargement invalide ou expiré.",
        )

    version = (
        db.query(models.PrescriptionVersion)
        .options(
            joinedload(models.PrescriptionVersion.prescription)
            .joinedload(models.Prescription.appointment)
            .joinedload(models.Appointment.user)
        )
        .filter(models.PrescriptionVersion.id == version_id)
        .first()
    )
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription version not found")

    actor = request.query_params.get("actor") or actor_claim or "anonymous"
    channel = request.query_params.get("channel") or channel_claim or "download_link"
    inline = request.query_params.get("mode") == "inline"
    return _serve_prescription_version_file(
        version,
        actor=actor,
        channel=channel,
        inline=inline,
        request=request,
        db=db,
    )


@router.post("/{appointment_id}/send-link", status_code=status.HTTP_202_ACCEPTED)
def send_prescription_link(
    appointment_id: int,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if not appointment.user or not appointment.user.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Patient email missing.")

    prescription = _ensure_prescription(db, appointment)
    base_url = settings.app_base_url.rstrip("/")
    access_path = _build_prescription_access_path(
        prescription_id=prescription.id,
        actor="patient",
        channel="email_link",
    )
    download_url = f"{base_url}{access_path}?actor=patient&channel=email_link"
    storage = get_storage_backend()
    if not storage.exists(ORDONNANCE_CATEGORY, prescription.pdf_path):
        raise HTTPException(status_code=404, detail="Prescription file missing on disk")
    try:
        send_prescription_email(appointment.user.email, download_url, appointment.appointment_type)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    prescription.sent_at = datetime.utcnow()
    prescription.sent_via = "email"
    db.add(prescription)
    db.commit()

    return {"detail": "Ordonnance envoyée par e-mail.", "download_url": download_url}


class PrescriptionUpdateRequest(BaseModel):
    items: List[str] = Field(min_length=1)
    instructions: str | None = None


@router.put("/{appointment_id}")
def update_prescription(
    appointment_id: int,
    payload: PrescriptionUpdateRequest,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    prescription = _ensure_prescription(db, appointment)
    prescription.items = [item.strip() for item in payload.items if item.strip()]
    if not prescription.items:
        raise HTTPException(status_code=400, detail="Au moins une ligne de prescription est nécessaire.")
    prescription.instructions = payload.instructions or DEFAULT_INSTRUCTIONS

    context = _build_prescription_context(appointment)
    try:
        filename = generate_ordonnance_pdf(context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    prescription.pdf_path = filename
    db.add(prescription)
    if appointment.procedure_case:
        appointment.procedure_case.ordonnance_pdf_path = filename
        db.add(appointment.procedure_case)
    db.flush()
    _append_version_entry(db, appointment, prescription, filename)
    db.commit()
    db.refresh(prescription)
    return {
        "id": prescription.id,
        "appointment_id": prescription.appointment_id,
        "items": prescription.items,
        "instructions": prescription.instructions,
        "url": _build_prescription_access_path(
            prescription_id=prescription.id,
            actor="practitioner",
            channel="api",
        ),
        "updated_at": prescription.created_at,
    }
