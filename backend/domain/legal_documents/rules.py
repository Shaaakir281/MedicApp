from __future__ import annotations

import datetime as dt
from typing import Iterable, Tuple

from .catalog_v1 import LEGAL_CATALOG
from .types import DocumentType, SignerRole


def required_roles_for_document(
    document_type: DocumentType,
    *,
    has_parent2: bool = True,
    extra_roles: Iterable[SignerRole] | None = None,
) -> Tuple[SignerRole, ...]:
    """Return the expected signer roles for a document given the context."""
    document = LEGAL_CATALOG[document_type]
    roles: list[SignerRole] = []
    for case in document.cases:
        for role in case.required_roles:
            if role == SignerRole.parent2 and not has_parent2:
                continue
            if role not in roles:
                roles.append(role)
    if extra_roles:
        for role in extra_roles:
            if role not in roles:
                roles.append(role)
    return tuple(roles)


def signature_delay_allowed(open_at: dt.date | None, *, enforce: bool = False) -> tuple[bool, str | None]:
    """Optional policy: delay before opening signature (J+15)."""
    if open_at and open_at > dt.date.today():
        reason = f"Signature disponible à partir du {open_at.isoformat()}"
        return (not enforce, reason)
    return True, None
