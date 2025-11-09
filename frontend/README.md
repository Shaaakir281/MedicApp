# MedScript Frontend

Interface React (Vite + Tailwind/DaisyUI) pour le parcours patient et le tableau de bord praticien de MedicApp. Elle consomme désormais les API FastAPI (auth, agenda, procédures) et intègre un minimum d'outillage qualité.

## Installation & scripts

```bash
# Prérequis : Node.js ≥ 18
npm install          # installe les dépendances app + outils (ESLint, Prettier…)
npm run dev          # lance Vite sur http://localhost:5173

npm run lint         # ESLint (React/Hooks/a11y/Tailwind) sans avertissement
npm run format       # Prettier pour src/**/*.{js,jsx,css}
```

## Architecture

- `src/App.jsx` : routes principales (Home, Patient, Praticien).
- `src/main.jsx` : bootstrap + `AuthProvider` + `QueryClientProvider`.
- `src/context/AuthContext.jsx` : gestion du token, login/register/logout.
- `src/lib/api.js` : client fetch + helpers métiers.
- `src/lib/queryClient.js` : configuration TanStack Query (cache, retry).
- `src/lib/forms/` : schémas Zod + valeurs par défaut pour React Hook Form (ex. `patientProcedureSchema.js`).
- `src/components/ui/` : primitives réutilisables (`Button`, `Card`, `InputField`, `SectionHeading`) alignées sur Tailwind/DaisyUI.
- `src/pages/Patient.jsx` / `Praticien.jsx` : pages métiers (à découper prochainement en sous-composants + hooks spécifiques).

## Tooling qualité

- **ESLint** (`.eslintrc.cjs`) avec plugins React, Hooks, JSX a11y, Tailwind, Prettier.
- **Prettier** (`.prettierrc.json`) pour garder un style homogène.
- **React Query** (`@tanstack/react-query`) pour la gestion des requêtes réseau et du cache.
- **React Hook Form + Zod** : déjà présents pour préparer la refonte formulaire (le binding arrivera dans la prochaine itération).

## Tests manuels recommandés (en attendant RTL)

1. `/patient` : flux login + chargement des informations de procédure + sélection d’un créneau (vérifier les messages d’erreur).
2. `/praticien` : connexion avec le compte seedé (`praticien.demo1@demo.medicapp` / `password`), rafraîchissement agenda + stats.
3. Vérifier dans la console navigateur qu’aucune erreur réseau n’apparaît (CORS et tokens expirés gérés par le QueryClient).

## Prochaines étapes UI

- Déporter la gestion des formulaires Patient vers React Hook Form + Zod et découper la page en composants indépendants.
- Ajouter React Testing Library + MSW pour couvrir les formulaires et interactions critiques.
- Étendre la bibliothèque `components/ui` (Alert, Loader, Modal) et centraliser les toasts/notifications.
