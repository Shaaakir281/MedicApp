"""
Alembic environment configuration.

This file sets up the Alembic context so that migrations can be run against
the SQLAlchemy models defined in this project. It reads the database URL
from the environment (via python‑dotenv) and injects the project root into
``sys.path`` so that models can be imported cleanly.
"""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Load environment variables from .env file
from dotenv import load_dotenv

load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging. This line sets up loggers
# basically.
fileConfig(config.config_file_name)

# Add the project root to sys.path so models can be imported relative to it
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

# Import the models' metadata.  If you add new models, import them here.
try:
    import models  # type: ignore  # noqa: F401
    target_metadata = models.Base.metadata  # type: ignore[attr-defined]
except Exception:
    target_metadata = None


def get_url() -> str:
    """Retrieve the database URL from environment variables."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable here as well.
    By skipping the Engine creation we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """

    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """

    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()