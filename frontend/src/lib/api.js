const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export async function apiRequest(path, { method = 'GET', token, body } = {}) {
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
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (data && data.detail) || response.statusText;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

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

