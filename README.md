# MedicApp

Plateforme médico-administrative composée d'un backend FastAPI, d'un frontend React et de ressources Azure.

Le projet est actuellement en pause technique. Les données étaient fictives et la base PostgreSQL ainsi que l'Azure Container Registry ont été supprimés pour réduire les coûts.

## Documentation

- Index documentaire : `docs/README.md`
- État vérifié du projet : `docs/ETAT_PROJET.md`
- Roadmap de reprise : `docs/ROADMAP.md`
- Périmètre préparatoire au devis : `docs/PERIMETRE_DEVIS.md`
- Procédure de reconstruction Azure : `docs/REPRISE_PROJET.md`
- Exploitation et monitoring : `docs/operations/MONITORING_RUNBOOK.md`

## Structure

- `backend/` : API FastAPI, PostgreSQL, Alembic, génération de documents et intégrations externes.
- `frontend/` : interface React, Vite, Tailwind CSS et parcours patient/praticien.
- `scripts/` : automatisation Azure, monitoring et maintenance.
- `docs/` : pilotage, exploitation, conformité, architecture, tests et archives.

## Lancement local

### Docker

```powershell
cd backend
Copy-Item .env.example .env
docker compose up --build
docker compose exec backend alembic upgrade head
```

- API : `http://localhost:8000/docs`
- Adminer : `http://localhost:18080`
- PostgreSQL local Docker : `localhost:55433`

### Backend sans Docker

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
python -m uvicorn main:app --reload
```

WeasyPrint dépend de bibliothèques natives. Sous Windows, Docker reste l'option la plus fiable.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Le frontend est alors disponible sur `http://localhost:5173`.

## Validation

```powershell
cd backend
pytest

cd ..\frontend
npm run build
```

## Reprise Azure

Ne pas réutiliser d'anciens exemples de provisionnement isolés. La procédure maintenue et vérifiée se trouve dans `docs/REPRISE_PROJET.md`.

Les secrets, mots de passe et chaînes de connexion ne doivent jamais être ajoutés au dépôt.
