import datetime

import models
from core import security
from services import pdf


class DummyStorage:
    supports_presigned_urls = False

    def __init__(self):
        self.saved = set()

    def save_pdf(self, category, filename, data):
        self.saved.add((category, filename))
        return filename

    def exists(self, category, identifier):
        return (category, identifier) in self.saved

    def build_file_response(self, category, identifier, download_name, *, inline=False):
        raise RuntimeError("Not implemented for tests")

    def generate_presigned_url(self, category, identifier, *, download_name, expires_in_seconds=600, inline=False):
        raise RuntimeError("Not implemented for tests")


def test_prescription_regenerated_when_missing_file(client, db_session, monkeypatch):
    storage = DummyStorage()

    # Force storage to use the in-memory dummy backend
    monkeypatch.setattr("services.storage.get_storage_backend", lambda: storage)
    monkeypatch.setattr("routes.prescriptions.get_storage_backend", lambda: storage)

    filenames = iter(["first.pdf", "second.pdf"])

    def fake_generate_ordonnance(_context):
        filename = next(filenames)
        storage.save_pdf(pdf.ORDONNANCE_CATEGORY, filename, b"dummy")
        return filename

    monkeypatch.setattr("services.pdf.generate_ordonnance_pdf", fake_generate_ordonnance)
    monkeypatch.setattr("routes.prescriptions.generate_ordonnance_pdf", fake_generate_ordonnance)

    practitioner = models.User(
        email="doc@example.com",
        hashed_password=security.hash_password("passpasspass"),
        role=models.UserRole.praticien,
        email_verified=True,
    )
    patient = models.User(
        email="patient@example.com",
        hashed_password=security.hash_password("passpasspass"),
        role=models.UserRole.patient,
        email_verified=True,
    )
    db_session.add_all([practitioner, patient])
    db_session.flush()

    appointment = models.Appointment(
        user_id=patient.id,
        date=datetime.date.today(),
        time=datetime.time(hour=10, minute=0),
        appointment_type=models.AppointmentType.general,
    )
    db_session.add(appointment)
    db_session.commit()

    token = security.create_access_token(str(practitioner.id))
    headers = {"Authorization": f"Bearer {token}"}

    # First call generates the prescription
    resp1 = client.post(f"/prescriptions/{appointment.id}", headers=headers)
    assert resp1.status_code == 200
    db_session.refresh(appointment)
    pres = appointment.prescription
    assert pres.pdf_path == "first.pdf"
    assert (pdf.ORDONNANCE_CATEGORY, "first.pdf") in storage.saved

    # Simulate missing file on disk and ensure regeneration happens
    storage.saved.clear()
    resp2 = client.post(f"/prescriptions/{appointment.id}", headers=headers)
    assert resp2.status_code == 200
    db_session.refresh(appointment)
    pres = appointment.prescription
    assert pres.pdf_path == "second.pdf"
    assert (pdf.ORDONNANCE_CATEGORY, "second.pdf") in storage.saved
