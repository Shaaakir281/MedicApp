"""Repository helpers for password reset tokens."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

import models


def invalidate_pending_tokens(db: Session, user_id: int) -> None:
    """Mark every pending reset token for ``user_id`` as consumed."""
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user_id,
        models.PasswordResetToken.consumed_at.is_(None),
    ).update(
        {models.PasswordResetToken.consumed_at: datetime.utcnow()},
        synchronize_session=False,
    )


def create(
    db: Session,
    *,
    user_id: int,
    token_value: str,
    expires_at: datetime,
) -> models.PasswordResetToken:
    token = models.PasswordResetToken(
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
) -> Optional[models.PasswordResetToken]:
    return (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token == token_value)
        .first()
    )


def save(db: Session, token: models.PasswordResetToken) -> None:
    db.add(token)
    db.commit()
