# MedScript – Sprint 0+ Démo cliquable

Cette version enrichie du prototype **MedScript** poursuit le Sprint 0 en ajoutant un calendrier interactif et en améliorant l’interface praticien. Elle reste **sans backend** : aucune base de données ni API ; toutes les données sont simulées via des *fixtures* et stockées en **sessionStorage**.

## ✨ Nouvelles fonctionnalités

- **Calendrier cliquable** côté patient : navigation entre le mois courant et le suivant, sélection d’un jour puis d’un créneau horaire (intervalle de 30 minutes). Les créneaux pré‑réservés (fixtures) sont grisés. Un seul créneau peut être sélectionné à la fois.
- **Formulaire RDV** : nom, téléphone, e‑mail + questionnaire de cinq cases à cocher. Les données sont sauvegardées dans `sessionStorage` (`medscript_rdv_draft`).
- **Confirmation factice** : après enregistrement, le créneau devient réservé pour la session (`medscript_reserved_session`).
- **Dashboard praticien** inspiré de la maquette : métriques du jour, liste des patients (états urgent/pending/validated), actions rapides et activité récente. Prévisualisation PDF toujours disponible.

## 🚀 Installation et lancement

Assurez‑vous d’avoir Node.js ≥ 16 (de préférence Node 18 ou plus) :

```bash
node -v
# Si la version est < 18, utilisez nvm ou installez la LTS.

# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev
```

Vite ouvrira l’application, généralement sur `http://localhost:5173`.

## 🧭 Structure de l’application

- `src/pages/`
  - **Home.jsx** : accueil avec choix entre patient et praticien.
  - **Patient.jsx** : calendrier, créneaux horaires, formulaire et récapitulatif factice.
  - **Praticien.jsx** : tableau de bord reprenant la maquette HTML fournie (métriques, patients du jour, actions rapides, activité récente).
- `src/components/`
  - **Calendar.jsx** : sélecteur de mois et grille de jours.
  - **TimeSlots.jsx** : génération des créneaux de 30 minutes avec état (réservé/disponible/sélectionné).
  - **Modal.jsx** : composant générique pour les fenêtres modales.
  - **Toast.jsx** : affiche un message de confirmation.
  - **PdfPreview.jsx** : iframe pour afficher un PDF embarqué en base64.
- `src/lib/`
  - **fixtures.js** : expose des fonctions renvoyant les données fictives (créneaux pré‑réservés, patients du jour, métriques du dashboard).
  - **storage.js** : fonctions utilitaires pour lire/écrire dans `sessionStorage`.

## ➕ Ajout de pages ou composants

1. Créez votre fichier dans `src/pages` ou `src/components` selon le cas.
2. Pour une page, importez‑la dans `src/App.jsx` et ajoutez une entrée dans le `<Routes>`.
3. Adaptez la navigation en ajoutant un lien dans la barre de navigation.

## 📄 Configuration

- **postcss.config.js** et **tailwind.config.js** sont au format CommonJS (`module.exports`) pour éviter les avertissements Node.
- **Vite** est utilisé comme serveur de développement et bundler (`vite.config.js`).

## 🧪 Tests manuels recommandés

1. Sur `/patient`, naviguez entre les mois et sélectionnez un jour, puis choisissez un créneau disponible. Vérifiez que les créneaux pré‑réservés sont grisés.
2. Remplissez le formulaire (nom, téléphone, e‑mail) et cochez les cinq cases. Cliquez sur **Enregistrer** : un toast confirme la sauvegarde et le créneau sélectionné disparaît des créneaux disponibles (uniquement pour votre session).
3. Sur `/praticien`, vérifiez les métriques, la liste des patients avec différents états et testez l’ouverture de la prévisualisation PDF via les boutons **Ordonnance**.

Bon développement !