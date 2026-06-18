# MedicApp - Etat actuel du projet

Derniere verification: 2026-06-18

Ce document est la source de verite pour savoir ce qui est realise, ce qui doit etre revalide et ce qui reste a faire.

## Synthese

MedicApp est fonctionnellement tres avance. Le coeur du parcours patient, le dashboard praticien, les signatures, les ordonnances, la securite, les droits RGPD et le monitoring ont ete implementes.

Le projet est actuellement en pause technique:

- backend Azure arrete;
- App Service Plan en `F1` Free;
- base PostgreSQL supprimee;
- Azure Container Registry supprime;
- Logic Apps desactivees;
- frontend Static Web App conserve;
- monitoring, Key Vault, alertes et configuration applicative conserves.

La procedure exacte de remise en route est dans `docs/REPRISE_PROJET.md`.

## Etat par domaine

| Domaine | Statut | Etat verifie |
|---|---|---|
| Depot et CI/CD | Realise, a reconnecter | Depot `Shaaakir281/MedicApp`, workflow backend present, secrets ACR a renouveler |
| Frontend public | Realise, a simplifier | Homepage et FAQ presentes; video explicative a masquer pour le pilote |
| Espace patient | Realise | Inscription, verification email, dossier enfant/parents, OTP telephone |
| Parcours patient | Realise, a simplifier | Timeline, pre-consultation, delai de 15 jours, acte, signatures |
| Rendez-vous | Realise, admin a enrichir | Creneaux, reservation, annulation, cascade pre-consultation/acte |
| Signature distante | Realise techniquement, hors pilote pour l'instant | Yousign, signatures par document, suivi des deux parents |
| Signature cabinet | Realise | Session tablette, QR code, signature manuscrite, audit PDF |
| Ordonnances | Realise techniquement, modele reel a integrer | Creation, modification, signature, versions, QR, diffusion |
| Espace praticien | Realise, a simplifier | Agenda, patients, relances, ordonnances, statistiques maintenance |
| Dashboard admin planning | Non developpe | Gestion des jours, plages horaires, types et durees de creneaux |
| Teleconsultation | Non developpe | Le champ visio/presentiel existe, mais pas de salle ni lien gere dans le parcours |
| Compte rendu pre-consultation | Non developpe | PDF reel a generer puis envoyer par lien securise |
| RGPD | Realise techniquement | Export, rectification, suppression logique, purge complete |
| Securite | Realise techniquement | Chiffrement, Key Vault, MFA praticien, rate limiting, verrouillage |
| Monitoring | Realise, actuellement desactive en partie | App Insights, dashboard, alertes, jobs et rapport hebdomadaire |
| Documentation legale | Brouillon avance | Textes presents, informations praticien/RPPS/SIRET/adresse a completer |
| Infrastructure HDS finale | Non finalisee | Private Endpoints, restrictions reseau et validation contractuelle a arbitrer |
| Tests automatises | Partiel | 28 tests backend detectes, aucun test frontend automatise |
| Module de paiement | Non developpe (nouveau perimetre) | Decision: Stripe encaisse la consultation prealable + emet la facture, depot HDS et lien patient. Detail dans `ROADMAP.md` section RP |

## Fonctionnalites realisees

### Parcours public et patient

- page d'accueil publique;
- creation et connexion au compte patient;
- verification d'adresse email et reinitialisation du mot de passe;
- constitution du dossier enfant et parents;
- verification des emails des parents;
- verification des telephones par SMS;
- prise de rendez-vous de pre-consultation et d'acte;
- respect du delai de reflexion de 15 jours;
- affichage visuel de l'avancement;
- acces aux documents, ordonnances et signatures;
- pages FAQ et contenus legaux.

References principales:

- `frontend/src/App.jsx`
- `frontend/src/pages/Patient.jsx`
- `frontend/src/components/PatientJourneyHeader.jsx`
- `frontend/src/hooks/usePatientJourney.js`
- `backend/routes/rgpd.py`
- `backend/routes/dossier.py`
- `backend/routes/appointments.py`

### Parcours praticien

- agenda et gestion des patients;
- dashboard documents;
- relances;
- generation, modification et signature des ordonnances;
- suivi des signatures;
- signature en cabinet sur tablette;
- statistiques de maintenance.

References principales:

- `frontend/src/pages/Praticien.jsx`
- `frontend/src/pages/DocumentsDashboard.jsx`
- `backend/routes/practitioner.py`
- `backend/routes/documents_dashboard.py`
- `backend/routes/prescriptions.py`
- `backend/routes/admin_stats.py`

### Documents et signatures

- signatures Yousign par document, realisees techniquement mais sorties du parcours actif pour le pilote;
- signature distincte des deux parents;
- suivi des statuts;
- stockage des preuves et PDFs finaux;
- signature manuscrite en cabinet;
- hash et bloc d'audit dans les PDFs;
- purge et neutralisation des donnees envoyees au prestataire.

References principales:

- `backend/routes/document_signature.py`
- `backend/routes/cabinet_signatures.py`
- `backend/services/pdf_signature_cabinet.py`
- `frontend/src/components/SignaturePad.jsx`
- `frontend/src/pages/CabinetSignature.jsx`

### Securite et RGPD

- chiffrement des documents;
- integration Azure Key Vault;
- migration des documents historiques;
- journalisation des acces;
- export des donnees patient;
- rectification;
- suppression logique;
- script de purge complete;
- MFA praticien;
- limitation de debit;
- verrouillage apres echecs de connexion.

References principales:

- `backend/services/encryption.py`
- `backend/core/key_vault.py`
- `backend/middleware/audit_logging.py`
- `backend/middleware/rate_limiter.py`
- `backend/routes/rgpd.py`
- `backend/services/mfa_service.py`
- `backend/scripts/purge_patient_complete.py`

### Monitoring et exploitation

- Application Insights;
- evenements metier;
- alertes techniques;
- alertes metier;
- dashboard KQL;
- rapport hebdomadaire;
- jobs internes pour delai de reflexion et parcours abandonnes;
- smoke check PowerShell.

References principales:

- `backend/services/event_tracker.py`
- `backend/routes/internal_jobs.py`
- `scripts/monitoring_smoke_check.ps1`
- `docs/operations/MONITORING_RUNBOOK.md`
- `docs/operations/M3_KQL_QUERIES.md`

## Verification technique

Etat constate le 2026-06-10:

- branche `main` alignee avec `origin/main`;
- derniere serie de changements applicatifs datee du 2026-02-20;
- Alembic possede une seule tete: `20260130_add_cabinet_signature_tables`;
- 28 fonctions de test backend detectees;
- aucun framework ou fichier de test frontend detecte;
- le script de donnees fictives est `backend/scripts/seed_practitioner_demo.py`;
- les secrets GitHub ACR existent mais correspondent a l'ancien registre supprime.

## A revalider apres reprise

Ces fonctions ont deja fonctionne mais doivent etre rejouees sur l'infrastructure recreee:

1. inscription et verification email;
2. modification et reverification email parent;
3. creation complete du dossier en une seule saisie;
4. OTP SMS des deux parents;
5. reservation et annulation des deux types de rendez-vous;
6. regle et affichage du delai de 15 jours;
7. absence de proposition Yousign dans le parcours pilote;
8. signature cabinet;
9. ordonnances et liens de telechargement;
10. export, rectification et suppression RGPD;
11. alertes App Insights et rapport hebdomadaire;
12. delivrabilite Mailjet avec SPF, DKIM et DMARC.

## Reste a faire

### Priorite 0 - Reprise

- recreer PostgreSQL et ACR;
- remettre le plan backend en `B1`;
- appliquer Alembic;
- recreer les donnees fictives;
- renouveler les secrets GitHub ACR;
- deployer et demarrer le backend;
- rebrancher le domaine backend et le certificat;
- reactiver les Logic Apps apres validation.

### Priorite 1 - Validation avant pilote

- executer une recette complete patient et praticien;
- corriger les regressions eventuelles une par une;
- simplifier le parcours pilote: Yousign desactive, video explicative masquee;
- ameliorer la page d'accueil avec une presentation claire du docteur;
- creer le dashboard administrateur de gestion des creneaux;
- remplacer les documents fictifs par les modeles reels d'ordonnance et de compte rendu;
- completer les mentions legales et la politique de confidentialite;
- valider les contenus metier avec le praticien;
- verifier la delivrabilite email et SMS;
- confirmer les couts Azure apres remise en route.

## Comptes et services tiers

Etat au 2026-06-18:

| Service | Statut |
|---|---|
| Mailjet (email) | Ouvert |
| Twilio (SMS) | Ouvert |
| OVH | Ouvert |
| Nom de domaine | Ouvert |
| Azure | Ouvert |
| Contrat HDS Microsoft | Premiere demande de contact envoyee, en attente de reponse |
| Stripe (paiement) | A ouvrir (seul compte manquant) |

### Priorite 2 - Qualite et conformite

- ajouter des tests frontend sur les parcours critiques;
- renforcer les tests backend de signatures, rendez-vous et dossier;
- decider et implementer l'architecture reseau HDS finale;
- verifier les contrats, attestations et responsabilites des sous-traitants;
- realiser une revue securite avant mise en production reelle;
- definir les politiques de retention et de sauvegarde definitives.

### Priorite 3 - Ameliorations

- traiter les micro-corrections UX remontees pendant la recette;
- remettre eventuellement la video explicative et sa transcription apres pilote;
- uniformiser les textes et accents restants;
- automatiser davantage la recette et la reprise d'infrastructure.

## Decisions deja prises

- le parent 2 n'est pas obligatoire des la creation du dossier;
- la signature distante s'appuie sur les contacts verifies;
- le telephone permet l'activation de la signature par SMS;
- le delai de reflexion est de 15 jours;
- la signature cabinet reste disponible sans Yousign;
- Yousign est sorti du parcours actif pour le pilote afin d'eviter le cout de 6 signatures par enfant;
- la video explicative est masquee pour le pilote, mais pourra etre remise plus tard;
- il n'y aura qu'un praticien dans le parcours cible: le docteur du cabinet;
- la consultation prealable est une consultation d'information pouvant etre couplee a la teleconsultation et au paiement Stripe;
- les donnees actuelles peuvent etre fictives et recreees;
- les changements futurs doivent rester petits, testes et sans refactorisation large non demandee.
