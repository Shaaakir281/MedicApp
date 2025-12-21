import {
  acknowledgeLegalBulk,
  acknowledgeLegalCase,
  downloadSignedConsent,
  fetchLegalCatalog,
  fetchLegalStatus,
  fetchPatientDashboard,
  requestPhoneOtp,
  sendConsentLinkCustom,
  startSignature,
  verifyPhoneOtp,
} from '../lib/api.js';

export const DOCUMENT_TYPES = {
  SURGICAL_AUTHORIZATION_MINOR: 'surgical_authorization_minor',
  INFORMED_CONSENT: 'informed_consent',
  FEES_CONSENT_QUOTE: 'fees_consent_quote',
};

export const SIGNER_ROLES = {
  PARENT_1: 'parent1',
  PARENT_2: 'parent2',
};

export async function getPatientDashboard({ appointmentId, token }) {
  return fetchPatientDashboard(appointmentId, token);
}

export async function getLegalCatalog({ appointmentId, sessionCode, token } = {}) {
  return fetchLegalCatalog({ appointmentId, sessionCode, token });
}

export async function getLegalStatus({ appointmentId, sessionCode, token } = {}) {
  return fetchLegalStatus({ appointmentId, sessionCode, token });
}

export async function acknowledgeLegalCheckbox({
  appointmentId,
  signerRole,
  documentType,
  caseKey,
  sessionCode,
  token,
}) {
  return acknowledgeLegalCase({
    appointmentId,
    signerRole,
    documentType,
    caseKey,
    sessionCode,
    token,
  });
}

export async function acknowledgeLegalCheckboxesBulk({
  appointmentId,
  signerRole,
  acknowledgements,
  sessionCode,
  token,
}) {
  return acknowledgeLegalBulk({
    appointmentId,
    signerRole,
    acknowledgements,
    sessionCode,
    token,
  });
}

export async function startDocumentSignature({
  appointmentId,
  parentRole,
  mode = 'remote',
  sessionCode,
  token,
  docType,
}) {
  if (docType && docType !== DOCUMENT_TYPES.INFORMED_CONSENT) {
    const error = new Error('Signature de ce document non disponible pour le moment.');
    error.code = 'NOT_IMPLEMENTED';
    throw error;
  }
  return startSignature(token, { appointmentId, signerRole: parentRole, mode, sessionCode });
}

export async function sendConsentSignatureLinkByEmail({ token, email }) {
  return sendConsentLinkCustom(token, { email });
}

export async function downloadSignedConsentBlob({ token }) {
  return downloadSignedConsent(token);
}

export async function requestGuardianPhoneOtp({ token, parentRole }) {
  return requestPhoneOtp(token, { parent: parentRole });
}

export async function verifyGuardianPhoneOtp({ token, parentRole, code }) {
  return verifyPhoneOtp(token, { parent: parentRole, code });
}
