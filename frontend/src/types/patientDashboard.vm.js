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
 * @property {string|null} previewPdfUrl
 * @property {number|null} documentSignatureId
 * @property {boolean} finalPdfAvailable
 * @property {boolean} signedPdfAvailable
 * @property {boolean} evidencePdfAvailable
 * @property {boolean} legacySignedAvailable
 * @property {boolean} legacyEvidenceAvailable
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

export {};
