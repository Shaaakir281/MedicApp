from __future__ import annotations

from .types import DocumentType, LegalDocumentCase, LegalDocumentDefinition, SignerRole

CATALOG_VERSION = "v1"

SURGICAL_AUTHORIZATION_MINOR_CASES: tuple[LegalDocumentCase, ...] = (
    LegalDocumentCase(
        key="both_parents_required",
        text="Je reconnais que ce document est à compléter et signer par les deux parents.",
    ),
    LegalDocumentCase(
        key="provide_supporting_docs",
        text="Je comprends que des documents sont à fournir (pièce d'identité, livret de famille, jugement si un seul parent détient l'autorité parentale).",
    ),
    LegalDocumentCase(
        key="procedure_information",
        text="J’ai été informé de la posthectomie totale sous anesthésie locale dans le cadre rituel et/ou religieux.",
    ),
    LegalDocumentCase(
        key="risks_explained",
        text="Les risques prévisibles m’ont été expliqués.",
    ),
    LegalDocumentCase(
        key="authorize_cabinet",
        text="J’autorise que l’intervention soit réalisée au cabinet médical.",
    ),
    LegalDocumentCase(
        key="authorize_transfer",
        text="J’autorise le médecin à décider hospitalisation/transfert si nécessaire.",
    ),
    LegalDocumentCase(
        key="no_reimbursement",
        text="J’ai compris que les frais ne sont pas remboursés par sécurité sociale et mutuelles.",
    ),
    LegalDocumentCase(
        key="minor_consent_sought",
        text="J’ai compris que le consentement du mineur doit être recherché s’il est apte à exprimer sa volonté.",
    ),
)

INFORMED_CONSENT_CASES: tuple[LegalDocumentCase, ...] = (
    LegalDocumentCase(
        key="understand_purpose",
        text="J’ai compris le but (éviter décalottage, toilette régulière).",
    ),
    LegalDocumentCase(
        key="understand_procedure",
        text="J’ai compris la réalisation (ablation prépuce, anesthésie loco-régionale, 15–20 min, souvent en consultation).",
    ),
    LegalDocumentCase(
        key="risks_immediate",
        text="J’ai compris les risques immédiats (douleurs mictionnelles, œdème, croûtes, saignement, possible hémostase).",
    ),
    LegalDocumentCase(
        key="risks_secondary",
        text="J’ai compris les risques secondaires (rétrécissement du méat, rare réintervention).",
    ),
    LegalDocumentCase(
        key="risk_of_complication",
        text="J’ai compris qu’il existe un risque de complication même exceptionnel.",
    ),
    LegalDocumentCase(
        key="questions_answered",
        text="J’ai pu poser des questions et j’ai compris les réponses ; je donne mon consentement.",
    ),
)

FEES_CONSENT_QUOTE_CASES: tuple[LegalDocumentCase, ...] = (
    LegalDocumentCase(
        key="fees_amount",
        text="Je comprends que le montant est de 300 euros.",
        required_roles=(SignerRole.parent1, SignerRole.parent2),
    ),
    LegalDocumentCase(
        key="no_cpam_coverage",
        text="Je comprends que ce n’est pas pris en charge par la CPAM (intervention religieuse/rituelle).",
        required_roles=(SignerRole.parent1, SignerRole.parent2),
    ),
    LegalDocumentCase(
        key="quote_signature_responsible",
        text="Je comprends que le devis doit être signé par le patient majeur ou les parents si mineur.",
        required_roles=(SignerRole.parent1, SignerRole.parent2),
    ),
    LegalDocumentCase(
        key="lu_et_approuve",
        text="Je signerai avec la mention \"Lu et approuvé\".",
        required_roles=(SignerRole.parent1, SignerRole.parent2),
    ),
)

LEGAL_CATALOG: dict[DocumentType, LegalDocumentDefinition] = {
    DocumentType.SURGICAL_AUTHORIZATION_MINOR: LegalDocumentDefinition(
        type=DocumentType.SURGICAL_AUTHORIZATION_MINOR,
        title="Autorisation d’intervention chirurgicale sur mineur",
        version=CATALOG_VERSION,
        cases=SURGICAL_AUTHORIZATION_MINOR_CASES,
    ),
    DocumentType.INFORMED_CONSENT: LegalDocumentDefinition(
        type=DocumentType.INFORMED_CONSENT,
        title="Fiche de consentement éclairé",
        version=CATALOG_VERSION,
        cases=INFORMED_CONSENT_CASES,
    ),
    DocumentType.FEES_CONSENT_QUOTE: LegalDocumentDefinition(
        type=DocumentType.FEES_CONSENT_QUOTE,
        title="Consentement honoraires / devis",
        version=CATALOG_VERSION,
        cases=FEES_CONSENT_QUOTE_CASES,
    ),
}
