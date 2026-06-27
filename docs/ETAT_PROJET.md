# MedicApp - Etat actuel du projet

Derniere verification: 2026-06-27

Ce document est la source de verite pour savoir ce qui est realise, ce qui doit etre revalide et ce qui reste a faire.

## Synthese

MedicApp est fonctionnellement tres avance. Le coeur du parcours patient, le dashboard praticien, les signatures, les ordonnances, la securite, les droits RGPD et le monitoring ont ete implementes.

Le developpement se fait actuellement **en local** (Docker + PostgreSQL locale, donnees fictives). L'infrastructure Azure reste **volontairement eteinte** jusqu'au durcissement HDS : elle ne sera recreee qu'a ce moment-la (en France Central), pas avant.

Etat Azure (eteint volontairement, ce n'est pas un incident):

- backend Azure arrete;
- App Service Plan en `F1` Free;
- base PostgreSQL non recreee;
- Azure Container Registry non recree;
- Logic Apps desactivees;
- frontend Static Web App conserve;
- monitoring, Key Vault, alertes et configuration applicative conserves.

La procedure exacte de remise en route Azure (a executer au moment du HDS) est dans `docs/REPRISE_PROJET.md`. Le cadrage du module teleconsultation + paiement est dans `docs/CADRAGE_TELECONSULTATION_PAIEMENT.md`.

## Point HDS (mis a jour 2026-06-27)

Reunion tenue le 25/06/2026 avec Microsoft (Ziad Tantawy, Customer Lifecycle Manager France) sur l'usage d'Azure en contexte HDS. Compte rendu et documents de conformite recus le 26/06 (Chedene Abdel, Azure Solution Area Specialist) et archives dans `docs/`.

Documents de conformite recus et archives:

- `docs/Azure, Dynamics 365 and Online Services - HDS Certificate (October 2025).pdf` : certificat HDS Microsoft (organisme Schellman, referentiel HDS v2, n 1042480-3), valide du 15/10/2025 au 30/10/2027. France Central (Paris) et France South (Marseille) explicitement dans le perimetre certifie ;
- `docs/Azure - Compliance Offerings (April 2026).pdf` : catalogue des certifications par service Azure (sert a verifier que chaque service active est dans le perimetre conforme).

Montage de responsabilite confirme: le **cabinet est titulaire de son propre compte Azure et responsable de traitement**, l'hebergement HDS etant assure par Azure (hebergeur certifie). Fathi intervient au titre du **developpement et de l'integration applicative** ; aucune certification HDS requise de son cote.

Comptes Azure (transmis a Microsoft le 26/06):

- **Compte cabinet** (titulaire HDS) : admin `admin@dr-talal-abdelkader.fr`, ID `d135117b-3c40-49c0-8dc3-be69738fd63f`. Fathi a la main sur la boite mail admin (gestion des acces et du parametrage) ;
- **Compte personnel** (developpement/integration), relie au GitHub `Shaaakir281`, ID `22045923-e995-4df0-8001-27de3b66290f`.

Prochaine etape cote Microsoft: un **partenaire Microsoft specialise** va contacter Fathi pour valider l'architecture et le parametrage de securite Azure HDS jusqu'a la mise en production.

Niveau de preparation HDS estime: **~75-80%**. Acquis: hebergement certifie (Azure France Central), securite applicative (chiffrement, Key Vault, journalisation des acces, MFA, RGPD), supervision (App Insights, dashboards KQL, alertes), documentation conformite (PRA/PCA, registre des traitements, procedure violation, politique de confidentialite, en brouillon avance). Principal reste a faire: **durcissement reseau** (Private Endpoints + coupure des acces publics, deja scriptes dans `docs/compliance/INFRASTRUCTURE_HDS.md` mais pas encore appliques), finalisation sauvegardes/retention, validation contractuelle.

## Couts recurrents (mis a jour 2026-06-27)

| Poste | Montant | Qui paie | Note |
|---|---|---|---|
| Infrastructure Azure (prod HDS) | ~400 EUR/mois | **Le cabinet** (compte Azure du cabinet) | Charge d'exploitation du cabinet, hors facturation Fathi. Le gros poste est le WAF Application Gateway ; allegeable en phase pilote (Front Door, SKU B-series) pour descendre nettement en dessous. |
| Maintenance mensuelle | ~400 EUR HT/mois (1 j) | Le cabinet, facture par Fathi | Formule **Standard** : supervision alertes, mises a jour securite, verification sauvegardes + test restauration, revue des logs d'acces/audit HDS, rotation secrets/certificats, support praticien, petits correctifs. Nouvelles fonctionnalites facturees a part au TJM (400 EUR/j). Contrat de maintenance distinct a formaliser. |

A noter: l'infra (~400 EUR/mois) n'est ni un cout ni une marge pour Fathi ; elle appartient au cabinet. La maintenance (~400 EUR HT/mois) est le revenu recurrent de Fathi.

## Jalon teleconsultation + paiement local (mis a jour 2026-06-27)

Le socle teleconsultation + paiement est maintenant implemente et testable en local sur donnees fictives.

Ce qui est en place:

- reservation de consultation prealable avec statut `awaiting_payment`;
- paiement local mock pour avancer tant que le compte Stripe n'est pas ouvert;
- validation du paiement mock et passage du rendez-vous en `validated`;
- creation automatique d'une `TeleconsultationSession` pour les rendez-vous `visio`;
- lien d'acces patient a usage unique;
- token praticien depuis l'agenda;
- page React `/teleconsultation/:appointmentId`;
- integration LiveKit React;
- serveur LiveKit local dans Docker Compose (`livekit/livekit-server`, mode dev);
- backend configure localement avec `LIVEKIT_URL=ws://localhost:7880`, `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`;
- tests locaux valides: backend `38 passed`, frontend `npm run build` OK.

Etat de test local:

- parcours patient de reservation et paiement mock valide;
- bouton patient "Rejoindre la teleconsultation" visible apres validation;
- bouton praticien "Rejoindre" fonctionnel depuis l'agenda;
- patient et praticien recoivent des tokens LiveKit reels (`mock=false`) pour la meme salle;
- correction faite sur la session praticien: la teleconsultation s'ouvre dans le meme onglet pour conserver le `sessionStorage`;
- correction faite sur les roles auth: les tokens portent `role`, `email`, `email_verified`, et les espaces patient/praticien signalent une mauvaise session au lieu de boucler.

Ce qui reste avant pilote reel:

- creer le compte Stripe et renseigner les cles sandbox;
- tester Stripe Checkout reel en bac a sable;
- brancher et tester le webhook Stripe avec signature;
- recuperer la facture/recu Stripe et la stocker dans le stockage HDS chiffre;
- exposer le lien de telechargement securise de la facture dans l'espace patient;
- remplacer LiveKit local par LiveKit Cloud UE pour pilote a donnees fictives, puis par LiveKit self-hosted Azure France Central HDS pour donnees reelles;
- faire une recette a deux navigateurs/profils (patient + praticien) avec camera/micro.

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
| Teleconsultation | Socle local operationnel | Salle LiveKit integree, tokens patient/praticien, lien patient a usage unique, Docker LiveKit local, page React visio. Reste: LiveKit Cloud UE pilote puis self-host HDS prod, recette multi-profils complete |
| Compte rendu pre-consultation | Non developpe | PDF reel a generer puis envoyer par lien securise |
| RGPD | Realise techniquement | Export, rectification, suppression logique, purge complete |
| Securite | Realise techniquement | Chiffrement, Key Vault, MFA praticien, rate limiting, verrouillage |
| Monitoring | Realise, actuellement desactive en partie | App Insights, dashboard, alertes, jobs et rapport hebdomadaire |
| Documentation legale | Brouillon avance | Textes presents, informations praticien/RPPS/SIRET/adresse a completer |
| Infrastructure HDS finale | Non finalisee (~75-80%) | Hebergement certifie OK (cert HDS recu 26/06), securite applicative et doc conformite OK ; reste le durcissement reseau (Private Endpoints, coupure acces publics, deja scriptes) + validation par le partenaire Microsoft |
| Tests automatises | Partiel | Backend: 38 tests passes le 2026-06-27 ; frontend: `npm run build` OK. Aucun test frontend automatise E2E |
| Module de paiement | Socle local en cours | Paiement mock local fonctionnel pour reserver/valider une preconsultation et creer la session visio. Reste: compte Stripe, Checkout sandbox, webhook signe, facture Stripe stockee HDS + lien securise |

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

Etat constate le 2026-06-27:

- branche `main` alignee avec `origin/main`;
- derniers jalons pousses: session patient/praticien clarifiee, teleconsultation praticien corrigee, LiveKit local Docker ajoute, CSS LiveKit ajoute;
- Alembic possede les migrations du module paiement + teleconsultation (`20260625_add_payments_teleconsultation.py`);
- backend Docker local actif avec PostgreSQL, Redis, Adminer et LiveKit local;
- LiveKit local accessible sur `ws://localhost:7880` / `http://localhost:7880`;
- endpoint teleconsultation praticien verifie en local: token LiveKit reel (`mock=false`);
- tests backend: `38 passed`;
- build frontend: OK, avec avertissements existants sur Browserslist et taille des chunks;
- le script de donnees fictives est `backend/scripts/seed_practitioner_demo.py`;
- les secrets GitHub ACR existent mais correspondent a l'ancien registre supprime.

## A revalider apres reprise

Ces fonctions ont deja fonctionne mais doivent etre rejouees sur l'infrastructure recreee:

1. inscription et verification email;
2. modification et reverification email parent;
3. creation complete du dossier en une seule saisie;
4. OTP SMS des deux parents;
5. reservation et annulation des deux types de rendez-vous;
6. reservation + paiement mock d'une preconsultation visio;
7. ouverture teleconsultation patient et praticien dans deux navigateurs/profils;
8. regle et affichage du delai de 15 jours;
9. absence de proposition Yousign dans le parcours pilote;
10. signature cabinet;
11. ordonnances et liens de telechargement;
12. export, rectification et suppression RGPD;
13. alertes App Insights et rapport hebdomadaire;
14. delivrabilite Mailjet avec SPF, DKIM et DMARC.

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

Etat au 2026-06-27:

| Service | Statut |
|---|---|
| Mailjet (email) | Ouvert |
| Twilio (SMS) | Ouvert |
| OVH | Ouvert |
| Nom de domaine | Ouvert |
| Azure (compte cabinet, titulaire HDS) | Ouvert - ID `d135117b-3c40-49c0-8dc3-be69738fd63f`, admin `admin@dr-talal-abdelkader.fr` |
| Azure (compte perso, dev/integration) | Ouvert - ID `22045923-e995-4df0-8001-27de3b66290f`, lie GitHub `Shaaakir281` |
| Contrat HDS Microsoft | Reunion tenue 25/06 ; docs de conformite + certificat HDS recus 26/06 et archives ; partenaire Microsoft a venir pour le parametrage |
| Stripe (paiement) | A ouvrir (seul compte manquant) |
| LiveKit local | Operationnel via Docker Compose (`livekit/livekit-server`, mode dev) |
| LiveKit Cloud UE | A creer/configurer pour le pilote a donnees fictives, puis remplacer par self-host HDS prod |

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
- le socle local teleconsultation + paiement mock est operationnel; Stripe reel et facture HDS restent a finaliser;
- les donnees actuelles peuvent etre fictives et recreees;
- les changements futurs doivent rester petits, testes et sans refactorisation large non demandee.
