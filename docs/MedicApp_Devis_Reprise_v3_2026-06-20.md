# MedicApp — Plan de reprise et devis v3

Date : 20 juin 2026 — Document interne de préparation (non contractuel). Remplace la v2 du 11 juin.
Base tarifaire : 200 € HT la demi-journée (400 € HT/jour), en régie par petits lots avec relevé d'activité.

## Ce qui change depuis la v2

1. **Visio : LiveKit au lieu de Jitsi.** Salle intégrée dans l'espace patient. LiveKit Cloud (région UE) pour le pilote, LiveKit self-hosted HDS pour la production réelle — même code, on bascule par configuration.
2. **Nouveau : paiement en ligne Stripe « payer pour réserver ».** Le créneau de consultation préalable n'est confirmé qu'après paiement. La facture est déposée en HDS et téléchargée par lien sécurisé (jamais par email).
3. **Visio et paiement sont désormais deux options séparées**, en plus du socle production. Le client choisit.

Le reste de la v2 ne bouge pas.

---

## 1. Le travail déjà réalisé (rappel — déjà facturé via les relevés)

L'application est déjà complète sur le plan fonctionnel : parcours patient, rendez-vous, signatures (cabinet + Yousign), ordonnances, espace praticien, sécurité/RGPD, monitoring, CI/CD.

**Valorisation indicative : ≈ 69–93 j, soit 27 600–37 200 € HT.**

Ce montant **n'est pas re-facturé** dans le devis de reprise. Il correspond au travail déjà livré, facturé via les relevés d'activité réels. Il sert uniquement à montrer au client la valeur déjà en place. Le devis ci-dessous ne chiffre que **ce qui reste à faire**.

---

## 2. Les trois devis

### Devis 1 — Remise en service

Plateforme de démonstration de nouveau en ligne, sur le compte du client.

| Contenu | Charge |
|---|---|
| Reconstruction infrastructure (compte client, France Central) | 3,5 j |
| Validation technique (email, SMS, stockage, monitoring) | 1,5 j |
| Recette courte des fonctions critiques + déblocage | 1,5 j |
| **Total** | **6,5 j — 2 600 € HT** |

Fourchette : 5,5–8 j (2 200–3 200 €).

### Devis 2 — Pilote prêt cabinet

Version simplifiée, personnalisée au nom du praticien, prête pour un pilote interne. Sans visio, sans paiement, sans durcissement HDS.

| Contenu | Charge |
|---|---|
| Reconstruction + validation technique | 5 j |
| Recette complète patient + praticien | 3 j |
| Corrections et micro-UX (provision) | 3 j |
| Contenus métier (mentions légales, RPPS, SIRET, adresse) | 1 j |
| Retrait Yousign + OTP parent 1 seulement | 2 j |
| Personnalisation praticien + corrections avocate | 1,5 j |
| SMS d'orientation post-appel (écran secrétariat) | 1,5 j |
| **Total** | **17 j — 6 800 € HT** |

Fourchette : 14–20 j (5 600–8 000 €).

### Devis 3 — Production réelle (socle)

Ouverture aux vrais patients : tests critiques, durcissement HDS, préparation production, installation et formation au cabinet. **Hors visio et hors paiement**, qui sont en options ci-dessous.

| Contenu | Charge |
|---|---|
| Périmètre du Devis 2 | 17 j |
| Tests automatisés critiques (signatures, RDV, dossier) | 2,75 j |
| Durcissement HDS (VNet, Private Endpoints, accès publics, clauses Microsoft) | 4,5 j |
| Préparation production (sauvegarde/restauration testée, procédure incident) | 2 j |
| Installation cabinet + formation ½ journée + guide PDF | 1,5 j |
| **Total** | **≈ 27 j — 10 800 € HT** |

Fourchette : 24–31 j (9 600–12 400 €).

---

## 3. Les deux options (à cocher par le client)

### Option Visio — téléconsultation (LiveKit)

Salle de téléconsultation intégrée dans l'espace patient : lien d'accès à usage unique, jeton sécurisé patient et praticien, bouton « Rejoindre », sans enregistrement.

**≈ 6,25 j — 2 500 € HT.** Le durcissement HDS de la visio en production (self-hosted) est couvert par le lot HDS du Devis 3.

### Option Paiement en ligne (Stripe « payer pour réserver »)

Encaissement en ligne de la consultation préalable (50 €). Le créneau n'est confirmé qu'après paiement. Facture émise par Stripe, déposée en HDS, téléchargée par lien sécurisé. Export mensuel pour le comptable.

| Contenu | Charge |
|---|---|
| Socle (compte Stripe, configuration) | 0,5–1 j |
| Paiement à la réservation + confirmation | 3–5 j |
| Webhook fiabilisé + expiration des réservations non payées | 3–5 j |
| Facture stockée en HDS + lien de téléchargement sécurisé | 2–4 j |
| **Total** | **≈ 10 j — 4 000 € HT** |

Fourchette : 9–12 j (3 600–4 800 €).

> Note : la visio et le paiement se complètent (l'accès à la salle n'est délivré qu'après paiement). Pris ensemble, ils restent additifs côté budget, avec une légère synergie d'intégration.

---

## 4. Récapitulatif

| Proposition | Charge | Montant HT |
|---|---|---|
| Devis 1 — Remise en service | 6,5 j | 2 600 € |
| Devis 2 — Pilote prêt cabinet | 17 j | 6 800 € |
| Devis 3 — Production réelle (socle) | ~27 j | ~10 800 € |
| Option Visio (LiveKit) | +6,25 j | +2 500 € |
| Option Paiement (Stripe) | +10 j | +4 000 € |
| Régie après démarrage (à la demande) | ≤3 j | ≤1 200 € |

**Production complète (Devis 3 + visio + paiement) : ≈ 43 j — ≈ 17 300 € HT.**

---

## 5. Coûts récurrents annuels du client (indicatifs HT)

| Phase | Annuel |
|---|---|
| Démo / reprise | ≈ 650–750 € |
| Pilote durci HDS | ≈ 950–1 100 € |
| Production réelle avec visio | ≈ 2 000–2 300 € |

Paiement Stripe : pas d'abonnement, frais d'environ 1,4 % + 0,25 € par transaction (≈ 0,95 € sur une consultation de 50 €). Domaine ≈ 30 €/an, Twilio ≈ 60–100 €/an, Mailjet 0 €. Économie Yousign : −200 à −500 €/an. À confirmer après le premier relevé Azure réel.

---

## 6. Risques principaux

1. **Clauses HDS Microsoft** sur le compte client neuf : à initier dès la semaine 1 (délai administratif le plus incertain).
2. **Consentement du parent 2 absent** le jour de l'acte : décision juridique encore ouverte, bloquante pour finaliser le retrait Yousign.
3. **Couverture de tests faible** (29 tests backend, 0 frontend) : tests limités aux parcours critiques, le reste en backlog.
4. **Paiement sur données de santé** : la facture est une donnée de santé → stockage HDS chiffré, jamais par email ; cas limites à gérer (refus de l'acte après paiement, remboursement).
5. **Dépôt local sous OneDrive** : à cloner hors OneDrive avant la reprise.

---

## 7. Hypothèses et exclusions

### Hypothèses
1. Données fictives jusqu'à la fin du durcissement HDS ; base recréée par Alembic + seed.
2. Le client crée les comptes (Azure, Twilio, OVH, Stripe) à son nom dès la signature ; toi administrateur invité.
3. Corrections par petits lots : une anomalie → un correctif → un test → un déploiement.
4. Provisions (corrections, tests, régie) = plafonds ; seul le réalisé est facturé.
5. Le cabinet fournit les modèles réels (ordonnance, compte rendu) et les informations légales.

### Exclusions
1. Validation juridique des textes, conseil DPO, audit HDS, pentest externe.
2. Abonnements et consommations tiers (Azure, Twilio, OVH, Stripe) — prélevés directement chez le client.
3. Production des vidéos et contenus médicaux.
4. Support utilisateur récurrent après démarrage (contrat de maintenance distinct).
5. Toute nouvelle fonctionnalité hors périmètre ci-dessus.
6. Génération et envoi du compte rendu de consultation, et tarification de l'acte par âge (lots distincts à chiffrer si retenus).

---

## 8. Décisions attendues avant devis final

1. Niveau cible : Devis 1, 2 ou 3, et options visio / paiement retenues ou non.
2. Modalité de consentement du parent 2 en cas d'absence.
3. Propriétaire de l'abonnement Azure (praticien recommandé) et lancement des clauses HDS Microsoft.
4. Date cible de remise en service.
