"""Azure Key Vault helper with caching."""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
import time
from typing import Dict, Optional

from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from azure.core.exceptions import AzureError

from core.config import get_settings

logger = logging.getLogger(__name__)


class KeyVaultError(RuntimeError):
    """Raised when Key Vault access fails."""


@dataclass
class _CacheEntry:
    value: str
    expires_at: float


@dataclass
class KeyVaultClient:
    """Singleton Key Vault client with TTL cache."""

    _client: Optional[SecretClient] = None
    _cache: Dict[str, _CacheEntry] = field(default_factory=dict)
    _ttl_seconds: int = 3600

    def _get_client(self) -> SecretClient:
        if self._client is not None:
            return self._client
        vault_uri = get_settings().azure_key_vault_uri
        if not vault_uri:
            raise KeyVaultError("AZURE_KEY_VAULT_URI is not configured.")
        credential = DefaultAzureCredential()
        self._client = SecretClient(vault_url=vault_uri, credential=credential)
        return self._client

    def get_secret(self, name: str) -> str:
        now = time.time()
        cached = self._cache.get(name)
        if cached and cached.expires_at > now:
            return cached.value

        last_error: Optional[Exception] = None
        for attempt in range(3):
            try:
                secret = self._get_client().get_secret(name)
                if not secret or not secret.value:
                    raise KeyVaultError(f"Secret '{name}' is missing.")
                value = secret.value
                self._cache[name] = _CacheEntry(value=value, expires_at=now + self._ttl_seconds)
                return value
            except AzureError as exc:
                last_error = exc
                logger.warning("Key Vault error reading %s (attempt %d/3)", name, attempt + 1)
                time.sleep(0.5 * (attempt + 1))

        raise KeyVaultError(f"Unable to read secret '{name}'.") from last_error


_singleton: Optional[KeyVaultClient] = None


def get_key_vault_client() -> KeyVaultClient:
    """Return a singleton KeyVaultClient."""
    global _singleton
    if _singleton is None:
        _singleton = KeyVaultClient()
    return _singleton
