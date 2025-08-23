# MedicApp Monorepo

## 📂 Structure

* `frontend/` — React + Vite + Tailwind + DaisyUI (Sprint 0+ demo cliquable)
* `backend/` — FastAPI + PostgreSQL + Alembic + JWT (Sprint 1)

## ⚙️ Prérequis

* Node.js 18+
* Python 3.11+
* PostgreSQL (local ou via Docker)

## 🚀 Lancer le frontend

```bash
cd frontend
npm install
npm run dev
```

➡️ Ouvrir l’URL affichée (souvent `http://localhost:5173`).

> ℹ️ **Windows + OneDrive** : si erreur `EPERM rmdir ... .vite\deps`, mettre OneDrive en pause, supprimer `node_modules/.vite`, relancer avec `--force`, ou déplacer le projet hors OneDrive (ex: `C:\Dev\MedicApp`).

## 🖥️ Lancer le backend

1. Créer `backend/.env` à partir de `.env.example` :

```
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/medscript
JWT_SECRET_KEY=change_me
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
```

2. Puis :

```bash
cd backend
python -m venv .venv
# Windows
. .venv/Scripts/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

➡️ Docs API : [http://localhost:8000/docs](http://localhost:8000/docs)

## 🔗 Variables côté frontend

Créer `frontend/.env.local` si besoin :

```
VITE_API_BASE=http://localhost:8000
```

Dans le code front, utiliser :

```js
const API = import.meta.env.VITE_API_BASE;
fetch(`${API}/appointments/slots?date=2025-09-01`)
```

## 🔒 Git et sécurité

* Ne **pas** committer `backend/.env` → garder `.env.example`.
* `.gitignore` doit inclure :

  * `node_modules/`, `dist/`, `.vite/`
  * `.venv/`, `.env`, `.env.*`
  * `__pycache__/`, `.vscode/`

## 📑 Prochaines étapes

* **Sprint 2** : génération PDF + règles métier (WeasyPrint/Jinja2)
* **Sprint 3** : dashboard praticien + validation ordonnances
* **Sprint 4** : notifications sécurisées + OTP patient
* **Sprint 5** : monitoring + 2FA praticien + sécurité avancée
