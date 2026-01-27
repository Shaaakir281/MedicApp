/**
 * @typedef {'parent1'|'parent2'} ParentRole
 * @typedef {'surgical_authorization_minor'|'informed_consent'|'fees_consent_quote'} DocumentType
 *
 * @typedef {Object} LegalCaseVM
 * @property {string} key
 * @property {string} label
 * @property {boolean} required
 * @property {string[]} requiredRoles
 *
 * @typedef {Object} DocumentParentStateVM
 * @property {string[]} checkedKeys
 * @property {number} completedCount
 * @property {number} total
 * @property {string|null} signatureStatus
 * @property {string|null} signatureLink
 * @property {string|null} sentAt
 * @property {string|null} signedAt
 *
 * @typedef {Object} DocumentVM
 * @property {DocumentType} docType
 * @property {string} title
 * @property {string} version
 * @property {LegalCaseVM[]} cases
 * @property {{ parent1: DocumentParentStateVM, parent2: DocumentParentStateVM }} byParent
 * @property {number|null} documentSignatureId
 * @property {boolean} finalPdfAvailable
 * @property {boolean} signedPdfAvailable
 * @property {boolean} evidencePdfAvailable
 * @property {boolean} signatureSupported
 *
 * @typedef {Object} PatientDashboardVM
 * @property {{ firstName: string, lastName: string, birthDate: string|null, weightKg: number|null, medicalNotes: string }} child
 * @property {{ parent1: { name: string, email: string, phone: string, verified: boolean }, parent2: { name: string, email: string, phone: string, verified: boolean } }} guardians
 * @property {{ upcoming: Array<{ id: number, date: string|null, time: string|null, appointmentType: string, status: string, mode: string|null }>, history: Array<{ id: number, date: string|null, time: string|null, appointmentType: string, status: string, mode: string|null }> }} appointments
 * @property {DocumentVM[]} legalDocuments
 * @property {boolean} legalComplete
 * @property {boolean} signatureComplete
 */

export class DocumentSignatureVM {
  constructor(data) {
    this.id = data.id;
    this.documentType = data.document_type;
    this.parent1SignedAt = data.parent1_signed_at;
    this.parent1SignatureUrl = data.parent1_signature_url;
    this.parent2SignedAt = data.parent2_signed_at;
    this.parent2SignatureUrl = data.parent2_signature_url;
    this.downloadUrl = data.download_url;
    this.finalPdfAvailable = Boolean(data.final_pdf_identifier);
    this.signedPdfAvailable = Boolean(data.signed_pdf_identifier);
    this.evidencePdfAvailable = Boolean(data.evidence_pdf_identifier);
    this.overallStatus = data.overall_status || 'draft';
    this.parent1Status = data.parent1_status || 'draft';
    this.parent2Status = data.parent2_status || 'draft';
    this.status = this._calculateStatus();
  }

  _calculateStatus() {
    if (this.overallStatus === 'completed') return 'completed';

    const p1Signed = Boolean(this.parent1SignedAt);
    const p2Signed = Boolean(this.parent2SignedAt);

    if (p1Signed && p2Signed) return 'completed';
    if (p1Signed || p2Signed) return 'partial';
    return 'pending';
  }

  get displayLabel() {
    const labels = {
      authorization: 'Autorisation parentale',
      consent: 'Consentement eclaire',
      fees: 'Frais et honoraires',
    };
    return labels[this.documentType] || this.documentType;
  }

  get signaturesText() {
    const p1 = this.parent1SignedAt ? 'Parent 1 OK' : 'Parent 1 -';
    const p2 = this.parent2SignedAt ? 'Parent 2 OK' : 'Parent 2 -';
    return `${p1}, ${p2}`;
  }
}

export {};
