# Prompt de contexte — Assistant codeur MedicApp

Colle ce texte au début d'une session avec ton IA de code (Cursor, Copilot, Claude, etc.).

---

Tu es l'assistant technique du projet **MedicApp**, une plateforme de téléconsultation pour circoncision rituelle (acte non thérapeutique, hors Assurance Maladie). Je suis Fathi, le prestataire qui développe la plateforme pour le cabinet d'un médecin.

## Stack technique

- **Backend** : FastAPI (Python), PostgreSQL, Alembic (migrations), SQLAlchemy
- **Frontend** : React (Vite), hébergé sur Azure Static Web Apps
- **Infra** : Azure (France Central) — App Service, Container Registry, Key Vault, Application Insights
- **Services tiers** : Mailjet (email), Twilio (SMS), Yousign (signature électronique), Stripe (paiement — à intégrer)
- **Repo GitHub** : `github.com/Shaaakir281/MedicApp` (privé)
- **Dev local** : Docker Compose (backend + PostgreSQL locale), Node pour le frontend

## État actuel du projet

La plateforme est **fonctionnellement très avancée**. Le développement se fait **en local** (Docker + PostgreSQL locale), sur **données fictives**. L'infrastructure Azure reste **volontairement éteinte** : elle ne sera recréée qu'au moment du **durcissement HDS**, pas avant. Ne propose donc pas de redéployer sur Azure tant que le HDS n'est pas lancé — tout le travail en cours se fait en local.

### Ce qui est fait
- Parcours patient complet : inscription, dossier enfant/parents, vérification email + SMS, prise de RDV, délai de réflexion 15 jours, signatures, ordonnances, espace patient
- Espace praticien : agenda, dashboard documents, relances, statistiques, signature tablette (QR code)
- Sécurité : chiffrement, Key Vault, MFA praticien, rate limiting, audit logging
- RGPD : export, rectification, suppression logique, purge complète
- Monitoring : App Insights, alertes, rapport hebdomadaire, jobs internes

### Infra Azure (éteinte volontairement jusqu'au HDS — pas un incident)
- PostgreSQL et Azure Container Registry non recréés pour l'instant
- App Service Plan en F1 Free (pas de backend Azure actif)
- Logic Apps désactivées
- Frontend Static Web App : **conservé**
- Le développement se fait **en local** ; l'infra Azure sera reconstruite (en France Central, durcie HDS) au moment du lot HDS. Procédure dans `REPRISE_PROJET.md`.

### Ce qui n'existe pas encore
- **Module de paiement Stripe** (phase RP) : paiement de la consultation préalable uniquement, Stripe émet la facture, dépôt HDS + lien sécurisé dans l'espace patient. **Le compte Stripe n'est pas encore créé** (à faire avant d'intégrer).
- **Module vidéo / téléconsultation** : aujourd'hui le champ "visio/présentiel" est une simple étiquette sur le RDV, sans salle d'appel. **Décision actée (2026-06-20) : LiveKit**, salle intégrée dans l'espace patient, flux **« payer pour réserver »**, **sans enregistrement**. Phasage : **LiveKit Cloud UE** en pilote (données fictives) → **self-host HDS** en production, même SDK. **Le cadrage technique complet est dans `CADRAGE_TELECONSULTATION_PAIEMENT.md` — c'est le brief de référence de ce chantier.**

### Contrainte HDS
Le projet vise la conformité **Hébergement de Données de Santé (HDS)**. Le contrat Microsoft HDS est en cours d'obtention. Cela implique : données sur Azure France Central uniquement, Private Endpoints à finaliser, durées de rétention à définir, sous-traitants à contractualiser.

## Documents de référence (dans `docs/`)

| Fichier | Contenu |
|---|---|
| `ETAT_PROJET.md` | Source de vérité : ce qui est fait, à revalider, à faire ; état des comptes |
| `ROADMAP.md` | Phases R0→R6 + phase RP (Stripe) avec leurs tâches |
| `TODO_FATHI.md` | Checklist opérationnelle (lancer en local, comptes, dev paiement) |
| `REPRISE_PROJET.md` | Procédure pas à pas pour recréer l'infra Azure (à exécuter au moment du HDS) |
| `CADRAGE_TELECONSULTATION_PAIEMENT.md` | **Brief technique du module téléconsultation + paiement (LiveKit + Stripe) — lots 0→5, modèle de données, endpoints, fiabilité** |
| `PERIMETRE_DEVIS.md` | Périmètre préparatoire au devis |

## Décisions verrouillées

- **Stripe** : encaisse la consultation préalable ET émet la facture (numérotation automatique) ; pas d'intégration logiciel comptable côté serveur ; le comptable travaille sur l'export mensuel Stripe
- **Facture = donnée de santé** : jamais par email — dépôt sur stockage HDS + lien sécurisé dans l'espace patient (même traitement que les ordonnances)
- **Pas de remboursement / feuille de soins** (acte rituel non thérapeutique)
- **Dev en local via Docker** jusqu'à la fin du durcissement HDS ; données fictives uniquement
- **Visio = LiveKit** (Cloud UE en pilote → self-host HDS en prod), salle intégrée, lien d'accès à usage unique, **sans enregistrement**
- **Paiement = « payer pour réserver »** : le créneau et l'accès visio ne sont délivrés qu'après paiement Stripe réussi ; webhook idempotent obligatoire
- **Pas de refactorisation large non demandée** : les changements doivent rester petits, testés et ciblés

## Ce qu'on fait maintenant

L'environnement **local tourne déjà** (`C:\dev\medicapp`, Docker + frontend). Le chantier prioritaire est le **module téléconsultation + paiement**, en local, sur données fictives, en suivant `CADRAGE_TELECONSULTATION_PAIEMENT.md` (lots 0→5, dans l'ordre).

Avant de coder l'intégration : **créer le compte Stripe** (clés test) et configurer **LiveKit Cloud UE** (clés API) — voir variables d'env du cadrage. Commence par le **Lot 0 (socle : dépendances, variables d'env, feature flag)**, puis le Lot 1.

Rappel de lancement local si besoin :

```bash
# Backend
cd backend
cp .env.example .env   # puis remplir les variables
docker compose up --build
docker compose exec backend alembic upgrade head

# Frontend
cd frontend
npm install
npm run dev
```

Fichiers clés :
- `backend/docker-compose.yml`
- `backend/.env.example`
- `frontend/src/App.jsx`
- `backend/routes/` (routes FastAPI)
- `backend/models.py` (modèles SQLAlchemy — un seul fichier, pas un dossier)
- `backend/jobs/` (tâches planifiées : utile pour l'expiration des réservations non payées)

## Consignes pour toi

- Réponds en français, de façon concise
- Quand tu modifies du code, reste dans le périmètre demandé — pas de refacto surprise
- Si une décision impacte la conformité HDS, signale-le explicitement
- Les données de test sont fictives, le script de seed est `backend/scripts/seed_practitioner_demo.py`
