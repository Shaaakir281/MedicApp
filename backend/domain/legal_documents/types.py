from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Tuple


class DocumentType(str, Enum):
    SURGICAL_AUTHORIZATION_MINOR = "surgical_authorization_minor"
    INFORMED_CONSENT = "informed_consent"
    FEES_CONSENT_QUOTE = "fees_consent_quote"


class SignerRole(str, Enum):
    parent1 = "parent1"
    parent2 = "parent2"
    other_guardian = "other_guardian"


@dataclass(frozen=True)
class LegalDocumentCase:
    """Single acknowledgement checkbox definition."""

    key: str
    text: str
    required: bool = True
    required_roles: Tuple[SignerRole, ...] = (SignerRole.parent1, SignerRole.parent2)


@dataclass(frozen=True)
class LegalDocumentDefinition:
    """Definition of a legal document and its acknowledgement cases."""

    type: DocumentType
    title: str
    version: str
    cases: Tuple[LegalDocumentCase, ...]
