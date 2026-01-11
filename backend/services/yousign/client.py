"""HTTP client for Yousign Public API v3 (with mock mode)."""

from __future__ import annotations

import logging
import uuid
from typing import List, Optional

import requests

from core.config import get_settings
from services.yousign.models import YousignProcedure, YousignSigner

logger = logging.getLogger(__name__)


class YousignConfigurationError(Exception):
    """Raised when the Yousign client cannot operate (missing key, etc.)."""


class YousignClient:
    """Low-level Yousign API wrapper."""

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.yousign_api_key
        base = settings.yousign_api_base_url.rstrip("/")
        # Robust fallback: ensure /v3 suffix is present (sandbox/prod)
        if not base.endswith("/v3"):
            base = f"{base}/v3"
        self.base_url = base
        self.mock_mode = not bool(self.api_key)
        if not self.mock_mode and not self.api_key:
            raise YousignConfigurationError("YOUSIGN_API_KEY is not configured.")

    # === Internal helpers ===
    def _json_headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def _auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}"}

    # === Mock helpers ===
    def create_mock_procedure(self, signers: List[dict]) -> YousignProcedure:
        """Return a mock procedure with generated links (development only)."""
        proc_id = f"mock_{uuid.uuid4().hex}"
        base = get_settings().app_base_url.rstrip("/")
        fake_signers = []
        for idx, signer in enumerate(signers, start=1):
            signer_id = signer.get("external_id") or f"mock-signer-{idx}"
            link = f"{base}/signature/mock/{proc_id}/{signer_id}"
            fake_signers.append(
                YousignSigner(
                    signer_id=signer_id,
                    signature_link=link,
                    email=signer.get("email"),
                    phone=signer.get("phone"),
                )
            )
        return YousignProcedure(procedure_id=proc_id, document_id=None, signers=fake_signers)

    # === Signature Request lifecycle ===
    def create_signature_request(self, name: str, delivery_mode: str = "email") -> str:
        """Create a signature request and return its ID.

        delivery_mode:
            - "email": Yousign envoie les emails (par défaut).
            - "none": MedScript gère les liens (face-à-face/tablette).
        """
        if self.mock_mode:
            return f"sr-mock-{uuid.uuid4().hex}"
        payload = {"name": name, "delivery_mode": delivery_mode, "timezone": "Europe/Paris"}
        url = f"{self.base_url}/signature_requests"
        try:
            resp = requests.post(url, json=payload, headers=self._json_headers(), timeout=30)
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
        url = f"{self.base_url}/signature_requests/{signature_request_id}/documents"
        with open(filepath, "rb") as f:
            files = {"file": (filename, f, "application/pdf")}
            data = {"nature": "signable_document"}
            try:
                resp = requests.post(url, headers=self._auth_headers(), files=files, data=data, timeout=60)
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
        """Add signers with configurable auth mode (v3)."""
        allowed_auth_modes = {"otp_sms", "otp_email", "no_otp", None}
        if self.mock_mode:
            base = get_settings().app_base_url.rstrip("/")
            return [
                YousignSigner(
                    signer_id=s.get("external_id") or f"mock-{i}",
                    signature_link=f"{base}/signature/mock/{signature_request_id}/{s.get('external_id', f'mock-{i}')}",
                    email=s.get("email"),
                    phone=s.get("phone"),
                )
                for i, s in enumerate(signers, start=1)
            ]

        created = []
        for i, s in enumerate(signers, start=1):
            payload = {
                "info": {
                    "first_name": s.get("first_name") or "Parent",
                    "last_name": s.get("last_name") or str(i),
                    "email": s.get("email"),
                    "locale": "fr",
                },
                "signature_level": "electronic_signature",
                "signature_authentication_mode": s.get("auth_mode") or "otp_sms",
                "fields": [
                    {
                        "type": "signature",
                        "document_id": document_id,
                        "page": s.get("page", 1),
                        "x": s.get("x", 200),
                        "y": s.get("y", 500),
                    }
                ],
            }
            if payload["signature_authentication_mode"] not in allowed_auth_modes:
                payload["signature_authentication_mode"] = "otp_sms"
            phone = s.get("phone") or s.get("phone_number")
            if phone:
                payload["info"]["phone_number"] = phone
            url = f"{self.base_url}/signature_requests/{signature_request_id}/signers"
            try:
                resp = requests.post(url, json=payload, headers=self._json_headers(), timeout=30)
                resp.raise_for_status()
            except requests.RequestException as exc:  # pragma: no cover
                logger.exception("Failed to add signer to signature_request: %s", getattr(exc.response, "text", exc))
                raise YousignConfigurationError(str(exc)) from exc
            data = resp.json()
            created.append(
                YousignSigner(
                    signer_id=data.get("id") or s.get("external_id") or f"signer-{uuid.uuid4().hex}",
                    signature_link=data.get("signature_url") or data.get("signature_link") or "",
                    email=(data.get("info") or {}).get("email") or data.get("email") or s.get("email"),
                    phone=(data.get("info") or {}).get("phone_number") or data.get("phone") or phone,
                )
            )
        return created

    def activate_signature_request(self, signature_request_id: str) -> dict:
        """Activate the signature request to make links available and return the API payload."""
        if self.mock_mode:
            return {}
        url = f"{self.base_url}/signature_requests/{signature_request_id}/activate"
        try:
            # Sandbox Yousign peut répondre lentement : timeout allongé.
            resp = requests.post(url, headers=self._json_headers(), timeout=60)
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
        url = f"{self.base_url}/signature_requests/{signature_request_id}"
        resp = requests.get(url, headers=self._json_headers(), timeout=20)
        resp.raise_for_status()
        return resp.json()

    def fetch_signers(self, signature_request_id: str) -> list[dict]:
        """Return the list of signers with their current signature links, if any."""
        if self.mock_mode:
            return []
        url = f"{self.base_url}/signature_requests/{signature_request_id}/signers"
        resp = requests.get(url, headers=self._json_headers(), timeout=20)
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
        url = f"{self.base_url}/signers/{signer_id}"
        resp = requests.get(url, headers=self._json_headers(), timeout=20)
        resp.raise_for_status()
        return resp.json()

    # === Download / cleanup ===
    def download_signed_documents(self, signature_request_id: str) -> bytes:
        """Download the final signed document(s) as binary bytes."""
        if self.mock_mode:
            return b""
        url = f"{self.base_url}/signature_requests/{signature_request_id}/documents/download"
        resp = requests.get(url, headers=self._auth_headers(), timeout=60)
        resp.raise_for_status()
        return resp.content

    def fetch_documents(self, signature_request_id: str) -> list[dict]:
        """List documents attached to a signature request."""
        if self.mock_mode:
            return []
        url = f"{self.base_url}/signature_requests/{signature_request_id}/documents"
        resp = requests.get(url, headers=self._auth_headers(), timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and "documents" in data:
            return data.get("documents") or []
        if isinstance(data, list):
            return data
        return []

    def download_document(self, signature_request_id: str, document_id: str) -> bytes:
        """Download a specific document by id."""
        if self.mock_mode:
            return b""
        url = f"{self.base_url}/signature_requests/{signature_request_id}/documents/{document_id}/download"
        resp = requests.get(url, headers=self._auth_headers(), timeout=60)
        resp.raise_for_status()
        return resp.content

    def download_audit_trails_all(self, signature_request_id: str) -> bytes:
        """Download the PDF containing all audit trails for the signature request (v3)."""
        if self.mock_mode:
            return b""
        url = f"{self.base_url}/signature_requests/{signature_request_id}/audit_trails/download"
        resp = requests.get(url, headers=self._auth_headers(), timeout=60)
        resp.raise_for_status()
        return resp.content

    def download_audit_trail_for_signer(self, signature_request_id: str, signer_id: str) -> bytes:
        """Download the audit trail PDF for a specific signer (v3)."""
        if self.mock_mode:
            return b""
        url = f"{self.base_url}/signature_requests/{signature_request_id}/signers/{signer_id}/audit_trails/download"
        resp = requests.get(url, headers=self._auth_headers(), timeout=60)
        resp.raise_for_status()
        return resp.content

    def download_evidence(self, signature_request_id: str, signer_id: Optional[str] = None) -> bytes:
        """Compatibility wrapper: in v3, use audit_trails endpoints (all signers by default)."""
        if signer_id:
            return self.download_audit_trail_for_signer(signature_request_id, signer_id)
        try:
            return self.download_audit_trails_all(signature_request_id)
        except requests.RequestException as exc:
            logger.exception("Failed to download audit trails: %s", getattr(exc.response, "text", exc))
            return b""

    def download_with_auth(self, url: str) -> bytes:
        """Download a resource using Bearer auth (for evidence/signed_file URLs)."""
        if self.mock_mode:
            return b""
        resp = requests.get(url, headers=self._auth_headers(), timeout=60)
        resp.raise_for_status()
        return resp.content

    def delete_document(self, signature_request_id: str, document_id: str) -> None:
        """Delete a single document attached to a signature request."""
        if self.mock_mode:
            return
        url = f"{self.base_url}/signature_requests/{signature_request_id}/documents/{document_id}"
        resp = requests.delete(url, headers=self._auth_headers(), timeout=20)
        resp.raise_for_status()

    def delete_signature_request(self, signature_request_id: str, permanent_delete: bool = True) -> None:
        """Delete the signature request (permanent when supported) and log confirmation."""
        if self.mock_mode:
            logger.info("Mock delete_signature_request(%s, permanent=%s)", signature_request_id, permanent_delete)
            return

        base_url = f"{self.base_url}/signature_requests/{signature_request_id}"
        params = {"permanent_delete": "true"} if permanent_delete else {}
        try:
            resp = requests.delete(base_url, headers=self._auth_headers(), params=params, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as exc:  # pragma: no cover - network dependent
            logger.exception(
                "Failed to delete signature_request %s (permanent=%s): %s",
                signature_request_id,
                permanent_delete,
                getattr(exc.response, "text", exc),
            )
            raise

        # Vérification best-effort : la SR doit renvoyer 404 après suppression
        try:
            check = requests.get(base_url, headers=self._auth_headers(), timeout=15)
            if check.status_code == 404:
                logger.info("Yousign SR %s purge confirmee (404)", signature_request_id)
            else:
                logger.warning(
                    "Yousign SR %s purge check status=%s body=%s",
                    signature_request_id,
                    check.status_code,
                    check.text[:200],
                )
        except requests.RequestException as exc:  # pragma: no cover - best effort
            logger.warning("Yousign SR %s purge check failed: %s", signature_request_id, exc)
