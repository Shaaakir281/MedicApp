"""Lightweight Yousign client wrapper (with mock mode by default).

The real API call still needs to be wired with proper endpoints and file upload.
For now, when no API key is configured, a mock procedure is returned so that
the rest of the consent workflow can be exercised end-to-end.
"""

from __future__ import annotations

import logging
import uuid
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
        if not self.mock_mode:
            if not self.api_key:
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

    def create_procedure(self, signers: List[dict], name: str = "Consentement") -> YousignProcedure:
        """Create a Yousign procedure for the provided signers.

        NOTE: This is a thin placeholder. The actual Yousign v3 payload (files, members,
        signature level OTP SMS, redirect URLs) must be filled in before production use.
        """
        if self.mock_mode:
            return self.create_mock_procedure(signers)

        payload = {"name": name, "signers": signers}
        try:
            response = requests.post(f"{self.base_url}/procedures", json=payload, headers=self._headers(), timeout=20)
            response.raise_for_status()
        except requests.RequestException as exc:  # pragma: no cover - network
            logger.exception("Failed to create Yousign procedure")
            raise YousignConfigurationError(str(exc)) from exc

        data = response.json()
        procedure_id = data.get("id") or data.get("procedure_id") or ""
        signer_links = []
        for signer in data.get("signers", []):
            signer_links.append(
                YousignSigner(
                    signer_id=str(signer.get("id")),
                    signature_link=signer.get("signature_link") or signer.get("url") or "",
                    email=signer.get("email"),
                    phone=signer.get("phone"),
                )
            )
        return YousignProcedure(
            procedure_id=procedure_id or f"unknown-{uuid.uuid4().hex}",
            signers=signer_links,
            evidence_url=data.get("evidence_file"),
            signed_file_url=data.get("signed_file"),
        )
