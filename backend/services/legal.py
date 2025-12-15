"""Legal acknowledgement and cabinet session services."""

from __future__ import annotations

import datetime as dt
import hashlib
import logging
import secrets
from typing import Iterable, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from domain.legal_documents import CATALOG_VERSION, LEGAL_CATALOG, required_roles_for_document
from domain.legal_documents.types import DocumentType, LegalDocumentCase, SignerRole

logger = logging.getLogger("uvicorn.error")

CABINET_SESSION_TTL_MINUTES = 10


def _get_appointment(db: Session, appointment_id: int) -> models.Appointment:
    appointment = (
        db.query(models.Appointment)
        .options(joinedload(models.Appointment.procedure_case))
        .filter(models.Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendez-vous introuvable.")
    return appointment


def _find_case_definition(document_type: DocumentType, case_key: str) -> LegalDocumentCase:
    document = LEGAL_CATALOG.get(document_type)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document juridique inconnu.")
    for case in document.cases:
        if case.key == case_key:
            return case
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case à cocher inconnue.")


def _acknowledge(
    db: Session,
    *,
    appointment_id: int,
    document_type: DocumentType,
    signer_role: SignerRole,
    case_key: str,
    catalog_version: str | None,
    source: str | None,
    ip: str | None,
    user_agent: str | None,
) -> models.LegalAcknowledgement:
    case_def = _find_case_definition(document_type, case_key)
    catalog_version = catalog_version or CATALOG_VERSION
    source = source or "remote"

    existing = (
        db.query(models.LegalAcknowledgement)
        .filter(
            models.LegalAcknowledgement.appointment_id == appointment_id,
            models.LegalAcknowledgement.document_type == document_type,
            models.LegalAcknowledgement.signer_role == signer_role,
            models.LegalAcknowledgement.case_key == case_key,
        )
        .first()
    )
    now = dt.datetime.utcnow()
    if existing:
        existing.case_text = case_def.text
        existing.catalog_version = catalog_version
        existing.source = source
        existing.ip = ip or existing.ip
        existing.user_agent = user_agent or existing.user_agent
        existing.acknowledged_at = now
        db.add(existing)
        return existing

    ack = models.LegalAcknowledgement(
        appointment_id=appointment_id,
        document_type=document_type,
        signer_role=signer_role,
        case_key=case_key,
        case_text=case_def.text,
        catalog_version=catalog_version,
        acknowledged_at=now,
        ip=ip,
        user_agent=user_agent,
        source=source,
    )
    db.add(ack)
    return ack


def acknowledge_case(db: Session, payload: schemas.LegalAcknowledgeRequest, *, ip: str | None, user_agent: str | None) -> models.LegalAcknowledgement:
    _get_appointment(db, payload.appointment_id)
    document_type = DocumentType(payload.document_type)
    signer_role = SignerRole(payload.signer_role)
    ack = _acknowledge(
        db,
        appointment_id=payload.appointment_id,
        document_type=document_type,
        signer_role=signer_role,
        case_key=payload.case_key,
        catalog_version=payload.catalog_version,
        source=payload.source,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    db.refresh(ack)
    logger.info(
        "acknowledged case appointment=%s doc=%s role=%s case=%s source=%s",
        payload.appointment_id,
        document_type.value,
        signer_role.value,
        payload.case_key,
        payload.source,
    )
    return ack


def acknowledge_bulk(
    db: Session,
    payload: schemas.LegalAcknowledgeBulkInput,
    *,
    ip: str | None,
    user_agent: str | None,
) -> list[models.LegalAcknowledgement]:
    _get_appointment(db, payload.appointment_id)
    acknowledgements: list[models.LegalAcknowledgement] = []
    signer_role = SignerRole(payload.signer_role)
    for item in payload.acknowledgements:
        document_type = DocumentType(item.document_type)
        ack = _acknowledge(
            db,
            appointment_id=payload.appointment_id,
            document_type=document_type,
            signer_role=signer_role,
            case_key=item.case_key,
            catalog_version=item.catalog_version or payload.catalog_version,
            source=payload.source,
            ip=ip,
            user_agent=user_agent,
        )
        acknowledgements.append(ack)
    db.commit()
    for ack in acknowledgements:
        db.refresh(ack)
    logger.info(
        "bulk acknowledged appointment=%s role=%s count=%s",
        payload.appointment_id,
        signer_role.value,
        len(acknowledgements),
    )
    return acknowledgements


def build_catalog() -> schemas.LegalCatalog:
    documents = []
    for document in LEGAL_CATALOG.values():
        documents.append(
            schemas.LegalDocument(
                document_type=document.type,
                title=document.title,
                version=document.version,
                cases=[
                    schemas.LegalDocumentCase(
                        key=case.key,
                        text=case.text,
                        required=case.required,
                        required_roles=[role.value for role in case.required_roles],
                    )
                    for case in document.cases
                ],
            )
        )
    return schemas.LegalCatalog(version=CATALOG_VERSION, documents=documents)


def _has_parent2(appointment: models.Appointment) -> bool:
    case = appointment.procedure_case
    if not case:
        return False
    return bool(case.parent2_name or case.parent2_email or case.parent2_phone)


def compute_status(db: Session, appointment_id: int) -> schemas.LegalStatusResponse:
    appointment = _get_appointment(db, appointment_id)
    has_parent2 = _has_parent2(appointment)
    acknowledgements = (
        db.query(models.LegalAcknowledgement)
        .filter(models.LegalAcknowledgement.appointment_id == appointment_id)
        .all()
    )
    ack_map: dict[tuple[DocumentType, SignerRole], set[str]] = {}
    for ack in acknowledgements:
        key = (ack.document_type, ack.signer_role)
        if key not in ack_map:
            ack_map[key] = set()
        ack_map[key].add(ack.case_key)

    documents_status: list[schemas.LegalDocumentStatus] = []
    for document in LEGAL_CATALOG.values():
        required_roles = required_roles_for_document(document.type, has_parent2=has_parent2)
        acknowledged: dict[SignerRole, list[str]] = {}
        missing: dict[SignerRole, list[str]] = {}
        for role in required_roles:
            role_cases = ack_map.get((document.type, role), set())
            acknowledged[role] = sorted(role_cases)
            required_case_keys = [
                case.key
                for case in document.cases
                if case.required and role in case.required_roles
            ]
            missing[role] = [key for key in required_case_keys if key not in role_cases]

        complete = all(len(missing.get(role, [])) == 0 for role in required_roles)
        documents_status.append(
            schemas.LegalDocumentStatus(
                document_type=document.type,
                version=document.version,
                required_roles=list(required_roles),
                acknowledged=acknowledged,
                missing=missing,
                complete=complete,
            )
        )

    complete_overall = all(doc.complete for doc in documents_status)
    return schemas.LegalStatusResponse(
        appointment_id=appointment_id,
        documents=documents_status,
        complete=complete_overall,
    )


def checklist_complete(db: Session, appointment_id: int, *, required_roles: Iterable[SignerRole] | None = None) -> bool:
    status = compute_status(db, appointment_id)
    if not required_roles:
        return status.complete
    role_values = {role.value for role in required_roles}
    for doc in status.documents:
        for role, missing_cases in doc.missing.items():
            if role.value in role_values and missing_cases:
                return False
    return True


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_cabinet_session(
    db: Session,
    *,
    appointment_id: int,
    signer_role: SignerRole,
    practitioner_id: int | None,
    ttl_minutes: int = CABINET_SESSION_TTL_MINUTES,
) -> tuple[models.SignatureCabinetSession, str]:
    appointment = _get_appointment(db, appointment_id)
    now = dt.datetime.utcnow()
    expires_at = now + dt.timedelta(minutes=ttl_minutes)
    token = secrets.token_urlsafe(16)
    token_hash = _hash_token(token)

    # Expire existing active sessions for same appointment/role
    existing_sessions = (
        db.query(models.SignatureCabinetSession)
        .filter(
            models.SignatureCabinetSession.appointment_id == appointment.id,
            models.SignatureCabinetSession.signer_role == signer_role,
            models.SignatureCabinetSession.status == models.SignatureCabinetSessionStatus.active,
        )
        .all()
    )
    for session in existing_sessions:
        session.status = models.SignatureCabinetSessionStatus.expired
        session.consumed_at = session.consumed_at or now
        db.add(session)

    session = models.SignatureCabinetSession(
        appointment_id=appointment.id,
        signer_role=signer_role,
        token_hash=token_hash,
        expires_at=expires_at,
        created_by_practitioner_id=practitioner_id,
        status=models.SignatureCabinetSessionStatus.active,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    logger.info(
        "session_created appointment=%s role=%s expires_at=%s practitioner=%s",
        appointment.id,
        signer_role.value,
        expires_at.isoformat(),
        practitioner_id,
    )
    return session, token


def get_active_session(db: Session, token: str) -> models.SignatureCabinetSession | None:
    token_hash = _hash_token(token)
    session = (
        db.query(models.SignatureCabinetSession)
        .options(
            joinedload(models.SignatureCabinetSession.appointment).joinedload(models.Appointment.procedure_case)
        )
        .filter(models.SignatureCabinetSession.token_hash == token_hash)
        .first()
    )
    if not session:
        return None

    now = dt.datetime.utcnow()
    if session.expires_at and session.expires_at < now:
        if session.status != models.SignatureCabinetSessionStatus.expired:
            session.status = models.SignatureCabinetSessionStatus.expired
            db.add(session)
            db.commit()
        return None
    if session.status != models.SignatureCabinetSessionStatus.active:
        return None
    return session


def consume_session(db: Session, session: models.SignatureCabinetSession) -> models.SignatureCabinetSession:
    now = dt.datetime.utcnow()
    session.status = models.SignatureCabinetSessionStatus.consumed
    session.consumed_at = now
    db.add(session)
    db.commit()
    db.refresh(session)
    logger.info(
        "session_consumed appointment=%s role=%s session_id=%s",
        session.appointment_id,
        session.signer_role.value,
        session.id,
    )
    return session
