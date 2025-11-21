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

    const message = (payload && payload.detail) || response.statusText;
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

export async function acknowledgeProcedureSteps(token) {
  return apiRequest('/procedures/acknowledge-steps', {
    method: 'POST',
    token,
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

export { API_BASE_URL };
