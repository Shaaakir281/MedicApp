"""FastAPI application entrypoint.

This module defines the main FastAPI instance and registers the routers for
authentication, appointments and questionnaires. It also configures a basic
CORS middleware to allow the front‑end application (e.g. React) to call
the API from another origin.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.logging_config import configure_application_insights
from middleware.audit_logging import audit_logging_middleware
from middleware.rate_limiter import configure_rate_limiter
from routes import all_routers


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="MedicApp Backend", version="0.1.0")
    settings = get_settings()
    configure_application_insights(settings.applicationinsights_connection_string)
    app.middleware("http")(audit_logging_middleware)
    configure_rate_limiter(app)

    allow_origins = settings.cors_allow_origins or ["http://localhost:3000"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    for router in all_routers:
        app.include_router(router)

    @app.get("/", tags=["health"])
    def read_root() -> dict[str, str]:
        """Health check endpoint."""
        return {"status": "running"}

    return app


app = create_application()
