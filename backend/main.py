"""FastAPI application entrypoint.

This module defines the main FastAPI instance and registers the routers for
authentication, appointments and questionnaires. It also configures a basic
CORS middleware to allow the front‑end application (e.g. React) to call
the API from another origin.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import all_routers


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="MedicApp Backend", version="0.1.0")

    # Enable permissive CORS for development.  Adjust in production.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
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