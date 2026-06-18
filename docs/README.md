# Documentation MedicApp

Dernière mise à jour : 2026-06-10

Ce fichier est le point d'entrée unique de la documentation.

## Pilotage actif

| Besoin | Document |
|---|---|
| Savoir ce qui est réalisé et ce qui reste | `ETAT_PROJET.md` |
| Organiser la reprise par étapes | `ROADMAP.md` |
| Préparer un devis ou un chiffrage | `PERIMETRE_DEVIS.md` |
| Reconstruire l'infrastructure Azure | `REPRISE_PROJET.md` |

Ces quatre documents constituent les sources de vérité pour l'état courant. Les anciens suivis de sprint sont archivés.

## Exploitation

Les guides techniques sont dans `operations/` :

- `operations/MONITORING_RUNBOOK.md`
- `operations/M3_DASHBOARD_SETUP.md`
- `operations/M3_KQL_QUERIES.md`
- `operations/DASH06_WEEKLY_REPORT_SETUP.md`
- `operations/PROCEDURE_BACKUP.md`

Ils décrivent des procédures opérationnelles. Une information Azure doit être vérifiée avant exécution, car certaines ressources sont actuellement arrêtées ou supprimées.

## Conformité

Les documents réglementaires et de continuité sont dans `compliance/` :

- `compliance/INFRASTRUCTURE_HDS.md`
- `compliance/MENTIONS_LEGALES.md`
- `compliance/POLITIQUE_CONFIDENTIALITE.md`
- `compliance/PRA_PCA.md`
- `compliance/PROCEDURE_VIOLATION_DONNEES.md`
- `compliance/REGISTRE_TRAITEMENTS.md`

Plusieurs champs restent à compléter avant une mise en production réelle : identité du praticien, RPPS, SIRET, adresse, DPO et dates officielles.

## Architecture et tests

- Architecture fonctionnelle : `architecture/LOGIGRAMMES_MEDICAPP.md`
- Architecture backend : `../backend/ARCHITECTURE.md`
- Scénarios de recette : `testing/TESTS_E2E_MEDICAPP.md`

## Archives

Les analyses terminées, anciens plans et comptes rendus sont dans `archive/`.

- `archive/plans/` : anciens sprints, statuts et plans.
- `archive/signatures/` : études et implémentations de signature.
- `archive/sms/` : analyses SMS et non-régression.
- `archive/implementation/` : comptes rendus d'implémentation.

Ces documents conservent l'historique mais ne décrivent pas nécessairement l'état actuel.

## Règles documentaires

- Un sujet actif possède un seul document de référence.
- Toute information d'état porte une date de vérification.
- Les guides techniques sont séparés des suivis de projet.
- Les documents terminés sont archivés, pas supprimés.
- Aucun secret, mot de passe ou token ne doit être écrit dans Markdown.
- Les nouveaux besoins sont ajoutés à `ROADMAP.md`, puis détaillés dans un document dédié seulement si nécessaire.
