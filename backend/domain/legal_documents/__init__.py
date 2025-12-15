"""Versioned legal document catalogue and rules."""

from .types import DocumentType, LegalDocumentCase, LegalDocumentDefinition, SignerRole  # noqa: F401
from .catalog_v1 import CATALOG_VERSION, LEGAL_CATALOG  # noqa: F401
from .rules import required_roles_for_document, signature_delay_allowed  # noqa: F401

__all__ = [
    "DocumentType",
    "SignerRole",
    "LegalDocumentCase",
    "LegalDocumentDefinition",
    "CATALOG_VERSION",
    "LEGAL_CATALOG",
    "required_roles_for_document",
    "signature_delay_allowed",
]
