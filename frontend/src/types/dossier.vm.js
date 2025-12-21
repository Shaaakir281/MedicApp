/**
 * @typedef {"PARENT_1" | "PARENT_2"} GuardianRole
 *
 * @typedef {Object} GuardianVM
 * @property {string | null} id
 * @property {GuardianRole} role
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} [email]
 * @property {string} [phoneE164]
 * @property {string | null} [phoneVerifiedAt]
 *
 * @typedef {Object} ChildVM
 * @property {string | null} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} birthDate
 * @property {number | string | null} [weightKg]
 * @property {string} [medicalNotes]
 *
 * @typedef {{step: "idle"} | {step: "sent", expiresInSec: number, cooldownSec: number} | {step: "verified", verifiedAt: string} | {step: "locked", retryAfterSec?: number}} PhoneVerificationState
 *
 * @typedef {Object} DossierVM
 * @property {ChildVM} child
 * @property {Record<GuardianRole, GuardianVM>} guardians
 * @property {Record<GuardianRole, PhoneVerificationState>} verification
 * @property {string[]} warnings
 */
