"""Questionnaire routes.

These endpoints serve questionnaire templates and allow clients to submit
responses for a given appointment. The template endpoint returns a static
example based on the intervention type. In a real application you would
probably retrieve this information from a database or another service.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db


router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])


class QuestionnaireCreateRequest(BaseModel):
    data: Dict[str, Any]


@router.get("/template/{intervention}", response_model=schemas.QuestionnaireTemplate)
def get_template(intervention: str = Path(..., description="Intervention identifier")) -> schemas.QuestionnaireTemplate:
    """Return a dummy questionnaire template for the given intervention."""
    # In a full implementation you would look up the template based on the
    # intervention. Here we return a hard‑coded example.
    template = {
        "intervention": intervention,
        "questions": [
            {"id": 1, "question": "How do you feel today?", "type": "text"},
            {"id": 2, "question": "Rate your pain level from 1 to 10", "type": "scale", "min": 1, "max": 10},
        ],
    }
    return schemas.QuestionnaireTemplate(template=template)


@router.post("/{appointment_id}", response_model=schemas.Questionnaire, status_code=status.HTTP_201_CREATED)
def submit_questionnaire(
    appointment_id: int = Path(..., description="ID of the appointment"),
    payload: QuestionnaireCreateRequest = Depends(),
    db: Session = Depends(get_db),
) -> schemas.Questionnaire:
    """Create or update a questionnaire for the specified appointment."""
    # TODO: check appointment existence and ownership
    questionnaire = crud.create_questionnaire(db, appointment_id, payload.data)
    return schemas.Questionnaire.from_orm(questionnaire)