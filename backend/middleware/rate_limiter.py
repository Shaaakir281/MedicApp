"""Rate limiting helpers for authentication endpoints."""

from __future__ import annotations

import os
from typing import Optional

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse

from services import auth_service


def _storage_uri() -> str:
    return os.getenv("REDIS_URL") or "memory://"


limiter = Limiter(key_func=get_remote_address, storage_uri=_storage_uri())


def user_key_func(request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            claims = auth_service.decode_token(token)
        except auth_service.InvalidCredentialsError:
            return get_remote_address(request)
        subject = claims.get("sub")
        if subject:
            return f"user:{subject}"
    return get_remote_address(request)


def rate_limit_exceeded_handler(request, exc: RateLimitExceeded):
    retry_after: Optional[int] = None
    reset_in = getattr(exc, "reset_in", None)
    if reset_in is not None:
        try:
            retry_after = int(reset_in)
        except (TypeError, ValueError):
            retry_after = None

    payload = {"detail": "Too many requests."}
    if retry_after is not None:
        payload["retry_after"] = retry_after

    response = JSONResponse(payload, status_code=429)
    if retry_after is not None:
        response.headers["Retry-After"] = str(retry_after)
    return response


def configure_rate_limiter(app) -> None:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
