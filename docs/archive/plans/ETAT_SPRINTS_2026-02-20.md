# MedicApp / MedScript — État complet des sprints

> Instantané archivé au 20 février 2026. La source active est `docs/ETAT_PROJET.md`.

**Date :** 20 février 2026
**Objectif :** Ce document liste TOUS les sprints réalisés et en cours. Il doit servir de checklist pour un agent IA connecté au repo afin de vérifier la présence effective du code et des configurations.

---

## Vue d'ensemble

| # | Sprint | Statut | Remarques |
|---|--------|--------|-----------|
| S1 | Chiffrement AES-256 | ✅ Terminé | Fichiers `.enc` visibles en prod |
| S2 | Logs et traçabilité | ✅ Terminé | Application Insights actif |
| S3 | RGPD complet | ✅ Terminé (95%) | RGPD-05 (parent2 obligatoire) volontairement abandonné |
| S4 | MFA et sécurité | ✅ Terminé | À activer en prod (`REQUIRE_MFA_PRACTITIONER=true`) |
| S5 | Signature cabinet | ✅ Terminé (ajustements UX restants) | Version renforcée avec hash + audit |
| S6 | Documentation RGPD | ✅ Terminé | Docs créés (encodage à corriger sur certains) |
| S7 | Infra Azure / HDS | 📋 À faire | Private Endpoints PostgreSQL + Blob — critique HDS |
| S8 | Refonte UX praticien | ✅ Terminé | Dashboard redesigné, 4 vues (agenda, patients, relances, ordonnances) |
| S9 | Frontend patient (contenus) | ✅ Largement fait | Homepage, FAQ, pages légales, footer. Restent contenus définitifs |
| S10 | Maintenance / continuité | 🔄 Partiellement fait | Base technique avancée, reste SMTP/alertes mail et procédures exploitation |
| S11 | Parcours patient visuel | ✅ Largement fait | Timeline 5 étapes implémentée. Reste micro-ajustements UX |
| Monitoring | Sprints M1-M4 (alertes + logging métier) | ✅ Terminé | Alertes techniques, logging métier, dashboards KQL, alertes métier |
| Contenus | Fiches info + vidéos | ✅ Terminé | 2 fiches (utilisation plateforme + jour intervention) + scripts vidéo |
| Présentation client | Document valeur | ✅ Produit | Gains de temps (~55 min/patient) + conformité légale |

---

## SPRINT 1 — Chiffrement (✅ Terminé)

**Objectif :** Chiffrer toutes les données sensibles (AES-256) via Azure Key Vault

### Tâches à vérifier dans le repo :

| ID | Tâche | Fichier/config à vérifier |
|----|-------|---------------------------|
| CRYPT-01 | Azure Key Vault configuré | Variable `AZURE_KEY_VAULT_URI` dans `.env` ou App Service config |
| CRYPT-02 | Service encryption.py | `backend/services/encryption.py` — classe `EncryptionService`, méthodes `encrypt_pdf()`, `decrypt_pdf()` |
| CRYPT-03 | Intégration Key Vault | `backend/core/key_vault.py` — singleton `KeyVaultClient`, cache TTL 1h, retry 3 tentatives |
| CRYPT-04 | Chiffrer avant upload | `backend/services/storage.py` — appel `encrypt_pdf()` avant upload, suffixe `.enc` |
| CRYPT-05 | Déchiffrer après download | `backend/services/storage.py` — vérification métadonnée `encrypted=true`, déchiffrement, support legacy |
| CRYPT-06 | Script migration PDFs | `backend/scripts/migrate_encrypt_pdfs.py` — mode `--dry-run`, log progression |
| CRYPT-07 | Tests unitaires | `backend/tests/test_encryption.py` — roundtrip, invalid data, mock Key Vault, format clé Fernet |

**Preuve terrain :** Les fichiers dans Azure Blob ont le suffixe `.enc` et s'ouvrent normalement dans l'app.

---

## SPRINT 2 — Logs et traçabilité (✅ Terminé)

**Objectif :** Tracer tous les accès aux données de santé

### Tâches à vérifier :

| ID | Tâche | Fichier/config à vérifier |
|----|-------|---------------------------|
| LOG-01 | Application Insights configuré | Variable `APPINSIGHTS_INSTRUMENTATION_KEY` dans `.env`, rétention 1 an |
| LOG-02 | Middleware audit_logging | `backend/middleware/audit_logging.py` — endpoints sensibles (/procedures/, /appointments/, /patient/me, /practitioner/patient/, /signature/, /prescriptions/), format JSON structuré |
| LOG-03 | Logger accès praticien aux dossiers | `backend/routes/practitioner.py` — event `practitioner_access_patient_data` avec practitioner_id, patient_id, data_accessed |
| LOG-04 | Logger tentatives auth | `backend/routes/auth.py` — logs tentative/succès/échec login (SANS mot de passe) |

---

## SPRINT 3 — RGPD complet (✅ Terminé à 95%)

**Objectif :** Implémenter les droits RGPD

### Tâches à vérifier :

| ID | Tâche | Fichier/config à vérifier |
|----|-------|---------------------------|
| RGPD-01 | Export données patient (art. 15) | `backend/routes/patient_gdpr.py` — `GET /patient/me/export`, retourne user + dossier + procédures + RDV + prescriptions + documents signés |
| RGPD-02 | Suppression compte (art. 17) | `backend/routes/patient_gdpr.py` — `POST /patient/me/delete`, soft delete, anonymisation email (`deleted+<id>@medicapp.example`), mot de passe remplacé |
| RGPD-03 | Rectification (art. 16) | `backend/routes/patient_gdpr.py` — `PUT /patient/me/rectify`, update email→`email_verified=false`, sync parent1 + procedure_case |
| RGPD-04 | Script purge complète | `backend/scripts/purge_patient_complete.py` — hard delete DB + blobs, modes `--dry-run` / `--yes` |
| RGPD-05 | Parent 2 obligatoire | ❌ **Volontairement abandonné** — trop bloquant pour le parcours. Aucun changement en prod. |
| RGPD-06 | Procédure violation données | `docs/PROCEDURE_VIOLATION_DONNEES.md` — (encodage à corriger) |

---

## SPRINT 4 — MFA et sécurité (✅ Terminé)

**Objectif :** Authentification forte praticien + protection brute-force

### Tâches à vérifier :

| ID | Tâche | Fichier/config à vérifier |
|----|-------|---------------------------|
| MFA-01 | Table mfa_codes | Migration Alembic — table `mfa_codes` (id, user_id, code, phone, expires_at, used_at, created_at) |
| MFA-02 | Service MFA | `backend/services/mfa_service.py` — `generate_code()` (6 chiffres, `secrets.choice`), `send_mfa_code()`, `verify_code()` |
| MFA-03 | Endpoints MFA | `backend/routes/auth.py` — `POST /auth/mfa/send` et `POST /auth/mfa/verify`, JWT avec claim `mfa_verified` |
| MFA-04 | Intégration flux login | `backend/routes/auth.py` — si praticien + `REQUIRE_MFA_PRACTITIONER=true` → JWT temporaire 10min + envoi SMS auto |
| MFA-05 | Rate limiter | `backend/middleware/rate_limiter.py` — slowapi, `/auth/login` 5 req/min par IP, `/auth/mfa/send` 3 req/min, `/auth/mfa/verify` 5 req/min |
| MFA-06 | Verrouillage compte | `backend/routes/auth.py` — table `login_attempts`, 5 échecs en 15 min → verrouillage 15 min, email notification, reset après succès |

**Note :** MFA praticien est implémenté mais pas encore activé en production. Activer avec `REQUIRE_MFA_PRACTITIONER=true`.

---

## SPRINT 5 — Signature cabinet (✅ Terminé, ajustements UX restants)

**Objectif :** Signature manuscrite sur tablette en cabinet (sans Yousign)

### Version renforcée implémentée (vs plan initial) :

| ID | Tâche | Fichier/config à vérifier |
|----|-------|---------------------------|
| CAB-01 | Tables cabinet_signatures + sessions | Migration Alembic — `cabinet_signature_sessions` (avec `initiated_by_practitioner_id`, `document_hash`, `device_id`) et `cabinet_signatures` (avec `signature_hash`, `consent_confirmed`) |
| CAB-02 | Endpoint initiate | `backend/routes/cabinet_signatures.py` — `POST /cabinet-signatures/initiate`, vérifie praticien, génère token, calcule hash document |
| CAB-03 | Endpoint upload | `backend/routes/cabinet_signatures.py` — `POST /cabinet-signatures/{token}/upload`, valide PNG ≤500KB, stocke signature + hash, `consent_confirmed=true` |
| CAB-04 | Service PDF signature | `backend/services/pdf_signature_cabinet.py` — incrustation image signature + bloc audit (date, IP, parent, session, hash doc, praticien) |
| CAB-05 | Composant SignaturePad | `frontend/src/components/SignaturePad.jsx` — Canvas HTML5, touch support tablette, export PNG base64 |
| CAB-06 | Page /sign/:token | `frontend/src/pages/CabinetSignature.jsx` — validation token, SignaturePad, checkbox "J'atteste…", upload |
| CAB-07 | Bouton praticien | Dashboard praticien — bouton "Signer en cabinet", sélection parent, création session, QR code + lien tablette |

**Restant :** micro-ajustements UX/texte (encodage, wording final métier)

---

## SPRINT 6 — Documentation RGPD (✅ Terminé)

**Objectif :** Documents légaux obligatoires RGPD

### Tâches à vérifier :

| ID | Tâche | Fichier à vérifier |
|----|-------|---------------------|
| DOC-01 | Politique de confidentialité | `docs/POLITIQUE_CONFIDENTIALITE.md` |
| DOC-02 | Registre des traitements (art. 30) | `docs/REGISTRE_TRAITEMENTS.md` |
| DOC-03 | Mentions légales | `docs/MENTIONS_LEGALES.md` |
| DOC-04 | Plan de Reprise d'Activité | `docs/PRA_PCA.md` |
| DOC-05 | Procédure violation données | `docs/PROCEDURE_VIOLATION_DONNEES.md` (encodage à corriger) |

---

## SPRINT 7 — Infra Azure / HDS (📋 À faire)

**Objectif :** Sécurisation réseau pour conformité HDS complète

### Tâches prévues :

| Tâche | Importance |
|-------|------------|
| Configurer Private Endpoint PostgreSQL | 🔴 Critique HDS |
| Configurer Private Endpoint Blob Storage | 🔴 Critique HDS |
| Firewall rules (bloquer accès public) | 🔴 Critique HDS |
| VNet / allowlist finalisés | 🔴 Critique |
| Signer contrat Azure Healthcare | 🔴 Obligatoire |
| Documentation infra finale | 🟡 Important |

**Note :** Décision prise de faire ce sprint en dernier, après stabilisation fonctionnelle. Coût estimé : +14€/mois.

---

## SPRINT 8 — Refonte UX praticien (✅ Terminé)

**Objectif :** Dashboard praticien moderne et fonctionnel

### Éléments implémentés :

- Navigation 4 onglets : Agenda, Patients, Relances, Ordonnances
- 5 métriques clés avec cartes colorées
- Cartes RDV enrichies (heure, type, lieu, statut, tags complétude, alertes visuelles)
- Modal patient avec 4 onglets (Informations, Consentement, Ordonnances, Session tablette)
- Recherche + filtres patients (Tous / En attente / Complets)
- Actions en masse pour relances
- Palette cohérente avec espace patient

---

## SPRINT 9 — Frontend patient contenus (✅ Largement fait)

**Objectif :** Homepage publique, pages légales, FAQ, séparation patient/praticien

### Éléments implémentés :

| Élément | Statut | Fichier/config à vérifier |
|---------|--------|---------------------------|
| Homepage publique | ✅ | `frontend/src/pages/HomePage.jsx` — composant avec config praticien |
| Pages légales (mentions, confidentialité) | ✅ | Routes `/mentions-legales` et `/confidentialite` |
| FAQ patient | ✅ | Page FAQ avec questions fréquentes |
| Global footer | ✅ | Footer sur toutes les pages |
| Séparation patient/praticien | ✅ | Deux domaines : `medicapp.fr` (patient) / `pro.medicapp.fr` (praticien) |

**Restant :** Contenus définitifs (noms réels, adresses, tarifs, textes juridiques validés par le praticien)

---

## SPRINT 10 — Maintenance et continuité (🔄 Partiellement fait)

**Objectif :** Opérations, sauvegardes, alertes, procédures

### État :

| Élément | Statut |
|---------|--------|
| Base technique | ✅ Avancée |
| Canal mail monitoring (domaine pro, SMTP) | 📋 À finaliser |
| Planification jobs quotidiens | 📋 À finaliser |
| Procédures d'exploitation incident | 📋 À rédiger |
| Kit papier de secours | 📋 À imprimer |

---

## SPRINT 11 — Parcours patient visuel (✅ Largement fait)

**Objectif :** Timeline visuelle type "suivi livraison" pour guider le patient

### Éléments implémentés :

| Élément | Statut | Détail |
|---------|--------|--------|
| Timeline 5 étapes | ✅ | Dossier → Pré-consultation → Délai réflexion (15j) → RDV Acte → Signatures |
| Statuts visuels | ✅ | Complete (vert), Current (bleu pulsant), Scheduled (ambre), Waiting (orange), Locked (gris) |
| Calcul automatique statuts | ✅ | Basé sur dossierComplete, appointments, délai 15 jours, document_signatures |
| Messages contextuels | ✅ | CTA dynamiques (Compléter dossier, Prendre RDV, Signer) |
| Responsive | ✅ | Horizontal desktop, vertical mobile |
| Palette | ✅ | Gris clair + bleu foncé confiance (#1E40AF) |

**Restant :** Derniers réglages UX (messages courts, cohérence étapes, encodage accents), liens "En savoir plus" vers FAQ

---

## SPRINTS MONITORING M1-M4 (✅ Terminé)

**Implémentés — ~40h sur 2 semaines**

| Sprint | Contenu | Statut |
|--------|---------|--------|
| M1 — Alertes techniques | Action Group email, alertes 5xx, temps de réponse, exceptions, CPU/mémoire, DB, test bout en bout | ✅ Terminé |
| M2 — Logging métier | Service EventTracker, instrumentation inscriptions/signatures/RDV/ordonnances/sécurité/parcours | ✅ Terminé |
| M3 — Dashboards KQL | Requêtes Kusto pour chaque métrique + dashboard Azure + rapport email hebdo | ✅ Terminé |
| M4 — Alertes métier | Notifications inscription, signatures complètes, fin délai 15j, brute-force, parcours abandonnés | ✅ Terminé |

### Éléments à vérifier dans le repo / Azure :

- **Service EventTracker** : `backend/services/event_tracker.py` — singleton, méthodes `track_event()`, `track_patient_event()`, `track_practitioner_event()`, `track_security_event()`
- **Instrumentation** : events custom dans les routes inscriptions, signatures (Yousign + cabinet), RDV, ordonnances, sécurité (login, MFA, lockout), parcours patient
- **Azure Monitor** : Action Group `medicapp-alerts-email`, alertes 5xx, temps de réponse >3s, exceptions backend, CPU >80%, mémoire >85%, connexions DB
- **Alertes métier** : nouvelle inscription, signatures complètes, fin délai 15 jours, brute-force (>20 échecs/h), parcours abandonné (30 jours inactif)
- **Dashboard Azure** : requêtes KQL configurées + rapport email hebdomadaire

---

## Contenus patient (✅ Terminé)

| Livrable | Statut | Détail |
|----------|--------|--------|
| Fiche 1 — Utilisation plateforme + formalités | ✅ | Capture vidéo prévue |
| Fiche 2 — Jour de l'intervention | ✅ | Document complet (accueil, anesthésie, intervention, suites) |
| Script vidéo intervention | ✅ | 25 scènes, flat design, style rassurant, aucun élément anatomique |
| Prompts images IA pour vidéo | ✅ | Générés pour chaque scène |

---

## Décisions métier documentées

| Décision | Détail |
|----------|--------|
| Ordonnance | Mention "NB non remboursable" ajoutée |
| RDV pré-consultation | Par téléphone (risque évalué et accepté — solution de bascule documentée) |
| Délai réflexion | 15 jours entre les 2 RDV ET 15 jours avant possibilité de signer |
| Consentement | Dual parental obligatoire (2 parents présents le jour J) |
| Yousign en cabinet | Remplacé par système d'horodatage maison (gratuit) |
| Parent 2 obligatoire dès création | Abandonné (trop bloquant) |
| Filtrage pré-inscription | Web-based (meilleur RGPD que SMS/téléphone) |

---

## Incidents et correctifs

| Date | Incident | Cause | Correctif |
|------|----------|-------|-----------|
| 10/02/2026 | 500 sur /dossier/current et /patient/me | Régression : helpers `_is_placeholder` et `_guardian_name_missing` manquants dans `backend/dossier/service.py` | Restauration des helpers, déploiement main |

**Leçon :** Les erreurs CORS côté navigateur étaient un effet secondaire du 500 backend — toujours diagnostiquer le backend d'abord.

---

## Infrastructure actuelle

| Composant | Service Azure | Coût mensuel |
|-----------|---------------|--------------|
| Backend API | App Service (Python/FastAPI) | ~12€ |
| Base de données | PostgreSQL Flexible Server | ~12€ |
| Stockage documents | Azure Blob Storage | ~2€ |
| Frontend patient | Static Web App | Gratuit |
| Frontend praticien | Static Web App | Gratuit |
| Monitoring | Application Insights | ~1€ |
| Secrets | Azure Key Vault | ~1€ |
| DNS | OVH (sethostscope.dev) | ~4€ |
| **Total actuel** | | **~32€/mois** |

**Après S7 (Private Endpoints) :** +14€/mois estimé

---

## Checklist pour l'agent IA de vérification

L'agent connecté au repo devrait vérifier :

1. **Structure fichiers backend** : `services/encryption.py`, `services/mfa_service.py`, `services/storage.py`, `services/pdf_signature_cabinet.py`, `services/event_tracker.py`, `middleware/audit_logging.py`, `middleware/rate_limiter.py`, `routes/patient_gdpr.py`, `routes/cabinet_signatures.py`, `scripts/migrate_encrypt_pdfs.py`, `scripts/purge_patient_complete.py`
2. **Migrations Alembic** : tables `mfa_codes`, `login_attempts`, `cabinet_signatures`, `cabinet_signature_sessions`
3. **Variables d'environnement attendues** : `AZURE_KEY_VAULT_URI`, `APPINSIGHTS_INSTRUMENTATION_KEY`, `REQUIRE_MFA_PRACTITIONER`, `REQUIRE_GUARDIAN_2`
4. **Endpoints API** : `/patient/me/export`, `/patient/me/delete`, `/patient/me/rectify`, `/auth/mfa/send`, `/auth/mfa/verify`, `/cabinet-signatures/initiate`, `/cabinet-signatures/{token}/upload`
5. **Frontend** : `SignaturePad.jsx`, `CabinetSignature.jsx`, `HomePage.jsx`, timeline parcours patient, dashboard praticien 4 onglets
6. **Documentation** : `POLITIQUE_CONFIDENTIALITE.md`, `REGISTRE_TRAITEMENTS.md`, `MENTIONS_LEGALES.md`, `PRA_PCA.md`, `PROCEDURE_VIOLATION_DONNEES.md`
7. **Tests** : `test_encryption.py` minimum
8. **Monitoring** : `services/event_tracker.py`, alertes Azure Monitor configurées (5xx, response time, exceptions, CPU, mémoire, DB), dashboard KQL, alertes métier (inscription, signatures, délai 15j, brute-force, abandons)
