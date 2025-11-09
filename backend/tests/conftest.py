"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from core.config import reset_settings_cache

# Ensure deterministic configuration for tests before importing app/database modules.
TEST_DB_PATH = Path(__file__).parent / "test.db"
os.environ.setdefault("DATABASE_URL", f"sqlite+pysqlite:///{TEST_DB_PATH}")
os.environ.setdefault("JWT_SECRET_KEY", "tests_secret_key_which_is_long_enough_123456")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "30")
os.environ.setdefault("APP_BASE_URL", "http://testserver")
os.environ.setdefault("BACKEND_CORS_ORIGINS", "http://testserver")

reset_settings_cache()

from database import Base, get_db  # noqa: E402  (import after env configuration)
from main import app  # noqa: E402


def _build_test_engine() -> Engine:
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    return create_engine(
        os.environ["DATABASE_URL"],
        connect_args={"check_same_thread": False},
        future=True,
    )


ENGINE = _build_test_engine()
TestingSessionLocal = sessionmaker(bind=ENGINE, autoflush=False, autocommit=False, future=True)


@pytest.fixture(scope="session", autouse=True)
def setup_database() -> Iterator[None]:
    """Create all tables before the test session and drop them afterwards."""
    Base.metadata.create_all(bind=ENGINE)
    yield
    Base.metadata.drop_all(bind=ENGINE)
    ENGINE.dispose()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture()
def db_session() -> Iterator[Session]:
    """Return a transactional SQLAlchemy session rolled back after each test."""
    connection = ENGINE.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session: Session) -> Iterator[TestClient]:
    """Return a FastAPI test client with the database dependency overridden."""

    def _get_db_override() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)
