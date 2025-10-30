## MedicApp — Copilot instructions (concise)

Purpose: help an automated coding agent be immediately productive in this repo (FastAPI backend + React/Vite frontend). Keep suggestions small, reference files, and follow existing patterns.

- Quick start (backend, from repo root):

  1. Create a venv and install:

     ```powershell
     cd backend
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     pip install -r requirements.txt
     ```

  2. Copy environment example and edit if needed:

     ```powershell
     cp .env.example .env
     # Edit backend\.env to set DATABASE_URL and JWT_SECRET_KEY
     ```

  3. Apply migrations and run (from `backend`):

     ```powershell
     alembic upgrade head
     uvicorn main:app --reload
     ```

  4. Docker alternative (uses `backend/docker-compose.yml`):

     ```powershell
     docker compose -f backend\docker-compose.yml up --build
     ```

- Quick start (frontend):

  ```powershell
  cd frontend
  npm install
  npm run dev
  ```

- Big-picture architecture (files to read):

  - Backend: `backend/main.py` (app factory), `backend/database.py` (SQLAlchemy engine and `get_db`), `backend/models.py` (ORM), `backend/schemas.py` (Pydantic types), `backend/crud.py` (business helpers, auth), `backend/routes/*.py` (HTTP endpoints). Routers are aggregated in `backend/routes/__init__.py` and registered in `main.py` via `all_routers`.

  - Frontend: `frontend/src/` (Vite + React). Seeds in `frontend/src/lib/fixtures.js`, ephemeral storage in `frontend/src/lib/storage.js` (uses `sessionStorage` keys `medscript_rdv_draft` and `medscript_reserved_session`).

- Key patterns and conventions (project-specific)

  - DB session injection: routes use `db: Session = Depends(get_db)` from `backend/database.py`. CRUD helpers accept `db: Session` and return ORM instances.
  - Pydantic with orm_mode: response models use `Config.orm_mode = True` and routes often return `Model.from_orm(instance)` (see `backend/routes/appointments.py`).
  - JWT auth is implemented in `backend/crud.py` (create_access_token/create_refresh_token) and exposed in `backend/routes/auth.py`. Refresh tokens include claim `"type":"refresh"` — refresh endpoint checks that.
  - Migrations: Alembic configuration in `backend/alembic.ini` and `backend/migrations/env.py` loads `.env` for `DATABASE_URL`.

- Integration points & external deps

  - PostgreSQL: `DATABASE_URL` (example in `backend/.env.example`). If missing, backend raises at startup (`database.py`).
  - Redis: referenced in `backend/docker-compose.yml` (present but currently used only for future token blacklisting).
  - Frontend is standalone demo (no backend by default) but is wired to be run independently; connect to backend by changing API calls if added.

- How to add a new backend route (example)

  1. Create `backend/routes/myfeature.py` with an `APIRouter(prefix="/myfeature")`.
  2. Add `from .myfeature import router as myfeature_router` and append to `all_routers` in `backend/routes/__init__.py` (or add it to the list there).
  3. Follow existing patterns: accept `db: Session = Depends(get_db)`, use `schemas` for request/response and `crud` helpers for DB operations.

- Common pitfalls seen in the codebase

  - `DATABASE_URL` is required at import time (see `database.py`) — ensure `.env` is copied before running alembic or uvicorn.
  - Tokens use `JWT_SECRET_KEY` defaulting to `changeme` if unset — tests/dev should set a value in `.env`.
  - Frontend persists demo state only to `sessionStorage`; production integrations will require replacing `fixtures.js` + `storage.js` usages.

- Useful file map (one-line purpose)

  - `backend/main.py` — app factory + CORS + router registration
  - `backend/database.py` — SQLAlchemy engine, SessionLocal, `get_db`
  - `backend/models.py` — SQLAlchemy ORM models & relationships
  - `backend/schemas.py` — Pydantic request/response models
  - `backend/crud.py` — hashing, JWT helpers, CRUD operations used by routes
  - `backend/routes/*.py` — endpoints (auth, appointments, questionnaires)
  - `backend/.env.example` — required env vars: DATABASE_URL, JWT_SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
  - `frontend/src/lib/fixtures.js` — demo data seeds
  - `frontend/src/lib/storage.js` — sessionStorage helper functions and keys

If anything here is unclear or you want more examples (e.g. exact response shapes or a walk-through to add a test), tell me which area to expand and I will iterate.
