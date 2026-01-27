"""PDF encryption helpers backed by Azure Key Vault."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from azure.core.exceptions import AzureError

from core.config import get_settings

logger = logging.getLogger(__name__)


class KeyVaultError(RuntimeError):
    """Raised when Key Vault access fails."""


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
        settings = get_settings()
        vault_uri = settings.azure_key_vault_uri
        if not vault_uri:
            raise KeyVaultError("AZURE_KEY_VAULT_URI is not configured.")

        secret_name = "pdf-encryption-key"
        try:
            credential = DefaultAzureCredential()
            client = SecretClient(vault_url=vault_uri, credential=credential)
            secret = client.get_secret(secret_name)
            if not secret or not secret.value:
                raise KeyVaultError("Secret pdf-encryption-key is missing or empty.")
            return secret.value.encode("utf-8")
        except AzureError as exc:
            logger.exception("Failed to read Key Vault secret %s", secret_name)
            raise KeyVaultError("Unable to read Key Vault secret.") from exc
