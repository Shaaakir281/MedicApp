import { DOCUMENT_TYPES, SIGNER_ROLES } from './patientDashboard.api.js';
import { DocumentSignatureVM } from '../types/patientDashboard.vm.js';

const SIGNATURE_TYPE_TO_CATALOG = {
  authorization: DOCUMENT_TYPES.SURGICAL_AUTHORIZATION_MINOR,
  consent: DOCUMENT_TYPES.INFORMED_CONSENT,
  fees: DOCUMENT_TYPES.FEES_CONSENT_QUOTE,
};

function mapSignatureTypeToCatalog(value) {
  return SIGNATURE_TYPE_TO_CATALOG[value] || value;
}

function splitChildFullName(fullName) {
  const cleaned = String(fullName || '').trim();
  if (!cleaned) return { firstName: '', lastName: '' };
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) };
}

function findGuardian(guardians, label) {
  return (guardians || []).find((g) => g?.label === label) || null;
}

function signatureEntryByRole(dashboard, role) {
  const entries = dashboard?.signature?.entries || [];
  return entries.find((entry) => entry?.signer_role === role) || null;
}

function isDateString(value) {
  return Boolean(value && typeof value === 'string');
}

function normalizeDate(value) {
  if (!value) return null;
  if (isDateString(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value);
}

function normalizeTime(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return String(value);
}

function mapAppointments(dashboard, procedureCase) {
  const upcoming = dashboard?.appointments?.upcoming || [];
  const history = dashboard?.appointments?.history || [];
  if (upcoming.length || history.length) {
    return {
      upcoming: upcoming.map((appt) => ({
        id: appt.id,
        date: normalizeDate(appt.date),
        time: normalizeTime(appt.time),
        appointmentType: appt.appointment_type,
        status: appt.status,
        mode: appt.mode || null,
      })),
      history: history.map((appt) => ({
        id: appt.id,
        date: normalizeDate(appt.date),
        time: normalizeTime(appt.time),
        appointmentType: appt.appointment_type,
        status: appt.status,
        mode: appt.mode || null,
      })),
    };
  }

  const appointments = procedureCase?.appointments || [];

  return {
    upcoming: appointments.map((appt) => ({
      id: appt.id,
      date: normalizeDate(appt.date),
      time: normalizeTime(appt.time),
      appointmentType: appt.appointment_type,
      status: appt.status,
      mode: appt.mode || null,
    })),
    history: [],
  };
}

function buildDocumentVM({
  catalogDoc,
  statusDoc,
  dashboard,
  procedureCase,
  documentSignatures = [],
}) {
  const roles = [SIGNER_ROLES.PARENT_1, SIGNER_ROLES.PARENT_2];
  const ack = statusDoc?.acknowledged || {};

  const docType = catalogDoc.document_type;
  const isConsent = docType === DOCUMENT_TYPES.INFORMED_CONSENT;

  // Architecture granulaire: chercher DocumentSignature pour CE document
  const docSignature = (documentSignatures || []).find(
    (sig) => mapSignatureTypeToCatalog(sig?.document_type) === docType
  );

  // Fallback vers ancien système si pas de DocumentSignature
  const documentSignatureId = docSignature?.id || null;
  const finalPdfAvailable = Boolean(docSignature?.final_pdf_identifier);
  const signedPdfAvailable = Boolean(docSignature?.signed_pdf_identifier);
  const evidencePdfAvailable = Boolean(docSignature?.evidence_pdf_identifier);
  const legacySignedAvailable = Boolean(
    isConsent && (dashboard?.signature?.signed_pdf_url || procedureCase?.consent_signed_pdf_url),
  );
  const legacyEvidenceAvailable = Boolean(
    isConsent && (dashboard?.signature?.evidence_pdf_url || procedureCase?.consent_evidence_pdf_url),
  );
  const previewPdfUrl = isConsent ? procedureCase?.consent_download_url || null : null;

  const byParent = roles.reduce((acc, role) => {
    const requiredCases = (catalogDoc.cases || []).filter(
      (item) => item.required && (item.required_roles || []).includes(role),
    );
    const total = requiredCases.length;
    const checkedKeys = ack[role] || [];
    const completedCount = requiredCases.filter((item) => checkedKeys.includes(item.key)).length;

    // Architecture granulaire: données de signature depuis DocumentSignature
    let signatureStatus = null;
    let signatureLink = null;
    let sentAt = null;
    let signedAt = null;

    if (docSignature) {
      // Données granulaires par document
      if (role === SIGNER_ROLES.PARENT_1) {
        signatureStatus = docSignature.parent1_status || 'pending';
        signatureLink = docSignature.parent1_signature_link || null;
        sentAt = docSignature.parent1_sent_at || null;
        signedAt = docSignature.parent1_signed_at || null;
      } else if (role === SIGNER_ROLES.PARENT_2) {
        signatureStatus = docSignature.parent2_status || 'pending';
        signatureLink = docSignature.parent2_signature_link || null;
        sentAt = docSignature.parent2_sent_at || null;
        signedAt = docSignature.parent2_signed_at || null;
      }
    } else {
      // Fallback vers ancien système (monolithique)
      const signatureEntry = isConsent ? signatureEntryByRole(dashboard, role) : null;
      signatureStatus = signatureEntry?.status || null;
      signatureLink =
        (signatureEntry?.signature_link || null) ||
        (role === SIGNER_ROLES.PARENT_1 ? procedureCase?.parent1_signature_link : procedureCase?.parent2_signature_link) ||
        null;
      sentAt = signatureEntry?.sent_at || null;
      signedAt = signatureEntry?.signed_at || null;
    }

    acc[role] = {
      checkedKeys,
      completedCount,
      total,
      signatureStatus,
      signatureLink,
      sentAt,
      signedAt,
    };
    return acc;
  }, {});

  return {
    docType,
    title: catalogDoc.title,
    version: catalogDoc.version,
    cases: (catalogDoc.cases || []).map((item) => ({
      key: item.key,
      label: item.text,
      required: Boolean(item.required),
      requiredRoles: item.required_roles || [],
    })),
    byParent,
    previewPdfUrl,
    documentSignatureId,
    finalPdfAvailable,
    signedPdfAvailable,
    evidencePdfAvailable,
    legacySignedAvailable,
    legacyEvidenceAvailable,
    signatureSupported: true,
  };
}

export function buildPatientDashboardVM({
  procedureCase,
  dashboard,
  legalCatalog,
  legalStatus,
}) {
  const childFullName = dashboard?.child?.full_name || procedureCase?.child_full_name || '';
  const { firstName, lastName } = splitChildFullName(childFullName);

  const parent1FromDash = findGuardian(dashboard?.guardians, 'parent1');
  const parent2FromDash = findGuardian(dashboard?.guardians, 'parent2');

  const parent1Verified =
    dashboard?.contact_verification?.parent1_verified ?? Boolean(procedureCase?.parent1_phone_verified_at);
  const parent2Verified =
    dashboard?.contact_verification?.parent2_verified ?? Boolean(procedureCase?.parent2_phone_verified_at);

  const appointments = mapAppointments(dashboard, procedureCase);

  const statusDocs = legalStatus?.documents || [];
  const statusByType = new Map(statusDocs.map((doc) => [String(doc.document_type), doc]));
  const catalogDocs = legalCatalog?.documents || [];

  // Architecture granulaire: extraire document_signatures depuis procedureCase
  const documentSignatures = procedureCase?.document_signatures || [];

  const legalDocuments = catalogDocs.map((doc) =>
    buildDocumentVM({
      catalogDoc: doc,
      statusDoc: statusByType.get(String(doc.document_type)) || null,
      dashboard,
      procedureCase,
      documentSignatures,
    }),
  );

  const signatureCompleteFromDocs = (legalDocuments || []).length
    ? (legalDocuments || []).every((doc) => {
        const parent1Required = doc?.byParent?.parent1?.total > 0;
        const parent2Required = doc?.byParent?.parent2?.total > 0;
        const parent1Signed = String(doc?.byParent?.parent1?.signatureStatus || '').toLowerCase() === 'signed';
        const parent2Signed = String(doc?.byParent?.parent2?.signatureStatus || '').toLowerCase() === 'signed';
        return (!parent1Required || parent1Signed) && (!parent2Required || parent2Signed);
      })
    : false;
  const legacySignatureComplete = Boolean(
    dashboard?.signature?.signed_pdf_url ||
      (dashboard?.signature?.entries || []).some(
        (entry) => (entry?.status || '').toLowerCase() === 'signed',
      ) ||
      procedureCase?.consent_signed_pdf_url,
  );

  return {
    child: {
      firstName,
      lastName,
      birthDate: dashboard?.child?.birthdate || procedureCase?.child_birthdate || null,
      weightKg:
        dashboard?.child?.weight_kg ??
        (typeof procedureCase?.child_weight_kg === 'number' ? procedureCase.child_weight_kg : null),
      medicalNotes: dashboard?.child?.notes || procedureCase?.notes || '',
    },
    guardians: {
      parent1: {
        name: parent1FromDash?.name || procedureCase?.parent1_name || '',
        email: parent1FromDash?.email || procedureCase?.parent1_email || '',
        phone: parent1FromDash?.phone || procedureCase?.parent1_phone || '',
        verified: parent1Verified,
      },
      parent2: {
        name: parent2FromDash?.name || procedureCase?.parent2_name || '',
        email: parent2FromDash?.email || procedureCase?.parent2_email || '',
        phone: parent2FromDash?.phone || procedureCase?.parent2_phone || '',
        verified: parent2Verified,
      },
    },
    appointments,
    legalDocuments,
    legalComplete: Boolean(legalStatus?.complete ?? dashboard?.legal_status?.complete),
    signatureComplete: signatureCompleteFromDocs || legacySignatureComplete,
  };
}

/**
 * Mapper pour les données praticien
 * Transforme document_signatures (snake_case) en documentSignatures (camelCase avec VM)
 */
export function mapPractitionerProcedureCase(procedureData) {
  if (!procedureData) return procedureData;

  return {
    ...procedureData,
    documentSignatures: (procedureData.document_signatures || []).map(
      (doc) => new DocumentSignatureVM(doc)
    ),
  };
}
