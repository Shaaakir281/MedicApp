"""Aggregate API routers for the FastAPI application."""

from .auth import router as auth_router  # noqa: F401
from .appointments import router as appointments_router  # noqa: F401
from .questionnaires import router as questionnaires_router  # noqa: F401
from .prescriptions import router as prescriptions_router  # noqa: F401
from .procedures import router as procedures_router  # noqa: F401
from .practitioner import router as practitioner_router  # noqa: F401
from .directory import router as directory_router  # noqa: F401
from .consents import router as consents_router  # noqa: F401
from .legal import router as legal_router  # noqa: F401
from .cabinet_sessions import router as cabinet_sessions_router  # noqa: F401
from .signature import router as signature_router  # noqa: F401

# A convenience list of routers that can be included in the main app.  You can
# import this in ``main.py`` to loop over and include routers dynamically.
all_routers = [
    auth_router,
    appointments_router,
    questionnaires_router,
    prescriptions_router,
    procedures_router,
    practitioner_router,
    directory_router,
    consents_router,
    legal_router,
    cabinet_sessions_router,
    signature_router,
]
