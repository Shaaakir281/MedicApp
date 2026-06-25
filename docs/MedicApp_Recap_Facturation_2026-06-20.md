# MedicApp — Récapitulatif de facturation

Date : 20 juin 2026 — Document interne de préparation (non contractuel).
Base tarifaire : 200 € HT la demi-journée (400 € HT/jour), en régie par petits lots avec relevé d'activité.

Ce récapitulatif couvre **l'ensemble de la mission** : le travail déjà réalisé (jamais facturé à ce jour) et le travail restant pour aboutir à une plateforme exploitable. L'objectif de budget est de **rester sous 35 000 € HT** pour la facture immédiate.

---

## 1. Travail déjà réalisé — forfait

L'application est déjà complète sur le plan fonctionnel et n'a fait l'objet d'aucune facture jusqu'à présent.

Périmètre livré : parcours patient complet, rendez-vous, signature cabinet sur tablette, ordonnances, espace praticien, sécurité et RGPD, monitoring et CI/CD.

| | Montant HT |
|---|---|
| Valeur réelle du travail livré (69–93 j) | 27 600 – 37 200 € |
| **Forfait retenu (allégé)** | **22 000 €** |

Le forfait est volontairement inférieur à la valeur réelle : geste commercial, et la part Yousign n'est pas facturée en totalité puisque cette brique sort du parcours actif.

---

## 2. Reste à faire — socle

Les comptes (Azure, Twilio, OVH, Stripe) sont déjà ouverts et la reprise est bien avancée. Le restant ci-dessous mène à une version production, hors options.

| Contenu | Charge |
|---|---|
| Fin de reprise + validation technique + recette courte | 3 j |
| Recette complète patient/praticien + corrections (provision) | 5 j |
| Contenus métier + personnalisation praticien + corrections avocate | 2,5 j |
| Retrait Yousign + OTP parent 1 seulement | 2 j |
| SMS d'orientation post-appel (écran secrétariat) | 1,5 j |
| Tests automatisés critiques | 2,75 j |
| Durcissement HDS (Private Endpoints, accès réseau, clauses Microsoft) | 4,5 j |
| Préparation production + installation cabinet + formation ½ journée | 3,5 j |
| **Total** | **≈ 25 j — 9 900 € HT** |

---

## 3. Option retenue maintenant — Visio (LiveKit)

Salle de téléconsultation intégrée dans l'espace patient : lien d'accès à usage unique, jeton sécurisé patient et praticien, sans enregistrement. LiveKit Cloud (UE) pour le pilote, self-hosted HDS pour la production.

**≈ 6,25 j — 2 500 € HT.**

---

## 4. Récapitulatif — facture immédiate

| Bloc | Montant HT |
|---|---|
| 1. Travail déjà réalisé (forfait allégé) | 22 000 € |
| 2. Reste à faire — socle | 9 900 € |
| 3. Option Visio (LiveKit) | 2 500 € |
| **Total à facturer maintenant** | **34 400 € HT** |

Objectif budgétaire respecté : **sous 35 000 € HT.**

---

## 5. Phase 2 — à facturer ultérieurement

L'option **Paiement en ligne (Stripe « payer pour réserver »)** est reportée. Le compte Stripe vient d'être ouvert et les modalités comptables côté cabinet (facture Stripe, export mensuel) restent à caler.

| Contenu | Charge | Montant HT |
|---|---|---|
| Paiement à la réservation + webhook fiabilisé + facture HDS + lien sécurisé | ~10 j | **4 000 €** |

Déclenchement quand le cabinet a validé sa procédure comptable.

S'ajoutent à la demande, après démarrage : optimisations ergonomiques selon les retours du personnel, en **régie (plafond 3 j, ≤ 1 200 € HT)** — seul le réalisé est facturé.

---

## 6. Coûts récurrents annuels du client (indicatifs HT, à sa charge directe)

| Phase | Annuel |
|---|---|
| Pilote durci HDS | ≈ 950 – 1 100 € |
| Production réelle avec visio | ≈ 2 000 – 2 300 € |

Stripe (phase 2) : pas d'abonnement, frais ≈ 1,4 % + 0,25 € par transaction. Ces montants sont prélevés directement chez le client (Azure, Twilio, OVH, Stripe). À confirmer après le premier relevé Azure réel.

---

## 7. Hypothèses et exclusions

### Hypothèses
1. Données fictives jusqu'à la fin du durcissement HDS ; base recréée par Alembic + seed.
2. Comptes tiers au nom du client ; prestataire administrateur invité.
3. Corrections par petits lots : une anomalie → un correctif → un test → un déploiement.
4. Les provisions (corrections, tests, régie) sont des plafonds ; seul le réalisé est facturé.
5. Le cabinet fournit les modèles réels (ordonnance, compte rendu) et les informations légales.

### Exclusions
1. Validation juridique des textes, conseil DPO, audit HDS, pentest externe.
2. Abonnements et consommations tiers — prélevés directement chez le client.
3. Production des vidéos et contenus médicaux.
4. Support utilisateur récurrent après démarrage (contrat de maintenance distinct).
5. Génération et envoi du compte rendu de consultation, et tarification de l'acte par âge (lots distincts si retenus).

---

## 8. Décisions attendues

1. Modalité de consentement du parent 2 absent le jour de l'acte (porte juridique).
2. Lancement des clauses HDS Microsoft (délai administratif — à initier tôt).
3. Date cible de remise en service.
4. Validation de la procédure comptable côté cabinet pour déclencher la phase 2 (paiement).
