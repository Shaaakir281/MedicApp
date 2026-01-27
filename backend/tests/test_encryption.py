"""Tests for the encryption service."""

import pytest
from cryptography.fernet import InvalidToken

from services.encryption import EncryptionService


def test_encrypt_decrypt_roundtrip():
    key = EncryptionService.generate_key()
    service = EncryptionService(key=key.encode("utf-8"))
    payload = b"sample-pdf-content"
    encrypted = service.encrypt_pdf(payload)
    assert encrypted != payload
    decrypted = service.decrypt_pdf(encrypted)
    assert decrypted == payload


def test_encrypt_produces_different_output():
    key = EncryptionService.generate_key()
    service = EncryptionService(key=key.encode("utf-8"))
    payload = b"same-content"
    encrypted = service.encrypt_pdf(payload)
    assert encrypted != payload


def test_decrypt_invalid_data_raises():
    key = EncryptionService.generate_key()
    service = EncryptionService(key=key.encode("utf-8"))
    with pytest.raises(InvalidToken):
        service.decrypt_pdf(b"invalid")
