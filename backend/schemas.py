"""Pydantic models for API requests and responses."""

from __future__ import annotations

from datetime import date, datetime, time as time_type
import datetime as dt
from typing import Any, Dict, List, Optional

from domain.legal_documents.types import DocumentType, SignerRole

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = Field(default="bearer")


class TokenRefresh(BaseModel):
    access_token: str
    token_type: str = Field(default="bearer")


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    role: str


class User(UserBase):
    id: int
    role: str
    created_at: datetime
    email_verified: bool

    model_config = ConfigDict(from_attributes=True)


class AppointmentBase(BaseModel):
    date: date
    time: time_type


class AppointmentCreate(AppointmentBase):
    pass


class Appointment(AppointmentBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    appointment_type: str
    mode: Optional[str] = None
    procedure_id: Optional[int] = None
    prescription_id: Optional[int] = None
    prescription_url: Optional[str] = None
    prescription_signed_at: Optional[datetime] = None
    prescription_signed: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class QuestionnaireTemplate(BaseModel):
    template: Dict[str, Any]


class QuestionnaireCreate(BaseModel):
    data: Dict[str, Any]


class Questionnaire(BaseModel):
    id: int
    appointment_id: int
    data: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    detail: str


class ProcedureCaseBase(BaseModel):
    procedure_type: str = Field(default="circumcision")
    child_full_name: str
    child_birthdate: date
    child_weight_kg: Optional[float] = None
    parent1_name: str
    parent1_email: Optional[EmailStr] = None
    parent2_name: Optional[str] = None
    parent2_email: Optional[EmailStr] = None
    parent1_phone: Optional[str] = None
    parent2_phone: Optional[str] = None
    parent1_sms_optin: bool = False
    parent2_sms_optin: bool = False
    parental_authority_ack: bool = False
    notes: Optional[str] = None
    preconsultation_date: Optional[date] = None


class ProcedureCaseCreate(ProcedureCaseBase):
    pass


class ProcedureCase(ProcedureCaseBase):
    id: int
    created_at: datetime
    updated_at: datetime
    checklist_pdf_path: Optional[str] = None
    consent_pdf_path: Optional[str] = None
    consent_download_url: Optional[str] = None
    ordonnance_pdf_path: Optional[str] = None
    ordonnance_download_url: Optional[str] = None
    ordonnance_prescription_id: Optional[int] = None
    ordonnance_signed_at: Optional[datetime] = None
    child_age_years: float
    appointments: List[Appointment] = Field(default_factory=list)
    steps_acknowledged: bool
    dossier_completed: bool
    missing_fields: List[str] = Field(default_factory=list)
    consent_signed_pdf_url: Optional[str] = None
    consent_evidence_pdf_url: Optional[str] = None
    consent_last_status: Optional[str] = None
    consent_ready_at: Optional[datetime] = None
    yousign_procedure_id: Optional[str] = None
    parent1_yousign_signer_id: Optional[str] = None
    parent2_yousign_signer_id: Optional[str] = None
    parent1_consent_status: str
    parent2_consent_status: str
    parent1_consent_sent_at: Optional[datetime] = None
    parent2_consent_sent_at: Optional[datetime] = None
    parent1_consent_signed_at: Optional[datetime] = None
    parent2_consent_signed_at: Optional[datetime] = None
    parent1_consent_method: Optional[str] = None
    parent2_consent_method: Optional[str] = None
    parent1_signature_link: Optional[str] = None
    parent2_signature_link: Optional[str] = None
    preconsultation_date: Optional[date] = None
    signature_open_at: Optional[date] = None
    parent1_phone_verified_at: Optional[datetime] = None
    parent2_phone_verified_at: Optional[datetime] = None
    document_signatures: List["DocumentSignatureDetail"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PractitionerPatientSummary(BaseModel):
    id: int
    email: EmailStr
    child_full_name: str


class PractitionerCaseStatus(BaseModel):
    case_id: int
    child_birthdate: date
    child_full_name: Optional[str] = None
    child_weight_kg: Optional[float] = None
    parent1_name: Optional[str] = None
    parent1_email: Optional[EmailStr] = None
    parent2_name: Optional[str] = None
    parent2_email: Optional[EmailStr] = None
    parent1_phone: Optional[str] = None
    parent2_phone: Optional[str] = None
    parent1_sms_optin: Optional[bool] = None
    parent2_sms_optin: Optional[bool] = None
    parental_authority_ack: bool
    has_checklist: bool
    has_consent: bool
    has_ordonnance: bool
    has_preconsultation: bool
    has_act_planned: bool
    next_act_date: Optional[date] = None
    next_preconsultation_date: Optional[date] = None
    notes: Optional[str] = None
    ordonnance_signed_at: Optional[datetime] = None
    latest_prescription_id: Optional[int] = None
    missing_items: List[str] = Field(default_factory=list)
    needs_follow_up: bool
    appointments_overview: List["PractitionerAppointmentSummary"] = Field(default_factory=list)
    consent_download_url: Optional[str] = None
    consent_signed_pdf_url: Optional[str] = None
    consent_evidence_pdf_url: Optional[str] = None
    consent_last_status: Optional[str] = None
    consent_ready_at: Optional[datetime] = None
    yousign_procedure_id: Optional[str] = None
    parent1_consent_status: Optional[str] = None
    parent2_consent_status: Optional[str] = None
    parent1_consent_sent_at: Optional[datetime] = None
    parent2_consent_sent_at: Optional[datetime] = None
    parent1_consent_signed_at: Optional[datetime] = None
    parent2_consent_signed_at: Optional[datetime] = None
    parent1_consent_method: Optional[str] = None
    parent2_consent_method: Optional[str] = None
    parent1_signature_link: Optional[str] = None
    parent2_signature_link: Optional[str] = None
    preconsultation_date: Optional[date] = None
    signature_open_at: Optional[date] = None
    parent1_phone_verified_at: Optional[datetime] = None
    parent2_phone_verified_at: Optional[datetime] = None


class PractitionerAppointmentSummary(BaseModel):
    appointment_id: int
    appointment_type: str
    date: date
    time: time_type
    status: str
    mode: Optional[str] = None


class PractitionerAppointmentCreate(BaseModel):
    case_id: int
    appointment_type: str
    date: date
    time: time_type
    mode: Optional[str] = None


class LegalDocumentCase(BaseModel):
    key: str
    text: str
    required: bool = True
    required_roles: List[str]


class LegalDocument(BaseModel):
    document_type: str
    title: str
    version: str
    cases: List[LegalDocumentCase] = Field(default_factory=list)


class LegalCatalog(BaseModel):
    version: str
    documents: List[LegalDocument] = Field(default_factory=list)


class LegalAcknowledgeInput(BaseModel):
    document_type: DocumentType
    case_key: str
    catalog_version: Optional[str] = None


class LegalAcknowledgeRequest(LegalAcknowledgeInput):
    appointment_id: int
    signer_role: SignerRole
    source: str | None = Field(default="remote", pattern="^(remote|cabinet)$")


class LegalAcknowledgeBulkInput(BaseModel):
    appointment_id: int
    signer_role: SignerRole
    acknowledgements: List[LegalAcknowledgeInput] = Field(default_factory=list)
    source: str | None = Field(default="remote", pattern="^(remote|cabinet)$")
    catalog_version: Optional[str] = None


class LegalDocumentStatus(BaseModel):
    document_type: DocumentType
    version: str
    required_roles: List[SignerRole]
    acknowledged: Dict[SignerRole, List[str]] = Field(default_factory=dict)
    missing: Dict[SignerRole, List[str]] = Field(default_factory=dict)
    complete: bool

    model_config = ConfigDict(use_enum_values=True)


class LegalStatusResponse(BaseModel):
    appointment_id: int
    documents: List[LegalDocumentStatus] = Field(default_factory=list)
    complete: bool

    model_config = ConfigDict(use_enum_values=True)


class CabinetSessionCreate(BaseModel):
    appointment_id: int
    signer_role: SignerRole


class CabinetSessionResponse(BaseModel):
    appointment_id: int
    signer_role: SignerRole
    session_code: str
    tablet_url: str
    expires_at: datetime
    status: str

    model_config = ConfigDict(use_enum_values=True)


class SignatureStartPayload(BaseModel):
    appointment_id: int
    signer_role: SignerRole
    mode: str = Field(default="remote", pattern="^(remote|cabinet)$")
    session_code: Optional[str] = None


class SignatureStartResponse(BaseModel):
    appointment_id: int
    signer_role: SignerRole
    signature_link: Optional[str] = None
    yousign_procedure_id: Optional[str] = None
    status: str

    model_config = ConfigDict(use_enum_values=True)


class PractitionerAppointmentEntry(BaseModel):
    appointment_id: int
    date: date
    time: time_type
    appointment_type: str
    status: str
    mode: Optional[str] = None
    patient: PractitionerPatientSummary
    procedure: PractitionerCaseStatus
    reminder_sent_at: Optional[datetime] = None
    reminder_opened_at: Optional[datetime] = None
    prescription_sent_at: Optional[datetime] = None
    prescription_last_download_at: Optional[datetime] = None
    prescription_download_count: int = 0
    prescription_items: Optional[List[str]] = None
    prescription_instructions: Optional[str] = None
    prescription_id: Optional[int] = None
    prescription_url: Optional[str] = None
    prescription_signed_at: Optional[datetime] = None


class PractitionerAgendaDay(BaseModel):
    date: date
    appointments: List[PractitionerAppointmentEntry] = Field(default_factory=list)


class PractitionerAgendaResponse(BaseModel):
    start: date
    end: date
    days: List[PractitionerAgendaDay]


class PractitionerStats(BaseModel):
    date: date
    total_appointments: int
    bookings_created: int
    new_patients: int
    new_patients_week: int
    follow_ups_required: int
    pending_consents: int


class PractitionerNewPatient(BaseModel):
    case_id: int
    created_at: datetime
    child_full_name: str
    patient_email: EmailStr
    next_preconsultation_date: Optional[date] = None
    next_act_date: Optional[date] = None
    procedure: PractitionerCaseStatus


class PractitionerCaseUpdate(BaseModel):
    child_full_name: Optional[str] = None
    child_birthdate: Optional[date] = None
    child_weight_kg: Optional[float] = Field(default=None, ge=0)
    parent1_name: Optional[str] = None
    parent1_email: Optional[EmailStr] = None
    parent2_name: Optional[str] = None
    parent2_email: Optional[EmailStr] = None
    parent1_phone: Optional[str] = None
    parent2_phone: Optional[str] = None
    parent1_sms_optin: Optional[bool] = None
    parent2_sms_optin: Optional[bool] = None
    parental_authority_ack: Optional[bool] = None
    notes: Optional[str] = None
    procedure_type: Optional[str] = None
    preconsultation_date: Optional[date] = None


class AppointmentRescheduleRequest(BaseModel):
    date: Optional[dt.date] = None
    time: Optional[time_type] = None
    appointment_type: Optional[str] = None
    mode: Optional[str] = None
    status: Optional[str] = None


class PrescriptionVersionEntry(BaseModel):
    id: int
    appointment_id: int
    appointment_type: str
    created_at: datetime
    url: str
    items: Optional[List[str]] = None
    instructions: Optional[str] = None
    downloads: List['PrescriptionDownloadEntry'] = Field(default_factory=list)


class PrescriptionDownloadEntry(BaseModel):
    id: int
    actor: str
    channel: str
    downloaded_at: datetime


class PrescriptionSignatureResponse(BaseModel):
    prescription_id: int
    appointment_id: int
    signed_at: datetime
    preview_url: str
    patient_download_url: Optional[str] = None


class PrescriptionVerificationResponse(BaseModel):
    reference: str
    slug: str
    verification_url: str
    issued_at: Optional[str] = None
    valid_until: Optional[str] = None
    patient_name: Optional[str] = None
    guardian_name: Optional[str] = None
    appointment_date: Optional[date] = None
    signed_at: Optional[datetime] = None
    scan_count: int
    last_scanned_at: Optional[datetime] = None


class PharmacyContactBase(BaseModel):
    name: str
    address_line1: str
    postal_code: str
    city: str
    address_line2: Optional[str] = None
    department_code: Optional[str] = None
    region: Optional[str] = None
    country: str = "France"
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    ms_sante_address: Optional[str] = None
    type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = None


class PharmacyContactCreate(PharmacyContactBase):
    external_id: Optional[str] = None


class PharmacyContact(PharmacyContactBase):
    id: int
    external_id: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class PharmacySearchResponse(BaseModel):
    total: int
    items: List[PharmacyContact] = Field(default_factory=list)


# =============================================================================
# Document Signature Schemas (Granular Yousign Signatures)
# =============================================================================


class DocumentSignatureStartRequest(BaseModel):
    """Démarrer la signature pour UN document spécifique."""
    procedure_case_id: int
    document_type: str = Field(
        pattern="^(authorization|consent|fees)$",
        description="Type de document à signer"
    )
    signer_role: SignerRole
    mode: str = Field(
        default="remote",
        pattern="^(remote|cabinet)$",
        description="Mode de signature (remote=OTP SMS, cabinet=no OTP)"
    )
    session_code: Optional[str] = None


class DocumentSignatureStartResponse(BaseModel):
    """Réponse après démarrage de signature pour un document."""
    document_signature_id: int
    document_type: str
    signer_role: SignerRole
    signature_link: Optional[str] = None
    yousign_procedure_id: Optional[str] = None
    status: str  # "sent", "draft"

    model_config = ConfigDict(use_enum_values=True)


class DocumentSignatureDetail(BaseModel):
    """Détail complet d'une signature de document."""
    id: int
    procedure_case_id: int
    document_type: str
    document_version: Optional[str] = None
    overall_status: str  # draft|sent|partially_signed|completed|expired|cancelled

    # Parent 1
    parent1_status: str
    parent1_signature_link: Optional[str] = None
    parent1_sent_at: Optional[datetime] = None
    parent1_signed_at: Optional[datetime] = None
    parent1_method: Optional[str] = None

    # Parent 2
    parent2_status: str
    parent2_signature_link: Optional[str] = None
    parent2_sent_at: Optional[datetime] = None
    parent2_signed_at: Optional[datetime] = None
    parent2_method: Optional[str] = None

    # Artefacts
    signed_pdf_identifier: Optional[str] = None
    evidence_pdf_identifier: Optional[str] = None
    final_pdf_identifier: Optional[str] = None

    # Métadonnées
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    yousign_purged_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentSignatureStatusUpdate(BaseModel):
    """Mise à jour du statut de signature (webhook Yousign)."""
    parent_label: str = Field(pattern="^(parent1|parent2)$")
    status_value: str
    signed_at: Optional[datetime] = None
    method: Optional[str] = None
    signed_file_url: Optional[str] = None
    evidence_url: Optional[str] = None


class CaseDocumentSignaturesSummary(BaseModel):
    """Résumé des signatures pour un ProcedureCase."""
    procedure_case_id: int
    document_signatures: List[DocumentSignatureDetail] = Field(default_factory=list)
