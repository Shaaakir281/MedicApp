# MedicApp - Perimetre pour preparation du devis

Derniere mise a jour: 2026-06-10

Ce document prepare le chiffrage. Il ne constitue pas un devis contractuel.

## 1. Situation de depart

Le produit existe deja et couvre l'essentiel des parcours metier. Le futur devis ne doit donc pas chiffrer une creation complete, mais:

- la remise en route;
- la recette;
- les corrections residuelles;
- la finalisation des contenus;
- les choix de conformite et d'industrialisation.

## 2. Perimetre deja realise

### Produit

- frontend public;
- espace patient;
- espace praticien;
- dossier enfant et parents;
- rendez-vous;
- delai de reflexion;
- documents legaux;
- signatures Yousign;
- signature cabinet;
- ordonnances;
- FAQ et contenus patient.

### Securite et conformite technique

- chiffrement;
- Key Vault;
- audit logging;
- MFA;
- rate limiting;
- verrouillage de compte;
- export, rectification et suppression RGPD;
- scripts de purge.

### Exploitation

- CI/CD GitHub Actions;
- App Service;
- Static Web App;
- Application Insights;
- alertes techniques et metier;
- dashboard KQL;
- rapport hebdomadaire;
- runbook monitoring.

## 3. Lots restant a chiffrer

Les charges ci-dessous sont indicatives et devront etre confirmees apres la remise en route.

| Lot | Contenu | Charge indicative |
|---|---|---|
| A | Reprise Azure, ACR, PostgreSQL, migrations, deploiement | 1 a 2 jours |
| B | Validation technique des integrations et du monitoring | 1 a 2 jours |
| C | Recette fonctionnelle patient et praticien | 2 a 4 jours |
| D | Corrections de regressions et micro-UX | Provision de 2 a 5 jours |
| E | Finalisation des textes et parametres metier | 0,5 a 2 jours techniques |
| F | Renforcement tests backend et creation tests frontend | 3 a 7 jours |
| G | Architecture HDS finale et restrictions reseau | 3 a 8 jours selon option |
| H | Preparation et accompagnement pilote | 2 a 5 jours |

## 4. Options de devis

### Option 1 - Reprise minimale

Inclut:

- lots A et B;
- recette courte des fonctions critiques;
- correction des blocages uniquement.

Objectif:

- remettre l'environnement de demonstration en ligne.

### Option 2 - Reprise et stabilisation

Inclut:

- lots A a E;
- recette complete;
- corrections UX prioritaires;
- contenus legaux techniquement integres.

Objectif:

- disposer d'une version stable pour demonstration ou pilote interne.

### Option 3 - Preparation production

Inclut:

- lots A a H;
- tests automatises renforces;
- architecture HDS arbitree;
- procedures exploitation validees;
- accompagnement pilote.

Objectif:

- preparer une mise en production avec utilisateurs reels.

## 5. Elements externes au chiffrage technique

A confirmer separement:

- validation juridique des textes;
- conseil DPO;
- audit HDS;
- pentest externe;
- abonnements Azure;
- Mailjet;
- Twilio;
- Yousign;
- nom de domaine et messagerie OVH;
- production des videos et contenus medicaux;
- support utilisateur apres lancement.

## 6. Hypotheses

- les donnees actuelles restent fictives;
- la base peut etre recreee par Alembic et le script de seed;
- les noms de ressources Azure restent disponibles;
- les acces Azure, GitHub, Mailjet, Twilio et Yousign restent valides;
- les corrections seront traitees par petits lots;
- toute nouvelle fonctionnalite fera l'objet d'un chiffrage distinct.

## 7. Informations necessaires avant devis final

- niveau cible: demonstration, pilote ou production;
- nombre de praticiens;
- volume estime de patients;
- besoin reel du parent 2;
- niveau de support attendu;
- exigences de disponibilite;
- choix d'architecture HDS;
- proprietaire de la validation juridique;
- liste finale des corrections UX;
- date cible de remise en service.
