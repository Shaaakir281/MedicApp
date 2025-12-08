from services import consents, consent_pdf


class DummyCase:
    def __init__(self, case_id: int, procedure_id: str | None):
        self.id = case_id
        self.yousign_procedure_id = procedure_id


def test_download_and_store_artifacts(monkeypatch):
    """Ensure we store signed/evidence PDFs when URLs are provided and client is not mock."""
    calls = {}

    class DummyClient:
        def __init__(self):
            self.mock_mode = False

        def download_with_auth(self, url: str) -> bytes:
            calls.setdefault("download_urls", []).append(url)
            return b"pdf-bytes"

        def download_signed_documents(self, signature_request_id: str) -> bytes:
            calls["download_default"] = signature_request_id
            return b"default-pdf"

    monkeypatch.setattr(consents, "YousignClient", DummyClient)

    def fake_store_signed(data: bytes, prefix: str) -> str:
        calls["store_signed"] = data
        return f"signed-{prefix}"

    def fake_store_evidence(data: bytes, prefix: str) -> str:
        calls["store_evidence"] = data
        return f"evidence-{prefix}"

    monkeypatch.setattr(consent_pdf, "store_signed_pdf", fake_store_signed)
    monkeypatch.setattr(consent_pdf, "store_evidence_pdf", fake_store_evidence)

    case = DummyCase(case_id=42, procedure_id="sr-abc")
    signed_id, evidence_id = consents._download_and_store_artifacts(
        case, signed_url="https://signed", evidence_url="https://evidence"
    )

    assert signed_id == "signed-42"
    assert evidence_id == "evidence-42"
    assert calls["store_signed"] == b"pdf-bytes"
    assert calls["store_evidence"] == b"pdf-bytes"
    assert calls["download_urls"] == ["https://signed", "https://evidence"]
