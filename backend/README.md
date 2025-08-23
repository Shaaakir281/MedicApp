# Backend FastAPI – Sprint 1

This repository contains the skeleton of a FastAPI backend for the MedicApp project. It provides the structure and boilerplate required for the first sprint: authentication, appointments and questionnaires. The code is intentionally minimal – you can extend it as you implement your domain logic.

## Requirements

* Python 3.11 or higher
* PostgreSQL (9.6+) for persistence
* Redis (for future token blacklisting)
* [Poetry](https://python-poetry.org/) or `pip` for dependency management

## Installation

Clone this repository and navigate into the `backend_fastapi_sprint1` directory. Install the dependencies in a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

Copy the `.env.example` file to `.env` and adjust the variables if necessary:

```bash
cp .env.example .env
```

Run the initial database migrations:

```bash
alembic upgrade head
```

Start the application in development mode:

```bash
uvicorn main:app --reload
```

Open Swagger UI at `http://localhost:8000/docs` to explore the API.

## Docker Compose

For a ready‑to‑use environment with PostgreSQL and Redis, use the provided Docker Compose file:

```bash
docker compose up --build
```

This will build the backend image, create a PostgreSQL database container and a Redis container, then expose the FastAPI app on port 8000. The default credentials and configuration are defined in the `.env.example` file.

## Project structure

```
backend_fastapi_sprint1/
├── main.py                # FastAPI entrypoint and router setup
├── database.py            # DB session/engine creation
├── models.py              # SQLAlchemy ORM models
├── schemas.py             # Pydantic models for request/response
├── crud.py                # CRUD helper functions
├── routes/                # API route definitions
│   ├── __init__.py
│   ├── auth.py            # login and token refresh endpoints
│   ├── appointments.py    # appointment endpoints
│   └── questionnaires.py  # questionnaire endpoints
├── migrations/            # Alembic revision scripts (empty by default)
├── tests/                 # Placeholder for test files
├── alembic.ini            # Alembic configuration file
├── .env.example           # Example environment configuration
├── docker-compose.yml     # Docker Compose definitions
├── Dockerfile             # Backend image build instructions
└── requirements.txt       # Python dependencies
```

### Authentication

This skeleton implements a basic JWT authentication mechanism with access and refresh tokens. Tokens are signed using the secret key defined in your `.env` file. Access tokens expire quickly (15 minutes by default), while refresh tokens last longer (30 days by default). You can customise the expiry durations via environment variables.

### Database migrations

Alembic is configured to generate and apply migrations automatically based on your SQLAlchemy models. To create an initial migration, run:

```bash
alembic revision --autogenerate -m "init"
alembic upgrade head
```

See `alembic.ini` for configuration details.

---

This skeleton is a starting point; you are free to add fields, refine the models and extend the CRUD logic as your application evolves.
