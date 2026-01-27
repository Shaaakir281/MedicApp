"""Abstraction layer for storing and serving generated PDF documents."""

from __future__ import annotations

from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from fastapi.responses import FileResponse, Response, StreamingResponse
from core.config import get_settings
from services.encryption import EncryptionService, KeyVaultError


class StorageError(RuntimeError):
    """Raised when a stored document cannot be accessed."""


_encryption_service: EncryptionService | None = None


def _get_encryption_service() -> EncryptionService:
    global _encryption_service
    if _encryption_service is None:
        try:
            _encryption_service = EncryptionService()
        except KeyVaultError as exc:
            raise StorageError("Encryption service unavailable.") from exc
    return _encryption_service


class StorageBackend(Protocol):
    """Protocol implemented by storage backends."""

    @property
    def supports_presigned_urls(self) -> bool: ...

    def save_pdf(self, category: str, filename: str, data: bytes) -> str:
        """Persist ``data`` inside ``category`` and return the stored identifier."""

    def exists(self, category: str, identifier: str) -> bool:
        """Return True if the document is available."""

    def build_file_response(
        self,
        category: str,
        identifier: str,
        download_name: str,
        *,
        inline: bool = False,
    ) -> Response:
        """Return a streaming HTTP response for the stored document."""

    def generate_presigned_url(
        self,
        category: str,
        identifier: str,
        *,
        download_name: str,
        expires_in_seconds: int = 600,
        inline: bool = False,
    ) -> str:
        """Return a temporary URL pointing to the stored PDF."""

    def get_local_path(self, category: str, identifier: str) -> Path:
        """Return a local filesystem path for the document when available (may raise StorageError)."""


class LocalStorageBackend:
    """Store files on the local filesystem (default development mode)."""

    def __init__(self, root: Path) -> None:
        self.root = root

    @property
    def supports_presigned_urls(self) -> bool:
        return False

    def _dir(self, category: str) -> Path:
        path = self.root / category
        path.mkdir(parents=True, exist_ok=True)
        return path

    def save_pdf(self, category: str, filename: str, data: bytes) -> str:
        path = self._dir(category) / filename
        path.write_bytes(data)
        return filename

    def exists(self, category: str, identifier: str) -> bool:
        if not identifier:
            return False
        return (self._dir(category) / identifier).exists()

    def build_file_response(
        self,
        category: str,
        identifier: str,
        download_name: str,
        *,
        inline: bool = False,
    ) -> Response:
        path = self._dir(category) / identifier
        if not path.exists():
            raise StorageError(f"Document {identifier} not found in {category}")
        response = FileResponse(path, media_type="application/pdf", filename=download_name)
        if inline:
            response.headers["Content-Disposition"] = f'inline; filename="{download_name}"'
        return response

    def generate_presigned_url(
        self,
        category: str,
        identifier: str,
        *,
        download_name: str,
        expires_in_seconds: int = 600,
        inline: bool = False,
    ) -> str:
        raise StorageError("Presigned URLs are not supported with local storage.")

    def get_local_path(self, category: str, identifier: str) -> Path:
        path = self._dir(category) / identifier
        if not path.exists():
            raise StorageError(f"Document {identifier} not found in {category}")
        return path.resolve()


class AzureBlobStorageBackend:
    """Upload files to Azure Blob Storage and stream them on demand."""

    def __init__(self, connection_string: str, container: str) -> None:
        from azure.core.exceptions import ResourceExistsError  # lazy import
        from azure.storage.blob import BlobServiceClient

        self._BlobServiceClient = BlobServiceClient
        self._connection_string = connection_string
        self._container_name = container
        self._client = BlobServiceClient.from_connection_string(connection_string)
        self._container = self._client.get_container_client(container)
        self._account_name, self._account_key = _parse_connection_string(connection_string)
        try:
            self._container.create_container()
        except ResourceExistsError:
            pass

    @property
    def supports_presigned_urls(self) -> bool:
        return bool(self._account_key)

    def _blob_name(self, category: str, filename: str) -> str:
        return f"{category}/{filename}"

    def save_pdf(self, category: str, filename: str, data: bytes) -> str:
        from azure.storage.blob import ContentSettings

        enc_service = _get_encryption_service()
        encrypted = enc_service.encrypt_pdf(data)
        encrypted_name = f"{filename}.enc" if not filename.endswith(".enc") else filename
        self._container.upload_blob(
            name=self._blob_name(category, encrypted_name),
            data=encrypted,
            overwrite=True,
            content_settings=ContentSettings(content_type="application/pdf"),
            metadata={"encrypted": "true"},
        )
        return encrypted_name

    def exists(self, category: str, identifier: str) -> bool:
        if not identifier:
            return False
        blob = self._container.get_blob_client(self._blob_name(category, identifier))
        return blob.exists()

    def build_file_response(
        self,
        category: str,
        identifier: str,
        download_name: str,
    *,
    inline: bool = False,
    ) -> Response:
        from azure.core.exceptions import ResourceNotFoundError

        blob_name = self._blob_name(category, identifier)
        blob = self._container.get_blob_client(blob_name)
        try:
            props = blob.get_blob_properties()
            encrypted = (props.metadata or {}).get("encrypted") == "true"
            downloader = blob.download_blob()
        except ResourceNotFoundError as exc:  # pragma: no cover - network error
            raise StorageError(f"Blob {blob_name} is missing") from exc
        if encrypted:
            enc_service = _get_encryption_service()
            data = downloader.readall()
            data = enc_service.decrypt_pdf(data)
            response = Response(content=data, media_type="application/pdf")
        else:
            response = StreamingResponse(downloader.chunks(), media_type="application/pdf")
        disposition = "inline" if inline else "attachment"
        response.headers["Content-Disposition"] = f'{disposition}; filename="{download_name}"'
        return response

    def generate_presigned_url(
        self,
        category: str,
        identifier: str,
        *,
        download_name: str,
        expires_in_seconds: int = 600,
        inline: bool = False,
    ) -> str:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas

        if not self.supports_presigned_urls:
            raise StorageError("Azure Blob presigned URLs require an account key.")

        blob_name = self._blob_name(category, identifier)
        blob = self._container.get_blob_client(blob_name)
        props = blob.get_blob_properties()
        if (props.metadata or {}).get("encrypted") == "true":
            raise StorageError("Encrypted blobs require server-side streaming.")
        expiry = datetime.utcnow() + timedelta(seconds=expires_in_seconds)
        disposition = "inline" if inline else "attachment"
        sas = generate_blob_sas(
            account_name=self._account_name,
            container_name=self._container_name,
            blob_name=blob_name,
            account_key=self._account_key,
            permission=BlobSasPermissions(read=True),
            expiry=expiry,
            content_disposition=f'{disposition}; filename="{download_name}"',
            content_type="application/pdf",
        )
        return f"{self._container.url}/{blob_name}?{sas}"

    def get_local_path(self, category: str, identifier: str) -> Path:
        import tempfile
        import uuid
        from azure.core.exceptions import ResourceNotFoundError

        if not identifier:
            raise StorageError("Missing identifier for Azure blob.")
        blob_name = self._blob_name(category, identifier)
        blob = self._container.get_blob_client(blob_name)
        try:
            props = blob.get_blob_properties()
            encrypted = (props.metadata or {}).get("encrypted") == "true"
            downloader = blob.download_blob()
            data = downloader.readall()
        except ResourceNotFoundError as exc:
            raise StorageError(f"Blob {blob_name} is missing") from exc
        if encrypted:
            enc_service = _get_encryption_service()
            data = enc_service.decrypt_pdf(data)

        temp_dir = Path(tempfile.mkdtemp(prefix="medicapp-blob-"))
        filename = f"{uuid.uuid4().hex}.pdf"
        path = temp_dir / filename
        path.write_bytes(data)
        return path


def _default_local_root() -> Path:
    base_dir = Path(__file__).resolve().parent.parent
    return base_dir / "storage"


def _parse_connection_string(connection_string: str) -> tuple[str | None, str | None]:
    parts: dict[str, str] = {}
    for segment in connection_string.split(";"):
        if not segment:
            continue
        if "=" not in segment:
            continue
        key, value = segment.split("=", 1)
        parts[key] = value
    return parts.get("AccountName"), parts.get("AccountKey")


@lru_cache(maxsize=1)
def get_storage_backend() -> StorageBackend:
    """Instantiate the configured storage backend."""
    settings = get_settings()
    if settings.storage_backend == "azure":
        if not settings.azure_blob_connection_string or not settings.azure_blob_container:
            raise StorageError("Azure storage selected but configuration is incomplete.")
        return AzureBlobStorageBackend(
            settings.azure_blob_connection_string,
            settings.azure_blob_container,
        )

    # Default to local filesystem
    default_root = _default_local_root()
    configured = settings.storage_local_path
    if configured:
        candidate = Path(configured)
        root = candidate if candidate.is_absolute() else (default_root.parent / candidate)
    else:
        root = default_root
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return LocalStorageBackend(root)
