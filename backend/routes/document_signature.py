"""Granular document signature endpoints (1 SR Yousign = 1 document type).

Architecture:
- POST /start-document : Démarrer signature pour UN document
- GET /document/{id} : Statut d'une signature de document
- GET /case/{case_id}/documents : Liste signatures pour un case
- POST /webhook/yousign : Webhook Yousign granulaire
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies.auth import get_current_user, get_optional_user, require_practitioner
from services import consent_pdf, document_signature_service, legal_documents_pdf
from services import legal as legal_service
from services.storage import StorageError, get_storage_backend

router = APIRouter(prefix="/signature", tags=["document_signature"])


@router.get("/mock/{procedure_id}/{signer_id}", response_class=HTMLResponse)
def mock_signature_link(procedure_id: str, signer_id: str) -> HTMLResponse:
    """Fallback page for mock signature links when Yousign is not configured."""
    html = (
        "<html><body>"
        "<h2>Signature mock</h2>"
        "<p>Yousign n'est pas configure. Ce lien est un placeholder.</p>"
        "<p>Procedure: "
        f"{procedure_id}"
        "</p>"
        "<p>Signer: "
        f"{signer_id}"
        "</p>"
        "</body></html>"
    )
    return HTMLResponse(content=html)


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
    appointment_id = payload.appointment_id
    document_type = (payload.document_type or "").strip()
    signer_role = payload.signer_role
    mode = payload.mode

    if not document_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type de document manquant."
        )

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
        if not appointment or not appointment.procedure_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment ou case introuvable."
            )
        procedure_case_id = appointment.procedure_id
        signer_role = session.signer_role
        mode = "cabinet"

    # Authentification requise si pas de session
    if current_user is None and session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise."
        )

    if session is None and procedure_case_id is None and appointment_id is not None:
        appointment = db.query(models.Appointment).filter(
            models.Appointment.id == appointment_id
        ).first()
        if not appointment or not appointment.procedure_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment ou case introuvable."
            )
        if current_user and current_user.role == models.UserRole.patient and appointment.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès refusé."
            )
        procedure_case_id = appointment.procedure_id

    if (
        session is None
        and mode == "cabinet"
        and current_user
        and current_user.role == models.UserRole.patient
    ):
        if appointment_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Appointment requis pour la signature en cabinet."
            )
        active_session = legal_service.get_active_session_for_appointment(
            db,
            appointment_id=appointment_id,
            signer_role=signer_role,
        )
        if not active_session:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Signature en cabinet non activée par le praticien."
            )

    if procedure_case_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="procedure_case_id ou appointment_id requis."
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

    status_attr = (
        f"{signer_role.value}_status"
        if hasattr(signer_role, "value")
        else f"{signer_role}_status"
    )
    try:
        if doc_sig.yousign_procedure_id and getattr(doc_sig, status_attr, None) != "signed":
            doc_sig = document_signature_service.poll_and_fetch_document_signature(db, doc_sig)
    except Exception:
        # Avoid blocking signature creation if polling fails.
        pass
    if getattr(doc_sig, status_attr, None) == "signed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce parent a déjà signé ce document."
        )

    # Récupérer le lien de signature pour ce signer_role
    link_attr = f"{signer_role.value}_signature_link" if hasattr(signer_role, "value") else f"{signer_role}_signature_link"
    signature_link = getattr(doc_sig, link_attr, None)

    if not signature_link and in_person:
        doc_sig = document_signature_service.ensure_missing_signer_link(
            db,
            doc_sig,
            signer_role.value if hasattr(signer_role, "value") else signer_role,
            in_person=True,
        )
        signature_link = getattr(doc_sig, link_attr, None)

    if not signature_link and in_person:
        doc_sig = document_signature_service.recreate_signature_request_for_role(
            db,
            doc_sig,
            signer_role.value if hasattr(signer_role, "value") else signer_role,
            in_person=True,
        )
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

    signatures = document_signature_service.ensure_signatures_for_case(db, procedure_case_id)

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
    base_category = legal_documents_pdf.base_category_for(doc_type)

    storage = get_storage_backend()
    download_name = f"case-{case.id}-{doc_type.value}.pdf"

    try:
        return storage.build_file_response(
            base_category,
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

    doc_type = legal_documents_pdf.normalize_document_type(doc_sig.document_type)
    if file_kind == "final":
        doc_sig = document_signature_service.ensure_final_document(db, doc_sig)
        identifier = doc_sig.final_pdf_identifier
        primary_category = legal_documents_pdf.final_category_for(doc_type)
        fallback_categories = [consent_pdf.FINAL_CONSENT_CATEGORY]
    elif file_kind == "signed":
        identifier = doc_sig.signed_pdf_identifier
        primary_category = legal_documents_pdf.signed_category_for(doc_type)
        fallback_categories = [consent_pdf.SIGNED_CONSENT_CATEGORY]
    else:
        identifier = doc_sig.evidence_pdf_identifier
        primary_category = legal_documents_pdf.evidence_category_for(doc_type)
        fallback_categories = [consent_pdf.EVIDENCE_CATEGORY]

    storage = get_storage_backend()
    download_name = f"case-{case.id}-{doc_sig.document_type}-{file_kind}.pdf"

    def _build_response(doc_identifier: str | None):
        if not doc_identifier:
            return None
        for category in [primary_category, *fallback_categories]:
            if storage.exists(category, doc_identifier):
                return storage.build_file_response(category, doc_identifier, download_name, inline=inline)
        return None

    response = _build_response(identifier)
    if response:
        return response

    doc_sig = document_signature_service.poll_and_fetch_document_signature(db, doc_sig)
    if file_kind == "final":
        identifier = doc_sig.final_pdf_identifier
    elif file_kind == "signed":
        identifier = doc_sig.signed_pdf_identifier
    else:
        identifier = doc_sig.evidence_pdf_identifier
    response = _build_response(identifier)
    if response:
        return response
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable.")


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

    data = payload.get("data", {}) if isinstance(payload, dict) else {}
    signature_request = data.get("signature_request") or payload.get("signature_request") or {}
    signer_payload = data.get("signer") or payload.get("signer") or {}

    # Extraire procedure_id
    procedure_id = (
        signature_request.get("id")
        or payload.get("procedure_id")
        or payload.get("procedureId")
    )
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
    event_type = (
        payload.get("event_name")
        or payload.get("event")
        or data.get("event_name")
        or ""
    )
    event_type = str(event_type).lower()

    if "signature_request" in event_type and any(token in event_type for token in ("done", "completed")):
        doc_sig = document_signature_service.poll_and_fetch_document_signature(db, doc_sig)
        document_signature_service.ensure_final_document(db, doc_sig)
        return {"status": "processed", "document_signature_id": doc_sig.id}

    if "signer" in event_type and any(token in event_type for token in ("signed", "done", "completed")):
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
        signed_file_url = signature_request.get("signed_file_url")
        evidence_url = signature_request.get("evidence_url")

        # Mise à jour
        doc_sig = document_signature_service.update_document_signature_status(
            db,
            doc_sig.id,
            parent_label=parent_label,
            status_value="signed",
            signed_at=None,  # Utilise timestamp actuel
            method="yousign",
            signed_file_url=signed_file_url,
            evidence_url=evidence_url,
        )
        if doc_sig.parent1_status == "signed" and doc_sig.parent2_status == "signed":
            document_signature_service.ensure_final_document(db, doc_sig)

        logger.info(
            "DocumentSignature %d (%s) updated: %s signed",
            doc_sig.id,
            doc_sig.document_type,
            parent_label
        )

        return {"status": "processed", "document_signature_id": doc_sig.id}

    logger.info("Unhandled event type: %s", event_type)
    return {"status": "ignored", "reason": "unhandled_event_type"}


@router.post("/practitioner/send-document", response_model=schemas.DocumentSignatureDetail)
def practitioner_send_document_signature(
    case_id: int,
    document_type: str,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db),
) -> schemas.DocumentSignatureDetail:
    """
    Permet au praticien d'envoyer ou renvoyer une demande de signature pour un document.

    Le praticien peut utiliser cet endpoint pour:
    - Initier une nouvelle signature si aucune n'existe
    - Renvoyer la demande si elle existe déjà mais n'est pas complétée
    """
    import logging
    logger = logging.getLogger("uvicorn.error")

    # Vérifier que le case existe
    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == case_id
    ).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ProcedureCase introuvable."
        )

    # Vérifier si une signature existe déjà pour ce document
    existing_sig = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.procedure_case_id == case_id,
        models.DocumentSignature.document_type == document_type
    ).first()

    if existing_sig:
        # Si déjà complété, on renvoie juste le status
        if existing_sig.overall_status == "completed":
            logger.info(f"Document {document_type} pour case {case_id} déjà complété")
            return schemas.DocumentSignatureDetail.model_validate(existing_sig)

        # Sinon, on peut régénérer/renvoyer (selon business logic)
        # Pour l'instant, on retourne l'existant
        logger.info(f"Document {document_type} pour case {case_id} existe avec status {existing_sig.overall_status}")
        return schemas.DocumentSignatureDetail.model_validate(existing_sig)

    # Créer une nouvelle signature
    doc_sig = document_signature_service.initiate_document_signature(
        db,
        procedure_case_id=case_id,
        document_type=document_type,
        in_person=False,  # Remote par défaut pour praticien
    )

    logger.info(f"Praticien a créé une nouvelle signature pour case {case_id}, document {document_type}")

    return schemas.DocumentSignatureDetail.model_validate(doc_sig)
