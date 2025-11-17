"""Repository helpers for ``models.User``."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

import models


def get_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def get_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def create(
    db: Session,
    *,
    email: str,
    hashed_password: str,
    role: models.UserRole,
    email_verified: bool = False,
) -> models.User:
    user = models.User(
        email=email,
        hashed_password=hashed_password,
        role=role,
        email_verified=email_verified,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
