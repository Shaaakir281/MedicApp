# MedicApp - Roadmap de reprise et finalisation

Derniere mise a jour: 2026-06-27

Cette roadmap remplace les anciens suivis de sprint comme document de pilotage actif.

> Jalon HDS (2026-06-27) : reunion Microsoft tenue le 25/06, **certificat HDS + documents de conformite Azure recus le 26/06** et archives dans `docs/`. Montage confirme : cabinet titulaire de son compte Azure (responsable de traitement), Fathi prestataire dev/integration. Un **partenaire Microsoft** va contacter Fathi pour valider l'architecture et le parametrage HDS (phase R1/R4). Preparation HDS estimee a **~75-80%** (reste surtout le durcissement reseau). Couts recurrents cadres : voir section "Couts recurrents" plus bas.

> Jalon teleconsultation/paiement (2026-06-27) : le socle local est operationnel. Paiement mock local, reservation `awaiting_payment`, validation du RDV, creation de session LiveKit, lien patient, token praticien, page React `/teleconsultation/:appointmentId` et LiveKit Docker local sont en place. Reste a finaliser : Stripe sandbox/reel, webhook signe, facture Stripe stockee HDS, LiveKit Cloud UE pilote puis self-host HDS prod.

## Objectif

Remettre MedicApp en service progressivement, confirmer les fonctions deja developpees, corriger les derniers ecarts et preparer un pilote exploitable.

> Note de sequencement (2026-06-20) : le developpement se fait **d'abord en local** (Docker, donnees fictives). L'infrastructure Azure (R1/R2) n'est **pas recreee tout de suite** : elle le sera **au moment du durcissement HDS**. Les chantiers actifs en local sont la simplification pilote (RS) et le module teleconsultation + paiement (cadre par `CADRAGE_TELECONSULTATION_PAIEMENT.md`).

## Vue d'ensemble

| Phase | Objectif | Statut |
|---|---|---|
| R0 | Ranger et fiabiliser la documentation | En cours |
| R1 | Recreer l'infrastructure supprimee | A faire (au moment du HDS) |
| R2 | Redemarrer et verifier techniquement | A faire (au moment du HDS) |
| R3 | Recette fonctionnelle complete | A faire |
| RS | Simplification produit avant pilote | A faire |
| R4 | Finaliser contenus et conformite | A faire |
| R5 | Preparer le pilote | A faire |
| RP | Module de paiement en ligne (Stripe) | En cours - socle local fait, Stripe reel/facture HDS a faire |
| R6 | Ameliorations post-recette | Backlog |

## R0 - Documentation

Objectif: disposer de sources de verite simples avant toute reprise.

- [x] confirmer le bon depot et la branche;
- [x] documenter l'etat Azure en pause;
- [x] creer la procedure de reprise;
- [x] creer l'etat projet;
- [x] creer la roadmap;
- [x] creer le perimetre pour le futur devis;
- [ ] archiver les anciens documents racine;
- [ ] verifier les runbooks et documents de conformite;
- [ ] supprimer ou ignorer les artefacts temporaires.

Livrables:

- `docs/REPRISE_PROJET.md`
- `docs/ETAT_PROJET.md`
- `docs/ROADMAP.md`
- `docs/PERIMETRE_DEVIS.md`

## R1 - Infrastructure

Objectif: recreer uniquement les ressources necessaires.

- [ ] repasser `medicapp-plan` de `F1` a `B1`;
- [ ] recreer `medicappregistry`;
- [ ] renouveler les secrets GitHub ACR;
- [ ] recreer `medicappdbprod`;
- [ ] recreer la base `medscript`;
- [ ] mettre a jour `DATABASE_URL`;
- [ ] appliquer `alembic upgrade head`;
- [ ] injecter les donnees fictives;
- [ ] redeployer l'image backend.

Procedure:

- `docs/REPRISE_PROJET.md`

Condition de sortie:

- backend accessible sur le hostname Azure;
- connexion PostgreSQL fonctionnelle;
- migrations a jour;
- workflow GitHub Actions vert.

## R2 - Validation technique

Objectif: verifier les fondations avant les tests metier.

- [ ] healthcheck backend;
- [ ] connexion frontend vers backend;
- [ ] CORS;
- [ ] acces Key Vault;
- [ ] stockage et dechiffrement des documents;
- [ ] SMTP Mailjet;
- [ ] SMS Twilio;
- [ ] signature cabinet et stockage des PDFs signes;
- [ ] Yousign seulement si remis dans le perimetre actif;
- [ ] Application Insights;
- [ ] logs sans secrets ni donnees excessives;
- [ ] domaine backend et SSL;
- [ ] reactivation controlee des Logic Apps.

Condition de sortie:

- aucun 500 structurel;
- aucun secret manquant;
- services tiers joignables;
- monitoring visible.

## R3 - Recette fonctionnelle

Objectif: rejouer un parcours complet avec donnees fictives.

### Patient

- [ ] inscription;
- [ ] verification email;
- [ ] dossier enfant et parents;
- [ ] verification email des parents;
- [ ] verification SMS;
- [ ] prise de pre-consultation;
- [ ] prise de rendez-vous acte;
- [ ] annulation et cascade;
- [ ] affichage du delai de 15 jours;
- [ ] documents et signatures cabinet;
- [ ] ordonnance;
- [ ] export, rectification et suppression RGPD.

### Praticien

- [ ] connexion et MFA;
- [ ] agenda;
- [ ] dossier patient;
- [ ] relances;
- [ ] ordonnances;
- [ ] signature cabinet;
- [ ] dashboard documents;
- [ ] statistiques maintenance.

Regle de travail:

- une anomalie;
- un correctif limite;
- un test cible;
- un deploiement;
- une validation avant de continuer.

## RS - Simplification produit avant pilote

Objectif: reduire le cout, les frictions et le perimetre avant le pilote, sans supprimer definitivement les briques deja codees.

### Decisions produit

- Yousign est sorti du parcours actif pour l'instant: 6 documents signes par enfant rendent le cout trop eleve;
- les signatures se font prioritairement sur place, sur tablette, avec la signature cabinet deja developpee;
- la video explicative n'est plus proposee dans le parcours ni mise en avant pour le pilote; elle reste une option future;
- le cote praticien doit etre simplifie car il n'y aura qu'un praticien: le docteur du cabinet;
- la consultation prealable est une consultation d'information, potentiellement en teleconsultation, avec paiement separe;
- teleconsultation, flux paiement (decide 2026-06-20): **payer pour reserver** - le creneau de consultation prealable n'est confirme qu'apres paiement Stripe reussi, et l'acces visio n'est delivre qu'apres paiement;
- teleconsultation, techno visio (decide 2026-06-20): **LiveKit**, salle integree dans l'espace patient; **phasage** - LiveKit Cloud region UE pour le pilote (donnees fictives), puis **LiveKit self-hosted** sur Azure France Central HDS en production (meme SDK, pas de reecriture); sans enregistrement, salles ephemeres, jetons courts signes par FastAPI, identite patient verifiee avant emission du token;
- contrainte visio medicale: hebergeable HDS ou prestataire certifie HDS, donnees en UE + DPA, embarquable dans l'UI, lien d'acces a usage unique, **sans enregistrement** (seul artefact conserve = le compte rendu ecrit).

### Taches fonctionnelles

- [ ] ameliorer la page d'accueil pour presenter plus clairement le docteur, le cabinet et le parcours;
- [ ] retirer les appels a Yousign du parcours patient et praticien actif, tout en conservant le code dormant si utile;
- [ ] masquer la video explicative dans l'interface publique et le parcours patient;
- [ ] appliquer la liste de corrections FAQ fournie par Fathi;
- [ ] simplifier l'espace praticien pour un seul docteur;
- [ ] creer un tableau de bord administrateur pour gerer les creneaux;
- [ ] permettre de definir, par jour et par plage horaire, le type de creneau, la duree et les jours/plages indisponibles;
- [ ] prevoir dans ce dashboard l'envoi ou l'ouverture des signatures cabinet cote patient si besoin;
- [ ] remplacer le modele fictif d'ordonnance par les exemples PDF reels du cabinet;
- [ ] generer le compte rendu de consultation prealable a partir du modele fourni;
- [ ] envoyer le compte rendu au patient/parents par lien securise;
- [x] cadrer le module de teleconsultation + paiement (`CADRAGE_TELECONSULTATION_PAIEMENT.md`);
- [x] implementer le socle local de teleconsultation integree (LiveKit, tokens patient/praticien, page React);
- [x] raccorder le paiement mock local de la consultation prealable au parcours de teleconsultation;
- [ ] brancher Stripe sandbox puis production;
- [ ] stocker la facture Stripe en HDS et l'exposer par lien securise.

Condition de sortie:

- le parcours pilote ne propose plus Yousign ni la video explicative, les creneaux sont gerables par l'administration, et les documents envoyes au patient utilisent les modeles reels.

## R4 - Contenus et conformite

Objectif: remplacer les brouillons par des informations validables.

- [ ] nom et coordonnees du praticien;
- [ ] RPPS;
- [ ] SIRET;
- [ ] adresse du cabinet;
- [ ] contact RGPD ou DPO;
- [ ] validation des mentions legales;
- [ ] validation de la politique de confidentialite;
- [ ] validation des durees de conservation;
- [ ] validation de la procedure de violation;
- [ ] decision sur les Private Endpoints et l'acces public (durcissement reseau scriptes dans `docs/compliance/INFRASTRUCTURE_HDS.md`, a appliquer avec le partenaire Microsoft);
- [x] archivage des attestations et contrats HDS (certificat HDS Azure + catalogue compliance recus 26/06, dans `docs/`);
- [ ] validation de l'architecture et du parametrage HDS par le partenaire Microsoft (contact a venir);
- [ ] confirmer le rattachement du compte Azure au cabinet (montage cabinet titulaire) et la clause prestataire dans le contrat de dev.

Attention:

La validation juridique et HDS ne doit pas etre declaree terminee sur la seule base du code.

## R5 - Pilote

Objectif: ouvrir a un petit nombre d'utilisateurs controles.

- [ ] environnement stabilise;
- [ ] donnees de test nettoyees;
- [ ] comptes pilote crees;
- [ ] support et procedure incident disponibles;
- [ ] sauvegarde et restauration testees;
- [ ] monitoring actif;
- [ ] criteres de retour arriere definis;
- [ ] collecte des retours utilisateurs;
- [ ] bilan du pilote.

## RP - Module de paiement en ligne (Stripe)

Objectif: encaisser en ligne la **consultation prealable** (l'acte lui-meme reste regle en direct le jour J), de la maniere la plus automatique et la plus simple possible.

### Decision d'architecture retenue

- pas de feuille de soins ni de remboursement: la circoncision rituelle est un acte non therapeutique, donc hors Assurance Maladie (a confirmer cote cabinet);
- paiement par carte via **Stripe** sur la plateforme;
- la **facture/recu est emise automatiquement par Stripe** (numerotation incluse), pas par le logiciel comptable: on evite ainsi toute integration sur mesure entre le logiciel comptable et le serveur;
- la facture etant une donnee renseignant sur la sante, elle n'est **pas envoyee par email**: elle est deposee sur le **stockage HDS** de la plateforme et le patient la telecharge via un **lien securise** depuis son espace (meme principe que les ordonnances et signatures);
- le comptable du cabinet recupere simplement l'**export mensuel Stripe** pour tenir la comptabilite.

### Tarifs (retour cabinet / Miriam, 2026-06-19)

- consultation prealable: **50 EUR** (montant a encaisser via Stripe; ancien chiffre indicatif de 40 EUR a abandonner);
- acte de circoncision: **tarification par tranche d'age** (alignement sur les autres cliniques), en remplacement du tarif unique de 400 EUR; grille d'age detaillee a fournir par le cabinet;
- les tarifs ne sont **pas affiches sur la page d'accueil publique** (decision Miriam): ils apparaitront dans le parcours / apres creation de compte.

### Points a confirmer avec le cabinet (Miriam / comptable)

- [ ] quel logiciel comptable est utilise et peut-il gerer les factures de consultations;
- [ ] accord pour que Stripe emette la facture et que le comptable travaille sur export mensuel;
- [ ] confirmation de l'absence de remboursement / feuille de soins.

### Taches techniques

- [ ] creer le compte Stripe (seul compte tiers encore manquant);
- [x] ajouter le modele `Payment`, `StripeWebhookEvent`, `TeleconsultationSession` et la migration associee;
- [x] integrer le paiement local mock au backend pour developper sans compte Stripe;
- [x] declencher le paiement de la consultation prealable dans le parcours patient;
- [x] confirmer un paiement mock et valider le RDV;
- [x] creer la session LiveKit apres paiement valide pour un RDV `visio`;
- [x] exposer les endpoints token patient/praticien;
- [x] integrer la salle React LiveKit dans `/teleconsultation/:appointmentId`;
- [x] ajouter LiveKit local a Docker Compose pour tester une vraie visio en local;
- [ ] integrer Stripe reel au backend avec cles sandbox;
- [ ] tester le webhook Stripe signe et idempotent;
- [ ] recuperer la facture Stripe et la stocker en HDS (chiffree, comme les autres documents);
- [ ] exposer un lien de telechargement securise dans l'espace patient;
- [ ] gerer le cas du patient qui paie la consultation puis refuse l'acte (facture disponible sans retour au cabinet);
- [ ] tests: paiement Stripe reussi, paiement echoue, remboursement eventuel, acces a la facture.

### Etat local valide le 2026-06-27

- backend: `38 passed`;
- frontend: `npm run build` OK;
- LiveKit local: conteneur Docker operationnel sur `ws://localhost:7880`;
- endpoint teleconsultation praticien: token LiveKit reel (`mock=false`);
- endpoint teleconsultation patient: token LiveKit reel (`mock=false`) pour la meme salle;
- correction session praticien: la teleconsultation s'ouvre dans le meme onglet pour conserver l'auth `sessionStorage`;
- correction auth: les tokens portent `role`, `email`, `email_verified`.

Condition de sortie:

- un paiement Stripe sandbox de consultation aboutit, la facture est disponible en ligne pour le patient, l'export Stripe est exploitable par le comptable, et patient/praticien rejoignent la meme salle LiveKit.

## R6 - Backlog

- tests frontend automatises;
- tests E2E automatises;
- automatisation Infrastructure as Code;
- ameliorations UX issues de la recette;
- video explicative et transcription, seulement si decidees apres pilote;
- revue accessibilite;
- revue de performance;
- pentest ou audit externe selon le niveau de mise en production vise.

## Couts recurrents (cadres 2026-06-27)

Deux postes distincts, deux factures distinctes :

| Poste | Montant | Qui paie | Contenu |
|---|---|---|---|
| Infrastructure Azure (prod HDS) | ~400 EUR/mois | **Le cabinet** (sur son compte Azure) | App Service, PostgreSQL, Key Vault, stockage, Private Endpoints, sauvegardes, supervision, WAF. Charge d'exploitation du cabinet, **hors facturation Fathi**. Allegeable en phase pilote (Front Door au lieu d'Application Gateway WAF, SKU B-series, reservations 1 an -40%). |
| Maintenance mensuelle | ~400 EUR HT/mois (1 j) | Le cabinet, **facture par Fathi** | Formule **Standard** : supervision alertes, mises a jour securite, verification sauvegardes + test restauration, revue des logs d'acces/audit HDS, rotation secrets/certificats, support praticien, petits correctifs. |

Regles a inscrire au contrat de maintenance :

- les **nouvelles fonctionnalites** ne sont pas dans le forfait : facturees a part au TJM (400 EUR/j HT) ;
- perimetre inclus/exclu explicite et delai de reponse indicatif (24-72 h selon gravite) ;
- contrat de maintenance **distinct** du devis de realisation initial.

Le forfait Standard est le point de depart pour un demarrage a un seul cabinet ; reevaluable apres quelques mois de donnees reelles d'usage.

## Definition de fin

MedicApp pourra etre considere pret pour un pilote lorsque:

1. l'infrastructure est recreee et documentee;
2. la recette patient et praticien est passee;
3. les integrations email, SMS et signature cabinet sont stables;
4. les documents legaux ne contiennent plus de placeholders;
5. les sauvegardes, alertes et procedures incident sont testees;
6. les risques HDS restants sont explicitement acceptes ou corriges.
