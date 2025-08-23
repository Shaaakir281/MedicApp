"""Database utilities for SQLAlchemy.

This module sets up the SQLAlchemy engine and session factory based on the
``DATABASE_URL`` environment variable. It also defines the declarative base
class used by the ORM models.
"""

import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set in the environment or .env file")

# Use the future flag for SQLAlchemy 2.0 style behaviour
engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

# Declarative base for models
Base = declarative_base()


def get_db() -> Generator:
    """Provide a transactional scope around a series of operations.

    This dependency can be used with FastAPI's ``Depends`` to inject a
    database session into your path operations.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()