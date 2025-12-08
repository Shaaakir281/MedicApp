## Flux de signature (Yousign v3) sans PHI

- **Document envoyé à Yousign** : PDF neutre (`templates/consent_neutral.html`) contenant uniquement un identifiant de consentement et un hash SHA-256 du consentement complet stocké en HDS. Aucune donnée médicale ou identité patient/praticien.
- **Orchestration** : `services/yousign/workflow.py` crée la signature request, uploade le PDF neutre, ajoute des signataires génériques (`Parent 1/2`, OTP SMS), active et récupère les liens. `services/consents.py` gère les statuts métier.
- **Stockage HDS** : tous les PDF (consentement complet, neutre signé, audit trail, final assemblé) sont persistés via `services.storage`. Catégories dédiées : `consents`, `signed_consents`, `consent_evidences`, `final_consents`.
- **Récupération preuve** : lors de l’événement `signed/done`, le backend télécharge le PDF signé et l’audit Yousign avec Bearer auth, les stocke en HDS puis assemble un PDF final (consentement complet + audit + neutre signé) via PyPDF2.
- **Nettoyage** : après récupération et assemblage, le backend tente de supprimer la signature_request côté Yousign (`DELETE ...?permanent_delete=true`) pour ne laisser aucune trace du PDF neutre.
- **Contrôles à respecter** : ne jamais mettre le type d’acte, le nom de l’enfant, du praticien ou tout PHI dans les payloads/labels/metadonnées Yousign. Seuls email/phone du parent sont transmis pour la livraison/OTP.
