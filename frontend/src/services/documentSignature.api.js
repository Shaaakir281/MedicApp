/**
 * Document Signature API Client
 *
 * Architecture granulaire: 1 Signature Request Yousign = 1 document médical
 *
 * Endpoints:
 * - POST /signature/start-document : Démarrer signature pour UN document
 * - GET /signature/document/{id} : Statut d'une signature
 * - GET /signature/case/{caseId}/documents : Liste des signatures d'un case
 */

import { apiRequest } from '../lib/api.js';

/**
 * Maps catalog document types to signature API document types.
 * Catalog: surgical_authorization_minor, informed_consent, fees_consent_quote
 * API: authorization, consent, fees
 */
function mapDocumentType(catalogType) {
  const mapping = {
    'surgical_authorization_minor': 'authorization',
    'informed_consent': 'consent',
    'fees_consent_quote': 'fees',
  };
  return mapping[catalogType] || catalogType;
}

/**
 * Démarre la signature pour UN document spécifique.
 *
 * @param {Object} params
 * @param {string} params.token - JWT token
 * @param {number} params.procedureCaseId - ID du ProcedureCase
 * @param {string} params.documentType - "authorization", "consent", "fees"
 * @param {string} params.signerRole - "parent1" ou "parent2"
 * @param {string} params.mode - "remote" (OTP SMS) ou "cabinet" (no OTP)
 * @param {string} [params.sessionCode] - Code session cabinet (optionnel)
 *
 * @returns {Promise<{
 *   document_signature_id: number,
 *   document_type: string,
 *   signer_role: string,
 *   signature_link: string,
 *   yousign_procedure_id: string,
 *   status: string
 * }>}
 */
export async function startDocumentSignature({
  token,
  procedureCaseId,
  documentType,
  signerRole,
  mode = 'remote',
  sessionCode = null,
}) {
  return apiRequest('/signature/start-document', {
    method: 'POST',
    token,
    body: {
      procedure_case_id: procedureCaseId,
      document_type: mapDocumentType(documentType), // Map catalog type to API type
      signer_role: signerRole,
      mode,
      session_code: sessionCode,
    },
  });
}

/**
 * Récupère le statut d'une signature de document.
 *
 * @param {Object} params
 * @param {string} params.token - JWT token
 * @param {number} params.documentSignatureId - ID du DocumentSignature
 *
 * @returns {Promise<{
 *   id: number,
 *   procedure_case_id: number,
 *   document_type: string,
 *   document_version: string,
 *   overall_status: string,
 *   parent1_status: string,
 *   parent1_signature_link: string,
 *   parent1_signed_at: string,
 *   parent2_status: string,
 *   parent2_signature_link: string,
 *   parent2_signed_at: string,
 *   signed_pdf_identifier: string,
 *   evidence_pdf_identifier: string,
 *   final_pdf_identifier: string,
 *   created_at: string,
 *   updated_at: string,
 *   completed_at: string,
 *   yousign_purged_at: string
 * }>}
 */
export async function getDocumentSignatureStatus({ token, documentSignatureId }) {
  return apiRequest(`/signature/document/${documentSignatureId}`, { token });
}

/**
 * Liste toutes les signatures de documents pour un ProcedureCase.
 *
 * @param {Object} params
 * @param {string} params.token - JWT token
 * @param {number} params.procedureCaseId - ID du ProcedureCase
 *
 * @returns {Promise<{
 *   procedure_case_id: number,
 *   document_signatures: Array<DocumentSignatureDetail>
 * }>}
 */
export async function getCaseDocumentSignatures({ token, procedureCaseId }) {
  return apiRequest(`/signature/case/${procedureCaseId}/documents`, { token });
}
