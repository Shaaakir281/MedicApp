# Cadrage — Téléconsultation + Paiement (consultation préalable)

Document de cadrage destiné à l'assistant codeur (VS Code). Objectif : implémenter la
consultation préalable en téléconsultation, avec paiement Stripe **payer pour réserver**.

> Règle de travail (non négociable) : petits changements, tests ciblés, `build` + `pytest`
> avant chaque commit, pas de refactorisation large non demandée, pas de
> `npm audit fix --force`. Chaque lot ci-dessous doit pouvoir être livré et testé seul.

---

## 1. Décisions actées

- **Flux paiement : payer pour réserver.** Le créneau de consultation préalable n'est
  confirmé, et l'accès visio n'est délivré, **qu'après paiement Stripe réussi**.
- **Visio : LiveKit**, salle intégrée dans l'espace patient (pas de lien externe collé).
  - **Pilote** (données fictives) : **LiveKit Cloud, région UE**.
  - **Production** (vraies données) : **LiveKit self-hosted** sur Azure France Central HDS.
  - Même SDK dans les deux cas → bascule par configuration, sans réécriture.
- **Sans enregistrement.** Aucune capture média côté plateforme. Le seul artefact conservé
  est le **compte rendu écrit** (lot séparé, déjà à la ROADMAP).
- **Facture Stripe** : émise automatiquement par Stripe, **déposée en HDS**, téléchargée par
  un **lien sécurisé** depuis l'espace patient (jamais par email). Export mensuel Stripe pour
  le comptable.
- **Montant consultation préalable : 50 €** (5000 centimes). La tarification de l'**acte**
  (par tranche d'âge) ne concerne PAS ce module — le paiement porte uniquement sur la
  consultation préalable.

## 2. Contexte technique existant

- Backend FastAPI + SQLAlchemy + Alembic, PostgreSQL. Frontend React (Vite).
- `Appointment` existe déjà avec : `status` (`pending` / `validated`),
  `appointment_type` (`general` / `preconsultation` / `act`), `mode` (`visio` / `presentiel`),
  `user_id`, `date`, `time`, `procedure_id`.
- Il existe déjà un dossier `backend/jobs/` (tâches planifiées) et `backend/services/`.
- Le champ `mode` est aujourd'hui une simple étiquette : **aucune salle d'appel** n'est gérée.

## 3. Périmètre du module

Couvre : réservation d'un créneau **préconsultation**, paiement Stripe, confirmation,
salle LiveKit pour le mode `visio`, lien d'accès patient à usage unique, jeton praticien,
récupération + stockage HDS de la facture.

Hors périmètre (lots séparés) : génération du compte rendu, envoi du compte rendu,
tarification de l'acte par âge, dashboard admin des créneaux.

---

## 4. Flux de bout en bout

### Patient
1. Le patient choisit un créneau de **consultation préalable** et un **mode** (`visio` / `presentiel`).
2. Le backend crée l'`Appointment` en statut **`awaiting_payment`** (réservation temporaire,
   non bloquante au-delà d'un délai) + un `Payment` lié, puis ouvre une **Stripe Checkout
   Session** (montant 50 €, `metadata.appointment_id`, `idempotency_key`).
3. Le patient paie sur Stripe. Au retour : page de confirmation côté front.
4. Stripe appelle le **webhook** → paiement `succeeded` → `Appointment.status = validated`.
   Si `mode = visio` : création de la salle LiveKit + génération d'un **lien d'accès à usage
   unique**.
5. Le jour J, dans la fenêtre horaire, le patient clique **« Rejoindre la téléconsultation »** :
   le lien à usage unique est consommé, le backend émet un **token LiveKit court** lié à son
   identité, le composant React rejoint la salle.

### Praticien
- Depuis l'agenda praticien, bouton **« Rejoindre »** sur les RDV `visio` validés → token
  LiveKit praticien pour la même salle.

### Cas `presentiel`
- Même logique pay-to-book (créneau confirmé après paiement), mais **pas de salle LiveKit**
  ni de lien d'accès. À confirmer : applique-t-on le pay-to-book aussi au présentiel ?
  (recommandé : oui, pour éviter les no-shows).

---

## 5. Modèle de données (nouvelles tables / champs)

### `Payment`
- `id`
- `appointment_id` (FK, unique)
- `user_id` (FK)
- `amount_cents` (int, 5000), `currency` (`eur`)
- `status` : `requires_payment` / `processing` / `succeeded` / `failed` / `refunded`
- `stripe_checkout_session_id`, `stripe_payment_intent_id`
- `stripe_invoice_id`, `invoice_hds_path` (chemin du PDF chiffré en HDS), `invoice_download_token`
- `idempotency_key` (clé envoyée à Stripe à la création)
- `created_at`, `updated_at`, `paid_at`

### `StripeWebhookEvent` (déduplication / idempotence)
- `id`
- `stripe_event_id` (**unique** — c'est la clé d'idempotence du webhook)
- `type`, `received_at`, `processed_at`, `status` (`received` / `processed` / `ignored`)

### `TeleconsultationSession`
- `id`
- `appointment_id` (FK, unique)
- `livekit_room_name` (ex. `precons-{appointment_id}-{uuid}`)
- `status` : `scheduled` / `active` / `ended`
- `access_link_token` (usage unique), `access_link_expires_at`, `access_link_used_at`
- `created_at`
- (aucun champ média : pas d'enregistrement)

### `Appointment` — évolution du statut
- Ajouter les valeurs : **`awaiting_payment`**, **`cancelled`** (en plus de `pending` / `validated`).
- Transition cible : `awaiting_payment` → `validated` (paiement OK) ; `awaiting_payment` →
  `cancelled` (expiration ou échec).
- Migration Alembic dédiée (un seul `ALTER TYPE` / recréation enum selon convention du repo).

---

## 6. Endpoints backend

| Méthode | Route | Rôle | Notes |
|---|---|---|---|
| POST | `/appointments/preconsultation` | patient | Crée l'`Appointment` `awaiting_payment` + `Payment` + Stripe Checkout Session ; renvoie l'URL de paiement. Idempotent par `idempotency_key`. |
| POST | `/webhooks/stripe` | Stripe | **Idempotent** : vérifie la signature, déduplique sur `event.id`, traite `checkout.session.completed` / `payment_intent.succeeded` / `.payment_failed`. |
| GET | `/teleconsultation/{appointment_id}/access` | patient | Consomme le lien à usage unique, vérifie identité + paiement `validated` + fenêtre horaire, renvoie un **token LiveKit court**. |
| GET | `/teleconsultation/{appointment_id}/token` | praticien | Token LiveKit praticien pour la salle. |
| GET | `/payments/{id}/invoice` | patient | Lien sécurisé de téléchargement de la facture (PDF chiffré en HDS). |

Tâche planifiée (`backend/jobs/`) :
- **Expiration des réservations non payées** : passe `awaiting_payment` → `cancelled` après
  N minutes (ex. 30) et libère le créneau.
- **Réconciliation Stripe** (filet de sécurité si un webhook est perdu) : pour les paiements
  `processing`/`requires_payment` anciens, interroger Stripe et resynchroniser l'état.

---

## 7. Fiabilité (points critiques)

- **Idempotence du webhook.** Un webhook peut être **rejoué ou reçu en double**. Insérer
  `event.id` dans `StripeWebhookEvent` avec contrainte unique ; si déjà présent → ignorer.
  Sans ça, un retry crée deux confirmations / deux factures.
- **Idempotence de la création de paiement.** Passer une `idempotency_key` à Stripe à la
  création de la Checkout Session pour éviter les doublons si l'appel est relancé.
- **Transitions d'état conditionnelles.** Ne jamais faire `status = X` aveuglément : mettre à
  jour seulement si la transition est valide (ex. `awaiting_payment` → `validated`), pour que
  les rejeux soient sans effet (opération idempotente).
- **Webhook perdu = panne silencieuse.** Le job de réconciliation est le filet : on ne dépend
  pas uniquement du webhook pour confirmer un paiement.
- **Timeouts** sur tous les appels Stripe et LiveKit ; erreurs loguées avec contexte.
- **Transaction DB** autour de « confirmer paiement + valider RDV + créer session » pour
  éviter un état partiel.

## 8. Sécurité / HDS

- **LiveKit** : enregistrement non déployé (pilote Cloud : ne pas activer le service
  d'enregistrement ; prod self-host : ne pas déployer le composant d'enregistrement).
- **Token LiveKit** : courte durée (≈ 15 min), limité à la salle du RDV, émis **après**
  vérification que le patient connecté est bien le propriétaire du RDV et que le paiement est
  `validated`.
- **Lien d'accès patient** : à usage unique + TTL court ; l'identité patient est garantie par
  **ton orchestration métier** (compte connecté + RDV lui appartenant), pas par la brique vidéo.
- **Facture = donnée de santé** : stockage HDS chiffré + lien sécurisé, jamais par email.
- **Métadonnées de session** (IP, horodatages, journaux d'accès) restent des données
  sensibles à cadrer RGPD/HDS, même sans média stocké.
- **Pilote** : LiveKit Cloud UE avec **données fictives** uniquement ; vraies données
  seulement après durcissement HDS (self-host).

## 9. Configuration

- Variables d'env : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRECONSULT`
  (ou montant en dur 5000), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`.
- Dépendances : `stripe` (backend), `livekit-server-sdk` (backend, génération de tokens),
  `@livekit/components-react` + `livekit-client` (frontend).
- **Feature flag** côté front (réutiliser le pattern `frontend/src/config/features.js`) :
  `TELECONSULTATION_ENABLED`, pour activer/désactiver le module sans le supprimer.

---

## 10. Découpage en lots (ordre conseillé)

- **Lot 0 — Socle.** Dépendances + variables d'env + feature flag, sans logique métier.
- **Lot 1 — Paiement à la réservation.** `Payment` + migration, statut `awaiting_payment`,
  création de la Checkout Session, URLs de retour. Tests : création RDV → session Stripe.
- **Lot 2 — Webhook idempotent.** `StripeWebhookEvent`, traitement signé et dédupliqué,
  passage `validated`, job d'expiration des non-payés. Tests : rejeu de webhook sans doublon.
- **Lot 3 — Salle LiveKit.** `TeleconsultationSession`, endpoints token patient/praticien,
  lien d'accès à usage unique. Tests : token refusé si non payé / hors fenêtre / mauvais patient.
- **Lot 4 — Frontend.** Parcours réserver → payer → confirmation, bouton « Rejoindre »
  (patient et praticien) avec le composant LiveKit React.
- **Lot 5 — Facture HDS.** Récupération de la facture Stripe, stockage HDS chiffré, lien de
  téléchargement sécurisé dans l'espace patient.

## 11. Points ouverts à trancher avec le cabinet / Fathi

- Pay-to-book appliqué aussi au **présentiel** ? (recommandé : oui).
- Politique d'**annulation / remboursement** de la consultation préalable.
- Délai d'**expiration** d'une réservation non payée (proposé : 30 min).
- Durée de la **fenêtre d'accès** à la salle avant/après l'heure du RDV.
- Identité affichée du **praticien** dans la salle LiveKit.
