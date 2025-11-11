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

Install the optional developer tooling (ruff, mypy) if you plan to run quality checks locally:

```bash
pip install -r requirements-dev.txt
```

Then edit `.env` to set a strong `JWT_SECRET_KEY` (minimum 32 characters, e.g. `openssl rand -hex 32`) and restrict `BACKEND_CORS_ORIGINS` to the trusted front-end origins.

Apply the database migrations:

```bash
alembic upgrade head
```

> ℹ️ Les nouvelles colonnes (suivi des ordonnances et rappels) nécessitent cette migration après chaque pull.

Start the development server:

```bash
uvicorn main:app --reload
```

The interactive API documentation is available at http://localhost:8000/docs.

## Quality tooling

Static analysis lives in `pyproject.toml`.

- `ruff check .` linting (pycodestyle/pyflakes/isort/pyupgrade/bugbear) with import sorting.
- `ruff format .` applies the formatter consistently with the linting rules.
- `mypy .` runs optional type-checking (missing imports are ignored for now, strict optional enabled).
- `pytest` executes the backend test suite (unit + integration). A temporary SQLite database is spun up thanks to the fixtures in `tests/conftest.py`.

A future GitHub Actions workflow can simply run the two commands above plus the test suite to gate pull requests.

## Project structure

```
backend/
  core/               # Cross-cutting helpers (configuration, security)
    config.py
    security.py
  repositories/       # Data access helpers
    __init__.py
    email_verification_repository.py
    user_repository.py
  services/           # Domain services (email, PDF, auth orchestration)
    auth_service.py
    email.py
    pdf.py
  routes/             # API routers
    __init__.py
    appointments.py
    auth.py
    questionnaires.py
  dependencies/       # FastAPI dependencies
  scripts/            # Utility scripts (seed data, maintenance)
  storage/            # Generated assets (e.g. consent PDFs)
  templates/          # Jinja templates for PDF rendering
  crud.py             # Legacy helpers (appointments, procedures)
  database.py         # SQLAlchemy engine/session
  main.py             # FastAPI app factory
  models.py           # SQLAlchemy models
  schemas.py          # Pydantic schemas
  README.md
```

## Auth flow overview

- `core.config.Settings` centralises environment secrets, validates JWT secret strength and exposes CORS/SMTP configuration.
- `core.security` concentrates password hashing and JWT creation/validation.
- `repositories.user_repository` and `repositories.email_verification_repository` isolate database access.
- `services.auth_service` orchestrates login, registration, token refresh and email verification, providing typed errors for the HTTP layer.
- The `/auth` routes now consume the service layer instead of the legacy `crud` functions, which simplifies future refactors and unit testing.

## Prescription & reminder tracking

- Les ordonnances générées via `/prescriptions/{appointment_id}` sont stockées dans `storage/ordonnances` et la base enregistre désormais l'envoi (`sent_at`, `sent_via`) ainsi que les téléchargements (compteur + date).
- Les rendez-vous exposent des champs `reminder_sent_at` / `reminder_opened_at` qui serviront aux rappels J-7. Les routes praticien renvoient ces métadonnées pour affichage dans le dashboard.

## Scripts

The `scripts/` directory contains helpers such as `seed_practitioner_demo.py`. Scripts rely on `core.security.hash_password` for consistent hashing.

- `send_appointment_reminders.py` : envoie les rappels J-7 (configurable via `REMINDER_LOOKAHEAD_DAYS`). À exécuter quotidiennement via cron (`poetry run python scripts/send_appointment_reminders.py`).

## Development tips

- Run `python -m compileall backend` to perform a quick syntax check.
- Execute `ruff check .` (and optionally `ruff format .`) before committing to keep style consistent.
- Use `mypy .` to catch typing regressions as services/repositories grow.
- Run `pytest` locally before opening a pull request to ensure authentication flows (unit + API routes) keep working.
- Add tests under `tests/` using pytest. Fixtures can reuse `database.SessionLocal` with a dedicated test database.
