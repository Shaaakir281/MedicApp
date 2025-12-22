"""Granular document signature endpoints (1 SR Yousign = 1 document type).

Architecture:
- POST /start-document : Démarrer signature pour UN document
- GET /document/{id} : Statut d'une signature de document
- GET /case/{case_id}/documents : Liste signatures pour un case
- POST /webhook/yousign : Webhook Yousign granulaire
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies.auth import get_current_user, get_optional_user
from services import consent_pdf, document_signature_service, legal_documents_pdf
from services import legal as legal_service
from services.storage import StorageError, get_storage_backend

router = APIRouter(prefix="/signature", tags=["document_signature"])


@router.post("/start-document", response_model=schemas.DocumentSignatureStartResponse)
def start_document_signature(
    payload: schemas.DocumentSignatureStartRequest,
    request: Request,
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> schemas.DocumentSignatureStartResponse:
    """
    Démarre la signature pour UN document spécifique.

    Architecture granulaire: Chaque document a sa propre Signature Request Yousign.

    RGPD:
    - PDF neutre sans données médicales
    - Notifications neutres sans nom d'enfant
    - Purge automatique après récupération
    """
    import logging
    logger = logging.getLogger("uvicorn.error")
    logger.info(f"start_document_signature called with payload: {payload.model_dump()}")

    # Gestion session cabinet (bypass auth)
    session = None
    procedure_case_id = payload.procedure_case_id
    document_type = payload.document_type
    signer_role = payload.signer_role
    mode = payload.mode

    if payload.session_code:
        session = legal_service.get_active_session(db, payload.session_code)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session expirée ou invalide."
            )
        # Override avec session
        appointment = db.query(models.Appointment).filter(
            models.Appointment.id == session.appointment_id
        ).first()
        if not appointment or not appointment.procedure_case_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment ou case introuvable."
            )
        procedure_case_id = appointment.procedure_case_id
        signer_role = session.signer_role
        mode = "cabinet"

    # Authentification requise si pas de session
    if current_user is None and session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise."
        )

    # Vérifier ownership
    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == procedure_case_id
    ).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ProcedureCase introuvable."
        )

    if current_user and current_user.role == models.UserRole.patient and case.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé."
        )

    # TODO: Optionnel - Vérifier checklist legal avant signature
    # from core.config import get_settings
    # if get_settings().feature_enforce_legal_checklist:
    #     legal_status = legal_service.compute_status(db, appointment_id)
    #     if not legal_status.complete:
    #         raise HTTPException(400, "Checklist incomplète")

    # Créer la signature du document
    in_person = mode == "cabinet"
    doc_sig = document_signature_service.initiate_document_signature(
        db,
        procedure_case_id=procedure_case_id,
        document_type=document_type,
        in_person=in_person,
    )

    # Consommer session si cabinet
    if session:
        legal_service.consume_session(db, session)

    # Récupérer le lien de signature pour ce signer_role
    link_attr = f"{signer_role.value}_signature_link" if hasattr(signer_role, "value") else f"{signer_role}_signature_link"
    signature_link = getattr(doc_sig, link_attr, None)

    if not signature_link:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lien de signature indisponible pour le signataire."
        )

    return schemas.DocumentSignatureStartResponse(
        document_signature_id=doc_sig.id,
        document_type=doc_sig.document_type,
        signer_role=signer_role,
        signature_link=signature_link,
        yousign_procedure_id=doc_sig.yousign_procedure_id,
        status="sent",
    )


@router.get("/document/{document_signature_id}", response_model=schemas.DocumentSignatureDetail)
def get_document_signature_status(
    document_signature_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.DocumentSignatureDetail:
    """
    Récupère le statut d'une signature de document.
    """
    doc_sig = document_signature_service.get_document_signature(db, document_signature_id)

    # Vérifier ownership
    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == doc_sig.procedure_case_id
    ).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case introuvable.")

    if current_user.role == models.UserRole.patient and case.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")

    return schemas.DocumentSignatureDetail.model_validate(doc_sig)


@router.get("/case/{procedure_case_id}/documents", response_model=schemas.CaseDocumentSignaturesSummary)
def get_case_document_signatures(
    procedure_case_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.CaseDocumentSignaturesSummary:
    """
    Liste toutes les signatures de documents pour un ProcedureCase.
    """
    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == procedure_case_id
    ).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case introuvable.")

    if current_user.role == models.UserRole.patient and case.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")

    signatures = document_signature_service.get_signatures_for_case(db, procedure_case_id)

    return schemas.CaseDocumentSignaturesSummary(
        procedure_case_id=procedure_case_id,
        document_signatures=[
            schemas.DocumentSignatureDetail.model_validate(sig) for sig in signatures
        ],
    )


@router.get("/case/{procedure_case_id}/document/{document_type}/preview")
def preview_legal_document(
    procedure_case_id: int,
    document_type: str,
    inline: bool = Query(default=True),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Preview the base legal document PDF (authorization/consent/fees).

    Access is restricted to the owning patient (or practitioners).
    """
    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == procedure_case_id
    ).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case introuvable.")

    if current_user.role == models.UserRole.patient and case.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse.")

    doc_type = legal_documents_pdf.normalize_document_type(document_type)
    identifier = legal_documents_pdf.ensure_legal_document_pdf(case, doc_type)

    storage = get_storage_backend()
    download_name = f"case-{case.id}-{doc_type.value}.pdf"

    if storage.supports_presigned_urls:
        try:
            url = storage.generate_presigned_url(
                legal_documents_pdf.LEGAL_DOCUMENT_CATEGORY,
                identifier,
                download_name=download_name,
                expires_in_seconds=600,
                inline=inline,
            )
            return RedirectResponse(url, status_code=307)
        except StorageError:
            pass

    try:
        return storage.build_file_response(
            legal_documents_pdf.LEGAL_DOCUMENT_CATEGORY,
            identifier,
            download_name,
            inline=inline,
        )
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable.") from exc


@router.get("/document/{document_signature_id}/file/{file_kind}")
def download_document_signature_file(
    document_signature_id: int,
    file_kind: str,
    inline: bool = Query(default=False),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download a document signature artifact (final, signed, evidence).

    Access is restricted to the owning patient (or practitioners).
    """
    if file_kind not in {"final", "signed", "evidence"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Type de fichier invalide.")

    doc_sig = document_signature_service.get_document_signature(db, document_signature_id)
    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == doc_sig.procedure_case_id
    ).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case introuvable.")

    if current_user.role == models.UserRole.patient and case.patient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse.")

    if file_kind == "final":
        identifier = doc_sig.final_pdf_identifier
        category = consent_pdf.FINAL_CONSENT_CATEGORY
    elif file_kind == "signed":
        identifier = doc_sig.signed_pdf_identifier
        category = consent_pdf.SIGNED_CONSENT_CATEGORY
    else:
        identifier = doc_sig.evidence_pdf_identifier
        category = consent_pdf.EVIDENCE_CATEGORY

    if not identifier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier indisponible.")

    storage = get_storage_backend()
    download_name = f"case-{case.id}-{doc_sig.document_type}-{file_kind}.pdf"
    try:
        return storage.build_file_response(category, identifier, download_name, inline=inline)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable.") from exc


@router.post("/webhook/yousign-document")
def handle_yousign_document_webhook(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Webhook Yousign granulaire pour DocumentSignature.

    Flow:
    1. Extrait yousign_procedure_id du payload
    2. Recherche DocumentSignature correspondant
    3. Appelle document_signature_service.update_status()
    4. Déclenche téléchargement artefacts + assemblage + purge si complet
    """
    import logging
    logger = logging.getLogger("uvicorn.error")

    logger.info("Yousign document webhook received: %s", payload)

    # Extraire procedure_id
    procedure_id = payload.get("signature_request", {}).get("id")
    if not procedure_id:
        logger.warning("Missing signature_request.id in webhook payload")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing signature_request.id")

    # Recherche granulaire
    doc_sig = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.yousign_procedure_id == procedure_id
    ).first()

    if not doc_sig:
        logger.warning("Unknown yousign_procedure_id: %s (granular)", procedure_id)
        return {"status": "ignored", "reason": "unknown_procedure_id"}

    # Identifier l'événement
    event_type = payload.get("event_name") or payload.get("event")

    if event_type == "signer.signed":
        signer_payload = payload.get("signer", {})
        signer_id = signer_payload.get("id")

        if not signer_id:
            logger.warning("Missing signer.id in signer.signed event")
            return {"status": "ignored", "reason": "missing_signer_id"}

        # Identifier le parent
        parent_label = None
        if signer_id == doc_sig.parent1_yousign_signer_id:
            parent_label = "parent1"
        elif signer_id == doc_sig.parent2_yousign_signer_id:
            parent_label = "parent2"
        else:
            logger.warning("Unknown signer_id: %s for DocumentSignature %d", signer_id, doc_sig.id)
            return {"status": "ignored", "reason": "unknown_signer"}

        # Extraire URLs artefacts (si disponibles)
        signed_file_url = payload.get("signature_request", {}).get("signed_file_url")
        evidence_url = payload.get("signature_request", {}).get("evidence_url")

        # Mise à jour
        document_signature_service.update_document_signature_status(
            db,
            doc_sig.id,
            parent_label=parent_label,
            status_value="signed",
            signed_at=None,  # Utilise timestamp actuel
            method="yousign",
            signed_file_url=signed_file_url,
            evidence_url=evidence_url,
        )

        logger.info(
            "DocumentSignature %d (%s) updated: %s signed",
            doc_sig.id,
            doc_sig.document_type,
            parent_label
        )

        return {"status": "processed", "document_signature_id": doc_sig.id}

    logger.info("Unhandled event type: %s", event_type)
    return {"status": "ignored", "reason": "unhandled_event_type"}
