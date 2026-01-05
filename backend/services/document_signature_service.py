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
import io
import logging
import zipfile
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import models
from core.config import get_settings
from services import consent_pdf
from services import legal_documents_pdf
from services import email as email_service
from services.sms import send_sms
from services.storage import get_storage_backend
from services.yousign import YousignClient, YousignConfigurationError, start_neutral_signature_request
from domain.legal_documents import LEGAL_CATALOG
from services.yousign.models import YousignSigner

logger = logging.getLogger("uvicorn.error")


DOCUMENT_TYPE_ALIASES = {
    "surgical_authorization_minor": "authorization",
    "informed_consent": "consent",
    "fees_consent_quote": "fees",
}
VALID_DOCUMENT_TYPES = {"authorization", "consent", "fees"}


def normalize_document_type(value: str) -> str:
    """Normalize API/catalog document types to internal identifiers."""
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type de document manquant."
        )
    normalized = DOCUMENT_TYPE_ALIASES.get(value, value)
    if normalized not in VALID_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de document invalide: {value}"
        )
    return normalized


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
    document_type = normalize_document_type(document_type)
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


def _ensure_email_value(
    email: str | None,
    phone: str | None,
    label: str,
    *,
    allow_placeholder: bool,
    case_id: int,
) -> str | None:
    if email:
        return email
    if phone:
        safe = phone.replace("+", "").replace(" ", "").replace("-", "")
        return f"{safe}@{label}.consent.test"
    if allow_placeholder:
        return f"{label}-{case_id}@medicapp.invalid"
    return None


def _build_single_signer_payload(
    case: models.ProcedureCase,
    role: str,
    auth_mode: str,
    allow_placeholder: bool,
) -> Optional[dict]:
    role = str(role or "").lower()
    if role not in {"parent1", "parent2"}:
        return None
    if role == "parent1":
        if not case.parent1_name:
            return None
        email = _ensure_email_value(
            case.parent1_email,
            case.parent1_phone,
            "parent1",
            allow_placeholder=allow_placeholder,
            case_id=case.id,
        )
        phone = case.parent1_phone
        last_name = "1"
    else:
        if not case.parent2_name:
            return None
        email = _ensure_email_value(
            case.parent2_email,
            case.parent2_phone,
            "parent2",
            allow_placeholder=allow_placeholder,
            case_id=case.id,
        )
        phone = case.parent2_phone
        last_name = "2"
    if not email and not allow_placeholder:
        return None
    return {
        "label": role,
        "email": email,
        "phone": phone,
        "auth_mode": auth_mode,
        "first_name": "Parent",
        "last_name": last_name,
    }


def _build_signers_payload(
    case: models.ProcedureCase,
    auth_mode: str = "otp_sms",
    allow_placeholder: bool = False,
) -> list[dict]:
    """
    Build signers payload pour Yousign.

    RGPD: Pseudonymisation des noms de parents.
    """
    signers = []
    if case.parent1_name and (case.parent1_email or case.parent1_phone or allow_placeholder):
        email = _ensure_email_value(
            case.parent1_email,
            case.parent1_phone,
            "parent1",
            allow_placeholder=allow_placeholder,
            case_id=case.id,
        )
        signers.append({
            "label": "parent1",
            "email": email,
            "phone": case.parent1_phone,
            "auth_mode": auth_mode,
            # RGPD: Pseudonymisation
            "first_name": "Parent",
            "last_name": "1",
        })
    if case.parent2_name and (case.parent2_email or case.parent2_phone or allow_placeholder):
        email = _ensure_email_value(
            case.parent2_email,
            case.parent2_phone,
            "parent2",
            allow_placeholder=allow_placeholder,
            case_id=case.id,
        )
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


def ensure_missing_signer_link(
    db: Session,
    doc_sig: models.DocumentSignature,
    role: str,
    *,
    in_person: bool,
) -> models.DocumentSignature:
    role = str(role or "").lower()
    if role not in {"parent1", "parent2"}:
        return doc_sig
    if not doc_sig.yousign_procedure_id or doc_sig.yousign_purged_at:
        return doc_sig
    link_attr = f"{role}_signature_link"
    if getattr(doc_sig, link_attr, None):
        return doc_sig

    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == doc_sig.procedure_case_id
    ).first()
    if not case:
        return doc_sig

    auth_mode = "no_otp" if in_person else "otp_sms"
    signer_payload = _build_single_signer_payload(
        case,
        role,
        auth_mode=auth_mode,
        allow_placeholder=in_person,
    )
    if not signer_payload:
        return doc_sig

    client = YousignClient()
    if client.mock_mode:
        created = client.add_signers(doc_sig.yousign_procedure_id, "mock", [signer_payload])
    else:
        try:
            documents = client.fetch_documents(doc_sig.yousign_procedure_id)
            document_id = None
            if documents:
                first = documents[0]
                if isinstance(first, dict):
                    document_id = first.get("id")
            if not document_id:
                return doc_sig
        except Exception:
            logger.exception(
                "Failed to fetch documents for Yousign SR %s (DocumentSignature %d)",
                doc_sig.yousign_procedure_id,
                doc_sig.id,
            )
            return doc_sig
        try:
            created = client.add_signers(doc_sig.yousign_procedure_id, document_id, [signer_payload])
        except Exception:
            logger.exception(
                "Failed to add signer %s for DocumentSignature %d",
                role,
                doc_sig.id,
            )
            return doc_sig

    if not created:
        return doc_sig

    signer = created[0]
    if not signer.signature_link and not client.mock_mode:
        try:
            payload = client.fetch_signer(str(signer.signer_id))
            signer = YousignSigner(
                signer_id=signer.signer_id,
                signature_link=payload.get("signature_url") or payload.get("signature_link") or "",
                email=(payload.get("info") or {}).get("email") or payload.get("email") or signer.email,
                phone=(payload.get("info") or {}).get("phone_number") or payload.get("phone") or signer.phone,
            )
        except Exception:
            logger.exception(
                "Failed to fetch signer details for DocumentSignature %d",
                doc_sig.id,
            )
    setattr(doc_sig, f"{role}_yousign_signer_id", signer.signer_id)
    setattr(doc_sig, link_attr, signer.signature_link)
    status_attr = f"{role}_status"
    sent_at_attr = f"{role}_sent_at"
    if getattr(doc_sig, status_attr, None) != "signed":
        setattr(doc_sig, status_attr, "sent")
        setattr(doc_sig, sent_at_attr, dt.datetime.utcnow())
        doc_sig.overall_status = models.DocumentSignatureStatus.sent

    db.add(doc_sig)
    db.commit()
    db.refresh(doc_sig)
    return doc_sig


def _start_signature_request_for_signers(
    case: models.ProcedureCase,
    document_type: str,
    signers: list[dict],
    *,
    in_person: bool,
) -> tuple[Optional[object], Optional[str]]:
    doc_type_enum = legal_documents_pdf.normalize_document_type(document_type)
    document_version = LEGAL_CATALOG[doc_type_enum].version
    consent_hash = None

    base_doc_id = legal_documents_pdf.ensure_legal_document_pdf(case, doc_type_enum)
    base_category = legal_documents_pdf.base_category_for(doc_type_enum)
    pdf_bytes = consent_pdf.load_pdf_bytes(base_category, base_doc_id)
    if pdf_bytes:
        consent_hash = consent_pdf.compute_pdf_sha256(pdf_bytes)

    neutral_pdf_path = consent_pdf.render_neutral_document_pdf(
        document_type=document_type,
        consent_id=str(case.id),
        document_version=document_version,
        consent_hash=consent_hash,
    )

    doc_labels = {
        "authorization": "Autorisation d'intervention",
        "consent": "Consentement eclaire",
        "fees": "Honoraires et modalites financieres",
    }
    procedure_label = f"MedScript - {doc_labels.get(document_type, document_type)}"
    delivery_mode = "none" if in_person else "email"

    try:
        client = YousignClient()
        procedure = start_neutral_signature_request(
            client=client,
            neutral_pdf_path=str(neutral_pdf_path),
            signers=signers,
            procedure_label=procedure_label,
            delivery_mode=delivery_mode,
        )
    except (YousignConfigurationError, RuntimeError):
        logger.exception(
            "Failed to start signature request for case=%d doc_type=%s",
            case.id,
            document_type,
        )
        return None, None

    return procedure, document_version


def recreate_signature_request_for_role(
    db: Session,
    doc_sig: models.DocumentSignature,
    role: str,
    *,
    in_person: bool,
) -> models.DocumentSignature:
    role = str(role or "").lower()
    if role not in {"parent1", "parent2"}:
        return doc_sig

    case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.id == doc_sig.procedure_case_id
    ).first()
    if not case:
        return doc_sig

    auth_mode = "no_otp" if in_person else "otp_sms"
    signer_payload = _build_single_signer_payload(
        case,
        role,
        auth_mode=auth_mode,
        allow_placeholder=in_person,
    )
    if not signer_payload:
        return doc_sig

    procedure, document_version = _start_signature_request_for_signers(
        case,
        doc_sig.document_type,
        [signer_payload],
        in_person=in_person,
    )
    if not procedure or not procedure.signers:
        return doc_sig

    signer = procedure.signers[0]
    now = dt.datetime.utcnow()
    doc_sig.yousign_procedure_id = procedure.procedure_id
    doc_sig.yousign_purged_at = None
    if document_version:
        doc_sig.document_version = document_version

    status_attr = f"{role}_status"
    sent_at_attr = f"{role}_sent_at"
    setattr(doc_sig, f"{role}_yousign_signer_id", signer.signer_id)
    setattr(doc_sig, f"{role}_signature_link", signer.signature_link)
    if getattr(doc_sig, status_attr, None) != "signed":
        setattr(doc_sig, status_attr, "sent")
        setattr(doc_sig, sent_at_attr, now)

    if doc_sig.parent1_status == "signed" and doc_sig.parent2_status == "signed":
        doc_sig.overall_status = models.DocumentSignatureStatus.completed
    elif doc_sig.parent1_status == "signed" or doc_sig.parent2_status == "signed":
        doc_sig.overall_status = models.DocumentSignatureStatus.partially_signed
    else:
        doc_sig.overall_status = models.DocumentSignatureStatus.sent

    db.add(doc_sig)
    db.commit()
    db.refresh(doc_sig)
    return doc_sig


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

    document_type = normalize_document_type(document_type)
    if not in_person:
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
    signers = _build_signers_payload(case, auth_mode=auth_mode, allow_placeholder=in_person)

    if not signers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun parent renseigné."
        )

    # 4. Générer PDF neutre spécifique à ce document
    try:
        client = YousignClient()

        # Hash du PDF medical complet (si disponible)
        doc_type_enum = legal_documents_pdf.normalize_document_type(document_type)
        document_version = LEGAL_CATALOG[doc_type_enum].version
        consent_hash = None
        base_doc_id = legal_documents_pdf.ensure_legal_document_pdf(case, doc_type_enum)
        base_category = legal_documents_pdf.base_category_for(doc_type_enum)
        pdf_bytes = consent_pdf.load_pdf_bytes(base_category, base_doc_id)
        if pdf_bytes:
            consent_hash = consent_pdf.compute_pdf_sha256(pdf_bytes)


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
    reference = f"{case.id}-{document_type}"

    def _build_body(link: str) -> str:
        # RGPD: Message neutre sans PHI
        return (
            f"Vous avez un document médical à signer : {doc_label}.\n"
            f"Référence : {reference}\n"
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
        email_service.send_signature_request_email(
            case.parent1_email,
            doc_label=doc_label,
            signature_link=doc_sig.parent1_signature_link,
            reference=reference,
        )
    if case.parent2_email and doc_sig.parent2_signature_link:
        email_service.send_signature_request_email(
            case.parent2_email,
            doc_label=doc_label,
            signature_link=doc_sig.parent2_signature_link,
            reference=reference,
        )


def send_document_reminder(
    case: models.ProcedureCase,
    doc_sig: models.DocumentSignature,
    document_type: str,
    parent_role: str,
) -> bool:
    """Resend signature notifications for one parent if a link exists."""
    role = str(parent_role or "").lower()
    if role not in {"parent1", "parent2"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role parent invalide.",
        )

    document_type = normalize_document_type(document_type)
    doc_labels = {
        "authorization": "Autorisation d'intervention",
        "consent": "Consentement eclaire",
        "fees": "Honoraires",
    }
    doc_label = doc_labels.get(document_type, document_type)
    reference = f"{case.id}-{document_type}"
    app_name = get_settings().app_name

    link = doc_sig.parent1_signature_link if role == "parent1" else doc_sig.parent2_signature_link
    if not link:
        return False

    def _build_body() -> str:
        return (
            f"Vous avez un document medical a signer : {doc_label}.\n"
            f"Reference : {reference}\n"
            f"Lien de signature securise : {link}\n"
            f"{app_name}"
        )

    if role == "parent1":
        if case.parent1_sms_optin and case.parent1_phone:
            send_sms(case.parent1_phone, _build_body())
        if case.parent1_email:
            email_service.send_signature_request_email(
                case.parent1_email,
                doc_label=doc_label,
                signature_link=link,
                reference=reference,
            )
    else:
        if case.parent2_sms_optin and case.parent2_phone:
            send_sms(case.parent2_phone, _build_body())
        if case.parent2_email:
            email_service.send_signature_request_email(
                case.parent2_email,
                doc_label=doc_label,
                signature_link=link,
                reference=reference,
            )

    return True



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

    doc_type = legal_documents_pdf.normalize_document_type(doc_sig.document_type)
    signed_category = legal_documents_pdf.signed_category_for(doc_type)
    evidence_category = legal_documents_pdf.evidence_category_for(doc_type)

    # Télécharger PDF signé (neutre)
    try:
        if signed_url:
            signed_bytes = client.download_with_auth(signed_url)
        else:
            signed_bytes = client.download_signed_documents(doc_sig.yousign_procedure_id)
        if signed_bytes:
            prefix = f"{doc_sig.procedure_case_id}-{doc_sig.document_type}"
            signed_identifier = consent_pdf.store_pdf_bytes(signed_category, prefix, signed_bytes)
            # Pruning : garder 2 versions max
            consent_pdf.prune_case_files(
                signed_category,
                doc_sig.procedure_case_id,
                keep_latest=2
            )
    except Exception:
        logger.exception(
            "Failed to download signed PDF for DocumentSignature %d",
            doc_sig.id
        )

    # Télécharger audit trail (priorité: URL > tous les signataires > par signataire)
    evidence_ids: list[str] = []

    def _is_pdf_bytes(data: bytes) -> bool:
        return bool(data) and data.startswith(b"%PDF")

    def _store_evidence_pdf(data: bytes, label: str | None = None) -> None:
        if not _is_pdf_bytes(data):
            return
        suffix = f"-{label}" if label else ""
        prefix = f"{doc_sig.procedure_case_id}-{doc_sig.document_type}-audit{suffix}"
        identifier = consent_pdf.store_pdf_bytes(evidence_category, prefix, data)
        evidence_ids.append(identifier)

    def _store_evidence_bytes(data: bytes, label: str | None = None) -> None:
        if not data:
            return
        if _is_pdf_bytes(data):
            _store_evidence_pdf(data, label)
            return
        if zipfile.is_zipfile(io.BytesIO(data)):
            try:
                with zipfile.ZipFile(io.BytesIO(data)) as archive:
                    entries = [info for info in archive.infolist() if not info.is_dir()]
                    for index, info in enumerate(entries, start=1):
                        payload = archive.read(info)
                        if not _is_pdf_bytes(payload):
                            continue
                        suffix = f"{label}-{index}" if label else f"zip-{index}"
                        _store_evidence_pdf(payload, suffix)
            except Exception:
                logger.exception(
                    "Failed to unpack audit zip for DocumentSignature %d",
                    doc_sig.id,
                )
            return
        logger.warning(
            "Audit trail payload is not a PDF or ZIP for DocumentSignature %d",
            doc_sig.id,
        )

    if evidence_url:
        try:
            evidence_bytes = client.download_with_auth(evidence_url)
            if evidence_bytes:
                _store_evidence_bytes(evidence_bytes, "url")
        except Exception:
            logger.exception(
                "Failed to download evidence URL for DocumentSignature %d",
                doc_sig.id
            )

    if not evidence_ids:
        try:
            evidence_bytes = client.download_audit_trails_all(doc_sig.yousign_procedure_id)
            if evidence_bytes:
                _store_evidence_bytes(evidence_bytes, "all")
        except Exception:
            logger.exception(
                "Failed to download audit trails (all) for DocumentSignature %d",
                doc_sig.id
            )

    signer_ids: list[str] = []
    if signer_id:
        signer_ids.append(signer_id)
    else:
        if doc_sig.parent1_yousign_signer_id:
            signer_ids.append(doc_sig.parent1_yousign_signer_id)
        if doc_sig.parent2_yousign_signer_id:
            signer_ids.append(doc_sig.parent2_yousign_signer_id)

    # When both signers are involved, fetch per-signer audits even if "all" succeeded,
    # to ensure both parents are represented in the final package.
    if signer_ids and (not evidence_ids or signer_id is None):
        for candidate in signer_ids:
            try:
                evidence_bytes = client.download_audit_trail_for_signer(
                    doc_sig.yousign_procedure_id,
                    candidate
                )
                if evidence_bytes:
                    _store_evidence_bytes(evidence_bytes, f"signer-{candidate}")
            except Exception:
                logger.exception(
                    "Failed to download audit trail for signer %s (DocumentSignature %d)",
                    candidate,
                    doc_sig.id,
                )

    if evidence_ids:
        consent_pdf.prune_case_files(
            evidence_category,
            doc_sig.procedure_case_id,
            keep_latest=max(4, len(evidence_ids))
        )
        evidence_identifier = evidence_ids[0]

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

    if not case:
        return None

    try:
        full_consent_id = legal_documents_pdf.ensure_legal_document_pdf(case, doc_sig.document_type)
    except Exception:
        logger.exception(
            "Echec generation document legal case=%d doc_type=%s",
            doc_sig.procedure_case_id,
            doc_sig.document_type,
        )
        return None

    signed_category = legal_documents_pdf.signed_category_for(doc_sig.document_type)
    evidence_category = legal_documents_pdf.evidence_category_for(doc_sig.document_type)

    doc_prefix = f"{doc_sig.procedure_case_id}-{doc_sig.document_type}"
    signed_ids = [
        identifier
        for identifier in consent_pdf.list_local_files_for_case(signed_category, doc_sig.procedure_case_id)
        if identifier.startswith(doc_prefix)
    ]
    evidence_ids = [
        identifier
        for identifier in consent_pdf.list_local_files_for_case(evidence_category, doc_sig.procedure_case_id)
        if identifier.startswith(doc_prefix)
    ]

    if doc_sig.signed_pdf_identifier and doc_sig.signed_pdf_identifier.startswith(doc_prefix) and doc_sig.signed_pdf_identifier not in signed_ids:
        signed_ids.append(doc_sig.signed_pdf_identifier)
    if doc_sig.evidence_pdf_identifier and doc_sig.evidence_pdf_identifier.startswith(doc_prefix) and doc_sig.evidence_pdf_identifier not in evidence_ids:
        evidence_ids.append(doc_sig.evidence_pdf_identifier)

    def _filter_valid_pdfs(category: str, identifiers: list[str]) -> list[str]:
        valid: list[str] = []
        for identifier in identifiers:
            payload = consent_pdf.load_pdf_bytes(category, identifier)
            if payload and payload.startswith(b"%PDF"):
                valid.append(identifier)
            else:
                logger.warning(
                    "Skipping non-PDF artifact %s for case=%d doc_type=%s",
                    identifier,
                    doc_sig.procedure_case_id,
                    doc_sig.document_type,
                )
        return valid

    signed_ids = _filter_valid_pdfs(signed_category, signed_ids)
    evidence_ids = _filter_valid_pdfs(evidence_category, evidence_ids)

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
            full_consent_category=legal_documents_pdf.base_category_for(doc_sig.document_type),
            signed_category=legal_documents_pdf.signed_category_for(doc_sig.document_type),
            evidence_category=legal_documents_pdf.evidence_category_for(doc_sig.document_type),
            final_category=legal_documents_pdf.final_category_for(doc_sig.document_type),
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
        if final_path:
            try:
                purge_document_signature(doc_sig)
                doc_sig.yousign_purged_at = dt.datetime.utcnow()
            except Exception:
                logger.exception(
                    "Échec purge Yousign pour DocumentSignature %d",
                    doc_sig.id
                )
        else:
            logger.warning(
                "Final PDF missing, skipping Yousign purge for DocumentSignature %d",
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


def poll_and_fetch_document_signature(
    db: Session,
    doc_sig: models.DocumentSignature,
) -> models.DocumentSignature:
    """
    Fallback polling: fetch Yousign SR, download artifacts, assemble final package.

    This mirrors the legacy consent flow to avoid regressions when webhook data
    is missing or delayed.
    """
    client = YousignClient()
    if client.mock_mode or not doc_sig.yousign_procedure_id or doc_sig.yousign_purged_at:
        return doc_sig

    try:
        sr = client.fetch_signature_request(doc_sig.yousign_procedure_id)
    except Exception:
        logger.exception("Poll Yousign SR failed for DocumentSignature %d", doc_sig.id)
        return doc_sig

    now = dt.datetime.utcnow()
    signed_parents: list[str] = []
    signers_payload = sr.get("signers") or []
    if not signers_payload:
        try:
            signers_payload = client.fetch_signers(doc_sig.yousign_procedure_id)
        except Exception:
            signers_payload = []
    for signer in signers_payload:
        if (signer.get("status") or "").lower() != "signed":
            continue
        signer_id = str(signer.get("id"))
        if signer_id == doc_sig.parent1_yousign_signer_id:
            doc_sig.parent1_status = "signed"
            doc_sig.parent1_signed_at = now
            doc_sig.parent1_method = "yousign"
            signed_parents.append("parent1")
        elif signer_id == doc_sig.parent2_yousign_signer_id:
            doc_sig.parent2_status = "signed"
            doc_sig.parent2_signed_at = now
            doc_sig.parent2_method = "yousign"
            signed_parents.append("parent2")

    signed_url = sr.get("signed_file_url")
    evidence_url = sr.get("evidence_url")

    both_signed = doc_sig.parent1_status == "signed" and doc_sig.parent2_status == "signed"

    if both_signed:
        stored_signed, stored_evidence = _download_and_store_artifacts(
            doc_sig,
            signed_url=signed_url,
            evidence_url=evidence_url,
            signer_id=None,
        )
        if stored_signed:
            doc_sig.signed_pdf_identifier = stored_signed
        if stored_evidence:
            doc_sig.evidence_pdf_identifier = stored_evidence

        final_path = _assemble_final_document(db, doc_sig)
        if final_path:
            doc_sig.final_pdf_identifier = final_path

        doc_sig.overall_status = models.DocumentSignatureStatus.completed
        doc_sig.completed_at = now

        if final_path:
            try:
                purge_document_signature(doc_sig)
                doc_sig.yousign_purged_at = dt.datetime.utcnow()
            except Exception:
                logger.exception(
                    "Echec purge Yousign pour DocumentSignature %d",
                    doc_sig.id,
                )
        else:
            logger.warning(
                "Final PDF missing, skipping Yousign purge for DocumentSignature %d",
                doc_sig.id,
            )
    elif signed_parents:
        for parent_label in signed_parents:
            signer_id = (
                doc_sig.parent1_yousign_signer_id
                if parent_label == "parent1"
                else doc_sig.parent2_yousign_signer_id
            )
            stored_signed, stored_evidence = _download_and_store_artifacts(
                doc_sig,
                signed_url=None,
                evidence_url=None,
                signer_id=signer_id,
            )
            if stored_signed:
                doc_sig.signed_pdf_identifier = stored_signed
            if stored_evidence:
                doc_sig.evidence_pdf_identifier = stored_evidence

        doc_sig.overall_status = models.DocumentSignatureStatus.partially_signed
    else:
        doc_sig.overall_status = models.DocumentSignatureStatus.sent

    db.add(doc_sig)
    db.commit()
    db.refresh(doc_sig)
    return doc_sig


def ensure_final_document(
    db: Session,
    doc_sig: models.DocumentSignature,
) -> models.DocumentSignature:
    """Ensure the final assembled PDF is up to date after both signatures."""
    status_value = doc_sig.overall_status
    if hasattr(status_value, "value"):
        status_value = status_value.value
    if str(status_value) != "completed":
        return doc_sig

    if doc_sig.final_pdf_identifier:
        storage = get_storage_backend()
        doc_type = legal_documents_pdf.normalize_document_type(doc_sig.document_type)
        final_category = legal_documents_pdf.final_category_for(doc_type)
        try:
            if storage.exists(final_category, doc_sig.final_pdf_identifier):
                if doc_sig.yousign_procedure_id and not doc_sig.yousign_purged_at:
                    try:
                        purge_document_signature(doc_sig)
                        doc_sig.yousign_purged_at = dt.datetime.utcnow()
                        db.add(doc_sig)
                        db.commit()
                        db.refresh(doc_sig)
                    except Exception:
                        logger.exception(
                            "Echec purge Yousign pour DocumentSignature %d",
                            doc_sig.id,
                        )
                return doc_sig
        except Exception:
            logger.exception(
                "Echec verification fichier final pour DocumentSignature %d",
                doc_sig.id,
            )

    final_path = _assemble_final_document(db, doc_sig)
    if final_path:
        doc_sig.final_pdf_identifier = final_path
        if doc_sig.yousign_procedure_id and not doc_sig.yousign_purged_at:
            try:
                purge_document_signature(doc_sig)
                doc_sig.yousign_purged_at = dt.datetime.utcnow()
            except Exception:
                logger.exception(
                    "Echec purge Yousign pour DocumentSignature %d",
                    doc_sig.id,
                )
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
        try:
            documents = client.fetch_documents(doc_sig.yousign_procedure_id)
        except Exception:
            documents = []

        for doc in documents:
            doc_id = doc.get("id") if isinstance(doc, dict) else None
            if not doc_id:
                continue
            try:
                client.delete_document(doc_sig.yousign_procedure_id, str(doc_id))
            except Exception:
                logger.exception(
                    "Failed to delete Yousign document %s (DocumentSignature %d)",
                    doc_id,
                    doc_sig.id,
                )
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
