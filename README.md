# MedicApp Monorepo

Plateforme médico-administrative composée d’un backend FastAPI et d’un frontend React. Le Sprint en cours se concentre sur le parcours patient (création du dossier circoncision, prise de rendez-vous, génération et diffusion des consentements).

## Structure

- `backend/` : FastAPI, PostgreSQL, Alembic, génération PDF via WeasyPrint.
- `frontend/` : React + Vite + Tailwind + DaisyUI.
- `setup_sprint2.ps1` : script d’automatisation (facultatif) pour installer les dépendances et lancer les services en local.

## Prérequis

- Node.js 18+
- Python 3.11+
- Docker + Docker Compose (recommandé) ou un accès PostgreSQL local

## Lancement rapide avec Docker

```powershell
cd backend
cp .env.example .env   # à faire une seule fois, ajuster si nécessaire
docker compose up --build
```

Services disponibles :

- API FastAPI : http://localhost:8000/docs
- Adminer : http://localhost:8080 (login postgres/postgres, base `medscript`)

Les migrations Alembic sont déjà appliquées dans l’image. Si une nouvelle révision est ajoutée : `docker compose exec backend alembic upgrade head`.

## Lancement manuel (sans Docker)

### Backend

```powershell
cd backend
python -m venv .venv
. .venv/Scripts/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

WeasyPrint requiert des bibliothèques natives (Cairo, Pango, etc.). Sous Windows, utiliser la pile WSL ou Docker si l’installation échoue.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Accès à l’UI : http://localhost:5173 (l’API doit être accessible sur `http://localhost:8000`). Une fois connecté, le parcours patient permet de :

1. Sélectionner la procédure “circoncision” et remplir le dossier (enfant + parents).
2. Générer les documents (checklist, consentement, ordonnance).
3. Prendre rendez-vous de pré-consultation (visio ou présentiel) puis l’acte chirurgical.
4. Télécharger ou recevoir par email le consentement (via l’endpoint `/procedures/send-consent-link`).

## Variables d’environnement principales

`backend/.env` :

```
DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/medscript
JWT_SECRET_KEY=change_me
APP_BASE_URL=http://localhost:8000
SMTP_HOST=...
EMAIL_FROM=...
```

`frontend/.env.local` (optionnel) :

```
VITE_API_BASE_URL=http://localhost:8000
```

## Génération des PDF

Les fichiers sont produits dans `backend/storage/` (automatiquement recréé). Ils sont ignorés par Git. Pour tester la génération à la main :

```powershell
docker compose exec backend python -c "from services import pdf; from weasyprint import HTML; HTML(string='<h1>Test</h1>').write_pdf('/tmp/test.pdf'); print('OK')"
```

## Script d’installation (optionnel)

`setup_sprint2.ps1` automatise la création du virtualenv, l’installation des dépendances, le lancement de Docker Compose et d’uvicorn. Il n’est pas obligatoire, mais reste disponible pour accélérer la mise en route sur Windows.

## Points de vigilance / TODO

- Parcours praticien à moderniser (Sprint suivant).
- Sécurité : définir durée de rétention des PDF, suivi des téléchargements, éventuelle authentification forte.
- Ajouter des tests d’intégration couvrant la génération des documents et la planification des rendez-vous.
- Brancher un SMTP réel (les emails sont consignés dans les logs si aucune configuration n’est fournie).
*** End Patch
