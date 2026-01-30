"""Authentication-related dependencies for FastAPI routes."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import models
from database import get_db
from core.config import get_settings
from services import auth_service


bearer_scheme = HTTPBearer(auto_error=False)


def _resolve_user(
    *,
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
    allow_mfa_required: bool,
) -> models.User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    token = credentials.credentials
    try:
        claims = auth_service.decode_token(token)
    except auth_service.InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload.",
        )

    user = auth_service.get_user_by_id(db, int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    if user.email and user.email.startswith("deleted+"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account deleted.",
        )
    if user.role == models.UserRole.patient and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not verified for patient account.",
        )

    settings = get_settings()
    if (
        not allow_mfa_required
        and settings.require_mfa_practitioner
        and user.role == models.UserRole.praticien
        and claims.get("mfa_verified") is not True
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA required.",
        )

    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    return _resolve_user(credentials=credentials, db=db, allow_mfa_required=False)


def get_current_user_allow_mfa(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    return _resolve_user(credentials=credentials, db=db, allow_mfa_required=True)


def require_practitioner(
    user: models.User = Depends(get_current_user),
) -> models.User:
    """Ensure the authenticated user has practitioner privileges."""
    if user.role != models.UserRole.praticien:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces reserve aux praticiens.",
        )
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User | None:
    """Return the current user if a Bearer token is provided, otherwise None."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    return _resolve_user(credentials=credentials, db=db, allow_mfa_required=False)
