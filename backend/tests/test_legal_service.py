import datetime as dt

import models
import schemas
from domain.legal_documents import LEGAL_CATALOG
from domain.legal_documents.types import SignerRole
from services import legal as legal_service


def _create_appointment_with_case(db_session):
    user = models.User(
        email="patient@example.com",
        hashed_password="hashed",
        role=models.UserRole.patient,
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    case = models.ProcedureCase(
        patient_id=user.id,
        child_full_name="Test Enfant",
        child_birthdate=dt.date(2020, 1, 1),
        parent1_name="Parent1",
        parent1_email="p1@example.com",
        parent2_name="Parent2",
        parent2_email="p2@example.com",
        parental_authority_ack=True,
        procedure_type=models.ProcedureType.circumcision,
    )
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)

    appt = models.Appointment(
        user_id=user.id,
        date=dt.date.today(),
        time=dt.time(10, 0),
        appointment_type=models.AppointmentType.act,
        mode=models.AppointmentMode.presentiel,
        procedure_id=case.id,
    )
    db_session.add(appt)
    db_session.commit()
    db_session.refresh(appt)
    return appt


def _build_acknowledgements_for_role(role: SignerRole):
    acknowledgements: list[schemas.LegalAcknowledgeInput] = []
    for doc in LEGAL_CATALOG.values():
        for case in doc.cases:
            if role in case.required_roles:
                acknowledgements.append(
                    schemas.LegalAcknowledgeInput(
                        document_type=doc.type,
                        case_key=case.key,
                    )
                )
    return acknowledgements


def test_compute_status_requires_all_documents(db_session):
    appt = _create_appointment_with_case(db_session)
    status = legal_service.compute_status(db_session, appt.id)
    assert status.complete is False

    # Ack parent1 only -> still incomplete because parent2 missing.
    legal_service.acknowledge_bulk(
        db_session,
        schemas.LegalAcknowledgeBulkInput(
            appointment_id=appt.id,
            signer_role=SignerRole.parent1,
            acknowledgements=_build_acknowledgements_for_role(SignerRole.parent1),
            source="remote",
        ),
        ip=None,
        user_agent=None,
    )
    status_parent1 = legal_service.compute_status(db_session, appt.id)
    assert status_parent1.complete is False

    legal_service.acknowledge_bulk(
        db_session,
        schemas.LegalAcknowledgeBulkInput(
            appointment_id=appt.id,
            signer_role=SignerRole.parent2,
            acknowledgements=_build_acknowledgements_for_role(SignerRole.parent2),
            source="remote",
        ),
        ip=None,
        user_agent=None,
    )
    status_complete = legal_service.compute_status(db_session, appt.id)
    assert status_complete.complete is True


def test_cabinet_session_expires(db_session):
    appt = _create_appointment_with_case(db_session)
    session, code = legal_service.create_cabinet_session(
        db_session,
        appointment_id=appt.id,
        signer_role=SignerRole.parent1,
        practitioner_id=None,
        ttl_minutes=1,
    )
    assert session.token_hash

    # Force expiration and ensure retrieval returns None.
    session.expires_at = dt.datetime.utcnow() - dt.timedelta(minutes=2)
    db_session.add(session)
    db_session.commit()
    assert legal_service.get_active_session(db_session, code) is None
