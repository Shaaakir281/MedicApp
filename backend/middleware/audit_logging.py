"""Audit logging middleware for sensitive document access."""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

from fastapi import Request

from core import security

logger = logging.getLogger("audit")

_SENSITIVE_PATHS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^/prescriptions/access/[^/]+"), "/prescriptions/access/<token>"),
    (re.compile(r"^/prescriptions/versions/access/[^/]+"), "/prescriptions/versions/access/<token>"),
    (re.compile(r"^/procedures/[^/]+/documents/[^/]+"), "/procedures/<token>/documents/<doc>"),
    (re.compile(r"^/signature/document/\\d+/file/[^/]+"), "/signature/document/<id>/file/<kind>"),
    (re.compile(r"^/signature/case/\\d+/document/[^/]+/preview"), "/signature/case/<id>/document/<doc>/preview"),
]

_SAFE_QUERY_KEYS = {"inline", "mode", "kind", "actor", "channel"}


def _match_sensitive_path(path: str) -> Optional[str]:
    for pattern, replacement in _SENSITIVE_PATHS:
        if pattern.match(path):
            return replacement
    return None


def _extract_user_id(request: Request) -> Optional[str]:
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        claims = security.decode_token(token)
    except security.TokenDecodeError:
        return None
    return str(claims.get("sub")) if claims.get("sub") else None


def _safe_query_params(request: Request) -> dict[str, str]:
    return {key: value for key, value in request.query_params.items() if key in _SAFE_QUERY_KEYS}


async def audit_logging_middleware(request: Request, call_next):
    if request.method != "GET":
        return await call_next(request)

    redacted_path = _match_sensitive_path(request.url.path)
    if not redacted_path:
        return await call_next(request)

    user_id = _extract_user_id(request)
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        logger.info(
            json.dumps(
                {
                    "event": "sensitive_document_access",
                    "method": request.method,
                    "path": redacted_path,
                    "query": _safe_query_params(request),
                    "status_code": status_code,
                    "user_id": user_id,
                    "ip": ip_address,
                    "user_agent": user_agent,
                }
            )
        )
