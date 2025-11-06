"""Repository helpers for email verification tokens."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

import models


def invalidate_pending_tokens(db: Session, user_id: int) -> None:
    """Mark every pending token for ``user_id`` as consumed."""
    db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.user_id == user_id,
        models.EmailVerificationToken.consumed_at.is_(None),
    ).update(
        {models.EmailVerificationToken.consumed_at: datetime.utcnow()},
        synchronize_session=False,
    )


def create(
    db: Session,
    *,
    user_id: int,
    token_value: str,
    expires_at: datetime,
) -> models.EmailVerificationToken:
    token = models.EmailVerificationToken(
        user_id=user_id,
        token=token_value,
        expires_at=expires_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def get_by_token(
    db: Session,
    token_value: str,
) -> Optional[models.EmailVerificationToken]:
    return (
        db.query(models.EmailVerificationToken)
        .filter(models.EmailVerificationToken.token == token_value)
        .first()
    )


def save(db: Session, token: models.EmailVerificationToken) -> None:
    db.add(token)
    db.commit()

