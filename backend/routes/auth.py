"""Authentication routes.

This module defines the endpoints responsible for user authentication and
token refresh. It uses JWT tokens for stateless authentication. In this
skeleton the login endpoint accepts an email and password and returns an
access and refresh token if the credentials are valid. The refresh
endpoint expects a refresh token in the request body and issues a new
access token if the refresh token is valid.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Body
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login", response_model=schemas.Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> schemas.Token:
    """Authenticate a user and return access and refresh tokens."""
    user = crud.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
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