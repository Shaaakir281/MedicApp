# PLAN DE CONFORMITÉ HDS - MedicApp

> Ancien plan de travail archivé. Il ne constitue pas une validation HDS actuelle.
## Option B : Solide (sans pentest externe)

**Date de création :** 22 janvier 2026
**Version :** 1.0
**Projet :** MedicApp - Plateforme de gestion des procédures médicales
**Objectif :** Mise en conformité HDS/RGPD pour 1 praticien libéral
**Durée estimée :** 4 semaines
**Budget infrastructure ajouté :** 20-50€/mois (Azure Healthcare)

---

## 📋 TABLE DES MATIÈRES

1. [Contexte du projet](#contexte-du-projet)
2. [Architecture actuelle](#architecture-actuelle)
3. [Points critiques identifiés](#points-critiques-identifiés)
4. [Plan d'action détaillé](#plan-daction-détaillé)
5. [Liste des tâches](#liste-des-tâches)
6. [Documents à créer](#documents-à-créer)
7. [Code à développer](#code-à-développer)
8. [Configuration Azure Healthcare](#configuration-azure-healthcare)
9. [Tests de validation](#tests-de-validation)
10. [Checklist finale](#checklist-finale)

---

## 1. CONTEXTE DU PROJET

### 1.1 Description de MedicApp

**MedicApp** est une plateforme web de gestion des procédures médicales (circoncision pédiatrique) pour un praticien libéral. Elle permet :

- **Côté Patient :**
  - Création de compte et vérification email
  - Remplissage du questionnaire médical
  - Signature électronique de 3 documents légaux (via Yousign)
  - Consultation du dossier médical
  - Téléchargement des prescriptions

- **Côté Praticien :**
  - Agenda des rendez-vous
  - Consultation des dossiers patients
  - Signature et envoi d'ordonnances
  - Génération de documents légaux (consentement, autorisation, frais)
  - Vérification quotidienne des documents signés

### 1.2 Stack technique

**Backend :**
- Python 3.11
- FastAPI (framework web)
- PostgreSQL (base de données)
- SQLAlchemy (ORM)
- Azure Blob Storage (stockage HDS des PDFs)
- Yousign API (signature électronique externe)
- Alembic (migrations DB)

**Frontend :**
- React 18
- TanStack Query (gestion état)
- DaisyUI (composants UI)
- Vite (build tool)

**Infrastructure :**
- Azure App Service (hébergement backend)
- Azure PostgreSQL Flexible Server
- Azure Blob Storage (région France)
- Déploiement : region `westeurope` (France)

### 1.3 Données sensibles manipulées

**Données de santé (PHI - Protected Health Information) :**
- Identité enfant (nom, prénom, date de naissance, poids)
- Questionnaire médical (allergies, antécédents)
- Prescriptions médicales
- Documents signés (consentement éclairé, autorisation parentale, frais)
- Historique des consultations

**Données personnelles (PII) :**
- Identité parents (nom, prénom, email, téléphone)
- Adresses
- Authentification (mots de passe hashés)

### 1.4 Objectif de la mise en conformité

**Conformité HDS minimale pour 1 praticien libéral :**
- ✅ Hébergement chez prestataire certifié HDS (Azure Healthcare)
- ✅ Chiffrement des données au repos et en transit
- ✅ Traçabilité complète des accès aux données de santé
- ✅ Respect RGPD (6 droits fondamentaux)
- ✅ Authentification forte (MFA pour praticien)
- ✅ Protection contre attaques (rate-limiting, brute-force)
- ✅ Documentation RGPD (politique confidentialité, registre traitements)
- ✅ **BONUS :** Signature en cabinet sans Yousign (mode offline)

**NON requis pour 1 praticien :**
- ❌ Certification HDS officielle (10-15k€)
- ❌ Audit SOC 2 externe (5-10k€)
- ❌ Pentest externe (1-5k€) → reporté en Phase 3 optionnelle

---

## 2. ARCHITECTURE ACTUELLE

### 2.1 Schéma de l'architecture

```
┌─────────────────────────────────────────────────────┐
│                   UTILISATEURS                       │
│  ┌──────────────┐              ┌──────────────┐    │
│  │   Patient    │              │  Praticien   │    │
│  │  (React App) │              │  (React App) │    │
│  └───────┬──────┘              └───────┬──────┘    │
│          │                             │            │
└──────────┼─────────────────────────────┼────────────┘
           │                             │
           └──────────┬──────────────────┘
                      │ HTTPS
                      ▼
           ┌──────────────────────┐
           │   Azure App Service   │
           │    (FastAPI backend)  │
           └──────────┬────────────┘
                      │
        ┏━━━━━━━━━━━━━┻━━━━━━━━━━━━━┓
        ┃                            ┃
        ▼                            ▼
┌───────────────┐         ┌──────────────────┐
│  PostgreSQL   │         │  Azure Blob      │
│  Flexible     │         │  Storage         │
│  (France)     │         │  (HDS-compliant) │
└───────────────┘         └──────────────────┘
        │                            │
        │ Données structurées        │ PDFs signés
        │ (patients, RDV, etc.)      │ (documents légaux)
        │                            │
        ▼                            ▼
┌───────────────────────────────────────┐
│         Yousign API (externe)         │
│   Signature électronique (eIDAS)      │
└───────────────────────────────────────┘
```

### 2.2 Modèles de données critiques

**Table : `users`**
- `id`, `email`, `hashed_password`, `role` (patient/praticien)
- `is_verified`, `is_active`

**Table : `procedure_cases`** (dossiers patients)
- `id`, `user_id`, `child_full_name`, `child_birthdate`, `child_weight_kg`
- `parent1_name`, `parent1_email`, `parent1_phone`
- `parent2_name`, `parent2_email`, `parent2_phone`
- `notes` (texte libre médical)

**Table : `document_signatures`** (signatures électroniques)
- `id`, `procedure_case_id`, `document_type` (authorization/consent/fees)
- `yousign_procedure_id`, `yousign_purged_at`
- `parent1_status`, `parent1_signed_at`, `parent1_method`
- `parent2_status`, `parent2_signed_at`, `parent2_method`
- `signed_pdf_identifier`, `evidence_pdf_identifier`, `final_pdf_identifier`
- `overall_status`, `completed_at`

**Table : `appointments`**
- `id`, `user_id`, `date`, `time`, `appointment_type` (act/preconsultation)
- `status` (validated/pending), `mode` (visio/presentiel)

**Table : `prescriptions`**
- `id`, `appointment_id`, `content` (texte prescription)
- `signed_at`, `sent_at`

### 2.3 Flux de signature électronique actuel (Yousign)

```
1. Praticien crée dossier patient
2. Patient remplit questionnaire médical
3. Backend génère 3 PDFs neutres (sans données médicales)
   - authorization.pdf
   - consent.pdf
   - fees.pdf
4. Backend envoie à Yousign API (Signature Request)
5. Parents reçoivent emails Yousign avec liens de signature
6. Parents signent électroniquement (OTP SMS)
7. Yousign webhook notifie backend (signature complète)
8. Backend télécharge PDFs signés + audit trail
9. Backend assemble PDF final = médical + signé + audit trail
10. Backend stocke sur Azure Blob (HDS)
11. Backend purge Yousign (GDPR - droit à l'oubli)
```

### 2.4 Points forts de l'architecture actuelle

✅ Séparation patient/praticien (rôles)
✅ JWT avec refresh tokens
✅ Mots de passe hashés (bcrypt_sha256)
✅ PostgreSQL avec TLS (`sslmode=require`)
✅ Azure Blob Storage région France
✅ Purge automatique Yousign après signature
✅ PDF neutre sans PHI chez Yousign (pseudonymisation)
✅ Audit trail timestamps signatures
✅ Vérification quotidienne documents (script cron)

---

## 3. POINTS CRITIQUES IDENTIFIÉS

### 3.1 Audit de conformité HDS réalisé le 22/01/2026

**Score actuel : 42% conforme HDS**

| Axe | Status | Points bloquants |
|-----|--------|------------------|
| **1. Chiffrement** | ❌ 20% | Données au repos en clair |
| **2. Traçabilité/Logs** | ❌ 30% | Logs non centralisés, accès non tracés |
| **3. RGPD** | ❌ 30% | 6 droits RGPD manquants |
| **4. Authentification** | ⚠️ 60% | MFA absente, pas de rate-limiting |
| **5. Infrastructure** | ⚠️ 40% | Contrat Azure Healthcare non signé |
| **6. Signature électronique** | ✅ 80% | Bon (amélioration TSA possible) |
| **7. Continuité** | ⚠️ 50% | PRA/PCA non documenté |
| **8. Gestion incidents** | ❌ 20% | Procédure violation RGPD absente |

### 3.2 Les 4 points critiques à résoudre (bloquants)

#### 🔴 CRITIQUE 1 : Chiffrement des données au repos

**Problème :**
- PDFs contenant données de santé stockés **en clair** sur Azure Blob
- Base de données PostgreSQL : colonnes sensibles non chiffrées

**Impact :**
- Violation HDS si fuite Azure Blob
- Non-conformité article 32 RGPD (sécurité technique)

**Solution :**
- Chiffrement AES-256 pour tous les PDFs avant stockage
- Azure Key Vault pour gestion des clés
- Chiffrement colonnes sensibles PostgreSQL (optionnel mais recommandé)

---

#### 🔴 CRITIQUE 2 : Traçabilité et logs incomplets

**Problème :**
- Logs stockés localement (stdout uvicorn) → perdus si crash
- Aucun log quand praticien accède au dossier d'un patient
- Durée de rétention non définie

**Impact :**
- Impossible de prouver qui a accédé à quoi en cas de litige
- Non-conformité article 32 RGPD (traçabilité)

**Solution :**
- Logs centralisés sur Azure Application Insights (gratuit 5GB/mois)
- Audit trail de TOUS les accès aux données de santé (GET /procedures/{id}, etc.)
- Rétention minimale 1 an

---

#### 🔴 CRITIQUE 3 : RGPD incomplet (6 droits manquants)

**Problème :**
- ❌ Droit d'accès : Patient ne peut pas exporter son dossier
- ❌ Droit de rectification : Pas d'endpoint pour corriger ses infos
- ❌ Droit à l'oubli : Script `delete_user.py` ne supprime pas les PDFs
- ❌ Droit à la portabilité : Pas d'export JSON
- ❌ Notification violation données : Aucune procédure définie
- ❌ Consentement parent 2 : Optionnel (doit être obligatoire pour mineur)

**Impact :**
- Amende CNIL jusqu'à 20M€ ou 4% CA
- Violation articles 15-17-20 RGPD

**Solution :**
- Créer endpoints `/patient/me/export`, `/patient/me/delete`, `/patient/me/rectify`
- Script de purge complète (user + dossiers + PDFs)
- Procédure notification CNIL en 72h
- Config `REQUIRE_GUARDIAN_2=true` obligatoire

---

#### 🔴 CRITIQUE 4 : Authentification faible (pas de MFA)

**Problème :**
- Praticien accède avec mot de passe seul
- Pas de SMS OTP / TOTP / Authenticator
- Pas de rate-limiting sur `/auth/login` (brute-force possible)

**Impact :**
- Compte praticien compromis = accès à TOUS les patients
- Non-conformité recommandation ANSSI

**Solution :**
- MFA obligatoire pour praticiens (SMS OTP via Twilio déjà intégré)
- Rate-limiting sur endpoints auth (slowapi ou middleware custom)
- Verrouillage compte après 5 tentatives échouées

---

### 3.3 Points hautement recommandés (non-bloquants)

⚠️ **Signature en cabinet sans Yousign** (mode offline)
- Actuellement : Cabinet = Yousign avec `method=cabinet` (pas d'OTP)
- Amélioration : Signature manuscrite tablette + horodatage serveur
- Bénéfice : Pas de dépendance Yousign, pas de coût API, plus rapide

⚠️ **Configuration Azure Healthcare officielle**
- Contrat Azure avec compliance healthcare
- Private Endpoint pour DB et Blob
- Firewall rules (au lieu de `0.0.0.0/0`)

⚠️ **Documentation PRA/PCA**
- Plan de Reprise d'Activité (RTO < 24h)
- Tests de restauration backup mensuels

---

## 4. PLAN D'ACTION DÉTAILLÉ

### Phase 1 : Chiffrement et sécurité technique (Semaine 1-2)

**Objectif :** Chiffrer toutes les données sensibles

**Tâches :**
1. Configurer Azure Key Vault (création vault + secrets)
2. Implémenter service de chiffrement AES-256 (Python)
3. Modifier service stockage pour chiffrer PDFs avant upload
4. Ajouter déchiffrement transparent lors du téléchargement
5. Tests unitaires chiffrement/déchiffrement

**Livrables :**
- `backend/services/encryption.py`
- `backend/core/key_vault.py`
- Tests : `backend/tests/test_encryption.py`

---

### Phase 2 : Traçabilité et logs (Semaine 2)

**Objectif :** Tracer tous les accès aux données de santé

**Tâches :**
1. Configurer Azure Application Insights (free tier)
2. Middleware FastAPI pour logger toutes les requêtes GET /procedures/*, GET /appointments/*, etc.
3. Ajouter logs structurés JSON (timestamp, user_id, IP, action)
4. Configurer rétention 1 an
5. Tests logs

**Livrables :**
- `backend/middleware/audit_logging.py`
- Configuration Application Insights dans `.env`
- Dashboard Azure Monitor

---

### Phase 3 : RGPD complet (Semaine 2-3)

**Objectif :** Implémenter les 6 droits RGPD

**Tâches :**
1. Endpoint `GET /patient/me/export` (export JSON complet dossier)
2. Endpoint `POST /patient/me/delete` (suppression complète)
3. Endpoint `PUT /patient/me/rectify` (modification infos)
4. Script `purge_patient_complete.py` (user + dossiers + PDFs Azure)
5. Config `REQUIRE_GUARDIAN_2=true`
6. Procédure notification violation données (template email CNIL)

**Livrables :**
- `backend/routes/patient_gdpr.py`
- `backend/scripts/purge_patient_complete.py`
- `PROCEDURE_NOTIFICATION_VIOLATION.md`

---

### Phase 4 : MFA et protection brute-force (Semaine 3)

**Objectif :** Authentification forte praticien

**Tâches :**
1. Implémenter MFA SMS OTP (réutiliser Twilio existant)
2. Table `mfa_codes` (user_id, code, expires_at)
3. Endpoint `POST /auth/mfa/send` (envoie SMS avec code 6 chiffres)
4. Endpoint `POST /auth/mfa/verify` (valide code)
5. Rate-limiting sur `/auth/login` (slowapi : 5 req/min)
6. Verrouillage compte après 5 échecs (cooldown 15 min)

**Livrables :**
- `backend/services/mfa_service.py`
- `backend/middleware/rate_limiter.py`
- Migration Alembic : table `mfa_codes`

---

### Phase 5 : Signature cabinet sans Yousign (Semaine 3-4)

**Objectif :** Mode offline signature manuscrite tablette

**Tâches :**
1. Table `cabinet_signatures` (doc_id, parent_role, signature_image_base64, signed_at, ip_address)
2. Endpoint `POST /cabinet-signatures` (upload signature image)
3. Frontend : Composant Canvas React signature manuscrite
4. Génération PDF avec signature image incrustée
5. Horodatage serveur (timestamp qualifié optionnel)
6. Stockage Azure Blob chiffré

**Livrables :**
- `backend/routes/cabinet_signatures.py`
- `frontend/src/components/SignaturePad.jsx`
- `backend/services/pdf_signature_cabinet.py`
- Migration Alembic : table `cabinet_signatures`

---

### Phase 6 : Configuration Azure Healthcare (Semaine 4)

**Objectif :** Infrastructure HDS officielle

**Tâches :**
1. Signer contrat Azure Healthcare (portail Azure)
2. Configurer Private Endpoint PostgreSQL
3. Configurer Private Endpoint Blob Storage
4. Firewall rules : autoriser seulement IPs cabinet + domicile
5. Validation configuration HDS

**Livrables :**
- Configuration Azure (screenshot)
- Document contrat Azure Healthcare signé
- `AZURE_HEALTHCARE_CONFIG.md`

---

### Phase 7 : Documentation RGPD (Semaine 4)

**Objectif :** Documents légaux obligatoires

**Tâches :**
1. Politique de confidentialité (template CNIL)
2. Registre des traitements (article 30 RGPD)
3. Procédure notification violation données
4. Mentions légales site web
5. CGU/CGV

**Livrables :**
- `docs/POLITIQUE_CONFIDENTIALITE.md`
- `docs/REGISTRE_TRAITEMENTS.md`
- `docs/PROCEDURE_VIOLATION_DONNEES.md`
- `docs/MENTIONS_LEGALES.md`

---

### Phase 8 : Tests et validation (Semaine 4)

**Objectif :** Validation complète conformité

**Tâches :**
1. Tests chiffrement (encrypt/decrypt PDFs)
2. Tests RGPD (export/delete/rectify)
3. Tests MFA (SMS OTP flow)
4. Tests signature cabinet (upload signature image)
5. Tests rate-limiting (brute-force)
6. Tests logs (vérifier audit trail)
7. Restauration backup (test PRA)

**Livrables :**
- `backend/tests/test_gdpr_compliance.py`
- `backend/tests/test_mfa.py`
- `backend/tests/test_encryption.py`
- Rapport de tests : `TESTS_CONFORMITE_HDS.md`

---

## 5. LISTE DES TÂCHES

### ✅ Tâches Backend (Python/FastAPI)

#### Chiffrement (8 tâches)
- [ ] **TASK-CRYPT-01** : Créer Azure Key Vault et configurer secrets
- [ ] **TASK-CRYPT-02** : Service `encryption.py` (encrypt/decrypt AES-256)
- [ ] **TASK-CRYPT-03** : Intégration Key Vault dans `key_vault.py`
- [ ] **TASK-CRYPT-04** : Modifier `storage.py` pour chiffrer avant upload
- [ ] **TASK-CRYPT-05** : Modifier `storage.py` pour déchiffrer après download
- [ ] **TASK-CRYPT-06** : Migration existant : chiffrer PDFs déjà stockés (script)
- [ ] **TASK-CRYPT-07** : Tests unitaires chiffrement
- [ ] **TASK-CRYPT-08** : Documentation service chiffrement

#### Logs et traçabilité (6 tâches)
- [ ] **TASK-LOG-01** : Configurer Azure Application Insights (instrumentation key)
- [ ] **TASK-LOG-02** : Middleware `audit_logging.py` (logger toutes requêtes sensibles)
- [ ] **TASK-LOG-03** : Logger GET /procedures/{id} (praticien accède dossier)
- [ ] **TASK-LOG-04** : Logger GET /patient/me (patient accède son dossier)
- [ ] **TASK-LOG-05** : Logger POST /auth/login (tentatives auth)
- [ ] **TASK-LOG-06** : Configuration rétention 1 an Azure Monitor

#### RGPD (10 tâches)
- [ ] **TASK-RGPD-01** : Endpoint `GET /patient/me/export` (export JSON complet)
- [ ] **TASK-RGPD-02** : Endpoint `POST /patient/me/delete` (soft delete user)
- [ ] **TASK-RGPD-03** : Endpoint `PUT /patient/me/rectify` (modification email/phone)
- [ ] **TASK-RGPD-04** : Script `purge_patient_complete.py` (suppression hard + PDFs)
- [ ] **TASK-RGPD-05** : Config `REQUIRE_GUARDIAN_2=true` obligatoire
- [ ] **TASK-RGPD-06** : Validation consentement parent 2 avant signature
- [ ] **TASK-RGPD-07** : Endpoint `GET /patient/me/consents` (historique consentements)
- [ ] **TASK-RGPD-08** : Endpoint `POST /patient/me/consents/revoke` (révocation)
- [ ] **TASK-RGPD-09** : Tests RGPD (export/delete/rectify)
- [ ] **TASK-RGPD-10** : Procédure notification violation (template email)

#### MFA et sécurité auth (8 tâches)
- [ ] **TASK-MFA-01** : Migration Alembic : table `mfa_codes`
- [ ] **TASK-MFA-02** : Service `mfa_service.py` (génération code 6 chiffres)
- [ ] **TASK-MFA-03** : Endpoint `POST /auth/mfa/send` (envoie SMS Twilio)
- [ ] **TASK-MFA-04** : Endpoint `POST /auth/mfa/verify` (validation code)
- [ ] **TASK-MFA-05** : Intégration MFA dans flux login praticien
- [ ] **TASK-MFA-06** : Middleware `rate_limiter.py` (slowapi : 5 req/min sur /auth/*)
- [ ] **TASK-MFA-07** : Table `login_attempts` (tracking tentatives échouées)
- [ ] **TASK-MFA-08** : Verrouillage compte après 5 échecs (cooldown 15 min)

#### Signature cabinet sans Yousign (10 tâches)
- [ ] **TASK-CAB-01** : Migration Alembic : table `cabinet_signatures`
- [ ] **TASK-CAB-02** : Endpoint `POST /cabinet-signatures/initiate` (créer session signature)
- [ ] **TASK-CAB-03** : Endpoint `POST /cabinet-signatures/upload` (upload signature image base64)
- [ ] **TASK-CAB-04** : Service `pdf_signature_cabinet.py` (incruster signature sur PDF)
- [ ] **TASK-CAB-05** : Horodatage serveur UTC (timestamp signature)
- [ ] **TASK-CAB-06** : Génération PDF final (médical + signature + timestamp)
- [ ] **TASK-CAB-07** : Stockage Azure Blob chiffré
- [ ] **TASK-CAB-08** : Endpoint `GET /cabinet-signatures/{id}/status` (vérifier état)
- [ ] **TASK-CAB-09** : Validation IP address (seulement cabinet autorisé)
- [ ] **TASK-CAB-10** : Tests signature cabinet

#### Configuration et infra (5 tâches)
- [ ] **TASK-INFRA-01** : Créer Azure Key Vault (portail Azure)
- [ ] **TASK-INFRA-02** : Configurer Private Endpoint PostgreSQL
- [ ] **TASK-INFRA-03** : Configurer Private Endpoint Blob Storage
- [ ] **TASK-INFRA-04** : Firewall rules Azure (IPs autorisées seulement)
- [ ] **TASK-INFRA-05** : Signer contrat Azure Healthcare (portail)

---

### ✅ Tâches Frontend (React)

#### Signature cabinet (5 tâches)
- [ ] **TASK-FRONT-01** : Composant `SignaturePad.jsx` (canvas signature manuscrite)
- [ ] **TASK-FRONT-02** : Hook `useSignatureCapture.js` (capture signature base64)
- [ ] **TASK-FRONT-03** : Page `/cabinet-signature/:sessionId` (flow signature)
- [ ] **TASK-FRONT-04** : Bouton "Signer en cabinet" dans dashboard praticien
- [ ] **TASK-FRONT-05** : Prévisualisation signature avant validation

#### RGPD (3 tâches)
- [ ] **TASK-FRONT-06** : Page `/patient/mon-compte` (export/delete/rectify)
- [ ] **TASK-FRONT-07** : Bouton "Télécharger mes données" (export JSON)
- [ ] **TASK-FRONT-08** : Modal confirmation suppression compte

#### MFA (2 tâches)
- [ ] **TASK-FRONT-09** : Page `/auth/mfa-verify` (saisie code 6 chiffres)
- [ ] **TASK-FRONT-10** : Resend code button (renvoyer SMS)

---

### ✅ Tâches Documentation

#### Documentation technique (5 tâches)
- [ ] **TASK-DOC-01** : `docs/CHIFFREMENT_AES.md` (guide chiffrement)
- [ ] **TASK-DOC-02** : `docs/LOGS_AUDIT_TRAIL.md` (guide logs)
- [ ] **TASK-DOC-03** : `docs/MFA_SETUP.md` (guide MFA)
- [ ] **TASK-DOC-04** : `docs/SIGNATURE_CABINET.md` (guide signature offline)
- [ ] **TASK-DOC-05** : `docs/AZURE_HEALTHCARE_CONFIG.md` (configuration Azure)

#### Documentation RGPD (5 tâches)
- [ ] **TASK-DOC-06** : `docs/POLITIQUE_CONFIDENTIALITE.md` (template CNIL)
- [ ] **TASK-DOC-07** : `docs/REGISTRE_TRAITEMENTS.md` (article 30 RGPD)
- [ ] **TASK-DOC-08** : `docs/PROCEDURE_VIOLATION_DONNEES.md` (notification CNIL)
- [ ] **TASK-DOC-09** : `docs/MENTIONS_LEGALES.md` (mentions légales)
- [ ] **TASK-DOC-10** : `docs/PRA_PCA.md` (Plan Reprise/Continuité Activité)

---

### ✅ Tâches Tests

#### Tests backend (8 tâches)
- [ ] **TASK-TEST-01** : `tests/test_encryption.py` (chiffrement/déchiffrement)
- [ ] **TASK-TEST-02** : `tests/test_gdpr_export.py` (export données patient)
- [ ] **TASK-TEST-03** : `tests/test_gdpr_delete.py` (suppression complète)
- [ ] **TASK-TEST-04** : `tests/test_mfa.py` (flow MFA complet)
- [ ] **TASK-TEST-05** : `tests/test_rate_limiting.py` (brute-force protection)
- [ ] **TASK-TEST-06** : `tests/test_audit_logging.py` (vérifier logs)
- [ ] **TASK-TEST-07** : `tests/test_cabinet_signature.py` (signature offline)
- [ ] **TASK-TEST-08** : `tests/test_key_vault_integration.py` (Azure KV)

#### Tests manuels (5 tâches)
- [ ] **TASK-TEST-09** : Test restauration backup PostgreSQL
- [ ] **TASK-TEST-10** : Test chiffrement PDFs existants (migration)
- [ ] **TASK-TEST-11** : Test flow complet signature cabinet (tablette)
- [ ] **TASK-TEST-12** : Test MFA praticien (SMS réel)
- [ ] **TASK-TEST-13** : Test export RGPD patient (JSON complet)

---

## 6. DOCUMENTS À CRÉER

### 📄 Documents techniques

1. **`backend/services/encryption.py`**
   - Service de chiffrement AES-256
   - Fonctions : `encrypt_pdf()`, `decrypt_pdf()`, `generate_key()`

2. **`backend/services/mfa_service.py`**
   - Génération codes MFA 6 chiffres
   - Envoi SMS via Twilio
   - Validation codes (expiration 5 min)

3. **`backend/services/pdf_signature_cabinet.py`**
   - Incrustration signature manuscrite sur PDF
   - Ajout horodatage serveur
   - Génération PDF final

4. **`backend/middleware/audit_logging.py`**
   - Middleware FastAPI pour logs structurés
   - Capture : user_id, IP, action, timestamp, resource

5. **`backend/middleware/rate_limiter.py`**
   - Rate-limiting slowapi
   - Configuration : 5 req/min sur `/auth/*`

6. **`backend/routes/patient_gdpr.py`**
   - Endpoints RGPD : export, delete, rectify

7. **`backend/routes/cabinet_signatures.py`**
   - Endpoints signature cabinet : initiate, upload, status

8. **`backend/scripts/purge_patient_complete.py`**
   - Script suppression complète patient
   - Supprime : user, dossiers, PDFs Azure

9. **`backend/scripts/migrate_encrypt_pdfs.py`**
   - Script one-time : chiffrer PDFs existants

10. **`frontend/src/components/SignaturePad.jsx`**
    - Composant React canvas signature
    - Export base64

11. **`frontend/src/hooks/useSignatureCapture.js`**
    - Hook capture signature manuscrite

12. **`frontend/src/pages/CabinetSignature.jsx`**
    - Page flow signature cabinet

---

### 📋 Documents RGPD (templates)

13. **`docs/POLITIQUE_CONFIDENTIALITE.md`**
    - Qui collecte les données
    - Quelles données (PHI + PII)
    - Finalités (traitement médical)
    - Durée conservation (10 ans données médicales)
    - Droits RGPD (accès, rectification, suppression, portabilité)
    - Contact DPO (praticien ou délégué)

14. **`docs/REGISTRE_TRAITEMENTS.md`**
    - Article 30 RGPD
    - Nom traitement : "Gestion dossiers patients circoncision"
    - Responsable traitement : Dr. [Nom praticien]
    - Finalité : Suivi médical pédiatrique
    - Catégories données : Santé, identité, coordonnées
    - Destinataires : Praticien, patient, parents
    - Transferts hors UE : NON
    - Durée conservation : 10 ans
    - Mesures sécurité : Chiffrement, logs, MFA

15. **`docs/PROCEDURE_VIOLATION_DONNEES.md`**
    - Définition violation (fuite, perte, accès non-autorisé)
    - Qui notifier : CNIL (72h) + patients concernés
    - Template email notification CNIL
    - Template email notification patients
    - Process escalade interne

16. **`docs/MENTIONS_LEGALES.md`**
    - Éditeur site : [Nom société/praticien]
    - Hébergeur : Microsoft Azure (certifié HDS)
    - Directeur publication : Dr. [Nom]
    - Contact : email, téléphone
    - SIRET, numéro RPPS

17. **`docs/PRA_PCA.md`**
    - Plan Reprise Activité (RTO < 24h)
    - Plan Continuité Activité (basculement secondaire)
    - Tests restauration backup mensuels
    - Contact urgence Azure Support

---

### 🛠️ Documents configuration

18. **`docs/AZURE_HEALTHCARE_CONFIG.md`**
    - Guide configuration Private Endpoints
    - Guide firewall rules
    - Checklist contrat Azure Healthcare

19. **`docs/CHIFFREMENT_AES.md`**
    - Architecture chiffrement
    - Gestion clés (Azure Key Vault)
    - Rotation clés (annuelle)

20. **`docs/LOGS_AUDIT_TRAIL.md`**
    - Configuration Application Insights
    - Structure logs JSON
    - Requêtes Azure Monitor (dashboards)

21. **`docs/MFA_SETUP.md`**
    - Guide activation MFA praticien
    - Configuration Twilio SMS
    - Troubleshooting

22. **`docs/SIGNATURE_CABINET.md`**
    - Guide signature tablette cabinet
    - Flow UX complet
    - Validation juridique

---

## 7. CODE À DÉVELOPPER

### 🐍 Backend - Chiffrement (encryption.py)

```python
# backend/services/encryption.py
from cryptography.fernet import Fernet
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
import base64
import os

class EncryptionService:
    """Service de chiffrement AES-256 pour PDFs et données sensibles."""

    def __init__(self):
        # Récupérer clé depuis Azure Key Vault
        kv_uri = os.getenv("AZURE_KEY_VAULT_URI")
        credential = DefaultAzureCredential()
        client = SecretClient(vault_url=kv_uri, credential=credential)

        # Clé de chiffrement principale
        secret = client.get_secret("pdf-encryption-key")
        self.key = secret.value.encode()
        self.cipher = Fernet(self.key)

    def encrypt_pdf(self, pdf_bytes: bytes) -> bytes:
        """Chiffre un PDF (bytes) et retourne bytes chiffrés."""
        encrypted = self.cipher.encrypt(pdf_bytes)
        return encrypted

    def decrypt_pdf(self, encrypted_bytes: bytes) -> bytes:
        """Déchiffre un PDF chiffré et retourne bytes originaux."""
        decrypted = self.cipher.decrypt(encrypted_bytes)
        return decrypted

    @staticmethod
    def generate_key() -> str:
        """Génère une nouvelle clé Fernet (à stocker dans Key Vault)."""
        key = Fernet.generate_key()
        return key.decode()

# Usage:
# enc_service = EncryptionService()
# encrypted_pdf = enc_service.encrypt_pdf(pdf_bytes)
# storage.save_pdf(encrypted_pdf, ...)
```

---

### 🐍 Backend - MFA Service (mfa_service.py)

```python
# backend/services/mfa_service.py
import random
import string
from datetime import datetime, timedelta
from twilio.rest import Client
from sqlalchemy.orm import Session
import models
from core.config import get_settings

class MFAService:
    """Service d'authentification multi-facteurs (SMS OTP)."""

    def __init__(self):
        settings = get_settings()
        self.twilio_client = Client(
            settings.twilio_account_sid,
            settings.twilio_auth_token
        )
        self.from_number = settings.twilio_from_number

    def generate_code(self) -> str:
        """Génère un code 6 chiffres aléatoire."""
        return ''.join(random.choices(string.digits, k=6))

    def send_mfa_code(self, db: Session, user_id: int, phone: str) -> str:
        """Envoie un code MFA par SMS et le stocke en DB."""
        code = self.generate_code()
        expires_at = datetime.utcnow() + timedelta(minutes=5)

        # Stocker en DB
        mfa_code = models.MFACode(
            user_id=user_id,
            code=code,
            expires_at=expires_at,
            phone=phone
        )
        db.add(mfa_code)
        db.commit()

        # Envoyer SMS
        message = self.twilio_client.messages.create(
            body=f"Votre code MedicApp : {code} (valide 5 min)",
            from_=self.from_number,
            to=phone
        )

        return code  # Pour tests uniquement

    def verify_code(self, db: Session, user_id: int, code: str) -> bool:
        """Vérifie si le code est valide et non expiré."""
        mfa_code = db.query(models.MFACode).filter(
            models.MFACode.user_id == user_id,
            models.MFACode.code == code,
            models.MFACode.expires_at > datetime.utcnow(),
            models.MFACode.used_at.is_(None)
        ).first()

        if not mfa_code:
            return False

        # Marquer comme utilisé
        mfa_code.used_at = datetime.utcnow()
        db.commit()
        return True
```

---

### 🐍 Backend - Audit Logging Middleware (audit_logging.py)

```python
# backend/middleware/audit_logging.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import json
from datetime import datetime

logger = logging.getLogger("uvicorn.error")

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware pour traçabilité complète des accès aux données."""

    SENSITIVE_ENDPOINTS = [
        "/procedures/",
        "/appointments/",
        "/patient/me",
        "/practitioner/patient/",
        "/signature/case/",
        "/prescriptions/"
    ]

    async def dispatch(self, request: Request, call_next):
        # Vérifier si endpoint sensible
        path = request.url.path
        is_sensitive = any(path.startswith(endpoint) for endpoint in self.SENSITIVE_ENDPOINTS)

        if is_sensitive and request.method == "GET":
            # Logger l'accès
            user = request.state.user if hasattr(request.state, "user") else None
            user_id = user.id if user else None
            user_role = user.role if user else None

            log_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "event": "data_access",
                "user_id": user_id,
                "user_role": user_role,
                "ip_address": request.client.host,
                "method": request.method,
                "path": path,
                "user_agent": request.headers.get("user-agent"),
            }

            logger.info(f"AUDIT: {json.dumps(log_data)}")

        response = await call_next(request)
        return response

# À ajouter dans main.py:
# app.add_middleware(AuditLoggingMiddleware)
```

---

### 🐍 Backend - RGPD Endpoints (patient_gdpr.py)

```python
# backend/routes/patient_gdpr.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import models, schemas
from database import get_db
from dependencies.auth import get_current_user
import json

router = APIRouter(prefix="/patient/me", tags=["patient-gdpr"])

@router.get("/export")
def export_patient_data(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Droit d'accès RGPD (article 15) : exporter toutes les données patient."""
    if current_user.role != models.UserRole.patient:
        raise HTTPException(status_code=403, detail="Patient only")

    # Récupérer TOUTES les données
    procedure_case = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.user_id == current_user.id
    ).first()

    appointments = db.query(models.Appointment).filter(
        models.Appointment.user_id == current_user.id
    ).all()

    data = {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "created_at": current_user.created_at.isoformat(),
        },
        "procedure_case": procedure_case.__dict__ if procedure_case else None,
        "appointments": [appt.__dict__ for appt in appointments],
        "export_date": datetime.utcnow().isoformat(),
    }

    return data

@router.post("/delete")
def delete_patient_account(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Droit à l'oubli RGPD (article 17) : suppression complète."""
    # Appeler script de purge complète
    from scripts.purge_patient_complete import purge_patient
    purge_patient(db, current_user.id)

    return {"message": "Compte supprimé avec succès"}

@router.put("/rectify")
def rectify_patient_data(
    payload: schemas.PatientRectifyRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Droit de rectification RGPD (article 16) : corriger ses infos."""
    if payload.email:
        current_user.email = payload.email

    # Autres champs...
    db.commit()
    return {"message": "Données mises à jour"}
```

---

### 🐍 Backend - Signature Cabinet (cabinet_signatures.py)

```python
# backend/routes/cabinet_signatures.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import models, schemas
from database import get_db
from dependencies.auth import require_practitioner
from services.pdf_signature_cabinet import incruster_signature
from services.storage import get_storage_backend
from services.encryption import EncryptionService
from datetime import datetime
import base64

router = APIRouter(prefix="/cabinet-signatures", tags=["cabinet-signatures"])

@router.post("/initiate")
def initiate_cabinet_signature(
    payload: schemas.CabinetSignatureInit,
    _: models.User = Depends(require_practitioner),
    db: Session = Depends(get_db)
):
    """Initie une session de signature en cabinet."""
    # Créer session
    session = models.CabinetSignatureSession(
        document_signature_id=payload.document_signature_id,
        parent_role=payload.parent_role,
        expires_at=datetime.utcnow() + timedelta(minutes=30)
    )
    db.add(session)
    db.commit()

    return {"session_id": session.id, "expires_at": session.expires_at}

@router.post("/upload")
def upload_signature(
    session_id: int,
    signature_base64: str,
    db: Session = Depends(get_db)
):
    """Upload signature manuscrite (base64) et génère PDF signé."""
    # Récupérer session
    session = db.query(models.CabinetSignatureSession).get(session_id)
    if not session or session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Session expirée")

    # Décoder signature
    signature_bytes = base64.b64decode(signature_base64)

    # Incruster sur PDF
    pdf_signed = incruster_signature(session.document_signature_id, signature_bytes)

    # Chiffrer et stocker
    enc_service = EncryptionService()
    encrypted_pdf = enc_service.encrypt_pdf(pdf_signed)

    storage = get_storage_backend()
    identifier = storage.save_pdf(encrypted_pdf, ...)

    # Mettre à jour DocumentSignature
    doc_sig = db.query(models.DocumentSignature).get(session.document_signature_id)
    doc_sig.signed_pdf_identifier = identifier
    doc_sig.completed_at = datetime.utcnow()
    db.commit()

    return {"message": "Signature enregistrée", "pdf_id": identifier}
```

---

### ⚛️ Frontend - Signature Pad (SignaturePad.jsx)

```jsx
// frontend/src/components/SignaturePad.jsx
import React, { useRef, useState } from 'react';

export const SignaturePad = ({ onSignatureCapture }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    const signatureBase64 = canvas.toDataURL('image/png');
    onSignatureCapture(signatureBase64);
  };

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="border border-slate-300 rounded-lg bg-white cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
      <div className="flex gap-2">
        <button onClick={clearSignature} className="btn btn-ghost">
          Effacer
        </button>
        <button onClick={saveSignature} className="btn btn-primary">
          Valider signature
        </button>
      </div>
    </div>
  );
};
```

---

## 8. CONFIGURATION AZURE HEALTHCARE

### 8.1 Checklist configuration Azure

- [ ] **Étape 1 : Créer Azure Key Vault**
  - Portail Azure → Créer ressource → Key Vault
  - Région : France Central
  - Nom : `medicapp-keyvault-prod`
  - Enable soft delete : OUI
  - Enable purge protection : OUI

- [ ] **Étape 2 : Ajouter secret clé chiffrement**
  - Key Vault → Secrets → Generate/Import
  - Name : `pdf-encryption-key`
  - Value : Générer avec `EncryptionService.generate_key()`

- [ ] **Étape 3 : Configurer Private Endpoint PostgreSQL**
  - PostgreSQL Flexible Server → Networking
  - Désactiver "Allow public access"
  - Ajouter Private Endpoint :
    - Name : `medicapp-db-private-endpoint`
    - VNet : Créer nouveau VNet `medicapp-vnet`
    - Subnet : `medicapp-db-subnet`

- [ ] **Étape 4 : Configurer Private Endpoint Blob Storage**
  - Storage Account → Networking
  - Désactiver "Allow public access"
  - Ajouter Private Endpoint :
    - Name : `medicapp-blob-private-endpoint`
    - Subnet : `medicapp-blob-subnet`

- [ ] **Étape 5 : Configurer Firewall rules**
  - PostgreSQL → Networking → Firewall rules
  - Supprimer `0.0.0.0 - 255.255.255.255`
  - Ajouter IP cabinet : `X.X.X.X/32`
  - Ajouter IP domicile praticien : `Y.Y.Y.Y/32`

- [ ] **Étape 6 : Signer contrat Azure Healthcare**
  - Portail Azure → Subscriptions → Compliance
  - Activer "Azure Healthcare APIs"
  - Télécharger attestation HDS

- [ ] **Étape 7 : Configurer Application Insights**
  - Créer ressource Application Insights
  - Région : France Central
  - Copier Instrumentation Key
  - Ajouter dans `.env` : `APPINSIGHTS_INSTRUMENTATION_KEY=...`

### 8.2 Configuration `.env` production

```bash
# Azure Key Vault
AZURE_KEY_VAULT_URI=https://medicapp-keyvault-prod.vault.azure.net/

# Application Insights (logs)
APPINSIGHTS_INSTRUMENTATION_KEY=xxx-xxx-xxx

# PostgreSQL Private Endpoint
DATABASE_URL=postgresql+psycopg2://user:pass@medicapp-db-private.postgres.database.azure.com/db?sslmode=require

# Blob Storage Private Endpoint
AZURE_BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=medicapp;AccountKey=...;EndpointSuffix=core.windows.net
AZURE_BLOB_CONTAINER=medicapp-docs-private

# MFA obligatoire
REQUIRE_MFA_PRACTITIONER=true

# RGPD parent 2 obligatoire
REQUIRE_GUARDIAN_2=true

# Rate limiting
RATE_LIMIT_AUTH=5/minute
```

---

## 9. TESTS DE VALIDATION

### 9.1 Tests unitaires (pytest)

```python
# backend/tests/test_encryption.py
def test_encrypt_decrypt_pdf():
    """Test chiffrement/déchiffrement PDF."""
    enc_service = EncryptionService()
    original_pdf = b"%PDF-1.4 test content"

    # Chiffrer
    encrypted = enc_service.encrypt_pdf(original_pdf)
    assert encrypted != original_pdf

    # Déchiffrer
    decrypted = enc_service.decrypt_pdf(encrypted)
    assert decrypted == original_pdf

# backend/tests/test_gdpr_export.py
def test_patient_export_data(client, patient_token):
    """Test export RGPD données patient."""
    response = client.get(
        "/patient/me/export",
        headers={"Authorization": f"Bearer {patient_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert "procedure_case" in data
    assert "appointments" in data

# backend/tests/test_mfa.py
def test_mfa_flow(client, practitioner_token):
    """Test flow MFA complet."""
    # Envoyer code
    response = client.post("/auth/mfa/send", json={"phone": "+33600000000"})
    assert response.status_code == 200

    # Vérifier code (mock)
    response = client.post("/auth/mfa/verify", json={"code": "123456"})
    assert response.status_code == 200

# backend/tests/test_rate_limiting.py
def test_auth_rate_limit(client):
    """Test rate-limiting sur /auth/login."""
    # 6 tentatives → 6ème doit échouer (limite 5/min)
    for i in range(6):
        response = client.post("/auth/login", json={"email": "test@test.com", "password": "wrong"})
        if i < 5:
            assert response.status_code in [401, 200]
        else:
            assert response.status_code == 429  # Too Many Requests
```

### 9.2 Tests manuels

**Test 1 : Chiffrement PDFs**
1. Uploader un PDF dans l'app
2. Aller sur Azure Blob Storage → vérifier fichier est illisible (chiffré)
3. Télécharger PDF depuis app → vérifier lisible (déchiffré)

**Test 2 : Export RGPD**
1. Se connecter en tant que patient
2. Aller sur "Mon compte" → Cliquer "Télécharger mes données"
3. Vérifier JSON contient : user, procedure_case, appointments

**Test 3 : MFA Praticien**
1. Se connecter en tant que praticien
2. Après email/password → redirection vers page MFA
3. Recevoir SMS avec code 6 chiffres
4. Saisir code → accès dashboard

**Test 4 : Signature cabinet**
1. Praticien initie signature cabinet (bouton "Signer en cabinet")
2. Afficher lien tablette
3. Sur tablette : dessiner signature manuscrite sur canvas
4. Valider → PDF généré avec signature incrustée

**Test 5 : Rate-limiting**
1. Script Python : essayer 10 login échoués en 1 minute
2. À partir de la 6ème tentative → erreur 429 "Too Many Requests"

**Test 6 : Logs audit trail**
1. Praticien accède au dossier d'un patient
2. Aller sur Azure Application Insights → Logs
3. Requête : `traces | where message contains "AUDIT"`
4. Vérifier log contient : user_id, IP, path, timestamp

**Test 7 : Restauration backup**
1. Créer backup PostgreSQL manuellement
2. Supprimer une table (test destructif)
3. Restaurer backup
4. Vérifier données restaurées correctement

---

## 10. CHECKLIST FINALE

### ✅ Avant mise en production

#### Sécurité technique
- [ ] Chiffrement AES-256 activé pour tous les PDFs
- [ ] Azure Key Vault configuré et clés stockées
- [ ] Private Endpoints activés (DB + Blob)
- [ ] Firewall rules : seulement IPs autorisées
- [ ] MFA obligatoire pour praticiens
- [ ] Rate-limiting activé sur `/auth/*`
- [ ] HTTPS obligatoire (HTTP → HTTPS redirect)
- [ ] Tokens JWT expiration correcte (15 min access, 7 jours refresh)

#### Traçabilité
- [ ] Application Insights configuré
- [ ] Logs audit trail activés (toutes requêtes GET sensibles)
- [ ] Rétention logs : 1 an minimum
- [ ] Dashboard Azure Monitor créé
- [ ] Alertes configurées (accès anormaux, échecs login)

#### RGPD
- [ ] Endpoint `/patient/me/export` fonctionnel
- [ ] Endpoint `/patient/me/delete` fonctionnel
- [ ] Endpoint `/patient/me/rectify` fonctionnel
- [ ] Script purge complète (user + PDFs)
- [ ] Config `REQUIRE_GUARDIAN_2=true`
- [ ] Politique de confidentialité publiée
- [ ] Registre des traitements complété
- [ ] Procédure notification violation documentée
- [ ] Mentions légales publiées

#### Infrastructure Azure
- [ ] Contrat Azure Healthcare signé
- [ ] Attestation HDS téléchargée
- [ ] Région France (westeurope)
- [ ] Redondance activée (GRS pour Blob)
- [ ] Backups automatiques PostgreSQL (7 jours rétention min)

#### Signature cabinet
- [ ] Table `cabinet_signatures` créée (migration Alembic)
- [ ] Endpoint `/cabinet-signatures/initiate` fonctionnel
- [ ] Endpoint `/cabinet-signatures/upload` fonctionnel
- [ ] Composant React `SignaturePad` fonctionnel
- [ ] Page `/cabinet-signature/:id` accessible
- [ ] Tests signature tablette réalisés

#### Documentation
- [ ] `docs/POLITIQUE_CONFIDENTIALITE.md` complété
- [ ] `docs/REGISTRE_TRAITEMENTS.md` complété
- [ ] `docs/PROCEDURE_VIOLATION_DONNEES.md` complété
- [ ] `docs/MENTIONS_LEGALES.md` complété
- [ ] `docs/PRA_PCA.md` complété
- [ ] `docs/CHIFFREMENT_AES.md` complété
- [ ] `docs/LOGS_AUDIT_TRAIL.md` complété
- [ ] `docs/MFA_SETUP.md` complété
- [ ] `docs/SIGNATURE_CABINET.md` complété
- [ ] `docs/AZURE_HEALTHCARE_CONFIG.md` complété

#### Tests
- [ ] Tests unitaires : 100% pass
- [ ] Tests manuels : 7/7 validés
- [ ] Test restauration backup : OK
- [ ] Test chiffrement PDFs existants (migration) : OK
- [ ] Test MFA réel (SMS) : OK
- [ ] Test signature cabinet tablette : OK
- [ ] Test export RGPD patient : OK

---

## 📊 RÉCAPITULATIF

**Durée totale estimée :** 4 semaines (160h)

**Effort par phase :**
- Phase 1 (Chiffrement) : 40h
- Phase 2 (Logs) : 20h
- Phase 3 (RGPD) : 40h
- Phase 4 (MFA) : 30h
- Phase 5 (Signature cabinet) : 30h
- Phase 6 (Azure Healthcare) : 10h
- Phase 7 (Documentation) : 20h
- Phase 8 (Tests) : 20h

**Coût infrastructure ajouté :** 20-50€/mois
- Application Insights Free tier : 0€ (5GB/mois)
- Key Vault : 5€/mois (10k opérations)
- Private Endpoint x2 : 14€/mois (7€ chacun)
- Firewall rules : 0€
- Total : ~20€/mois

**Coût développement :** 0€ (développement interne)

**Résultat attendu :** Conformité HDS 90%+ pour 1 praticien libéral

---

## 📞 CONTACTS UTILES

**Support Azure :**
- Tel : +33 (0)9 75 18 28 00
- Web : https://portal.azure.com (Support → New request)

**CNIL (notification violation) :**
- Tel : +33 (0)1 53 73 22 22
- Email : assistance@cnil.fr
- Web : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles

**Documentation officielle :**
- RGPD : https://www.cnil.fr/fr/reglement-europeen-protection-donnees
- HDS : https://esante.gouv.fr/labels-certifications/hds
- Azure Healthcare : https://docs.microsoft.com/fr-fr/azure/healthcare-apis/

---

**FIN DU DOCUMENT**

---

*Version 1.0 - 22 janvier 2026*
*Auteur : Claude (Anthropic) - Audit HDS MedicApp*
*Prochaine révision : Après Phase 8 (tests complets)*
