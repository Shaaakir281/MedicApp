import { apiRequest } from '../lib/api.js';

export async function fetchDossier({ token, childId } = {}) {
  const path = childId ? `/dossier/${childId}` : '/dossier/current';
  return apiRequest(path, { token });
}

export async function saveDossier({ token, payload, childId } = {}) {
  const path = childId ? `/dossier/${childId}` : '/dossier/current';
  return apiRequest(path, { method: 'PUT', token, body: payload });
}

export async function sendGuardianVerification({ token, guardianId, phoneE164 } = {}) {
  if (!guardianId) {
    throw new Error('guardianId requis pour envoyer le code.');
  }
  return apiRequest(`/dossier/guardians/${guardianId}/phone-verification/send`, {
    method: 'POST',
    token,
    body: { phone_e164: phoneE164 },
  });
}

export async function verifyGuardianCode({ token, guardianId, code } = {}) {
  if (!guardianId) {
    throw new Error('guardianId requis pour vérifier le code.');
  }
  return apiRequest(`/dossier/guardians/${guardianId}/phone-verification/verify`, {
    method: 'POST',
    token,
    body: { code },
  });
}

export async function sendGuardianEmailVerification({ token, guardianId, email } = {}) {
  if (!guardianId) {
    throw new Error('guardianId requis pour envoyer l\'email de vérification.');
  }
  return apiRequest(`/dossier/guardians/${guardianId}/email-verification/send`, {
    method: 'POST',
    token,
    body: { email },
  });
}
