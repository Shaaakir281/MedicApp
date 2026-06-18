# MedicApp - Roadmap de reprise et finalisation

Derniere mise a jour: 2026-06-18

Cette roadmap remplace les anciens suivis de sprint comme document de pilotage actif.

## Objectif

Remettre MedicApp en service progressivement, confirmer les fonctions deja developpees, corriger les derniers ecarts et preparer un pilote exploitable.

## Vue d'ensemble

| Phase | Objectif | Statut |
|---|---|---|
| R0 | Ranger et fiabiliser la documentation | En cours |
| R1 | Recreer l'infrastructure supprimee | A faire |
| R2 | Redemarrer et verifier techniquement | A faire |
| R3 | Recette fonctionnelle complete | A faire |
| R4 | Finaliser contenus et conformite | A faire |
| R5 | Preparer le pilote | A faire |
| RP | Module de paiement en ligne (Stripe) | A faire (nouveau) |
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
- [ ] Yousign;
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
- [ ] documents et signatures;
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
- [ ] decision sur les Private Endpoints et l'acces public;
- [ ] archivage des attestations et contrats HDS.

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

### Points a confirmer avec le cabinet (Miriam / comptable)

- [ ] quel logiciel comptable est utilise et peut-il gerer les factures de consultations;
- [ ] accord pour que Stripe emette la facture et que le comptable travaille sur export mensuel;
- [ ] confirmation de l'absence de remboursement / feuille de soins.

### Taches techniques

- [ ] creer le compte Stripe (seul compte tiers encore manquant);
- [ ] integrer Stripe au backend (creation de paiement, webhook de confirmation);
- [ ] declencher le paiement de la consultation prealable dans le parcours patient;
- [ ] recuperer la facture Stripe et la stocker en HDS (chiffree, comme les autres documents);
- [ ] exposer un lien de telechargement securise dans l'espace patient;
- [ ] gerer le cas du patient qui paie la consultation puis refuse l'acte (facture disponible sans retour au cabinet);
- [ ] tests: paiement reussi, paiement echoue, remboursement eventuel, acces a la facture.

Condition de sortie:

- un paiement de consultation aboutit, la facture est disponible en ligne pour le patient, et l'export Stripe est exploitable par le comptable.

## R6 - Backlog

- tests frontend automatises;
- tests E2E automatises;
- automatisation Infrastructure as Code;
- ameliorations UX issues de la recette;
- video et transcription finales;
- revue accessibilite;
- revue de performance;
- pentest ou audit externe selon le niveau de mise en production vise.

## Definition de fin

MedicApp pourra etre considere pret pour un pilote lorsque:

1. l'infrastructure est recreee et documentee;
2. la recette patient et praticien est passee;
3. les integrations email, SMS et signature sont stables;
4. les documents legaux ne contiennent plus de placeholders;
5. les sauvegardes, alertes et procedures incident sont testees;
6. les risques HDS restants sont explicitement acceptes ou corriges.
