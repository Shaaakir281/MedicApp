# 🏥 MedicApp - Sprints Finaux

> Ancien plan de travail archivé. La roadmap active est `docs/ROADMAP.md`.

## Plan de Conformité HDS & Mise en Production

**Version :** 2.0  
**Date :** Février 2026  
**Statut :** S1-S4 et S6 terminés

---

## 📊 Vue d'ensemble

| Sprint | Contenu | Durée | Responsable | Priorité |
|--------|---------|-------|-------------|----------|
| **S5** | Signature cabinet (renforcée) | 20-24h | IA codeur | 🔴 Haute |
| **S9** | Frontend patient + Contenus | 16-20h | Mixte | 🔴 Haute |
| **S10** | Maintenance & Continuité | 8-12h | IA codeur + Toi | 🟡 Moyenne |
| **S7** | Infrastructure Azure (PE) | 6-8h | Toi | 🔴 À faire en dernier |

---

# S5 - SIGNATURE CABINET (Version Renforcée)

**Objectif :** Mode signature manuscrite tablette avec valeur probante maximale

**Durée estimée :** 20-24 heures

---

## ÉTAPE 1 — Migration Alembic (CAB-01)

**Durée :** 2h

### Tables à créer

#### Table `cabinet_signature_sessions`

| Colonne | Type | Description |
|---------|------|-------------|
| id | Integer, PK | Identifiant unique |
| document_signature_id | Integer, FK | Lien vers document_signatures |
| parent_role | Enum (parent1/parent2) | Quel parent signe |
| token | String 64, unique | Token URL tablette |
| expires_at | DateTime | Expiration (30 min) |
| completed_at | DateTime, nullable | Date complétion |
| **initiated_by_practitioner_id** | Integer, FK | ✅ Traçabilité praticien |
| **document_hash** | String 64 | ✅ Hash SHA-256 du document |
| **device_id** | String 255, nullable | ✅ Identifiant appareil (optionnel) |
| created_at | DateTime | Date création |

#### Table `cabinet_signatures`

| Colonne | Type | Description |
|---------|------|-------------|
| id | Integer, PK | Identifiant unique |
| document_signature_id | Integer, FK | Lien vers document_signatures |
| parent_role | Enum (parent1/parent2) | Quel parent a signé |
| signature_image_base64 | Text | Image PNG en base64 |
| **signature_hash** | String 64 | ✅ Hash de l'image signature |
| **consent_confirmed** | Boolean | ✅ Checkbox attestation cochée |
| signed_at | DateTime | Horodatage signature |
| ip_address | String 45 | IP du signataire |
| user_agent | String 255 | Navigateur/appareil |
| created_at | DateTime | Date création |

### Prompt IA

```
Tu es un développeur Python/SQLAlchemy. Crée la migration Alembic pour les tables cabinet_signature_sessions et cabinet_signatures.

Table cabinet_signature_sessions :
- id (Integer, PK)
- document_signature_id (Integer, FK document_signatures.id)
- parent_role (Enum: parent1/parent2)
- token (String 64, unique, index)
- expires_at (DateTime)
- completed_at (DateTime, nullable)
- initiated_by_practitioner_id (Integer, FK users.id) ← NOUVEAU
- document_hash (String 64) ← NOUVEAU : SHA-256 du document au moment de l'initiation
- device_id (String 255, nullable) ← NOUVEAU : optionnel, fingerprint tablette
- created_at (DateTime, default=now)

Table cabinet_signatures :
- id (Integer, PK)
- document_signature_id (Integer, FK)
- parent_role (Enum)
- signature_image_base64 (Text)
- signature_hash (String 64) ← NOUVEAU : SHA-256 de l'image
- consent_confirmed (Boolean, default=False) ← NOUVEAU
- signed_at (DateTime)
- ip_address (String 45)
- user_agent (String 255)
- created_at (DateTime)

Index sur (token) et (document_signature_id, parent_role).

Fournis la migration Alembic complète.
```

---

## ÉTAPE 2 — Endpoint POST /cabinet-signatures/initiate (CAB-02)

**Durée :** 3h

### Spécifications

- **Auth :** Praticien uniquement
- **Body :** `{ "document_signature_id": 123, "parent_role": "parent1" }`
- **Actions :**
  1. Vérifier que le dossier appartient au praticien
  2. Récupérer le PDF du document
  3. Calculer hash SHA-256 du PDF
  4. Générer token unique (secrets.token_urlsafe(32))
  5. Créer session avec expiration 30 min
  6. Enregistrer `initiated_by_practitioner_id`
- **Response :** `{ "session_id": 1, "sign_url": "/sign/abc123...", "expires_at": "...", "document_hash": "sha256:..." }`

### Prompt IA

```
Tu es un développeur Python/FastAPI. Crée backend/routes/cabinet_signatures.py :

Endpoint : POST /cabinet-signatures/initiate
Auth : Praticien uniquement (via JWT)
Body : { "document_signature_id": 123, "parent_role": "parent1" }

Actions :
1. Vérifier que le dossier appartient bien au praticien connecté
2. Récupérer le PDF depuis Azure Blob (via storage service)
3. Calculer le hash SHA-256 du PDF : hashlib.sha256(pdf_bytes).hexdigest()
4. Créer session avec token unique : secrets.token_urlsafe(32)
5. Expiration dans 30 minutes
6. Sauvegarder initiated_by_practitioner_id depuis le JWT

Response : { 
  "session_id": 1, 
  "sign_url": "/sign/abc123...", 
  "expires_at": "2026-02-05T10:30:00Z",
  "document_hash": "sha256:abc123..."
}

Gestion erreurs :
- 404 si document_signature_id invalide
- 403 si dossier n'appartient pas au praticien
- 409 si session déjà active pour ce parent

Fournis le code complet avec schemas Pydantic.
```

---

## ÉTAPE 3 — Endpoint POST /cabinet-signatures/{token}/upload (CAB-03)

**Durée :** 4h

### Spécifications

- **Auth :** Aucune (le token fait office d'auth)
- **Body :** `{ "signature_base64": "data:image/png;base64,...", "consent_confirmed": true }`
- **Actions :**
  1. Valider token (non expiré, non utilisé)
  2. Vérifier `consent_confirmed == true`
  3. Décoder et valider image PNG (taille max 500KB, dimensions min 200x100)
  4. Calculer hash SHA-256 de l'image
  5. Stocker en DB (cabinet_signatures)
  6. Marquer session comme complétée
  7. Déclencher génération PDF signé (async ou sync)
- **Response :** `{ "success": true, "message": "Signature enregistrée" }`

### Prompt IA

```
Tu es un développeur Python/FastAPI. Crée l'endpoint d'upload signature :

Endpoint : POST /cabinet-signatures/{token}/upload
Auth : Aucune (le token fait office d'authentification)
Body : { 
  "signature_base64": "data:image/png;base64,...",
  "consent_confirmed": true  ← OBLIGATOIRE, doit être true
}

Actions :
1. Récupérer session par token
2. Valider token :
   - Non expiré (expires_at > now)
   - Non utilisé (completed_at is None)
3. Vérifier consent_confirmed == true, sinon erreur 400
4. Décoder image base64 :
   - Retirer préfixe "data:image/png;base64,"
   - base64.b64decode()
5. Valider image :
   - Taille max 500KB
   - Format PNG valide (PIL.Image.open)
   - Dimensions min 200x100 pixels
6. Calculer hash : hashlib.sha256(image_bytes).hexdigest()
7. Créer cabinet_signatures avec :
   - signature_image_base64
   - signature_hash
   - consent_confirmed = True
   - signed_at = now
   - ip_address (depuis request)
   - user_agent (depuis headers)
8. Marquer session : completed_at = now
9. Appeler service génération PDF signé

Response succès : { "success": true, "message": "Signature enregistrée" }
Response erreurs :
- 400 : "consent_confirmed doit être true"
- 400 : "Image invalide ou trop grande"
- 404 : "Session invalide"
- 410 : "Session expirée"
- 409 : "Session déjà utilisée"

Fournis le code complet avec validation image (Pillow).
```

---

## ÉTAPE 4 — Service PDF signature cabinet (CAB-04)

**Durée :** 5h

### Spécifications

Le PDF final doit contenir :
1. Image de la signature à la position appropriée
2. Bloc d'audit horodaté avec toutes les informations de traçabilité

### Bloc d'audit à incruster

```
─────────────────────────────────────────────────────────
SIGNATURE ÉLECTRONIQUE - PREUVE D'INTÉGRITÉ

Signataire : [Nom Parent] (Parent 1 / Parent 2)
Date et heure : 05/02/2026 à 09:45:32 (UTC+1)
Adresse IP : 192.168.1.xxx

Document signé : [Nom document]
Hash document (SHA-256) : abc123...
Hash signature (SHA-256) : def456...

Session : [token partiel]
Initiée par : Dr [Nom Praticien]

Attestation : "J'atteste avoir pris connaissance du document 
et signer en toute connaissance de cause."
─────────────────────────────────────────────────────────
```

### Prompt IA

```
Tu es un développeur Python. Crée backend/services/pdf_signature_cabinet.py :

Utilise PyMuPDF (fitz) pour modifier le PDF.

Fonction : incruster_signature_cabinet(
    pdf_bytes: bytes,
    signature_image_bytes: bytes,
    parent_name: str,
    parent_role: str,  # "Parent 1" ou "Parent 2"
    signed_at: datetime,
    ip_address: str,
    document_hash: str,
    signature_hash: str,
    session_token: str,  # afficher seulement les 8 premiers caractères
    practitioner_name: str
) -> bytes

Actions :
1. Charger le PDF avec fitz.open(stream=pdf_bytes, filetype="pdf")
2. Aller à la dernière page
3. Positionner l'image signature :
   - En bas de page, alignée avec la zone signature existante
   - Taille : environ 150x75 pixels
4. Ajouter le bloc d'audit en dessous de la signature :
   - Police : Courier 8pt (monospace pour aspect officiel)
   - Couleur : gris foncé (#333333)
   - Bordure : rectangle gris clair
5. Contenu du bloc :
   ─────────────────────────────────────────────────
   SIGNATURE ÉLECTRONIQUE - PREUVE D'INTÉGRITÉ
   
   Signataire : {parent_name} ({parent_role})
   Date et heure : {signed_at formaté} (UTC+1)
   Adresse IP : {ip_address}
   
   Hash document (SHA-256) : {document_hash[:16]}...
   Hash signature (SHA-256) : {signature_hash[:16]}...
   
   Session : {session_token[:8]}...
   Initiée par : Dr {practitioner_name}
   
   Attestation cochée : OUI
   ─────────────────────────────────────────────────
6. Sauvegarder le PDF modifié
7. Retourner les bytes du PDF

Fournis le code complet avec gestion d'erreurs.
```

---

## ÉTAPE 5 — Composant React SignaturePad (CAB-05)

**Durée :** 4h

### Spécifications

- Canvas HTML5 avec support tactile (stylet + doigt)
- Boutons : Effacer, Valider
- Export PNG en base64
- Design épuré, adapté tablette

### Prompt IA

```
Tu es un développeur React. Crée frontend/src/components/SignaturePad.jsx :

Specs :
- Canvas HTML5 pour dessin signature manuscrite
- Support tactile complet (tablette, stylet, doigt)
- Support souris (desktop)
- Taille responsive : largeur 100% du container, hauteur 200px
- Fond blanc, bordure grise arrondie
- Trait : noir, épaisseur 2px, lissé

Props :
- onSignatureCapture(base64String) : callback quand signature validée
- onClear() : callback optionnel quand effacé
- disabled : boolean pour bloquer le pad

Fonctionnalités :
- Dessin fluide avec lissage des courbes
- Bouton "Effacer" : vide le canvas
- Bouton "Valider" : exporte en PNG base64 et appelle onSignatureCapture
- Validation : empêche de valider si canvas vide ou quasi-vide (< 100 pixels dessinés)

Gestion événements :
- mousedown/mousemove/mouseup pour desktop
- touchstart/touchmove/touchend pour mobile
- Empêcher le scroll pendant le dessin (preventDefault)

Style : Tailwind CSS
- Bordure : border-2 border-gray-300 rounded-lg
- Boutons : bg-blue-600 text-white (Valider), bg-gray-200 (Effacer)
- Responsive mobile-first

Fournis le code complet avec useRef et useState.
```

---

## ÉTAPE 6 — Page /sign/:token (CAB-06)

**Durée :** 4h

### Flow utilisateur

1. Praticien génère un lien/QR code
2. Parent ouvre le lien sur tablette
3. Page affiche :
   - Infos du document (nom patient, type)
   - Aperçu PDF (optionnel)
   - SignaturePad
   - Checkbox attestation
   - Bouton "Valider ma signature"
4. Après signature : écran de confirmation

### Prompt IA

```
Tu es un développeur React. Crée frontend/src/pages/CabinetSignaturePage.jsx :

Route : /sign/:token

Flow :
1. Au chargement : GET /cabinet-signatures/{token}/status
   - Si token invalide/expiré → écran erreur
   - Si déjà signé → écran "Déjà signé"
   - Si OK → afficher formulaire

2. Affichage formulaire :
   - Header : "Signature du document"
   - Infos : Nom patient, type de document, nom du parent concerné
   - Composant SignaturePad
   - Checkbox : "J'atteste avoir pris connaissance du document ci-dessus et signer en toute connaissance de cause"
   - Bouton "Valider ma signature" (disabled si checkbox non cochée ou signature vide)

3. Au clic Valider :
   - POST /cabinet-signatures/{token}/upload
   - Body : { signature_base64: "...", consent_confirmed: true }
   - Pendant chargement : spinner + "Enregistrement en cours..."
   - Si succès → écran confirmation avec check vert
   - Si erreur → message d'erreur approprié

États à gérer :
- loading : vérification token
- error : token invalide
- expired : session expirée
- already_signed : déjà signé
- ready : prêt à signer
- submitting : envoi en cours
- success : signature enregistrée

Design :
- Mobile-first (tablette)
- Grande zone de signature
- Boutons larges (touch-friendly)
- Couleurs : bleu médical, vert validation

Utilise TanStack Query pour les appels API.

Fournis le code complet.
```

---

## ÉTAPE 7 — Bouton praticien dashboard (CAB-07)

**Durée :** 2h

### Prompt IA

```
Tu es un développeur React. Modifie le dashboard praticien :

Fichier : frontend/src/pages/PractitionerDashboard.jsx (existant)

Ajout sur chaque dossier patient en attente de signature :

1. Nouveau bouton "📝 Signer en cabinet" 
   - À côté du bouton existant "Envoyer lien Yousign"
   - Style : outline, icône stylo

2. Au clic du bouton :
   - Ouvrir modal de sélection
   - Titre : "Signature en cabinet"
   - Options : "Parent 1 : [Nom]" / "Parent 2 : [Nom]"
   - Bouton "Générer le lien"

3. Après sélection :
   - Appel POST /cabinet-signatures/initiate
   - Afficher résultat :
     * QR code généré avec la librairie qrcode.react
     * Lien cliquable : {BASE_URL}/sign/{token}
     * Bouton "Copier le lien"
     * Expiration affichée : "Valide 30 minutes"

4. Gestion erreurs :
   - Si session déjà active : proposer de l'annuler ou attendre

Fournis le diff/patch à appliquer.
```

---

# S9 - FRONTEND PATIENT & CONTENUS

**Objectif :** Finaliser l'expérience patient et créer les contenus d'accompagnement

**Durée estimée :** 16-20 heures

---

## A. SÉPARATION PATIENT / PRATICIEN

### FRONT-01 : Intégrer la homepage patient (3h)

**Fichier source :** medicapp-homepage.jsx (dans le projet)

```
Tu es un développeur React. Intègre la homepage patient dans le frontend :

1. Le fichier medicapp-homepage.jsx existe déjà (composant React complet)

2. Actions :
   - Créer frontend/src/pages/HomePage.jsx
   - Importer et adapter le composant existant
   - Remplacer les placeholders [NOM DU MÉDECIN], [VILLE], etc. par des variables d'environnement ou config
   - Connecter les liens :
     * /inscription → page inscription patient existante
     * /mentions-legales → nouvelle page (FRONT-03)
     * /confidentialite → nouvelle page (FRONT-03)

3. Configuration :
   - Créer frontend/src/config/practitioner.js :
     export const PRACTITIONER = {
       name: process.env.VITE_DOCTOR_NAME || "Dr [Nom]",
       city: process.env.VITE_CITY || "[Ville]",
       hospitalPhone: process.env.VITE_HOSPITAL_PHONE || "",
       cabinetAddress: process.env.VITE_CABINET_ADDRESS || ""
     };

4. Mettre à jour le routeur pour que "/" affiche HomePage

Fournis le code complet.
```

### FRONT-02 : Sous-domaine praticien (4h)

**Objectif :** Séparer complètement l'accès praticien

```
Tu es un développeur React/DevOps. Configure la séparation patient/praticien :

ARCHITECTURE CIBLE :
- medicapp.fr → Frontend patient (homepage, inscription, espace patient)
- pro.medicapp.fr → Frontend praticien (login, dashboard)

OPTION A - Deux builds séparés (recommandé pour sécurité) :

1. Créer deux points d'entrée :
   - frontend/src/main-patient.jsx
   - frontend/src/main-practitioner.jsx

2. Deux configurations Vite :
   - vite.config.patient.js
   - vite.config.practitioner.js

3. Scripts package.json :
   "build:patient": "vite build --config vite.config.patient.js",
   "build:practitioner": "vite build --config vite.config.practitioner.js"

4. Le build praticien ne contient AUCUNE route patient et vice-versa

OPTION B - Même build, routage par domaine (plus simple) :

1. Détecter le domaine au chargement :
   const isPractitioner = window.location.hostname.startsWith('pro.');

2. Afficher les routes appropriées selon le contexte

3. Bloquer l'accès aux routes praticien depuis le domaine patient

SÉCURITÉ SUPPLÉMENTAIRE pour pro.medicapp.fr :

1. IP Whitelist (recommandé) :
   - Configurer dans Azure App Service
   - Autoriser uniquement l'IP fixe du cabinet
   - Autoriser ton IP pour dev

2. Header personnalisé (alternative) :
   - Le praticien doit avoir une extension navigateur qui ajoute un header
   - Le serveur vérifie ce header

Fournis l'implémentation de l'option A avec la configuration Azure pour IP whitelist.
```

### FRONT-03 : Pages légales (3h)

**Sources :** Documents S6 (POLITIQUE_CONFIDENTIALITE.md, MENTIONS_LEGALES.md)

```
Tu es un développeur React. Crée les pages légales :

1. frontend/src/pages/legal/MentionsLegales.jsx
   - Titre : "Mentions légales"
   - Contenu structuré avec sections
   - Style : prose, lisible, sobre

2. frontend/src/pages/legal/PolitiqueConfidentialite.jsx
   - Titre : "Politique de confidentialité"
   - Sections RGPD complètes
   - Ancres pour navigation rapide

3. frontend/src/pages/legal/CGU.jsx (si nécessaire)
   - Conditions générales d'utilisation

Structure commune :
- Header avec titre
- Navigation par ancres (sommaire cliquable)
- Contenu en prose
- Footer avec date de mise à jour

Template réutilisable :
- Créer frontend/src/components/LegalPage.jsx
- Props : title, lastUpdated, sections[]
- Chaque section : { id, title, content }

Ajouter les routes :
- /mentions-legales
- /confidentialite
- /cgu (optionnel)

Fournis le code complet avec le template et une page exemple.
```

### FRONT-04 : Footer global (1h)

```
Tu es un développeur React. Crée un footer global :

Fichier : frontend/src/components/Footer.jsx

Contenu :
- Nom du cabinet
- Adresse
- Liens : Mentions légales | Politique de confidentialité
- Copyright : © 2026 Cabinet du Dr [Nom]. Tous droits réservés.

Intégration :
- Ajouter au layout principal
- Présent sur toutes les pages patient
- Style cohérent avec la homepage

Fournis le code.
```

---

## B. CONTENUS & GUIDES

### CONT-01 : Intégration vidéo rassurance (2h)

**Prérequis :** Tu dois d'abord créer la vidéo motion design (hors scope codage)

```
Tu es un développeur React. Crée la page vidéo de rassurance :

1. frontend/src/pages/VideoRassurance.jsx

Contenu :
- Titre : "Préparer le jour de l'intervention"
- Lecteur vidéo intégré (YouTube embed ou fichier local)
- Sous-titres disponibles
- Transcription texte en dessous (accessibilité)

2. Intégration dans le parcours patient :
- Lien depuis l'espace patient (après prise de RDV)
- Notification/rappel avant la date de l'intervention

3. Configuration :
- VIDEO_URL dans les variables d'environnement
- Fallback si vidéo non disponible

Fournis le code complet.
```

### CONT-02 : Guide FAQ interactif (4h)

```
Tu es un développeur React. Crée le guide FAQ interactif :

1. frontend/src/pages/GuideFAQ.jsx

Structure :
- Barre de recherche en haut
- Catégories cliquables :
  * Créer mon compte
  * Compléter mon dossier
  * Prendre rendez-vous
  * Signer les documents
  * Le jour de l'intervention
  * Après l'intervention

2. Composant FAQ avec accordéons :
- Question cliquable → réponse dépliable
- Possibilité d'inclure des captures d'écran
- Animation fluide ouverture/fermeture

3. Structure données :
const faqData = [
  {
    category: "Créer mon compte",
    questions: [
      {
        question: "Comment créer mon compte ?",
        answer: "Pour créer votre compte...",
        screenshots: ["/images/guide/inscription-1.png"],
        steps: ["Étape 1...", "Étape 2..."]
      }
    ]
  }
];

4. Fonctionnalités :
- Recherche instantanée (filtre questions)
- Ancre directe vers une question (/guide#question-id)
- Bouton "Cette réponse vous a-t-elle aidé ?" (optionnel)
- Version imprimable / PDF

5. Intégration :
- Lien dans le menu patient
- Lien dans le footer
- Accessible sans connexion

Fournis le code complet avec données exemple.
```

### CONT-03 : Captures d'écran guide (2h - Manuel)

**Note :** Cette tâche nécessite de faire des captures manuellement.

**Checklist captures à faire :**

- [ ] Page d'accueil
- [ ] Formulaire inscription (vide)
- [ ] Formulaire inscription (rempli exemple)
- [ ] Email de vérification
- [ ] Page connexion
- [ ] Dashboard patient vide
- [ ] Formulaire dossier enfant
- [ ] Questionnaire médical
- [ ] Calendrier prise RDV
- [ ] Confirmation RDV
- [ ] Page signature documents
- [ ] Confirmation signature
- [ ] Espace documents signés

**Organisation :**
```
frontend/public/images/guide/
├── 01-accueil.png
├── 02-inscription-vide.png
├── 02-inscription-rempli.png
├── 03-email-verification.png
├── 04-connexion.png
├── 05-dashboard.png
...
```

---

# S10 - MAINTENANCE & CONTINUITÉ

**Objectif :** Faciliter la maintenance quotidienne et prévoir les situations de crise

**Durée estimée :** 8-12 heures

---

## A. MAINTENANCE FACILITÉE

### MAINT-01 : Dashboard admin simplifié (4h)

```
Tu es un développeur React/FastAPI. Crée un mini dashboard admin pour le praticien :

BACKEND - backend/routes/admin_stats.py

Endpoints (auth praticien) :
- GET /admin/stats/overview
  {
    "total_patients": 150,
    "pending_signatures": 5,
    "appointments_this_week": 12,
    "storage_used_mb": 450,
    "last_backup": "2026-02-05T03:00:00Z"
  }

- GET /admin/stats/recent-activity
  [
    { "type": "new_patient", "date": "...", "details": "Nouveau dossier créé" },
    { "type": "signature", "date": "...", "details": "Document signé par..." },
    ...
  ]

- GET /admin/health
  {
    "database": "ok",
    "storage": "ok", 
    "email_service": "ok",
    "sms_service": "ok"
  }

FRONTEND - frontend/src/pages/AdminDashboard.jsx

Affichage :
- Cards avec statistiques clés
- Liste activité récente (10 dernières actions)
- Indicateurs santé système (pastilles vert/rouge)
- Bouton "Exporter les données" (backup manuel)

Accessible uniquement aux praticiens.

Fournis le code complet.
```

### MAINT-02 : Alertes automatiques (2h)

```
Tu es un développeur Python. Configure les alertes automatiques :

Fichier : backend/services/alerting.py

Alertes à configurer :

1. Erreurs critiques :
   - Échec connexion base de données
   - Échec envoi email/SMS
   - Espace stockage > 80%
   → Email immédiat au praticien + développeur

2. Alertes quotidiennes (résumé matin) :
   - Nombre de nouveaux dossiers
   - Signatures en attente depuis > 7 jours
   - RDV du jour

3. Implémentation :
   - Utiliser Application Insights pour les erreurs
   - Cron job Azure pour le résumé quotidien
   - Template email simple et clair

Fournis le code avec configuration Azure Functions pour le cron.
```

---

## B. SAUVEGARDES & RESTAURATION

### MAINT-03 : Procédure backup vérifiée (2h)

```
Tu es un expert Azure. Documente et teste les sauvegardes :

1. Vérifier configuration actuelle :
   - Azure PostgreSQL : backup automatique activé ?
   - Rétention : combien de jours ?
   - Azure Blob : soft delete activé ?

2. Créer script de test restauration :
   backend/scripts/test_restore.py
   
   - Mode dry-run : simule sans restaurer
   - Liste les backups disponibles
   - Vérifie l'intégrité d'un backup récent
   - Log le résultat

3. Documenter dans docs/PROCEDURE_BACKUP.md :
   - Comment Azure fait les backups automatiquement
   - Comment restaurer manuellement (étapes portail)
   - Contacts support Azure
   - Checklist mensuelle de vérification

Fournis le script et la documentation.
```

### MAINT-04 : Export manuel des données critiques (2h)

```
Tu es un développeur Python. Crée un export de sécurité :

Fichier : backend/scripts/export_critical_data.py

Fonction : Exporter toutes les données critiques en JSON/CSV

Données à exporter :
- Liste patients (anonymisée ou complète selon option)
- Tous les rendez-vous
- Statuts des signatures
- Prescriptions générées

Options :
--output-dir : dossier de sortie
--anonymize : masquer données personnelles
--since : date début (export incrémental)
--encrypt : chiffrer l'archive avec mot de passe

Sortie :
- export_YYYY-MM-DD.zip contenant :
  - patients.json
  - appointments.json
  - signatures.json
  - prescriptions.json
  - metadata.json (date export, version app)

Usage recommandé : Exécuter 1x/semaine, stocker sur disque externe.

Fournis le code complet.
```

---

## C. PLAN DE CONTINUITÉ (PCA)

### MAINT-05 : Procédure fallback papier (Documentation)

```
Crée docs/PROCEDURE_FALLBACK_PAPIER.md :

# Procédure de continuité - Mode papier

## Déclencheurs
- Plateforme inaccessible > 30 minutes
- Internet cabinet coupé
- Problème critique non résolvable rapidement

## Kit papier à préparer (à imprimer à l'avance)

### Documents vierges :
- [ ] Fiche patient vierge (10 exemplaires)
- [ ] Questionnaire médical papier (10 exemplaires)
- [ ] Formulaire consentement papier (10 exemplaires)
- [ ] Ordonnance pré-imprimée (carnet)

### Informations de référence :
- [ ] Liste RDV de la semaine (imprimer chaque lundi)
- [ ] Coordonnées patients du jour (imprimer chaque matin)

## Procédure pendant la panne

1. Accueil patient :
   - Expliquer le problème technique
   - Remplir fiche papier
   - Scanner CNI si possible (photo téléphone)

2. Questionnaire médical :
   - Version papier à remplir
   - Le parent signe le papier

3. Consentement :
   - Signature manuscrite sur formulaire papier
   - Date + heure + lieu
   - Les DEUX parents si possible

4. Prescription :
   - Ordonnance manuscrite ou pré-imprimée
   - Tampon + signature médecin

## Après la panne - Numérisation

1. Scanner tous les documents papier
2. Créer les dossiers dans MedicApp
3. Uploader les scans comme pièces jointes
4. Marquer "Créé en mode dégradé" dans les notes

## Contacts urgence
- Support technique : [email/téléphone]
- Azure Status : status.azure.com
```

### MAINT-06 : Relais technique (Documentation)

```
Crée docs/CONTACTS_SUPPORT.md :

# Contacts et procédures support

## Niveau 1 - Problèmes simples
**Développeur principal :** [Ton nom]
- Email : 
- Téléphone :
- Disponibilité : 

**Problèmes couverts :**
- Mot de passe oublié praticien
- Patient bloqué dans le parcours
- Question sur l'utilisation

**Délai réponse :** < 4h en journée

## Niveau 2 - Problèmes techniques
**Même contact** mais escalade si :
- Bug bloquant
- Données incorrectes
- Erreur système

**Délai réponse :** < 24h

## Niveau 3 - Urgence critique
**Plateforme complètement down**

1. Vérifier status.azure.com
2. Contacter développeur immédiatement
3. Activer procédure fallback papier

## Support Azure
- Portail : portal.azure.com → Help + Support
- Niveau support actuel : [Basic/Standard/Pro]
- Temps réponse garanti : [selon niveau]

## Procédure escalade
1. Problème détecté → noter l'heure et les symptômes
2. Essayer les solutions simples (refresh, reconnexion)
3. Si persiste > 15 min → contacter développeur
4. Si critique → mode papier + contact urgent
```

---

# S7 - INFRASTRUCTURE AZURE (À faire en dernier)

**Objectif :** Sécuriser l'accès réseau (Private Endpoints) et signer le contrat HDS

**Durée estimée :** 6-8 heures  
**Coût supplémentaire :** ~14€/mois

**Note :** Ce sprint est à faire une fois que tout le reste fonctionne, juste avant la mise en production réelle avec des patients.

---

## Rappel des tâches (déjà documentées)

| Tâche | Description | Durée |
|-------|-------------|-------|
| INFRA-01 | Private Endpoint PostgreSQL | 2h |
| INFRA-02 | Private Endpoint Blob Storage | 2h |
| INFRA-03 | VNet Integration App Service | 1h |
| INFRA-04 | Firewall App Service (IP whitelist) | 30min |
| INFRA-05 | Signer contrat Azure Healthcare | 1h |
| INFRA-06 | Documentation infrastructure | 30min |

**Ordre critique :**
```
INFRA-01 → INFRA-02 → INFRA-03 → Désactiver accès public → INFRA-04/05/06
```

⚠️ **Ne jamais désactiver l'accès public AVANT d'avoir configuré le VNet Integration, sinon l'application ne pourra plus accéder à la base de données !**

---

# 📅 PLAN DE DÉPLOIEMENT PROGRESSIF

## Phase 1 : Finalisation technique (2-3 semaines)
- [ ] S5 : Signature cabinet
- [ ] S9 : Frontend patient + contenus
- [ ] Tests complets en environnement de dev

## Phase 2 : Préparation production (1 semaine)
- [ ] S10 : Maintenance & continuité
- [ ] Imprimer kit papier de secours
- [ ] Former le praticien et la secrétaire
- [ ] Créer les captures d'écran pour le guide

## Phase 3 : Pilote (2-4 semaines)
- [ ] 5-10 patients en conditions réelles
- [ ] Recueillir les retours
- [ ] Ajuster si nécessaire
- [ ] Valider la vidéo rassurance

## Phase 4 : Sécurisation finale (1 semaine)
- [ ] S7 : Infrastructure Azure (Private Endpoints)
- [ ] Contrat HDS Azure
- [ ] Audit sécurité final

## Phase 5 : Production complète
- [ ] Basculer tous les nouveaux patients sur la plateforme
- [ ] Monitoring renforcé les premières semaines
- [ ] Support réactif

---

# ✅ CHECKLIST AVANT MISE EN PRODUCTION

## Technique
- [ ] Tous les sprints complétés
- [ ] Tests fonctionnels passés
- [ ] MFA praticien activé
- [ ] Backups vérifiés
- [ ] Monitoring configuré

## Légal / Conformité
- [ ] Politique de confidentialité publiée
- [ ] Mentions légales publiées
- [ ] Contrat HDS signé
- [ ] RGPD : export/rectification/suppression fonctionnels

## Opérationnel
- [ ] Guide FAQ finalisé
- [ ] Vidéo rassurance disponible
- [ ] Kit papier imprimé
- [ ] Praticien formé
- [ ] Secrétaire formée
- [ ] Contacts support documentés

## Sécurité
- [ ] Private Endpoints configurés
- [ ] IP whitelist praticien
- [ ] Chiffrement vérifié
- [ ] Logs d'audit actifs

---

*Document généré le 5 février 2026*
*MedicApp - Conformité HDS/RGPD*
