const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (payload && payload.detail) || response.statusText;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export { apiRequest };

export async function registerUser(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: payload });
}

export async function loginUser(payload) {
  return apiRequest('/auth/login', { method: 'POST', body: payload });
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

export async function createPrescription(token, appointmentId) {
  return apiRequest(`/prescriptions/${appointmentId}`, { method: 'POST', token });
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

export { API_BASE_URL };
