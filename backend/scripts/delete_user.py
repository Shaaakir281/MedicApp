"""Delete a user by email from the configured database."""
from __future__ import annotations

import argparse

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from database import SessionLocal


def _cleanup_legal_links(db: Session, appointment_ids: list[int]) -> None:
    if not appointment_ids:
        return
    db.query(models.LegalAcknowledgement).filter(
        models.LegalAcknowledgement.appointment_id.in_(appointment_ids)
    ).delete(synchronize_session=False)
    db.query(models.SignatureCabinetSession).filter(
        models.SignatureCabinetSession.appointment_id.in_(appointment_ids)
    ).delete(synchronize_session=False)


def delete_user_by_email(email: str) -> int:
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            return 1
        appointment_ids = [
            row[0]
            for row in db.query(models.Appointment.id)
            .filter(models.Appointment.user_id == user.id)
            .all()
        ]
        _cleanup_legal_links(db, appointment_ids)
        db.delete(user)
        db.commit()
        return 0
    except IntegrityError:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Delete a user by email.")
    parser.add_argument("--email", required=True, help="User email to delete.")
    args = parser.parse_args()

    try:
        status = delete_user_by_email(args.email)
    except IntegrityError:
        print(f"[delete] blocked by constraints for: {args.email}")
        raise SystemExit(2)

    if status == 0:
        print(f"[delete] ok: {args.email}")
    else:
        print(f"[delete] not found: {args.email}")


if __name__ == "__main__":
    main()
