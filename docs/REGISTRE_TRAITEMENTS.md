# Registre des ActivitÃ©s de Traitement - MedicApp

**ConformÃ©ment Ã  l'article 30 du RGPD**

**Responsable de traitement :** Dr. [NOM DU PRATICIEN Ã€ REMPLIR]
**Date de crÃ©ation :** [DATE Ã€ REMPLIR]
**DerniÃ¨re mise Ã  jour :** [DATE Ã€ REMPLIR]
**Version :** 1.0

---

## Sommaire

1. [Traitement nÂ°1 : Gestion des dossiers patients](#traitement-n1--gestion-des-dossiers-patients)
2. [Traitement nÂ°2 : Signature Ã©lectronique des documents](#traitement-n2--signature-Ã©lectronique-des-documents)
3. [Traitement nÂ°3 : Gestion des rendez-vous](#traitement-n3--gestion-des-rendez-vous)
4. [Traitement nÂ°4 : Envoi de prescriptions mÃ©dicales](#traitement-n4--envoi-de-prescriptions-mÃ©dicales)
5. [Traitement nÂ°5 : Authentification et gestion des comptes](#traitement-n5--authentification-et-gestion-des-comptes)
6. [Traitement nÂ°6 : Logs et traÃ§abilitÃ© HDS](#traitement-n6--logs-et-traÃ§abilitÃ©-hds)

---

## Traitement nÂ°1 : Gestion des dossiers patients

### Informations gÃ©nÃ©rales

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Gestion des dossiers mÃ©dicaux patients |
| **RÃ©fÃ©rence interne** | TRAIT-001-DOSSIER |
| **Date de crÃ©ation** | [DATE] |
| **Responsable de traitement** | Dr. [NOM DU PRATICIEN] |
| **CoordonnÃ©es** | [ADRESSE CABINET] - [EMAIL] - [TÃ‰LÃ‰PHONE] |

### FinalitÃ©s du traitement

| NÂ° | FinalitÃ© |
|----|----------|
| 1 | Constitution et gestion du dossier mÃ©dical du patient (enfant) |
| 2 | Suivi mÃ©dical prÃ© et post-opÃ©ratoire |
| 3 | Gestion de la relation patient-praticien |
| 4 | Facturation des actes mÃ©dicaux |

### Base lÃ©gale

| Base lÃ©gale | Justification |
|-------------|---------------|
| **Obligation lÃ©gale** (art. 6.1.c) | Article L. 1111-7 du Code de la SantÃ© Publique : obligation de tenir un dossier mÃ©dical |
| **Consentement explicite** (art. 9.2.a) | Pour les donnÃ©es de santÃ© : consentement recueilli via signature Ã©lectronique |
| **IntÃ©rÃªt vital** (art. 6.1.d) | En cas d'urgence mÃ©dicale |

### CatÃ©gories de personnes concernÃ©es

| CatÃ©gorie | Description |
|-----------|-------------|
| Patients | Enfants mineurs bÃ©nÃ©ficiant de l'acte mÃ©dical (circoncision) |
| Parents/Tuteurs | Titulaires de l'autoritÃ© parentale (parent 1 et parent 2) |

### CatÃ©gories de donnÃ©es traitÃ©es

| CatÃ©gorie | DonnÃ©es | SensibilitÃ© |
|-----------|---------|-------------|
| **IdentitÃ© enfant** | Nom, prÃ©nom, date de naissance | DonnÃ©es personnelles |
| **SantÃ© enfant** | Poids, questionnaire mÃ©dical, antÃ©cÃ©dents, allergies | **DonnÃ©es sensibles (art. 9)** |
| **IdentitÃ© parents** | Nom, prÃ©nom | DonnÃ©es personnelles |
| **CoordonnÃ©es parents** | Email, tÃ©lÃ©phone, adresse | DonnÃ©es personnelles |
| **AutoritÃ© parentale** | Attestation sur l'honneur | DonnÃ©es personnelles |

### Destinataires des donnÃ©es

| CatÃ©gorie | Destinataire | FinalitÃ© | Base |
|-----------|--------------|----------|------|
| **Interne** | Dr. [NOM] | Suivi mÃ©dical | Obligation lÃ©gale |
| **Sous-traitant** | Microsoft Azure (HDS) | HÃ©bergement | Contrat DPA |

### Transferts hors UE

| Transfert hors UE | NON |
|-------------------|-----|
| **Justification** | Toutes les donnÃ©es sont hÃ©bergÃ©es en France (rÃ©gion Azure West Europe) |

### DurÃ©e de conservation

| DonnÃ©es | DurÃ©e | Base lÃ©gale |
|---------|-------|-------------|
| Dossier mÃ©dical complet | 20 ans aprÃ¨s derniÃ¨re consultation | Art. R. 1112-7 CSP |
| Si patient mineur | Jusqu'aux 28 ans du patient | Art. R. 1112-7 CSP |

### Mesures de sÃ©curitÃ©

| Mesure | Description |
|--------|-------------|
| Chiffrement au repos | AES-256 (Azure + application) |
| Chiffrement en transit | TLS 1.3 |
| ContrÃ´le d'accÃ¨s | Authentification JWT + MFA praticien |
| TraÃ§abilitÃ© | Logs de tous les accÃ¨s |
| Sauvegarde | Quotidienne, gÃ©o-redondante |

---

## Traitement nÂ°2 : Signature Ã©lectronique des documents

### Informations gÃ©nÃ©rales

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Signature Ã©lectronique des documents lÃ©gaux |
| **RÃ©fÃ©rence interne** | TRAIT-002-SIGNATURE |
| **Date de crÃ©ation** | [DATE] |
| **Responsable de traitement** | Dr. [NOM DU PRATICIEN] |

### FinalitÃ©s du traitement

| NÂ° | FinalitÃ© |
|----|----------|
| 1 | Recueil du consentement Ã©clairÃ© des parents |
| 2 | Signature de l'autorisation parentale pour acte sur mineur |
| 3 | Signature du devis et acceptation des frais |
| 4 | Constitution de preuves juridiques horodatÃ©es |

### Base lÃ©gale

| Base lÃ©gale | Justification |
|-------------|---------------|
| **Consentement explicite** (art. 9.2.a) | Signature volontaire par les parents |
| **Obligation lÃ©gale** (art. 6.1.c) | Consentement obligatoire pour acte mÃ©dical sur mineur |
| **ExÃ©cution contractuelle** (art. 6.1.b) | Acceptation du devis |

### CatÃ©gories de personnes concernÃ©es

| CatÃ©gorie | Description |
|-----------|-------------|
| Parents/Tuteurs | Signataires des documents lÃ©gaux |

### CatÃ©gories de donnÃ©es traitÃ©es

| CatÃ©gorie | DonnÃ©es | SensibilitÃ© |
|-----------|---------|-------------|
| **IdentitÃ© signataire** | Nom, prÃ©nom (pseudonymisÃ© chez Yousign) | DonnÃ©es personnelles |
| **CoordonnÃ©es** | Email, tÃ©lÃ©phone (pour OTP) | DonnÃ©es personnelles |
| **Signature** | Image signature, horodatage, IP | DonnÃ©es personnelles |
| **Document signÃ©** | PDF contenant donnÃ©es mÃ©dicales (aprÃ¨s signature) | **DonnÃ©es sensibles** |

### Destinataires des donnÃ©es

| CatÃ©gorie | Destinataire | FinalitÃ© | Base |
|-----------|--------------|----------|------|
| **Interne** | Dr. [NOM] | Conservation preuve | Obligation lÃ©gale |
| **Sous-traitant** | Yousign | Signature Ã©lectronique | Contrat DPA + eIDAS |
| **Sous-traitant** | Twilio | Envoi SMS OTP | Contrat DPA |
| **Sous-traitant** | Microsoft Azure | Stockage PDF signÃ©s | Contrat DPA + HDS |

### Transferts hors UE

| Transfert hors UE | NON |
|-------------------|-----|
| **Yousign** | Serveurs en France |
| **Twilio SMS** | Serveurs UE (Irlande) |
| **Azure** | RÃ©gion France |

### DurÃ©e de conservation

| DonnÃ©es | DurÃ©e | Base lÃ©gale |
|---------|-------|-------------|
| Documents signÃ©s | 20 ans | Preuve juridique + dossier mÃ©dical |
| Audit trail Yousign | PurgÃ© immÃ©diatement aprÃ¨s rÃ©cupÃ©ration | RGPD (minimisation) |
| Preuves de signature | 20 ans | Conservation avec dossier mÃ©dical |

### Mesures de sÃ©curitÃ©

| Mesure | Description |
|--------|-------------|
| Pseudonymisation | Noms pseudonymisÃ©s chez Yousign (Parent 1, Parent 2) |
| PDF neutre | Aucune donnÃ©e mÃ©dicale transmise Ã  Yousign |
| Chiffrement | PDF stockÃ©s chiffrÃ©s AES-256 |
| Purge Yousign | Suppression immÃ©diate aprÃ¨s rÃ©cupÃ©ration des preuves |
| Horodatage | Timestamp serveur Yousign |

---

## Traitement nÂ°3 : Gestion des rendez-vous

### Informations gÃ©nÃ©rales

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Gestion de l'agenda et des rendez-vous |
| **RÃ©fÃ©rence interne** | TRAIT-003-RDV |
| **Date de crÃ©ation** | [DATE] |
| **Responsable de traitement** | Dr. [NOM DU PRATICIEN] |

### FinalitÃ©s du traitement

| NÂ° | FinalitÃ© |
|----|----------|
| 1 | Planification des rendez-vous (prÃ©-consultation, acte) |
| 2 | Envoi de rappels par email/SMS |
| 3 | Suivi des rendez-vous (validÃ©, annulÃ©, reportÃ©) |

### Base lÃ©gale

| Base lÃ©gale | Justification |
|-------------|---------------|
| **ExÃ©cution contractuelle** (art. 6.1.b) | Organisation de la prestation mÃ©dicale |
| **Consentement** (art. 6.1.a) | Envoi de rappels par email/SMS |

### CatÃ©gories de personnes concernÃ©es

| CatÃ©gorie | Description |
|-----------|-------------|
| Patients | Enfants ayant un rendez-vous planifiÃ© |
| Parents/Tuteurs | Contacts pour les rappels |

### CatÃ©gories de donnÃ©es traitÃ©es

| CatÃ©gorie | DonnÃ©es | SensibilitÃ© |
|-----------|---------|-------------|
| **Rendez-vous** | Date, heure, type (prÃ©-consultation/acte), mode (visio/prÃ©sentiel) | DonnÃ©es personnelles |
| **CoordonnÃ©es** | Email, tÃ©lÃ©phone parent | DonnÃ©es personnelles |
| **Statut** | ValidÃ©, en attente, annulÃ© | DonnÃ©es personnelles |

### Destinataires des donnÃ©es

| CatÃ©gorie | Destinataire | FinalitÃ© | Base |
|-----------|--------------|----------|------|
| **Interne** | Dr. [NOM] | Gestion agenda | ExÃ©cution contrat |
| **Sous-traitant** | Twilio | Envoi SMS rappel | Contrat DPA |
| **Sous-traitant** | SMTP (Mailjet) | Envoi email rappel | Contrat DPA |

### Transferts hors UE

| Transfert hors UE | NON |
|-------------------|-----|

### DurÃ©e de conservation

| DonnÃ©es | DurÃ©e | Base lÃ©gale |
|---------|-------|-------------|
| Historique rendez-vous | 20 ans | Dossier mÃ©dical |
| Logs rappels envoyÃ©s | 1 an | Preuve d'envoi |

### Mesures de sÃ©curitÃ©

| Mesure | Description |
|--------|-------------|
| Authentification | AccÃ¨s rÃ©servÃ© au praticien authentifiÃ© |
| HTTPS | Communications chiffrÃ©es |

---

## Traitement nÂ°4 : Envoi de prescriptions mÃ©dicales

### Informations gÃ©nÃ©rales

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | GÃ©nÃ©ration et envoi des ordonnances mÃ©dicales |
| **RÃ©fÃ©rence interne** | TRAIT-004-PRESCRIPTION |
| **Date de crÃ©ation** | [DATE] |
| **Responsable de traitement** | Dr. [NOM DU PRATICIEN] |

### FinalitÃ©s du traitement

| NÂ° | FinalitÃ© |
|----|----------|
| 1 | GÃ©nÃ©ration d'ordonnances prÃ©-opÃ©ratoires |
| 2 | GÃ©nÃ©ration d'ordonnances post-opÃ©ratoires |
| 3 | Signature Ã©lectronique par le praticien |
| 4 | Envoi aux parents par email |

### Base lÃ©gale

| Base lÃ©gale | Justification |
|-------------|---------------|
| **Obligation lÃ©gale** (art. 6.1.c) | Prescription mÃ©dicale obligatoire |
| **Consentement** (art. 6.1.a) | Envoi par email |

### CatÃ©gories de personnes concernÃ©es

| CatÃ©gorie | Description |
|-----------|-------------|
| Patients | Enfants bÃ©nÃ©ficiaires des prescriptions |
| Parents/Tuteurs | Destinataires des ordonnances |

### CatÃ©gories de donnÃ©es traitÃ©es

| CatÃ©gorie | DonnÃ©es | SensibilitÃ© |
|-----------|---------|-------------|
| **IdentitÃ© patient** | Nom, prÃ©nom, date de naissance | DonnÃ©es personnelles |
| **Prescription** | MÃ©dicaments, posologie | **DonnÃ©es de santÃ©** |
| **Praticien** | Nom, RPPS, signature | DonnÃ©es personnelles |

### Destinataires des donnÃ©es

| CatÃ©gorie | Destinataire | FinalitÃ© | Base |
|-----------|--------------|----------|------|
| **Interne** | Dr. [NOM] | RÃ©daction prescription | Obligation lÃ©gale |
| **Patient/Parents** | Email parents | RÃ©ception ordonnance | Consentement |
| **Sous-traitant** | SMTP (Mailjet) | Envoi email | Contrat DPA |
| **Sous-traitant** | Azure Blob | Stockage PDF | Contrat DPA + HDS |

### Transferts hors UE

| Transfert hors UE | NON |
|-------------------|-----|

### DurÃ©e de conservation

| DonnÃ©es | DurÃ©e | Base lÃ©gale |
|---------|-------|-------------|
| Ordonnances | 20 ans | Dossier mÃ©dical |
| Logs tÃ©lÃ©chargement | 1 an | TraÃ§abilitÃ© |

### Mesures de sÃ©curitÃ©

| Mesure | Description |
|--------|-------------|
| Signature praticien | Ordonnance signÃ©e Ã©lectroniquement |
| Chiffrement | PDF stockÃ© chiffrÃ© AES-256 |
| TraÃ§abilitÃ© | Log de chaque tÃ©lÃ©chargement |

---

## Traitement nÂ°5 : Authentification et gestion des comptes

### Informations gÃ©nÃ©rales

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Gestion des comptes utilisateurs et authentification |
| **RÃ©fÃ©rence interne** | TRAIT-005-AUTH |
| **Date de crÃ©ation** | [DATE] |
| **Responsable de traitement** | Dr. [NOM DU PRATICIEN] |

### FinalitÃ©s du traitement

| NÂ° | FinalitÃ© |
|----|----------|
| 1 | CrÃ©ation et gestion des comptes patients |
| 2 | Authentification sÃ©curisÃ©e (login) |
| 3 | Authentification forte MFA pour praticiens |
| 4 | RÃ©cupÃ©ration de mot de passe |
| 5 | VÃ©rification d'email |

### Base lÃ©gale

| Base lÃ©gale | Justification |
|-------------|---------------|
| **ExÃ©cution contractuelle** (art. 6.1.b) | AccÃ¨s au service |
| **IntÃ©rÃªt lÃ©gitime** (art. 6.1.f) | SÃ©curitÃ© du systÃ¨me |

### CatÃ©gories de personnes concernÃ©es

| CatÃ©gorie | Description |
|-----------|-------------|
| Patients/Parents | Utilisateurs avec compte patient |
| Praticien | Utilisateur avec compte praticien |

### CatÃ©gories de donnÃ©es traitÃ©es

| CatÃ©gorie | DonnÃ©es | SensibilitÃ© |
|-----------|---------|-------------|
| **Identifiants** | Email, mot de passe (hashÃ©) | DonnÃ©es personnelles |
| **MFA** | Code OTP, numÃ©ro tÃ©lÃ©phone | DonnÃ©es personnelles |
| **Tokens** | JWT access/refresh | DonnÃ©es techniques |
| **Tentatives login** | IP, timestamp, succÃ¨s/Ã©chec | DonnÃ©es techniques |

### Destinataires des donnÃ©es

| CatÃ©gorie | Destinataire | FinalitÃ© | Base |
|-----------|--------------|----------|------|
| **Sous-traitant** | Twilio | Envoi SMS MFA | Contrat DPA |
| **Sous-traitant** | Azure | Stockage | Contrat DPA |

### Transferts hors UE

| Transfert hors UE | NON |
|-------------------|-----|

### DurÃ©e de conservation

| DonnÃ©es | DurÃ©e | Base lÃ©gale |
|---------|-------|-------------|
| Compte utilisateur | DurÃ©e de la relation + 3 ans | CNIL recommandation |
| Tokens de session | 15 min (access) / 7 jours (refresh) | SÃ©curitÃ© |
| Logs authentification | 1 an | Obligation HDS |
| Codes MFA | 5 minutes | SÃ©curitÃ© |

### Mesures de sÃ©curitÃ©

| Mesure | Description |
|--------|-------------|
| Hashage mot de passe | bcrypt_sha256 |
| ComplexitÃ© mot de passe | 12 caractÃ¨res min, majuscules, minuscules, chiffres, spÃ©ciaux |
| MFA praticien | SMS OTP obligatoire |
| Rate-limiting | 5 tentatives / minute sur /auth/login |
| Verrouillage | Compte bloquÃ© aprÃ¨s 5 Ã©checs consÃ©cutifs |

---

## Traitement nÂ°6 : Logs et traÃ§abilitÃ© HDS

### Informations gÃ©nÃ©rales

| Champ | Valeur |
|-------|--------|
| **Nom du traitement** | Journalisation et traÃ§abilitÃ© des accÃ¨s (obligation HDS) |
| **RÃ©fÃ©rence interne** | TRAIT-006-LOGS |
| **Date de crÃ©ation** | [DATE] |
| **Responsable de traitement** | Dr. [NOM DU PRATICIEN] |

### FinalitÃ©s du traitement

| NÂ° | FinalitÃ© |
|----|----------|
| 1 | TraÃ§abilitÃ© des accÃ¨s aux donnÃ©es de santÃ© (obligation HDS) |
| 2 | DÃ©tection d'accÃ¨s non autorisÃ©s |
| 3 | Preuve en cas de litige |
| 4 | Audit de sÃ©curitÃ© |

### Base lÃ©gale

| Base lÃ©gale | Justification |
|-------------|---------------|
| **Obligation lÃ©gale** (art. 6.1.c) | Exigence HDS : traÃ§abilitÃ© des accÃ¨s |
| **IntÃ©rÃªt lÃ©gitime** (art. 6.1.f) | SÃ©curitÃ© informatique |

### CatÃ©gories de personnes concernÃ©es

| CatÃ©gorie | Description |
|-----------|-------------|
| Tous les utilisateurs | Patients, parents, praticien |

### CatÃ©gories de donnÃ©es traitÃ©es

| CatÃ©gorie | DonnÃ©es | SensibilitÃ© |
|-----------|---------|-------------|
| **Logs d'accÃ¨s** | User ID, timestamp, action, ressource accÃ©dÃ©e | DonnÃ©es techniques |
| **MÃ©tadonnÃ©es** | Adresse IP, user-agent, mÃ©thode HTTP | DonnÃ©es techniques |
| **Ã‰vÃ©nements** | Login, logout, accÃ¨s dossier, modification | DonnÃ©es techniques |

### Destinataires des donnÃ©es

| CatÃ©gorie | Destinataire | FinalitÃ© | Base |
|-----------|--------------|----------|------|
| **Interne** | Dr. [NOM] | Audit sÃ©curitÃ© | Obligation lÃ©gale |
| **Sous-traitant** | Azure Application Insights | Stockage logs | Contrat DPA |

### Transferts hors UE

| Transfert hors UE | NON |
|-------------------|-----|
| **Azure** | RÃ©gion France (West Europe) |

### DurÃ©e de conservation

| DonnÃ©es | DurÃ©e | Base lÃ©gale |
|---------|-------|-------------|
| Logs d'accÃ¨s | 1 an minimum | Obligation HDS |
| Logs de sÃ©curitÃ© | 1 an | LCEN |

### Mesures de sÃ©curitÃ©

| Mesure | Description |
|--------|-------------|
| Centralisation | Azure Application Insights |
| ImmuabilitÃ© | Logs non modifiables |
| AccÃ¨s restreint | Seul le praticien peut consulter |
| Format structurÃ© | JSON pour analyse automatisÃ©e |
| Exports critiques | Export verrouillÃ© par variable d'environnement + justification obligatoire + journal export_audit.jsonl |

---

## Annexe : Tableau rÃ©capitulatif

| NÂ° | Traitement | Base lÃ©gale | DonnÃ©es sensibles | DurÃ©e conservation | Sous-traitants |
|----|------------|-------------|-------------------|--------------------| ---------------|
| 1 | Dossiers patients | Obligation lÃ©gale | OUI | 20 ans | Azure (HDS) |
| 2 | Signature Ã©lectronique | Consentement | OUI | 20 ans | Yousign, Twilio, Azure |
| 3 | Rendez-vous | Contrat | NON | 20 ans | Twilio, Mailjet |
| 4 | Prescriptions | Obligation lÃ©gale | OUI | 20 ans | Mailjet, Azure |
| 5 | Authentification | Contrat + IntÃ©rÃªt lÃ©gitime | NON | 3 ans | Twilio, Azure |
| 6 | Logs HDS | Obligation lÃ©gale | NON | 1 an | Azure |

---

## Signatures

**Responsable de traitement :**

Nom : Dr. [NOM DU PRATICIEN]
Date : [DATE]
Signature : _______________________

---

*Document Ã©tabli conformÃ©ment Ã  l'article 30 du RÃ¨glement (UE) 2016/679 (RGPD)*
*MedicApp - Version 1.0*



