"""High-level Yousign workflow helpers (neutral PDF only, no PHI)."""

from __future__ import annotations

import logging
import uuid
from typing import List, Optional

from services.yousign.client import YousignClient
from services.yousign.models import YousignProcedure, YousignSigner

logger = logging.getLogger("uvicorn.error")


def _signature_link(data: dict) -> str:
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


def _normalize_signers(signers: List[dict]) -> List[dict]:
    normalized: List[dict] = []
    for idx, s in enumerate(signers, start=1):
        normalized.append(
            {
                "label": s.get("label") or f"parent{idx}",
                "email": s.get("email"),
                "phone": s.get("phone"),
                "first_name": "Parent",
                "last_name": str(idx),
                "external_id": s.get("external_id") or s.get("label") or f"signer-{idx}",
                "page": s.get("page", 1),
                "x": s.get("x", 200),
                "y": s.get("y", 500),
            }
        )
    return normalized


def _enrich_signers(client: YousignClient, signature_request_id: str, signers: List[YousignSigner]) -> List[YousignSigner]:
    """Fetch signature links if missing after activation."""
    try:
        signers_data = client.fetch_signers(signature_request_id)
        logger.info("Yousign fetch_signers payload for %s: %s", signature_request_id, signers_data)
    except Exception:  # pragma: no cover - network
        signers_data = []

    # Construire un mapping id -> données pour ne remplir que les liens manquants
    mapping: dict[str, dict] = {}
    for s in signers_data or []:
        if isinstance(s, dict) and s.get("id"):
            mapping[str(s.get("id"))] = s

    enriched: List[YousignSigner] = []
    for s in signers:
        payload = mapping.get(str(s.signer_id))
        link = s.signature_link
        email = s.email
        phone = s.phone
        if payload:
            if not link:
                link = _signature_link(payload)
            email = (payload.get("info") or {}).get("email") or payload.get("email") or email
            phone = (payload.get("info") or {}).get("phone_number") or payload.get("phone") or phone
        if not link:
            # Dernier recours : fetch_signer individuel
            try:
                payload = client.fetch_signer(str(s.signer_id))
                link = _signature_link(payload)
                email = (payload.get("info") or {}).get("email") or payload.get("email") or email
                phone = (payload.get("info") or {}).get("phone_number") or payload.get("phone") or phone
            except Exception:
                pass
        enriched.append(YousignSigner(signer_id=s.signer_id, signature_link=link or "", email=email, phone=phone))
    return enriched


def start_neutral_signature_request(
    client: YousignClient,
    neutral_pdf_path: str,
    signers: List[dict],
    *,
    procedure_label: str = "Consentement electronique",
) -> YousignProcedure:
    """Create SR, upload neutral PDF, add signers, activate, and return links."""
    normalized_signers = _normalize_signers(signers)

    if client.mock_mode:
        procedure = client.create_mock_procedure(normalized_signers)
        logger.info("Yousign finalize_signature_request (mock) -> procedure_id=%s, signers=%s", procedure.procedure_id, procedure.signers)
        return procedure

    signature_request_id = client.create_signature_request(procedure_label)
    filename = f"yousign-neutral-consent-{uuid.uuid4().hex}.pdf"
    document_id = client.upload_document(signature_request_id, neutral_pdf_path, filename=filename)
    created_signers = client.add_signers(signature_request_id, document_id, normalized_signers)
    activation_payload = client.activate_signature_request(signature_request_id)
    logger.info("Yousign activation payload for %s: %s", signature_request_id, activation_payload)

    # Try to extract signature links from activation payload first.
    try:
        signers_data = activation_payload.get("signers", []) if isinstance(activation_payload, dict) else []
        if signers_data:
            created_signers = [
                YousignSigner(
                    signer_id=str(s.get("id") or created_signers[i].signer_id if i < len(created_signers) else uuid.uuid4().hex),
                    signature_link=_signature_link(s),
                    email=(s.get("info") or {}).get("email") or s.get("email") or created_signers[i].email if i < len(created_signers) else None,
                    phone=(s.get("info") or {}).get("phone_number") or s.get("phone") or created_signers[i].phone if i < len(created_signers) else None,
                )
                for i, s in enumerate(signers_data)
            ]
    except Exception:
        logger.debug("Activation payload did not contain signer links, will fallback to fetch.")

    # Si nous avons déjà des liens via l'activation, on évite d'écraser avec une réponse vide de fetch_signers.
    if not any(s.signature_link for s in created_signers):
        created_signers = _enrich_signers(client, signature_request_id, created_signers)

    evidence_url = None
    signed_file_url = None
    if isinstance(activation_payload, dict):
        evidence_url = activation_payload.get("evidence_url")
        signed_file_url = activation_payload.get("signed_file_url")

    procedure = YousignProcedure(
        procedure_id=signature_request_id,
        document_id=document_id,
        signers=created_signers,
        evidence_url=evidence_url,
        signed_file_url=signed_file_url,
    )
    logger.info(
        "Yousign finalize_signature_request -> procedure_id=%s, signers=%s",
        signature_request_id,
        created_signers,
    )
    return procedure
