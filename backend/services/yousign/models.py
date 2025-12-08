"""Lightweight dataclasses for the Yousign integration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class YousignSigner:
    signer_id: str
    signature_link: str
    email: Optional[str] = None
    phone: Optional[str] = None


@dataclass
class EvidenceLinks:
    """Container for audit/signed document references."""

    evidence_url: Optional[str] = None
    signed_file_url: Optional[str] = None


@dataclass
class YousignProcedure:
    procedure_id: str
    document_id: Optional[str]
    signers: List[YousignSigner]
    evidence_url: Optional[str] = None
    signed_file_url: Optional[str] = None
