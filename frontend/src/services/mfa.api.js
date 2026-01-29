import { apiRequest } from '../lib/api.js';

export async function sendPractitionerMfaCode({ token, phone }) {
  const body = phone ? { phone } : {};
  return apiRequest('/auth/mfa/send', { method: 'POST', body, token });
}

export async function verifyPractitionerMfaCode({ token, code }) {
  return apiRequest('/auth/mfa/verify', { method: 'POST', body: { code }, token });
}
