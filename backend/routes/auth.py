"""Authentication routes.

This module defines the endpoints responsible for user authentication, tokens
and e-mail verification.
"""

from urllib.parse import urlencode
from datetime import datetime, timedelta
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy.orm import Session

import schemas
import models
from database import get_db
from core.config import get_settings
from core import password_policy
from services import auth_service
from services.email import (
    send_verification_email,
    send_password_reset_email,
    send_account_locked_email,
)
from services.mfa_service import mfa_service
from dependencies.auth import get_current_user_allow_mfa
from middleware.rate_limiter import limiter, user_key_func


router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    phone: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=password_policy.MIN_LENGTH)
    new_password_confirm: str = Field(min_length=password_policy.MIN_LENGTH)

    @model_validator(mode="after")
    def passwords_match(cls, values: "ResetPasswordRequest") -> "ResetPasswordRequest":
        if values.new_password != values.new_password_confirm:
            raise ValueError("Passwords do not match")
        password_policy.validate_password_strength(values.new_password)
        return values


class RegisterRequest(BaseModel):
    """Payload used when registering a new user."""

    email: EmailStr
    password: str = Field(min_length=password_policy.MIN_LENGTH)
    password_confirm: str = Field(min_length=password_policy.MIN_LENGTH)
    role: models.UserRole

    @model_validator(mode="after")
    def passwords_match(cls, values: "RegisterRequest") -> "RegisterRequest":
        if values.password != values.password_confirm:
            raise ValueError("Passwords do not match")
        password_policy.validate_password_strength(values.password)
        return values


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class MFASendRequest(BaseModel):
    phone: str | None = None


class MFAVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


def _get_frontend_base_url() -> str:
    settings = get_settings()
    base_url = settings.frontend_base_url or settings.app_base_url
    return base_url.rstrip("/")


def _build_verification_link(token: str) -> str:
    base_url = get_settings().app_base_url.rstrip("/")
    query = urlencode({"token": token})
    return f"{base_url}/auth/verify-email?{query}"


def _build_password_reset_link(token: str) -> str:
    base_url = get_settings().app_base_url.rstrip("/")
    query = urlencode({"token": token})
    return f"{base_url}/auth/reset-password?{query}"


_LOCK_WINDOW = timedelta(minutes=15)
_LOCK_DURATION = timedelta(minutes=15)
_LOCK_THRESHOLD = 5


def _record_login_attempt(
    db: Session,
    *,
    user_id: int,
    ip: str | None,
    success: bool,
) -> None:
    attempt = models.LoginAttempt(
        user_id=user_id,
        ip=ip,
        success=success,
    )
    db.add(attempt)
    if success:
        cutoff = datetime.utcnow() - _LOCK_WINDOW
        db.query(models.LoginAttempt).filter(
            models.LoginAttempt.user_id == user_id,
            models.LoginAttempt.success.is_(False),
            models.LoginAttempt.created_at >= cutoff,
        ).delete(synchronize_session=False)
    db.commit()


def _recent_failure_count(db: Session, *, user_id: int) -> int:
    cutoff = datetime.utcnow() - _LOCK_WINDOW
    return (
        db.query(models.LoginAttempt)
        .filter(
            models.LoginAttempt.user_id == user_id,
            models.LoginAttempt.success.is_(False),
            models.LoginAttempt.created_at >= cutoff,
        )
        .count()
    )


def _get_lock_until(db: Session, *, user_id: int) -> datetime | None:
    cutoff = datetime.utcnow() - _LOCK_WINDOW
    latest_failures = (
        db.query(models.LoginAttempt)
        .filter(
            models.LoginAttempt.user_id == user_id,
            models.LoginAttempt.success.is_(False),
            models.LoginAttempt.created_at >= cutoff,
        )
        .order_by(models.LoginAttempt.created_at.desc())
        .limit(_LOCK_THRESHOLD)
        .all()
    )
    if len(latest_failures) < _LOCK_THRESHOLD:
        return None
    locked_until = latest_failures[0].created_at + _LOCK_DURATION
    return locked_until if locked_until > datetime.utcnow() else None


@router.post("/login", response_model=schemas.LoginResponse)
@limiter.limit("5/minute")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.LoginResponse:
    """Authenticate a user and return access and refresh tokens."""
    user = auth_service.get_user_by_email(db, payload.email)
    if user:
        locked_until = _get_lock_until(db, user_id=user.id)
        if locked_until:
            retry_after = int((locked_until - datetime.utcnow()).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail={"error": "Compte verrouille", "retry_after": retry_after},
            )
    try:
        user = auth_service.authenticate_user(db, payload.email, payload.password)
    except auth_service.InvalidCredentialsError:
        if user:
            _record_login_attempt(
                db,
                user_id=user.id,
                ip=request.client.host if request.client else None,
                success=False,
            )
            failure_count = _recent_failure_count(db, user_id=user.id)
            if failure_count >= _LOCK_THRESHOLD:
                send_account_locked_email(
                    user.email,
                    retry_after_minutes=int(_LOCK_DURATION.total_seconds() / 60),
                )
        logger.info(
            json.dumps(
                {
                    "event": "auth_login_failed",
                    "email": payload.email,
                    "reason": "invalid_credentials",
                    "ip": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                }
            )
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    _record_login_attempt(
        db,
        user_id=user.id,
        ip=request.client.host if request.client else None,
        success=True,
    )
    if user.role == models.UserRole.patient and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not verified",
        )
    settings = get_settings()
    if user.role == models.UserRole.praticien and settings.require_mfa_practitioner:
        from core import security

        temp_token = security.create_access_token(
            str(user.id),
            expires_delta=timedelta(minutes=10),
            claims={"mfa_required": True},
        )
        sms_sent = False
        if payload.phone:
            sms_sent = mfa_service.send_mfa_code(db, user.id, payload.phone)
        return schemas.LoginResponse(
            requires_mfa=True,
            temp_token=temp_token,
            expires_in=600,
            message="Code envoye." if sms_sent else "Verification MFA requise.",
        )

    tokens = auth_service.issue_tokens(user.id)
    logger.info(
        json.dumps(
            {
                "event": "auth_login_success",
                "user_id": user.id,
                "email": user.email,
                "role": user.role,
                "ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
            }
        )
    )
    return schemas.LoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type="bearer",
    )


@router.post("/mfa/send", response_model=schemas.MFASendResponse)
@limiter.limit("3/minute", key_func=user_key_func)
def send_mfa_code(
    payload: MFASendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_allow_mfa),
) -> schemas.MFASendResponse:
    if current_user.role != models.UserRole.praticien:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces reserve aux praticiens.",
        )

    phone = payload.phone or mfa_service.get_last_phone(db, current_user.id)
    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Numero de telephone requis.",
        )

    sent = mfa_service.send_mfa_code(db, current_user.id, phone)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Envoi SMS indisponible.",
        )

    return schemas.MFASendResponse(message="Code envoye", expires_in=300)


@router.post("/mfa/verify", response_model=schemas.Token)
@limiter.limit("5/minute", key_func=user_key_func)
def verify_mfa_code(
    payload: MFAVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_allow_mfa),
) -> schemas.Token:
    if current_user.role != models.UserRole.praticien:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces reserve aux praticiens.",
        )

    if not mfa_service.verify_code(db, current_user.id, payload.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Code MFA invalide ou expire.",
        )

    tokens = auth_service.issue_tokens(
        current_user.id,
        access_claims={"mfa_verified": True},
        refresh_claims={"mfa_verified": True},
    )
    return schemas.Token(access_token=tokens.access_token, refresh_token=tokens.refresh_token)


@router.post("/refresh", response_model=schemas.TokenRefresh)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> schemas.TokenRefresh:
    """Refresh an access token using a valid refresh token."""
    try:
        new_access_token = auth_service.refresh_access_token(payload.refresh_token)
    except auth_service.InvalidRefreshTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    return schemas.TokenRefresh(access_token=new_access_token)


@router.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> schemas.User:
    """Create a new user account if the email is not already registered."""
    try:
        user = auth_service.register_user(
            db,
            email=payload.email,
            password=payload.password,
            role=payload.role,
        )
    except auth_service.EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    if user.role == models.UserRole.patient:
        token = auth_service.create_email_verification_token(db, user)
        verification_link = _build_verification_link(token.token)
        send_verification_email(user.email, verification_link)

    return schemas.User.from_orm(user)


@router.get("/verify-email", response_model=schemas.Message)
def verify_email(token: str = Query(..., description="Token received by email"), db: Session = Depends(get_db)) -> schemas.Message:
    """Verify a user's email address."""
    try:
        auth_service.verify_email_token(db, token)
    except auth_service.InvalidVerificationTokenError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return schemas.Message(detail="Adresse e-mail verifiee avec succes.")


@router.post("/forgot-password", response_model=schemas.Message)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> schemas.Message:
    """Send a password reset link if the account exists."""
    user = auth_service.get_user_by_email(db, payload.email)
    if user:
        token = auth_service.create_password_reset_token(db, user)
        reset_link = _build_password_reset_link(token.token)
        send_password_reset_email(user.email, reset_link)
    return schemas.Message(detail="If an account exists, a reset email has been sent.")


@router.post("/reset-password", response_model=schemas.Message)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> schemas.Message:
    """Reset the password using a valid reset token."""
    try:
        auth_service.reset_password_with_token(db, payload.token, payload.new_password)
    except auth_service.InvalidPasswordResetTokenError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return schemas.Message(detail="Password updated successfully.")
