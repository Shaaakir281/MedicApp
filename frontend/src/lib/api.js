const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim()) ||
  'https://medicapp-backend-prod.azurewebsites.net';

let authSessionManager = null;

export function configureAuthSession(manager) {
  authSessionManager = manager;
}

async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    token,
    body,
    headers: customHeaders,
    retryOnAuth = true,
    skipAuth = false,
  } = options;

  const headers = { 'Content-Type': 'application/json', ...(customHeaders || {}) };

  let resolvedToken = token;
  if (!resolvedToken && !skipAuth && authSessionManager?.getAccessToken) {
    resolvedToken = authSessionManager.getAccessToken();
  }
  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const shouldAttemptRefresh =
      response.status === 401 &&
      retryOnAuth &&
      !skipAuth &&
      Boolean(authSessionManager?.getRefreshToken?.());

    if (shouldAttemptRefresh && authSessionManager?.refreshAccessToken) {
      try {
        const freshToken = await authSessionManager.refreshAccessToken();
        if (freshToken && freshToken !== resolvedToken) {
          return apiRequest(path, {
            ...options,
            token: freshToken,
            retryOnAuth: false,
          });
        }
      } catch (refreshError) {
        authSessionManager?.handleAuthError?.(refreshError);
      }
    }

    let message = response.statusText;
    if (payload && payload.detail) {
      message = typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail);
    }
    const error = new Error(message || 'Une erreur est survenue');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export { apiRequest };

export async function registerUser(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: payload, skipAuth: true });
}

export async function loginUser(payload) {
  return apiRequest('/auth/login', { method: 'POST', body: payload, skipAuth: true });
}

export async function refreshAccessToken(refreshToken) {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    retryOnAuth: false,
    skipAuth: true,
  });
}

export async function fetchSlots(date) {
  return apiRequest(`/appointments/slots?date=${date}`);
}

export async function createAppointment(token, payload) {
  return apiRequest('/appointments', { method: 'POST', body: payload, token });
}

export async function fetchProcedureInfo() {
  return apiRequest('/procedures/info');
}

export async function fetchCurrentProcedure(token) {
  try {
    return await apiRequest('/procedures/current', { token });
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function saveProcedure(token, payload) {
  return apiRequest('/procedures', { method: 'POST', body: payload, token });
}

export async function sendConsentLink(token) {
  return apiRequest('/procedures/send-consent-link', { method: 'POST', token });
}

export async function startSignature(token, { appointmentId, signerRole, mode = 'remote', sessionCode } = {}) {
  const params = new URLSearchParams();
  if (sessionCode) {
    params.set('session_code', sessionCode);
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/signature/start${query}`, {
    method: 'POST',
    token,
    skipAuth: !token && Boolean(sessionCode),
    body: {
      appointment_id: appointmentId,
      signer_role: signerRole,
      mode,
    },
  });
}

export async function acknowledgeProcedureSteps(token) {
  return apiRequest('/procedures/acknowledge-steps', {
    method: 'POST',
    token,
  });
}

export async function fetchLegalCatalog({ appointmentId, sessionCode, token } = {}) {
  const params = new URLSearchParams();
  if (appointmentId) params.set('appointment_id', appointmentId);
  if (sessionCode) params.set('session_code', sessionCode);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/legal/catalog${query}`, {
    token,
    skipAuth: !token && Boolean(sessionCode),
  });
}

export async function fetchLegalStatus({ appointmentId, sessionCode, token } = {}) {
  const params = new URLSearchParams();
  if (appointmentId) params.set('appointment_id', appointmentId);
  if (sessionCode) params.set('session_code', sessionCode);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/legal/status${query}`, {
    token,
    skipAuth: !token && Boolean(sessionCode),
  });
}

export async function fetchPatientDashboard(appointmentId, token) {
  if (!appointmentId) {
    throw new Error("L'identifiant de rendez-vous est requis pour charger le dashboard patient.");
  }
  return apiRequest(`/patient-dashboard/${appointmentId}`, { token });
}

export async function acknowledgeLegalCase({
  appointmentId,
  signerRole,
  documentType,
  caseKey,
  sessionCode,
  token,
}) {
  const params = new URLSearchParams();
  if (sessionCode) params.set('session_code', sessionCode);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/legal/acknowledge${query}`, {
    method: 'POST',
    token,
    skipAuth: !token && Boolean(sessionCode),
    body: {
      appointment_id: appointmentId,
      signer_role: signerRole,
      document_type: documentType,
      case_key: caseKey,
    },
  });
}

export async function acknowledgeLegalBulk({
  appointmentId,
  signerRole,
  acknowledgements,
  sessionCode,
  token,
}) {
  const params = new URLSearchParams();
  if (sessionCode) params.set('session_code', sessionCode);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/legal/acknowledge/bulk${query}`, {
    method: 'POST',
    token,
    skipAuth: !token && Boolean(sessionCode),
    body: {
      appointment_id: appointmentId,
      signer_role: signerRole,
      acknowledgements,
    },
  });
}

export async function fetchPractitionerAgenda({ start, end } = {}, token) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/practitioner/agenda${query}`, { token });
}

export async function fetchPractitionerStats(date, token) {
  const query = date ? `?target_date=${date}` : '';
  return apiRequest(`/practitioner/stats${query}`, { token });
}

export async function searchPharmacies({ query, city, limit = 10, offset = 0 }) {
  const params = new URLSearchParams();
  params.set('query', query);
  if (city) params.set('city', city);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/directory/pharmacies${qs}`, { skipAuth: true });
}

export async function createPrescription(token, appointmentId) {
  return apiRequest(`/prescriptions/${appointmentId}`, { method: 'POST', token });
}

export async function signPrescription(token, appointmentId) {
  return apiRequest(`/prescriptions/${appointmentId}/sign`, { method: 'POST', token });
}

export async function sendPrescriptionLink(token, appointmentId) {
  return apiRequest(`/prescriptions/${appointmentId}/send-link`, { method: 'POST', token });
}

export async function updatePrescription(token, appointmentId, payload) {
  return apiRequest(`/prescriptions/${appointmentId}`, { method: 'PUT', body: payload, token });
}

export async function fetchNewPatients({ days = 7 } = {}, token) {
  const query = `?days=${days}`;
  return apiRequest(`/practitioner/new-patients${query}`, { token });
}

export async function updatePatientCase(token, caseId, payload) {
  return apiRequest(`/practitioner/patient/${caseId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function rescheduleAppointment(token, appointmentId, payload) {
  return apiRequest(`/practitioner/appointments/${appointmentId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function createPractitionerAppointment(token, payload) {
  return apiRequest(`/practitioner/appointments`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function fetchPrescriptionHistory(token, appointmentId) {
  return apiRequest(`/prescriptions/${appointmentId}/history`, {
    method: 'GET',
    token,
  });
}

export async function requestPasswordReset(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    skipAuth: true,
  });
}

export async function resetPassword(payload) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}

export async function verifyEmailToken(token) {
  return apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    skipAuth: true,
  });
}

export async function deleteAppointment(token, appointmentId, options = {}) {
  const { cascadeAct = true } = options;
  return apiRequest(`/appointments/${appointmentId}?cascade_act=${cascadeAct}`, {
    method: 'DELETE',
    token,
  });
}

export async function initiateConsentProcedure(token, caseId) {
  return apiRequest(`/consents/procedures/${caseId}/initiate`, { method: 'POST', token });
}

export async function remindConsent(token, caseId) {
  return apiRequest(`/consents/procedures/${caseId}/remind`, { method: 'POST', token });
}

export async function fetchConsentStatus(token, caseId) {
  return apiRequest(`/consents/procedures/${caseId}/status`, { method: 'GET', token });
}

export async function requestPhoneOtp(token, payload) {
  return apiRequest('/procedures/phone-otp/request', { method: 'POST', body: payload, token });
}

export async function verifyPhoneOtp(token, payload) {
  return apiRequest('/procedures/phone-otp/verify', { method: 'POST', body: payload, token });
}

export async function sendConsentLinkCustom(token, payload) {
  return apiRequest('/procedures/send-consent-link-custom', { method: 'POST', body: payload, token });
}

export async function createCabinetSession(token, payload) {
  return apiRequest('/cabinet-sessions', { method: 'POST', token, body: payload });
}

export async function getCabinetSession(sessionCode) {
  return apiRequest(`/cabinet-sessions/${sessionCode}`, { method: 'GET', skipAuth: true });
}

export async function fetchCabinetPatientsToday(token) {
  return apiRequest('/cabinet-sessions/patients/today', { method: 'GET', token });
}

export async function fetchCabinetActiveSessions(token, appointmentId) {
  const query = new URLSearchParams({ appointment_id: String(appointmentId) }).toString();
  return apiRequest(`/cabinet-sessions/active?${query}`, { method: 'GET', token });
}

export async function fetchDocumentsDashboard(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.append('status', filters.status);
  }
  if (filters.dateRange) {
    params.append('date_range', filters.dateRange);
  }
  const query = params.toString();
  return apiRequest(`/practitioner/documents-dashboard${query ? `?${query}` : ''}`, {
    method: 'GET',
    token,
  });
}

export async function resendDocumentsDashboard(token, caseId, parentRole) {
  const query = new URLSearchParams({ parent_role: parentRole }).toString();
  return apiRequest(`/practitioner/documents-dashboard/${caseId}/resend-documents?${query}`, {
    method: 'POST',
    token,
  });
}

export async function downloadSignedConsent(token) {
  const resolvedToken = token || authSessionManager?.getAccessToken?.();
  const headers = resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {};
  const resp = await fetch(`${API_BASE_URL}/procedures/current/signed-consent`, {
    method: 'GET',
    headers,
  });
  if (!resp.ok) {
    const message = `Echec de telechargement (${resp.status})`;
    const error = new Error(message);
    error.status = resp.status;
    throw error;
  }
  return await resp.blob();
}

export { API_BASE_URL };
