const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Maps catalog document types to signature API document types.
 */
function mapDocumentType(value) {
  const mapping = {
    surgical_authorization_minor: 'authorization',
    informed_consent: 'consent',
    fees_consent_quote: 'fees',
  };
  return mapping[value] || value;
}


/**
 * Démarre la signature pour un document spécifique (patient)
 * @param {Object} payload - Données de la requête
 * @param {number} payload.procedure_case_id - ID du dossier
 * @param {string} payload.document_type - Type de document
 * @param {string} payload.signer_role - Rôle du signataire (parent1/parent2)
 * @param {string} payload.mode - Mode de signature (remote/cabinet)
 * @param {string} payload.session_code - Code de session (optionnel)
 * @param {string} token - Token d'authentification (optionnel)
 * @returns {Promise<Object>} Réponse avec le lien de signature
 */
export async function startDocumentSignature(payload = {}, token = null) {
  const resolvedToken = token || payload?.token || null;
  const procedureCaseId = payload?.procedureCaseId ?? payload?.procedure_case_id ?? null;
  const appointmentId = payload?.appointmentId ?? payload?.appointment_id ?? null;
  const documentType = payload?.documentType ?? payload?.document_type ?? null;
  const signerRole = payload?.signerRole ?? payload?.signer_role ?? null;
  const mode = payload?.mode || 'remote';
  const sessionCode = payload?.sessionCode ?? payload?.session_code ?? null;

  const body = {
    procedure_case_id: procedureCaseId || undefined,
    appointment_id: appointmentId || undefined,
    document_type: mapDocumentType(documentType) || undefined,
    signer_role: signerRole || undefined,
    mode,
    session_code: sessionCode || undefined,
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/signature/start-document`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Impossible de démarrer la signature');
  }

  return response.json();
}

/**
 * Permet au praticien d'envoyer ou renvoyer une demande de signature pour un document
 * @param {string} token - Token d'authentification
 * @param {number} caseId - ID du dossier patient
 * @param {string} documentType - Type de document ("authorization" | "consent" | "fees")
 * @returns {Promise<Object>} Détails de la signature du document
 */
export async function practitionerSendSignature(token, caseId, documentType) {
  const response = await fetch(`${API_BASE_URL}/signature/practitioner/send-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      case_id: caseId,
      document_type: documentType,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Impossible d\'envoyer la demande de signature');
  }

  return response.json();
}

/**
 * Récupère tous les documents de signature pour un dossier
 * @param {string} token - Token d'authentification
 * @param {number} caseId - ID du dossier patient
 * @returns {Promise<Object>} Liste des documents de signature
 */
export async function getCaseDocumentSignatures(token, caseId) {
  const response = await fetch(`${API_BASE_URL}/signature/case/${caseId}/documents`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Impossible de récupérer les documents');
  }

  return response.json();
}

/**
 * Télécharge un fichier de signature de document (final, signed, evidence)
 * @param {Object} params - Paramètres
 * @param {string} params.token - Token d'authentification
 * @param {number} params.documentSignatureId - ID de la signature de document
 * @param {string} params.fileKind - Type de fichier ('final', 'signed', 'evidence')
 * @param {boolean} params.inline - Si true, affiche dans le navigateur, sinon télécharge
 * @returns {Promise<Blob>} Le fichier PDF
 */
export async function downloadDocumentSignatureFile({ token, documentSignatureId, fileKind, inline = false }) {
  const params = new URLSearchParams();
  if (inline) {
    params.append('inline', 'true');
  }

  const queryString = params.toString();
  const url = `${API_BASE_URL}/signature/document/${documentSignatureId}/file/${fileKind}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Impossible de télécharger le fichier');
  }

  return response.blob();
}

/**
 * Télécharge la prévisualisation d'un document légal (base non signée)
 * @param {Object} params - Paramètres
 * @param {string} params.token - Token d'authentification
 * @param {number} params.procedureCaseId - ID du dossier
 * @param {string} params.documentType - Type de document
 * @param {boolean} params.inline - Si true, affiche dans le navigateur, sinon télécharge
 * @returns {Promise<Blob>} Le fichier PDF
 */
export async function downloadLegalDocumentPreview({ token, procedureCaseId, documentType, inline = true }) {
  const params = new URLSearchParams();
  if (inline) {
    params.append('inline', 'true');
  }

  const queryString = params.toString();
  const url = `${API_BASE_URL}/signature/case/${procedureCaseId}/document/${documentType}/preview${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Impossible de télécharger la prévisualisation');
  }

  return response.blob();
}
