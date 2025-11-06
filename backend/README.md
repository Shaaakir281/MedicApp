# MedicApp Backend

FastAPI backend for the MedicApp project. It currently exposes authentication, agenda and procedure features used by the web frontend.

## Requirements

- Python 3.11+
- PostgreSQL 13+
- Redis (optional, reserved for future background tasks)
- `pip` or Poetry for dependency management

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate    # PowerShell: .venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Apply the database migrations:

```bash
alembic upgrade head
```

Start the development server:

```bash
uvicorn main:app --reload
```

The interactive API documentation is available at http://localhost:8000/docs.

## Project structure

```
backend/
+-- core/                  # Cross-cutting helpers (security, JWT, password hashing)
¦   +-- security.py
+-- repositories/          # Data access helpers
¦   +-- __init__.py
¦   +-- email_verification_repository.py
¦   +-- user_repository.py
+-- services/              # Domain services (email, PDF, auth orchestration)
¦   +-- auth_service.py
¦   +-- email.py
¦   +-- pdf.py
+-- routes/                # API routers
¦   +-- __init__.py
¦   +-- appointments.py
¦   +-- auth.py
¦   +-- questionnaires.py
+-- dependencies/          # FastAPI dependencies
+-- scripts/               # Utility scripts (seed data, maintenance)
+-- storage/               # Generated assets (eg. consent PDFs)
+-- templates/             # Jinja templates for PDF rendering
+-- crud.py                # Legacy helpers (appointments, procedures)
+-- database.py            # SQLAlchemy engine/session
+-- main.py                # FastAPI app factory
+-- models.py              # SQLAlchemy models
+-- schemas.py             # Pydantic schemas
+-- README.md
```

## Auth flow overview

- `core.security` concentrates password hashing and JWT creation/validation.
- `repositories.user_repository` and `repositories.email_verification_repository` isolate database access.
- `services.auth_service` orchestrates login, registration, token refresh and email verification, providing typed errors for the HTTP layer.
- The `/auth` routes now consume the service layer instead of the legacy `crud` functions, which simplifies future refactors and unit testing.

## Scripts

The `scripts/` directory contains helpers such as `seed_practitioner_demo.py`. Scripts now rely on `core.security.hash_password` for consistent hashing.

## Development tips

- Run `python -m compileall backend` to perform a quick syntax check.
- Configure formatting and linting (eg. `ruff`, `mypy`) to catch issues early; the repository is ready to host those configs.
- Add tests under `tests/` using pytest. Fixtures can reuse `database.SessionLocal` with a dedicated test database.

