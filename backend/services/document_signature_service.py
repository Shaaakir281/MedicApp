"""Document signature service - Granular Yousign signature management.

Architecture granulaire: 1 DocumentSignature = 1 type de document médical.

RGPD/HDS:
- Chaque document a sa propre Signature Request Yousign
- PDF neutre sans données médicales
- Purge Yousign après récupération locale
- Stockage exclusif en environnement HDS
"""

from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import models
from core.config import get_settings
from services import consent_pdf
from services import email as email_service
from services.sms import send_sms
from services.yousign import YousignClient, YousignConfigurationError, start_neutral_signature_request
from services.yousign.models import YousignSigner

logger = logging.getLogger("uvicorn.error")


def get_document_signature(
    db: Session,
    document_signature_id: int,
) -> models.DocumentSignature:
    """Récupère une signature de document par ID."""
    doc_sig = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.id == document_signature_id
    ).first()
    if not doc_sig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signature de document introuvable."
        )
    return doc_sig


def get_signatures_for_case(
    db: Session,
    procedure_case_id: int,
) -> list[models.DocumentSignature]:
    """Retourne toutes les signatures de documents pour un case."""
    return db.query(models.DocumentSignature).filter(
        models.DocumentSignature.procedure_case_id == procedure_case_id
    ).order_by(models.DocumentSignature.created_at).all()


def get_or_create_document_signature(
    db: Session,
    procedure_case_id: int,
    document_type: str,
) -> models.DocumentSignature:
    """
    Récupère ou crée un DocumentSignature pour un document spécifique.
    """
    existing = db.query(models.DocumentSignature).filter(
        models.DocumentSignature.procedure_case_id == procedure_case_id,
        models.DocumentSignature.document_type == document_type,
    ).first()

    if existing:
        return existing

    # Créer nouveau DocumentSignature
    doc_sig = models.DocumentSignature(
        procedure_case_id=procedure_case_id,
        document_type=document_type,
        overall_status=models.DocumentSignatureStatus.draft,
        parent1_status="pending",
        parent2_status="pending",
    )
    db.add(doc_sig)
    db.commit()
    db.refresh(doc_sig)
    return doc_sig


def _build_signers_payload(
    case: models.ProcedureCase,
    auth_mode: str = "otp_sms"
) -> list[dict]:
    """
    Build signers payload pour Yousign.

    RGPD: Pseudonymisation des noms de parents.
    """
    def _ensure_email(email: str | None, phone: str | None, label: str) -> str | None:
        if email:
            return email
        if phone:
            safe = phone.replace("+", "").replace(" ", "").replace("-", "")
            return f"{safe}@{label}.consent.test"
        return None

    signers = []
    if case.parent1_name and (case.parent1_email or case.parent1_phone):
        email = _ensure_email(case.parent1_email, case.parent1_phone, "parent1")
        signers.append({
            "label": "parent1",
            "email": email,
            "phone": case.parent1_phone,
            "auth_mode": auth_mode,
            # RGPD: Pseudonymisation
            "first_name": "Parent",
            "last_name": "1",
        })
    if case.parent2_name and (case.parent2_email or case.parent2_phone):
        email = _ensure_email(case.parent2_email, case.parent2_phone, "parent2")
        signers.append({
            "label": "parent2",
            "email": email,
            "phone": case.parent2_phone,
            "auth_mode": auth_mode,
            # RGPD: Pseudonymisation
            "first_name": "Parent",
            "last_name": "2",
        })
    return signers


def _validate_contacts(case: models.ProcedureCase) -> None:
    """Valide que les coordonnées nécessaires sont présentes."""
    missing = []
    if not case.parent1_phone:
        missing.append("parent1_phone")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coordonnées SMS manquantes : {', '.join(missing)}"
        )


def initiate_document_signature(
    db: Session,
    *,
    procedure_case_id: int,
    document_type: str,
    in_person: bool = False,
) -> models.DocumentSignature:
    """
    Crée une Signature Request Yousign pour UN document spécifique.

    Workflow:
    1. Récupère le ProcedureCase
    2. Charge le PDF médical du document_type (authorization/consent/fees)
    3. Génère PDF neutre SPÉCIFIQUE à ce document
    4. Appelle Yousign API pour créer SR
    5. Crée/met à jour DocumentSignature en DB
    6. Envoie notifications (email/SMS)
    7. Retourne DocumentSignature
    """
    # 1. Récupérer le ProcedureCase
    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == procedure_case_id
    ).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ProcedureCase introuvable."
        )

    _validate_contacts(case)

    # 2. Récupérer ou créer DocumentSignature
    doc_sig = get_or_create_document_signature(db, procedure_case_id, document_type)

    # Si déjà une SR Yousign active, retourner l'existante
    if doc_sig.yousign_procedure_id and doc_sig.overall_status != models.DocumentSignatureStatus.draft:
        logger.info(
            "DocumentSignature %d déjà initialisé (SR=%s)",
            doc_sig.id,
            doc_sig.yousign_procedure_id
        )
        return doc_sig

    # 3. Mode d'authentification Yousign
    auth_mode = "no_otp" if in_person else "otp_sms"
    signers = _build_signers_payload(case, auth_mode=auth_mode)

    if not signers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun parent renseigné."
        )

    # 4. Générer PDF neutre spécifique à ce document
    try:
        client = YousignClient()

        # Hash du PDF médical complet (si disponible)
        consent_hash = None
        if case.consent_pdf_path:
            from services import pdf as pdf_service
            pdf_bytes = consent_pdf.load_pdf_bytes(pdf_service.CONSENT_CATEGORY, case.consent_pdf_path)
            if pdf_bytes:
                consent_hash = consent_pdf.compute_pdf_sha256(pdf_bytes)

        # TODO: Déterminer document_version depuis catalog
        document_version = "v1.0"

        # Générer PDF neutre SPÉCIFIQUE au document_type
        neutral_pdf_path = consent_pdf.render_neutral_document_pdf(
            document_type=document_type,
            consent_id=str(case.id),
            document_version=document_version,
            consent_hash=consent_hash,
        )

        # Label de la procédure Yousign
        doc_labels = {
            "authorization": "Autorisation d'intervention",
            "consent": "Consentement éclairé",
            "fees": "Honoraires et modalités financières",
        }
        procedure_label = f"MedScript - {doc_labels.get(document_type, document_type)}"

        # Créer Signature Request Yousign
        procedure = start_neutral_signature_request(
            client=client,
            neutral_pdf_path=str(neutral_pdf_path),
            signers=signers,
            procedure_label=procedure_label,
            delivery_mode="none" if in_person else "email",
        )

    except YousignConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc)
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        ) from exc

    logger.info(
        "initiate_document_signature -> case=%d doc_type=%s procedure=%s signers=%d",
        case.id,
        document_type,
        procedure.procedure_id,
        len(procedure.signers)
    )

    # 5. Fallback : récupération immédiate des liens si manquants
    if not client.mock_mode and any(not s.signature_link for s in procedure.signers):
        def _sig_link(data: dict) -> str:
            links = data.get("signature_links") or {}
            return (
                data.get("signature_url")
                or data.get("signature_link")
                or data.get("url")
                or links.get("iframe")
                or links.get("short")
                or links.get("long")
                or ""
            )

        refreshed: list[YousignSigner] = []
        try:
            signers_data = client.fetch_signers(procedure.procedure_id)
            mapping = {str(s.get("id")): _sig_link(s) for s in signers_data if isinstance(s, dict)}
        except Exception:
            mapping = {}

        for signer in procedure.signers:
            link = signer.signature_link or mapping.get(str(signer.signer_id)) or ""
            if not link:
                try:
                    payload = client.fetch_signer(str(signer.signer_id))
                    link = _sig_link(payload)
                except Exception:
                    pass
            refreshed.append(
                YousignSigner(
                    signer_id=signer.signer_id,
                    signature_link=link,
                    email=signer.email,
                    phone=signer.phone,
                )
            )
        procedure.signers = refreshed

    # 6. Persister dans DocumentSignature
    doc_sig.yousign_procedure_id = procedure.procedure_id
    doc_sig.document_version = document_version
    now = dt.datetime.utcnow()

    for idx, signer in enumerate(procedure.signers):
        label = signers[idx].get("label") if idx < len(signers) else None
        if label == "parent1":
            doc_sig.parent1_yousign_signer_id = signer.signer_id
            doc_sig.parent1_status = "sent"
            doc_sig.parent1_sent_at = now
            doc_sig.parent1_signature_link = signer.signature_link
        elif label == "parent2":
            doc_sig.parent2_yousign_signer_id = signer.signer_id
            doc_sig.parent2_status = "sent"
            doc_sig.parent2_sent_at = now
            doc_sig.parent2_signature_link = signer.signature_link

    doc_sig.overall_status = models.DocumentSignatureStatus.sent

    db.add(doc_sig)
    db.commit()
    db.refresh(doc_sig)

    # 7. Envoyer notifications
    _send_document_notifications(case, doc_sig, document_type)

    return doc_sig


def _send_document_notifications(
    case: models.ProcedureCase,
    doc_sig: models.DocumentSignature,
    document_type: str,
) -> None:
    """
    Envoie notifications email/SMS pour un document spécifique.

    RGPD: Messages neutres sans nom de l'enfant.
    """
    app_name = get_settings().app_name

    doc_labels = {
        "authorization": "Autorisation d'intervention",
        "consent": "Consentement éclairé",
        "fees": "Honoraires",
    }
    doc_label = doc_labels.get(document_type, document_type)

    def _build_body(link: str) -> str:
        # RGPD: Message neutre sans PHI
        return (
            f"Vous avez un document médical à signer : {doc_label}.\n"
            f"Référence : {case.id}-{document_type}\n"
            f"Lien de signature sécurisé : {link}\n"
            f"{app_name}"
        )

    # SMS
    if doc_sig.parent1_signature_link and case.parent1_sms_optin and case.parent1_phone:
        send_sms(case.parent1_phone, _build_body(doc_sig.parent1_signature_link))
    if doc_sig.parent2_signature_link and case.parent2_sms_optin and case.parent2_phone:
        send_sms(case.parent2_phone, _build_body(doc_sig.parent2_signature_link))

    # Email
    if case.parent1_email and doc_sig.parent1_signature_link:
        email_service.send_consent_download_email(
            case.parent1_email,
            f"Document médical - {doc_label}",
            doc_sig.parent1_signature_link
        )
    if case.parent2_email and doc_sig.parent2_signature_link:
        email_service.send_consent_download_email(
            case.parent2_email,
            f"Document médical - {doc_label}",
            doc_sig.parent2_signature_link
        )


def _download_and_store_artifacts(
    doc_sig: models.DocumentSignature,
    signed_url: Optional[str] = None,
    evidence_url: Optional[str] = None,
    signer_id: Optional[str] = None,
) -> tuple[Optional[str], Optional[str]]:
    """
    Télécharge les artefacts Yousign et les stocke en HDS.

    Returns:
        (signed_pdf_identifier, evidence_pdf_identifier)
    """
    client = YousignClient()
    if client.mock_mode or not doc_sig.yousign_procedure_id:
        return None, None

    signed_identifier = None
    evidence_identifier = None

    # Télécharger PDF signé (neutre)
    try:
        if signed_url:
            signed_bytes = client.download_with_auth(signed_url)
        else:
            signed_bytes = client.download_signed_documents(doc_sig.yousign_procedure_id)
        if signed_bytes:
            prefix = f"{doc_sig.procedure_case_id}-{doc_sig.document_type}"
            signed_identifier = consent_pdf.store_signed_pdf(signed_bytes, prefix=prefix)
            # Pruning : garder 2 versions max
            consent_pdf.prune_case_files(
                consent_pdf.SIGNED_CONSENT_CATEGORY,
                doc_sig.procedure_case_id,
                keep_latest=2
            )
    except Exception:
        logger.exception(
            "Failed to download signed PDF for DocumentSignature %d",
            doc_sig.id
        )

    # Télécharger audit trail
    try:
        if evidence_url:
            evidence_bytes = client.download_with_auth(evidence_url)
        else:
            evidence_bytes = client.download_evidence(
                doc_sig.yousign_procedure_id,
                signer_id=signer_id
            )
        if evidence_bytes:
            prefix = f"{doc_sig.procedure_case_id}-{doc_sig.document_type}"
            evidence_identifier = consent_pdf.store_evidence_pdf(evidence_bytes, prefix=prefix)
            consent_pdf.prune_case_files(
                consent_pdf.EVIDENCE_CATEGORY,
                doc_sig.procedure_case_id,
                keep_latest=2
            )
    except Exception:
        logger.exception(
            "Failed to download evidence PDF for DocumentSignature %d",
            doc_sig.id
        )

    return signed_identifier, evidence_identifier


def _assemble_final_document(
    db: Session,
    doc_sig: models.DocumentSignature,
) -> Optional[str]:
    """
    Assemble le package final : PDF médical + audit + PDF neutre signé.

    Stockage en HDS uniquement.
    """
    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == doc_sig.procedure_case_id
    ).first()

    if not case or not case.consent_pdf_path:
        return None

    # TODO: Adapter pour charger PDF spécifique au document_type
    # Pour l'instant, on utilise le consent_pdf_path global
    full_consent_id = case.consent_pdf_path

    signed_ids = []
    evidence_ids = []

    if doc_sig.signed_pdf_identifier:
        signed_ids.append(doc_sig.signed_pdf_identifier)
    if doc_sig.evidence_pdf_identifier:
        evidence_ids.append(doc_sig.evidence_pdf_identifier)

    if not signed_ids and not evidence_ids:
        return None

    try:
        logger.info(
            "Assemblage document final case=%d doc_type=%s signed=%s evidences=%s",
            doc_sig.procedure_case_id,
            doc_sig.document_type,
            signed_ids,
            evidence_ids
        )
        return consent_pdf.compose_final_document_consent(
            full_consent_id=full_consent_id,
            document_type=doc_sig.document_type,
            case_id=doc_sig.procedure_case_id,
            signed_ids=signed_ids,
            evidence_ids=evidence_ids,
        )
    except Exception:
        logger.exception(
            "Échec assemblage document final DocumentSignature %d",
            doc_sig.id
        )
        return None


def update_document_signature_status(
    db: Session,
    document_signature_id: int,
    *,
    parent_label: str,
    status_value: str,
    signed_at: Optional[dt.datetime] = None,
    method: Optional[str] = None,
    signed_file_url: Optional[str] = None,
    evidence_url: Optional[str] = None,
) -> models.DocumentSignature:
    """
    Met à jour le statut de signature (appelé par webhook Yousign).

    Workflow:
    1. Met à jour parent1/2_status
    2. Si les 2 parents signés:
        a. Télécharge artefacts depuis Yousign
        b. Stocke en HDS (signed_pdf, evidence_pdf)
        c. Recompose PDF final (médical + preuves)
        d. Purge Yousign (permanent_delete)
        e. Marque overall_status = "completed"
    """
    doc_sig = get_document_signature(db, document_signature_id)

    signed_at = signed_at or dt.datetime.utcnow()

    # Mise à jour statut parent
    if parent_label == "parent1":
        doc_sig.parent1_status = status_value
        doc_sig.parent1_signed_at = signed_at
        doc_sig.parent1_method = method or "yousign"
    elif parent_label == "parent2":
        doc_sig.parent2_status = status_value
        doc_sig.parent2_signed_at = signed_at
        doc_sig.parent2_method = method or "yousign"

    # Télécharger artefacts si signature complète
    if status_value == "signed":
        signer_id = (
            doc_sig.parent1_yousign_signer_id
            if parent_label == "parent1"
            else doc_sig.parent2_yousign_signer_id
        )
        stored_signed, stored_evidence = _download_and_store_artifacts(
            doc_sig,
            signed_url=signed_file_url,
            evidence_url=evidence_url,
            signer_id=signer_id,
        )
        if stored_signed:
            doc_sig.signed_pdf_identifier = stored_signed
        if stored_evidence:
            doc_sig.evidence_pdf_identifier = stored_evidence

        # Assemblage partiel
        assembled = _assemble_final_document(db, doc_sig)
        if assembled:
            doc_sig.final_pdf_identifier = assembled

    # Vérifier si les 2 parents ont signé
    both_signed = (
        doc_sig.parent1_status == "signed" and
        doc_sig.parent2_status == "signed"
    )

    if both_signed:
        # Téléchargement final complet
        stored_signed, stored_evidence = _download_and_store_artifacts(
            doc_sig,
            signed_url=None,
            evidence_url=None,
            signer_id=None,
        )
        if stored_signed:
            doc_sig.signed_pdf_identifier = stored_signed
        if stored_evidence:
            doc_sig.evidence_pdf_identifier = stored_evidence

        # Assemblage final complet
        final_path = _assemble_final_document(db, doc_sig)
        if final_path:
            doc_sig.final_pdf_identifier = final_path

        doc_sig.overall_status = models.DocumentSignatureStatus.completed
        doc_sig.completed_at = signed_at

        # Purge Yousign après récupération locale
        try:
            purge_document_signature(doc_sig)
            doc_sig.yousign_purged_at = dt.datetime.utcnow()
        except Exception:
            logger.exception(
                "Échec purge Yousign pour DocumentSignature %d",
                doc_sig.id
            )
    elif doc_sig.parent1_status == "signed" or doc_sig.parent2_status == "signed":
        doc_sig.overall_status = models.DocumentSignatureStatus.partially_signed
    else:
        doc_sig.overall_status = models.DocumentSignatureStatus.sent

    db.add(doc_sig)
    db.commit()
    db.refresh(doc_sig)

    return doc_sig


def purge_document_signature(doc_sig: models.DocumentSignature) -> None:
    """
    Purge la Signature Request Yousign pour CE document.

    RGPD: Suppression permanente chez Yousign après récupération locale.
    """
    client = YousignClient()
    if client.mock_mode or not doc_sig.yousign_procedure_id:
        return

    try:
        client.delete_signature_request(doc_sig.yousign_procedure_id, permanent_delete=True)
        logger.info(
            "Yousign SR %s purged (DocumentSignature %d, doc_type=%s)",
            doc_sig.yousign_procedure_id,
            doc_sig.id,
            doc_sig.document_type
        )
    except Exception:
        logger.exception(
            "Failed to purge Yousign SR %s (DocumentSignature %d)",
            doc_sig.yousign_procedure_id,
            doc_sig.id
        )
