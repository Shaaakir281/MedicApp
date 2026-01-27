"""PDF encryption helpers backed by Azure Key Vault."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from azure.core.exceptions import AzureError

from core.key_vault import get_key_vault_client, KeyVaultError

logger = logging.getLogger(__name__)


@dataclass
class EncryptionService:
    """Encrypt/decrypt PDF bytes using Fernet (AES-256 under the hood)."""

    key: Optional[bytes] = None

    def __post_init__(self) -> None:
        if self.key is None:
            self.key = self._load_key()
        self._fernet = Fernet(self.key)

    @staticmethod
    def generate_key() -> str:
        """Generate a new Fernet key string."""
        return Fernet.generate_key().decode("utf-8")

    def encrypt_pdf(self, pdf_bytes: bytes) -> bytes:
        """Encrypt raw PDF bytes."""
        if not isinstance(pdf_bytes, (bytes, bytearray)):
            raise TypeError("pdf_bytes must be bytes.")
        return self._fernet.encrypt(bytes(pdf_bytes))

    def decrypt_pdf(self, encrypted_bytes: bytes) -> bytes:
        """Decrypt encrypted PDF bytes."""
        if not isinstance(encrypted_bytes, (bytes, bytearray)):
            raise TypeError("encrypted_bytes must be bytes.")
        try:
            return self._fernet.decrypt(bytes(encrypted_bytes))
        except InvalidToken as exc:
            raise InvalidToken("Invalid encryption token.") from exc

    def _load_key(self) -> bytes:
        """Load the encryption key from Azure Key Vault."""
        secret_name = "pdf-encryption-key"
        try:
            value = get_key_vault_client().get_secret(secret_name)
            return value.encode("utf-8")
        except KeyVaultError:
            raise
        except AzureError as exc:
            logger.exception("Failed to read Key Vault secret %s", secret_name)
            raise KeyVaultError("Unable to read Key Vault secret.") from exc
