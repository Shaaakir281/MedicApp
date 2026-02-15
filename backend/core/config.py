"""Application configuration and settings management.

This module centralises the loading and validation of environment-based
configuration so security-sensitive defaults are caught early. It relies on
``pydantic-settings`` in order to parse environment variables (and optional
``.env`` files) into a strongly typed ``Settings`` object that can be reused
throughout the codebase.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class SMTPSettings(BaseModel):
    """Structured configuration for SMTP/Email settings."""

    host: Optional[str] = None
    port: int = 587
    username: Optional[str] = None
    password: Optional[str] = None
    use_tls: bool = True
    use_ssl: bool = False
    sender: Optional[str] = None

    @property
    def is_configured(self) -> bool:
        """Return True when a minimal SMTP configuration is available."""
        return bool(self.host and self.sender)


class Settings(BaseSettings):
    """Application-wide strongly typed settings."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = Field(default="development", alias="ENVIRONMENT")
    database_url: str = Field(..., alias="DATABASE_URL")
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY")
    access_token_expire_minutes: int = Field(default=15, alias="ACCESS_TOKEN_EXPIRE_MINUTES", ge=5)
    refresh_token_expire_days: int = Field(default=30, alias="REFRESH_TOKEN_EXPIRE_DAYS", ge=1)
    app_name: str = Field(default="MedicApp", alias="APP_NAME")
    app_base_url: str = Field(default="http://localhost:8000", alias="APP_BASE_URL")
    app_base_urls_raw: str | List[str] | None = Field(default=None, alias="APP_BASE_URLS")
    frontend_base_url: str = Field(default="http://localhost:5173", alias="FRONTEND_BASE_URL")
    frontend_base_urls_raw: str | List[str] | None = Field(default=None, alias="FRONTEND_BASE_URLS")
    applicationinsights_connection_string: Optional[str] = Field(
        default=None,
        alias="APPLICATIONINSIGHTS_CONNECTION_STRING",
    )
    cors_allow_origins_raw: str | List[str] | None = Field(default=None, alias="BACKEND_CORS_ORIGINS")

    smtp_host: Optional[str] = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: Optional[str] = Field(default=None, alias="SMTP_USERNAME")
    smtp_password: Optional[str] = Field(default=None, alias="SMTP_PASSWORD")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    smtp_use_ssl: bool = Field(default=False, alias="SMTP_USE_SSL")
    email_from: Optional[str] = Field(default=None, alias="EMAIL_FROM")
    reminder_lookahead_days: int = Field(default=7, alias="REMINDER_LOOKAHEAD_DAYS", ge=1, le=30)
    storage_backend: Literal["local", "azure"] = Field(default="local", alias="STORAGE_BACKEND")
    storage_local_path: Optional[str] = Field(default=None, alias="STORAGE_LOCAL_PATH")
    azure_blob_connection_string: Optional[str] = Field(default=None, alias="AZURE_BLOB_CONNECTION_STRING")
    azure_blob_container: Optional[str] = Field(default=None, alias="AZURE_BLOB_CONTAINER")
    azure_key_vault_uri: Optional[str] = Field(default=None, alias="AZURE_KEY_VAULT_URI")
    yousign_api_key: Optional[str] = Field(default=None, alias="YOUSIGN_API_KEY")
    yousign_api_base_url: str = Field(default="https://api.yousign.app/v3", alias="YOUSIGN_API_BASE_URL")
    yousign_webhook_secret: Optional[str] = Field(default=None, alias="YOUSIGN_WEBHOOK_SECRET")
    sms_provider: Literal["twilio", "none"] = Field(default="twilio", alias="SMS_PROVIDER")
    twilio_account_sid: Optional[str] = Field(default=None, alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: Optional[str] = Field(default=None, alias="TWILIO_AUTH_TOKEN")
    twilio_from_number: Optional[str] = Field(default=None, alias="TWILIO_FROM_NUMBER")
    feature_enforce_legal_checklist: bool = Field(
        default=False, alias="FEATURE_ENFORCE_LEGAL_CHECKLIST"
    )
    require_guardian_2: bool = Field(default=False, alias="REQUIRE_GUARDIAN_2")
    require_mfa_practitioner: bool = Field(default=False, alias="REQUIRE_MFA_PRACTITIONER")
    maintenance_alert_enabled: bool = Field(default=False, alias="MAINTENANCE_ALERT_ENABLED")
    maintenance_alert_recipient_email: Optional[str] = Field(
        default=None,
        alias="MAINTENANCE_ALERT_RECIPIENT_EMAIL",
    )

    # Vérification quotidienne documents
    document_verification_recipient_email: Optional[str] = Field(
        default=None,
        alias="DOCUMENT_VERIFICATION_RECIPIENT_EMAIL"
    )
    document_verification_enabled: bool = Field(
        default=True,
        alias="DOCUMENT_VERIFICATION_ENABLED"
    )
    internal_jobs_key: Optional[str] = Field(default=None, alias="INTERNAL_JOBS_KEY")

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, value: str) -> str:
        """Ensure the JWT secret key is present and strong enough."""
        cleaned = value.strip()
        if cleaned.lower() in {"changeme", "change_me_to_a_random_secret"}:
            raise ValueError("JWT_SECRET_KEY must be rotated from the default value.")
        if len(cleaned) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long.")
        return cleaned

    def smtp_settings(self) -> SMTPSettings:
        """Return a structured SMTP configuration object."""
        return SMTPSettings(
            host=self.smtp_host,
            port=self.smtp_port,
            username=self.smtp_username,
            password=self.smtp_password,
            use_tls=self.smtp_use_tls,
            use_ssl=self.smtp_use_ssl,
            sender=self.email_from,
        )

    @staticmethod
    def _normalize_url_list(raw: str | List[str] | None) -> List[str]:
        if raw is None or raw == "":
            return []
        if isinstance(raw, str):
            candidates = [item.strip() for item in raw.split(",")]
        else:
            candidates = [item.strip() for item in raw]
        return [url.rstrip("/") for url in candidates if url]

    @computed_field
    def app_base_urls(self) -> List[str]:
        """Return app base URLs (primary + optional aliases), normalized and deduplicated."""
        values = [self.app_base_url.rstrip("/"), *self._normalize_url_list(self.app_base_urls_raw)]
        return list(dict.fromkeys(url for url in values if url))

    @computed_field
    def frontend_base_urls(self) -> List[str]:
        """Return frontend base URLs (primary + optional aliases), normalized and deduplicated."""
        values = [
            self.frontend_base_url.rstrip("/"),
            *self._normalize_url_list(self.frontend_base_urls_raw),
        ]
        return list(dict.fromkeys(url for url in values if url))

    @computed_field
    def cors_allow_origins(self) -> List[str]:
        """Return CORS origins as a normalized list regardless of env input format."""
        raw = self.cors_allow_origins_raw
        if raw is None or raw == "":
            return []
        if isinstance(raw, str):
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        # Already a list (e.g. provided via `.env` JSON or Settings override)
        return [origin.strip() for origin in raw if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached ``Settings`` instance."""
    return Settings()


def reset_settings_cache() -> None:
    """Clear the cached settings instance (useful for tests)."""
    get_settings.cache_clear()
