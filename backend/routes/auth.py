"""Authentication routes.

This module defines the endpoints responsible for user authentication, tokens
and e-mail verification.
"""

from __future__ import annotations

import os
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy.orm import Session

import crud
import schemas
import models
from database import get_db
from services.email import send_verification_email


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    """Payload used when registering a new user."""

    email: EmailStr
    password: str = Field(min_length=8)
    password_confirm: str = Field(min_length=8)
    role: models.UserRole

    @model_validator(mode="after")
    def passwords_match(cls, values: "RegisterRequest") -> "RegisterRequest":
        if values.password != values.password_confirm:
            raise ValueError("Passwords do not match")
        return values


def _build_verification_link(token: str) -> str:
    base_url = os.getenv("APP_BASE_URL", "http://localhost:8000")
    if base_url.endswith("/"):
        base_url = base_url[:-1]
    query = urlencode({"token": token})
    return f"{base_url}/auth/verify-email?{query}"


@router.post("/login", response_model=schemas.Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> schemas.Token:
    """Authenticate a user and return access and refresh tokens."""
    user = crud.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not verified",
        )
    access_token = crud.create_access_token({"sub": str(user.id)})
    refresh_token = crud.create_refresh_token({"sub": str(user.id)})
    return schemas.Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=schemas.TokenRefresh)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> schemas.TokenRefresh:
    """Refresh an access token using a valid refresh token."""
    try:
        claims = crud.decode_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise ValueError("Not a refresh token")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    # Issue a new access token with the same subject
    new_access_token = crud.create_access_token({"sub": user_id})
    return schemas.TokenRefresh(access_token=new_access_token)


@router.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> schemas.User:
    """Create a new user account if the email is not already registered."""
    existing = crud.get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    try:
        user = crud.create_user(db, payload.email, payload.password, payload.role.value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    token = crud.create_email_verification_token(db, user)
    verification_link = _build_verification_link(token.token)
    send_verification_email(user.email, verification_link)

    return schemas.User.from_orm(user)


@router.get("/verify-email", response_model=schemas.Message)
def verify_email(token: str = Query(..., description="Token received by email"), db: Session = Depends(get_db)) -> schemas.Message:
    """Verify a user's email address."""
    try:
        crud.verify_email_token(db, token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return schemas.Message(detail="Adresse e-mail vérifiée avec succès.")
