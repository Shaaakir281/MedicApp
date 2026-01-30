const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function createCabinetSignatureSession({ token, documentSignatureId, parentRole }) {
  const response = await fetch(`${API_BASE_URL}/cabinet-signatures/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      document_signature_id: documentSignatureId,
      parent_role: parentRole,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Impossible de creer la session.');
  }

  return response.json();
}

export async function fetchCabinetSignatureStatus(token) {
  const response = await fetch(`${API_BASE_URL}/cabinet-signatures/${token}/status`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Session introuvable.');
  }
  return response.json();
}

export async function uploadCabinetSignature({ token, signatureBase64, consentConfirmed = true, deviceId = null }) {
  const response = await fetch(`${API_BASE_URL}/cabinet-signatures/${token}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature_base64: signatureBase64,
      consent_confirmed: consentConfirmed,
      device_id: deviceId || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Signature impossible.');
  }

  return response.json();
}
