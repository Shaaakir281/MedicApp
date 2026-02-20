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
APP_BASE_URL=http://localhost:5173
SMTP_HOST=...
EMAIL_FROM=...
EMAIL_FROM_NAME=MedicApp
EMAIL_REPLY_TO=support@medicapp.sethostscope.dev
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

- Auth / emails :
  - APP_BASE_URL doit pointer sur l’URL du front (ex: http://localhost:5173) pour que les liens email (vérification, reset) ouvrent les pages React.
  - Les mots de passe doivent respecter la règle 12+ caractères (maj/min/chiffre/spécial) ; jauge visuelle ajoutée côté front.
  - Flots “mot de passe oublié” et “reset” côté front + emails Mailjet opérationnels.
- Parcours praticien à moderniser (Sprint suivant).
- Sécurité : définir durée de rétention des PDF, suivi des téléchargements, éventuelle authentification forte.
- Ajouter des tests d’intégration couvrant la génération des documents et la planification des rendez-vous.
- Brancher un SMTP réel (les emails sont consignés dans les logs si aucune configuration n’est fournie).

## Déploiement Azure (backend & frontend)

### Provision des ressources principales

```powershell
az group create -n medicapp-rg -l westeurope

az acr create `
  -n medicappregistry `
  -g medicapp-rg `
  --sku Basic `
  --admin-enabled true

az appservice plan create `
  -n medicapp-plan `
  -g medicapp-rg `
  --is-linux `
  --sku B1

az webapp create `
  -n medicapp-backend-prod `
  -g medicapp-rg `
  -p medicapp-plan `
  --deployment-container-image-name medicappregistry.azurecr.io/medicapp-backend:initial

$PgPassword = "UnMotDePasseFort123!"
az postgres flexible-server create `
  -g medicapp-rg `
  -n medicappdbprod `
  -l westeurope `
  --tier Burstable `
  --sku-name Standard_B1ms `
  --storage-size 32 `
  --admin-user medicappadmin `
  --admin-password $PgPassword `
  --public-access 0.0.0.0-255.255.255.255

az postgres flexible-server db create `
  -g medicapp-rg `
  -s medicappdbprod `
  -d medscript

az staticwebapp create `
  -n medicapp-frontend `
  -g medicapp-rg `
  -s https://github.com/Shaaakir281/MedicApp `
  -b main `
  --app-location frontend `
  --output-location dist `
  --login-with-github
```

### App settings backend

```
APP_BASE_URL=https://medicapp-backend-prod.azurewebsites.net
DATABASE_URL=postgresql+psycopg2://medicappadmin:***@medicappdbprod.postgres.database.azure.com/medscript?sslmode=require
STORAGE_BACKEND=azure
AZURE_BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=...
AZURE_BLOB_CONTAINER=medicapp-docs
JWT_SECRET_KEY=***
BACKEND_CORS_ORIGINS=https://gentle-moss-0fd896410.3.azurestaticapps.net
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
SMTP_USERNAME=***
SMTP_PASSWORD=***
SMTP_USE_TLS=true
SMTP_USE_SSL=false
EMAIL_FROM=no-reply@medicapp.sethostscope.dev
EMAIL_FROM_NAME=MedicApp
EMAIL_REPLY_TO=support@medicapp.sethostscope.dev
DOCKER_REGISTRY_SERVER_URL=https://medicappregistry.azurecr.io
DOCKER_REGISTRY_SERVER_USERNAME=medicappregistry
DOCKER_REGISTRY_SERVER_PASSWORD=<az acr credential show ...>
```

Frontend (`medicapp-frontend`) :

```
VITE_API_BASE_URL=https://medicapp-backend-prod.azurewebsites.net
```

### Secrets GitHub Actions

| Secret | Source |
| --- | --- |
| `AZURE_CREDENTIALS` | `az ad sp create-for-rbac --sdk-auth ...` |
| `AZURE_WEBAPP_NAME` | `medicapp-backend-prod` |
| `AZURE_REGISTRY_LOGIN_SERVER` | `medicappregistry.azurecr.io` |
| `AZURE_REGISTRY_USERNAME` | `az acr credential show -n medicappregistry --query username -o tsv` |
| `AZURE_REGISTRY_PASSWORD` | `az acr credential show -n medicappregistry --query 'passwords[0].value' -o tsv` |

Le job `backend-ci-cd` exécute `pytest`, construit/publie l’image Docker puis déploie la Web App. La Static Web App dispose de son propre workflow généré lors de la commande `az staticwebapp create`.

### Tests manuels (prod)

```powershell
# Healthcheck
Invoke-WebRequest -Uri "https://medicapp-backend-prod.azurewebsites.net/" -Method Get

# Login praticien
$payload = @{
  email    = "praticien.demo1@demo.medicapp"
  password = "password"
} | ConvertTo-Json

curl.exe -X POST "https://medicapp-backend-prod.azurewebsites.net/auth/login" `
  -H "Content-Type: application/json" `
  -d $payload

# Agenda (remplacer <TOKEN> par l'access_token obtenu)
curl.exe "https://medicapp-backend-prod.azurewebsites.net/practitioner/agenda?start=2025-11-11&end=2025-11-16" `
  -H "Authorization: Bearer <TOKEN>"
```
*** End Patch
