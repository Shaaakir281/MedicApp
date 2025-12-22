from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user
from dossier import schemas
from dossier import service as dossier_service
from dossier import email_verification_service

router = APIRouter(prefix="/dossier", tags=["dossier"])


@router.get("/current", response_model=schemas.DossierResponse)
def read_current_dossier(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.DossierResponse:
    return dossier_service.get_dossier_current(db, current_user)


@router.put("/current", response_model=schemas.DossierResponse)
def save_current_dossier(
    payload: schemas.DossierPayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.DossierResponse:
    try:
        return dossier_service.save_dossier_current(db, payload, current_user)
    except dossier_service.InvalidPhoneNumber as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/{child_id}", response_model=schemas.DossierResponse)
def read_dossier(
    child_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.DossierResponse:
    return dossier_service.get_dossier(db, str(child_id), current_user)


@router.put("/{child_id}", response_model=schemas.DossierResponse)
def save_dossier(
    child_id: UUID,
    payload: schemas.DossierPayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.DossierResponse:
    try:
        return dossier_service.save_dossier(db, str(child_id), payload, current_user)
    except dossier_service.InvalidPhoneNumber as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post(
    "/guardians/{guardian_id}/phone-verification/send",
    response_model=schemas.SmsSendResponse,
)
def send_verification_code(
    guardian_id: UUID,
    payload: schemas.SmsSendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.SmsSendResponse:
    try:
        verification, ttl, cooldown = dossier_service.send_verification_code(
            db,
            str(guardian_id),
            current_user,
            phone_override=payload.phone_e164,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except dossier_service.InvalidPhoneNumber as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return schemas.SmsSendResponse(status=verification.status, expires_in_sec=ttl, cooldown_sec=cooldown)


@router.post(
    "/guardians/{guardian_id}/phone-verification/verify",
    response_model=schemas.SmsVerifyResponse,
)
def verify_code(
    guardian_id: UUID,
    payload: schemas.SmsVerifyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.SmsVerifyResponse:
    verification = dossier_service.verify_code(db, str(guardian_id), current_user, payload.code)
    return schemas.SmsVerifyResponse(
        verified=verification.status == dossier_service.VerificationStatus.verified.value,
        verified_at=verification.verified_at,
    )


@router.post(
    "/guardians/{guardian_id}/email-verification/send",
    response_model=schemas.EmailSendResponse,
)
def send_email_verification(
    guardian_id: UUID,
    payload: schemas.EmailSendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.EmailSendResponse:
    """Send email verification link to guardian."""
    verification, email = email_verification_service.send_email_verification(
        db,
        str(guardian_id),
        current_user,
        email_override=payload.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return schemas.EmailSendResponse(
        status=verification.status,
        email=email,
    )


@router.get(
    "/guardians/{guardian_id}/email-verification/verify",
    response_model=schemas.EmailVerifyResponse,
)
def verify_email_token(
    guardian_id: UUID,
    token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.EmailVerifyResponse:
    """Verify guardian email using token from email link."""
    verification = email_verification_service.verify_email_token(
        db,
        str(guardian_id),
        token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return schemas.EmailVerifyResponse(
        verified=True,
        verified_at=verification.consumed_at,
    )
