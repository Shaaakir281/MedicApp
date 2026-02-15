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
from services.email import send_prescription_signed_email
from services.storage import StorageError, get_storage_backend
from services import download_links, qr_codes
from services.ordonnances import build_ordonnance_context
from services.event_tracker import get_event_tracker
from core.config import get_settings
from pydantic import BaseModel, Field
from dependencies.auth import get_current_user, require_practitioner


router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])
settings = get_settings()
event_tracker = get_event_tracker()


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


def _build_patient_download_url(prescription_id: int, *, channel: str) -> str:
    base_url = settings.app_base_url.rstrip("/")
    access_path = _build_prescription_access_path(
        prescription_id=prescription_id,
        actor="patient",
        channel=channel,
    )
    return f"{base_url}{access_path}?actor=patient&channel={channel}"


def _build_prescription_context(
    db: Session,
    appointment: models.Appointment,
    *,
    issued_at: datetime | None = None,
    existing_slug: str | None = None,
    existing_url: str | None = None,
) -> tuple[Dict[str, Any], str, Dict[str, Any]]:
    procedure = appointment.procedure_case
    child_name = procedure.child_full_name if procedure else appointment.user.email

    props = appointment.prescription
    weight_value = procedure.child_weight_kg if procedure else None
    prescriptions = props.items if props and props.items is not None else []
    instructions = props.instructions if props and props.instructions is not None else ""

    reference = (
        props.reference
        if props and props.reference
        else f"ORD-{appointment.id:06d}-{appointment.date.strftime('%m%y')}"
    )
    slug = existing_slug or qr_codes.generate_unique_slug(db)
    verification_url = existing_url or qr_codes.build_verification_url(slug)
    guardian_name = procedure.parent1_name if procedure else None
    guardian_email = (
        procedure.parent1_email
        if procedure and procedure.parent1_email
        else appointment.user.email if appointment.user else None
    )
    context = build_ordonnance_context(
        patient_name=child_name,
        patient_birthdate=procedure.child_birthdate if procedure else None,
        patient_weight=weight_value,
        intervention_date=appointment.date,
        prescriptions=prescriptions,
        instructions=instructions,
        appointment_type=appointment.appointment_type.value,
        reference=reference,
        verification_url=verification_url,
        guardian_name=guardian_name,
        guardian_email=guardian_email,
        issued_at=issued_at,
    )
    qr_payload = {
        "reference": reference,
        "patient_name": child_name,
        "guardian_name": guardian_name,
        "appointment_type": appointment.appointment_type.value,
        "issued_at": context["ordonnance"]["issued_at"],
        "valid_until": context["ordonnance"]["valid_until"],
    }
    return context, reference, {"slug": slug, "verification_url": verification_url, "payload": qr_payload}


def _append_version_entry(
    db: Session,
    appointment: models.Appointment,
    prescription: models.Prescription,
    pdf_path: str,
    *,
    skip_if_duplicate: bool = False,
) -> models.PrescriptionVersion:
    last_version = (
        db.query(models.PrescriptionVersion)
        .filter(models.PrescriptionVersion.prescription_id == prescription.id)
        .order_by(models.PrescriptionVersion.created_at.desc())
        .first()
    )
    if skip_if_duplicate and last_version:
        if (
            last_version.items == prescription.items
            and last_version.instructions == prescription.instructions
            and last_version.pdf_path == pdf_path
        ):
            return last_version

    version = models.PrescriptionVersion(
        prescription_id=prescription.id,
        appointment_id=appointment.id,
        appointment_type=appointment.appointment_type.value,
        pdf_path=pdf_path,
        items=prescription.items,
        instructions=prescription.instructions,
        reference=prescription.reference,
    )
    db.add(version)
    db.flush()
    return version


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

    if not pres.signed_at and actor != "practitioner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ordonnance non signée.",
        )

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
    event_tracker.track_event(
        "prescription_downloaded",
        properties={
            "prescription_id": pres.id,
            "actor": actor,
            "channel": channel,
        },
        measurements={"download_count": pres.download_count},
    )

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
    if parent:
        event_tracker.track_event(
            "prescription_downloaded",
            properties={
                "prescription_id": parent.id,
                "version_id": version.id,
                "actor": actor,
                "channel": channel,
            },
            measurements={"download_count": parent.download_count},
        )

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
    storage = get_storage_backend()

    # Explicitly check if prescription exists in DB (in case relationship not loaded)
    existing_pres = db.query(models.Prescription).filter(
        models.Prescription.appointment_id == appointment.id
    ).first()

    if existing_pres:
        pres = existing_pres
        file_missing = not (pres.pdf_path and storage.exists(ORDONNANCE_CATEGORY, pres.pdf_path))
        if not file_missing:
            return pres

        # Regenerate missing PDF
        existing_qr = pres.qr_codes[0] if pres.qr_codes else None
        context, reference, qr_meta = _build_prescription_context(
            db,
            appointment,
            issued_at=pres.signed_at,
            existing_slug=existing_qr.slug if existing_qr else None,
            existing_url=existing_qr.verification_url if existing_qr else None,
        )
        try:
            filename = generate_ordonnance_pdf(context)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        pres.pdf_path = filename
        pres.reference = reference
        db.add(pres)
        db.flush()
        version = _append_version_entry(db, appointment, pres, filename, skip_if_duplicate=True)
        qr_codes.upsert_qr_code(
            db,
            prescription=pres,
            reference=reference,
            slug=qr_meta["slug"],
            verification_url=qr_meta["verification_url"],
            payload=qr_meta["payload"],
            version=version,
        )
        db.commit()
        db.refresh(pres)
        return pres

    # Create new prescription if none exists
    existing_qr = None
    context, reference, qr_meta = _build_prescription_context(
        db,
        appointment,
        existing_slug=existing_qr.slug if existing_qr else None,
        existing_url=existing_qr.verification_url if existing_qr else None,
    )
    try:
        filename = generate_ordonnance_pdf(context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    prescription = models.Prescription(
        appointment_id=appointment.id,
        reference=reference,
        pdf_path=filename,
        download_count=0,
        items=context["prescriptions"],
        instructions=context["instructions"],
    )
    db.add(prescription)
    db.flush()
    version = _append_version_entry(db, appointment, prescription, filename, skip_if_duplicate=False)
    qr_codes.upsert_qr_code(
        db,
        prescription=prescription,
        reference=reference,
        slug=qr_meta["slug"],
        verification_url=qr_meta["verification_url"],
        payload=qr_meta["payload"],
        version=version,
    )
    db.commit()
    db.refresh(prescription)
    return prescription


@router.post("/{appointment_id}")
def create_prescription(
    appointment_id: int,
    current_user: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    # Verify appointment existence
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    pres = _ensure_prescription(db, appt)
    event_tracker.track_practitioner_event(
        "prescription_generated",
        current_user.id,
        prescription_type=appt.appointment_type.value if hasattr(appt.appointment_type, "value") else appt.appointment_type,
        procedure_id=appt.procedure_id,
        prescription_id=pres.id,
    )
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


@router.post("/{appointment_id}/sign", response_model=schemas.PrescriptionSignatureResponse)
def sign_prescription(
    appointment_id: int,
    current_user: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.PrescriptionSignatureResponse:
    appointment = (
        db.query(models.Appointment)
        .options(joinedload(models.Appointment.user), joinedload(models.Appointment.procedure_case))
        .filter(models.Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if not appointment.user or not appointment.user.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Patient email missing.")

    prescription = _ensure_prescription(db, appointment)
    now = datetime.utcnow()
    existing_qr = prescription.qr_codes[0] if prescription.qr_codes else None
    context, reference, qr_meta = _build_prescription_context(
        db,
        appointment,
        issued_at=now,
        existing_slug=existing_qr.slug if existing_qr else None,
        existing_url=existing_qr.verification_url if existing_qr else None,
    )
    try:
        filename = generate_ordonnance_pdf(context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    prescription.pdf_path = filename
    prescription.reference = reference
    prescription.signed_at = now
    prescription.signed_by_id = current_user.id
    db.add(prescription)

    if appointment.procedure_case:
        appointment.procedure_case.ordonnance_pdf_path = filename
        db.add(appointment.procedure_case)

    db.flush()
    version = _append_version_entry(db, appointment, prescription, filename, skip_if_duplicate=True)
    qr_codes.upsert_qr_code(
        db,
        prescription=prescription,
        reference=reference,
        slug=qr_meta["slug"],
        verification_url=qr_meta["verification_url"],
        payload=qr_meta["payload"],
        version=version,
    )

    preview_path = _build_prescription_access_path(
        prescription_id=prescription.id,
        actor="practitioner",
        channel="signature",
    )
    preview_url = f"{preview_path}?mode=inline"
    patient_download_url = _build_patient_download_url(
        prescription.id,
        channel="patient_signature",
    )

    portal_url = f"{settings.app_base_url.rstrip('/')}/patients/dashboard"
    pharmacy_url = f"{settings.app_base_url.rstrip('/')}/patients/dashboard?tab=ordonnance"
    try:
        send_prescription_signed_email(
            appointment.user.email,
            portal_url=portal_url,
            download_url=patient_download_url,
            pharmacy_url=pharmacy_url,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    prescription.sent_at = now
    prescription.sent_via = "signature_email"
    db.add(prescription)
    db.commit()
    db.refresh(prescription)
    event_tracker.track_practitioner_event(
        "prescription_generated",
        current_user.id,
        prescription_type=appointment.appointment_type.value if hasattr(appointment.appointment_type, "value") else appointment.appointment_type,
        procedure_id=appointment.procedure_id,
        prescription_id=prescription.id,
    )

    return schemas.PrescriptionSignatureResponse(
        prescription_id=prescription.id,
        appointment_id=appointment.id,
        signed_at=prescription.signed_at,
        preview_url=preview_url,
        patient_download_url=patient_download_url,
    )


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


@router.get("/qr/{slug}", response_model=schemas.PrescriptionVerificationResponse)
def verify_prescription_qr(
    slug: str,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.PrescriptionVerificationResponse:
    qr_code = (
        db.query(models.PrescriptionQRCode)
        .options(
            joinedload(models.PrescriptionQRCode.prescription)
            .joinedload(models.Prescription.appointment)
            .joinedload(models.Appointment.procedure_case)
        )
        .filter(models.PrescriptionQRCode.slug == slug)
        .first()
    )
    if qr_code is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code introuvable.")

    channel = request.query_params.get("channel") or "qr"
    actor = request.query_params.get("actor")
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    qr_codes.log_scan(
        db,
        qr_code,
        channel=channel,
        actor=actor,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.commit()

    prescription = qr_code.prescription
    appointment = prescription.appointment if prescription else None
    procedure_case = appointment.procedure_case if appointment else None
    payload = qr_code.qr_payload or {}
    return schemas.PrescriptionVerificationResponse(
        reference=qr_code.reference,
        slug=qr_code.slug,
        verification_url=qr_code.verification_url,
        issued_at=payload.get("issued_at"),
        valid_until=payload.get("valid_until"),
        patient_name=procedure_case.child_full_name if procedure_case else None,
        guardian_name=procedure_case.parent1_name if procedure_case else None,
        appointment_date=appointment.date if appointment else None,
        signed_at=prescription.signed_at if prescription else None,
        scan_count=qr_code.scan_count,
        last_scanned_at=qr_code.last_scanned_at,
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
    if not prescription.signed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ordonnance non signée : impossible d'envoyer le lien au patient.",
        )
    download_url = _build_patient_download_url(prescription.id, channel="email_link")
    storage = get_storage_backend()
    if not storage.exists(ORDONNANCE_CATEGORY, prescription.pdf_path):
        raise HTTPException(status_code=404, detail="Prescription file missing on disk")
    portal_url = f"{settings.app_base_url.rstrip('/')}/patients/dashboard"
    pharmacy_url = f"{settings.app_base_url.rstrip('/')}/patients/dashboard?tab=ordonnance"
    try:
        send_prescription_signed_email(
            appointment.user.email,
            portal_url=portal_url,
            download_url=download_url,
            pharmacy_url=pharmacy_url,
        )
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
    instructions = payload.instructions
    if instructions is not None:
        instructions = instructions.strip()
    prescription.instructions = instructions or None

    existing_qr = prescription.qr_codes[0] if prescription.qr_codes else None
    context, reference, qr_meta = _build_prescription_context(
        db,
        appointment,
        existing_slug=existing_qr.slug if existing_qr else None,
        existing_url=existing_qr.verification_url if existing_qr else None,
    )
    try:
        filename = generate_ordonnance_pdf(context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    prescription.pdf_path = filename
    prescription.reference = reference
    db.add(prescription)
    if appointment.procedure_case:
        appointment.procedure_case.ordonnance_pdf_path = filename
        db.add(appointment.procedure_case)
    db.flush()
    version = _append_version_entry(db, appointment, prescription, filename)
    qr_codes.upsert_qr_code(
        db,
        prescription=prescription,
        reference=reference,
        slug=qr_meta["slug"],
        verification_url=qr_meta["verification_url"],
        payload=qr_meta["payload"],
        version=version,
    )
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
