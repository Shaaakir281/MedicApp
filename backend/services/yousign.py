"""Lightweight Yousign client wrapper (with mock mode by default).

The real API call still needs to be wired with proper endpoints and file upload.
For now, when no API key is configured, a mock procedure is returned so that
the rest of the consent workflow can be exercised end-to-end.
"""

from __future__ import annotations

import logging
import uuid
import base64
from dataclasses import dataclass
from typing import List, Optional

import requests

from core.config import get_settings

logger = logging.getLogger(__name__)


class YousignConfigurationError(Exception):
    """Raised when the Yousign client cannot operate (missing key, etc.)."""


@dataclass
class YousignSigner:
    signer_id: str
    signature_link: str
    email: Optional[str] = None
    phone: Optional[str] = None


@dataclass
class YousignProcedure:
    procedure_id: str
    signers: List[YousignSigner]
    evidence_url: Optional[str] = None
    signed_file_url: Optional[str] = None


class YousignClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.yousign_api_key
        self.base_url = settings.yousign_api_base_url.rstrip("/")
        self.mock_mode = not bool(self.api_key)
        if not self.mock_mode and not self.api_key:
            raise YousignConfigurationError("YOUSIGN_API_KEY is not configured.")

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def create_mock_procedure(self, signers: List[dict]) -> YousignProcedure:
        """Return a mock procedure with generated links (development only)."""
        proc_id = f"mock_{uuid.uuid4().hex}"
        base = get_settings().app_base_url.rstrip("/")
        fake_signers = []
        for idx, signer in enumerate(signers, start=1):
            signer_id = signer.get("external_id") or f"mock-signer-{idx}"
            link = f"{base}/consents/mock/{proc_id}/{signer_id}"
            fake_signers.append(
                YousignSigner(
                    signer_id=signer_id,
                    signature_link=link,
                    email=signer.get("email"),
                    phone=signer.get("phone"),
                )
            )
        return YousignProcedure(procedure_id=proc_id, signers=fake_signers)

    # === YOUSIGN V3 SIGNATURE REQUEST FLOW ===
    def create_signature_request(self, name: str) -> str:
        """Create a signature request and return its ID."""
        if self.mock_mode:
            return f"sr-mock-{uuid.uuid4().hex}"
        payload = {
            "name": name,
            "delivery_mode": "email",
            "timezone": "Europe/Paris",
        }
        url = f"{self.base_url}/v3/signature_requests"
        try:
            resp = requests.post(url, json=payload, headers=self._headers(), timeout=30)
            resp.raise_for_status()
        except requests.RequestException as exc:  # pragma: no cover
            logger.exception("Failed to create signature_request: %s", getattr(exc.response, "text", exc))
            raise YousignConfigurationError(str(exc)) from exc
        data = resp.json()
        return data.get("id") or data.get("signature_request_id") or f"sr-unknown-{uuid.uuid4().hex}"

    def upload_document(self, signature_request_id: str, filepath: str, filename: str) -> str:
        """Upload a PDF as signable_document to a signature request."""
        if self.mock_mode:
            return f"doc-mock-{uuid.uuid4().hex}"
        url = f"{self.base_url}/v3/signature_requests/{signature_request_id}/documents"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        with open(filepath, "rb") as f:
            files = {"file": (filename, f, "application/pdf")}
            data = {"nature": "signable_document"}
            try:
                resp = requests.post(url, headers=headers, files=files, data=data, timeout=60)
                resp.raise_for_status()
            except requests.RequestException as exc:  # pragma: no cover
                logger.exception("Failed to upload document to Yousign: %s", getattr(exc.response, "text", exc))
                raise YousignConfigurationError(str(exc)) from exc
        return resp.json().get("id") or f"doc-unknown-{uuid.uuid4().hex}"

    def add_signers(
        self,
        signature_request_id: str,
        document_id: str,
        signers: List[dict],
    ) -> List[YousignSigner]:
        """Add signers with OTP SMS and a basic signature field (v3)."""
        if self.mock_mode:
            base = get_settings().app_base_url.rstrip("/")
            return [
                YousignSigner(
                    signer_id=s.get("external_id") or f"mock-{i}",
                    signature_link=f"{base}/consents/mock/{signature_request_id}/{s.get('external_id', f'mock-{i}')}",
                    email=s.get("email"),
                    phone=s.get("phone"),
                )
                for i, s in enumerate(signers, start=1)
            ]

        created = []
        for s in signers:
            full_name = s.get("full_name", "Parent")
            if " " in full_name:
                firstname, lastname = full_name.split(" ", 1)
            else:
                firstname, lastname = full_name, full_name

            payload = {
                "info": {
                    "first_name": firstname,
                    "last_name": lastname,
                    "email": s.get("email"),
                    "locale": "fr",
                },
                "signature_level": "electronic_signature",
                "signature_authentication_mode": "otp_sms",
                "fields": [
                    {
                        "type": "signature",
                        "document_id": document_id,
                        "page": 1,
                        "x": 200,
                        "y": 500,
                    }
                ],
            }
            if s.get("phone"):
                payload["info"]["phone_number"] = s.get("phone")

            url = f"{self.base_url}/v3/signature_requests/{signature_request_id}/signers"
            try:
                resp = requests.post(url, json=payload, headers=self._headers(), timeout=30)
                resp.raise_for_status()
            except requests.RequestException as exc:  # pragma: no cover
                logger.exception("Failed to add signer to signature_request: %s", getattr(exc.response, "text", exc))
                raise YousignConfigurationError(str(exc)) from exc
            data = resp.json()
            created.append(
                YousignSigner(
                    signer_id=data.get("id") or s.get("external_id") or f"signer-{uuid.uuid4().hex}",
                    signature_link=data.get("signature_url") or "",
                    email=data.get("email") or s.get("email"),
                    phone=data.get("phone") or s.get("phone"),
                )
            )
        return created

    def activate_signature_request(self, signature_request_id: str) -> dict:
        """Activate the signature request to make links available and return the API payload."""
        if self.mock_mode:
            return {}
        url = f"{self.base_url}/v3/signature_requests/{signature_request_id}/activate"
        try:
            resp = requests.post(url, headers=self._headers(), timeout=20)
            resp.raise_for_status()
        except requests.RequestException as exc:  # pragma: no cover
            logger.exception("Failed to activate signature_request: %s", getattr(exc.response, "text", exc))
            raise YousignConfigurationError(str(exc)) from exc
        try:
            return resp.json()
        except Exception:
            return {}

    def fetch_signature_request(self, signature_request_id: str) -> dict:
        if self.mock_mode:
            return {}
        url = f"{self.base_url}/v3/signature_requests/{signature_request_id}"
        resp = requests.get(url, headers=self._headers(), timeout=20)
        resp.raise_for_status()
        return resp.json()

    def fetch_signers(self, signature_request_id: str) -> list[dict]:
        """Return the list of signers with their current signature links, if any."""
        if self.mock_mode:
            return []
        url = f"{self.base_url}/v3/signature_requests/{signature_request_id}/signers"
        resp = requests.get(url, headers=self._headers(), timeout=20)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and "signers" in data:
            return data.get("signers") or []
        if isinstance(data, list):
            return data
        return []

    def fetch_signer(self, signer_id: str) -> dict:
        """Return signer details (includes signature_link)."""
        if self.mock_mode:
            return {}
        url = f"{self.base_url}/v3/signers/{signer_id}"
        resp = requests.get(url, headers=self._headers(), timeout=20)
        resp.raise_for_status()
        return resp.json()

    def finalize_signature_request(
        self,
        signature_request_id: str,
        document_id: str,
        signers: List[dict],
        name: str = "Consentement",
    ) -> YousignProcedure:
        """Add signers, activate the request and return signer links."""
        if self.mock_mode:
            return self.create_mock_procedure(signers)

        created_signers = self.add_signers(signature_request_id, document_id, signers)
        activation_payload = self.activate_signature_request(signature_request_id)

        try:
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

            # Prefer links returned directly by activation response if available.
            signers_data = activation_payload.get("signers", []) if isinstance(activation_payload, dict) else []

            # Try to fetch signers list; if still empty, fetch SR, then per-signer.
            if not signers_data:
                signers_data = self.fetch_signers(signature_request_id)
            if not signers_data:
                sr = self.fetch_signature_request(signature_request_id)
                signers_data = sr.get("signers", []) if isinstance(sr, dict) else []

            # If we still have no signature_link, call per-signer endpoint.
            if signers_data:
                enriched = []
                for s in signers_data:
                    signer_payload = s
                    if not _sig_link(s):
                        try:
                            signer_payload = self.fetch_signer(str(s.get("id")))
                        except Exception:
                            signer_payload = s
                    enriched.append(signer_payload)
                signers_data = enriched

            if signers_data:
                created_signers = [
                    YousignSigner(
                        signer_id=str(s.get("id")),
                        signature_link=_sig_link(s),
                        email=(s.get("info") or {}).get("email") or s.get("email"),
                        phone=(s.get("info") or {}).get("phone_number") or s.get("phone"),
                    )
                    for s in signers_data
                ]
        except Exception:
            pass

        return YousignProcedure(
            procedure_id=signature_request_id,
            signers=created_signers,
            evidence_url=None,
            signed_file_url=None,
        )
