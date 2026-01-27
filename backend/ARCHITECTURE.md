## Flux de signature (Yousign v3) sans PHI

- Document envoye a Yousign: PDF neutre par document (authorization/consent/fees) via `templates/consent_neutral_document.html`,
  avec reference + hash SHA-256 du PDF medical complet stocke en HDS. Aucune PHI.
- Orchestration: `services/yousign/workflow.py` + `services/document_signature_service.py` cree la signature request,
  uploade le PDF neutre, ajoute les signataires (parent1/parent2), active et recupere les liens.
- Stockage HDS: PDF medical complet (legal_documents_pdf), PDF neutre signe, audit trail, PDF final assemble.
  Categories: `legal_documents/*`, `legal_documents_signed/*`, `legal_documents_evidence/*`, `legal_documents_final/*`.
- Recuperation preuve: a l'evenement `signature_request.done`, telecharger PDF signe + audit(s) et assembler un PDF final
  (medical + audit + neutre signe) via PyPDF2.
- Nettoyage: suppression de la signature_request cote Yousign apres recuperation.
- Controles: ne jamais envoyer de PHI (type d'acte, nom enfant, praticien) dans Yousign. Email/telephone parent uniquement.
