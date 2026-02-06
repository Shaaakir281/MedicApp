"""Aggregate API routers for the FastAPI application."""

from .auth import router as auth_router  # noqa: F401
from .appointments import router as appointments_router  # noqa: F401
from .questionnaires import router as questionnaires_router  # noqa: F401
from .prescriptions import router as prescriptions_router  # noqa: F401
from .procedures import router as procedures_router  # noqa: F401
from .practitioner import router as practitioner_router  # noqa: F401
from .admin_stats import router as admin_stats_router  # noqa: F401
from .directory import router as directory_router  # noqa: F401
from .legal import router as legal_router  # noqa: F401
from .cabinet_sessions import router as cabinet_sessions_router  # noqa: F401
from .cabinet_signatures import router as cabinet_signatures_router  # noqa: F401
from .document_signature import router as document_signature_router  # noqa: F401
from .patient_dashboard import router as patient_dashboard_router  # noqa: F401
from .dossier import router as dossier_router  # noqa: F401
from .documents_dashboard import router as documents_dashboard_router  # noqa: F401
from .rgpd import router as rgpd_router  # noqa: F401

# A convenience list of routers that can be included in the main app.  You can
# import this in ``main.py`` to loop over and include routers dynamically.
all_routers = [
    auth_router,
    appointments_router,
    questionnaires_router,
    prescriptions_router,
    procedures_router,
    practitioner_router,
    admin_stats_router,
    directory_router,
    legal_router,
    cabinet_sessions_router,
    cabinet_signatures_router,
    document_signature_router,
    patient_dashboard_router,
    dossier_router,
    documents_dashboard_router,
    rgpd_router,
]
