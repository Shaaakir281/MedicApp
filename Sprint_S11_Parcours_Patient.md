# 🏥 SPRINT S11 — Parcours Patient Visuel

**Objectif :** Remplacer le header actuel par une timeline interactive de progression  
**Durée estimée :** 12-16h  
**Priorité :** Haute (UX patient)

---

## 📋 Contexte

Le header actuel (fond sombre avec infos enfant + onglets) sera remplacé par une timeline visuelle type "suivi de livraison" qui guide le patient à travers les 4 étapes de son parcours.

### Les 4 étapes

| # | Étape | Validée quand | Sous-texte |
|---|-------|---------------|------------|
| 1 | **Dossier** | Compte créé + nom enfant | "Créé" / "À créer" |
| 2 | **Pré-consultation** | RDV pris | "RDV pris" / "À planifier" |
| 3 | **RDV Acte** | RDV pris | "RDV pris" / "À planifier" |
| 4 | **Signatures** | Tous documents signés | "Terminé" / "En attente" |

### Contrainte métier importante

Le **délai de réflexion de 15 jours** n'est PAS une étape visible. Il s'affiche comme message contextuel sous la timeline, uniquement à l'étape Signatures :
- Si délai non écoulé → "Signature possible dans X jours"
- Si dossier incomplet → "Complétez le dossier pour signer à distance"
- Si tout OK → "Parent 1 et Parent 2 peut signer"

---

## 🎨 Design validé

### Palette de couleurs

| Élément | Couleur | Tailwind |
|---------|---------|----------|
| **Fond** | Gris très clair dégradé | `bg-gradient-to-b from-slate-50 to-slate-100` |
| **Étape complète** | Vert émeraude | `bg-emerald-500` + `text-emerald-700` |
| **Étape en cours** | Bleu foncé confiance | `bg-blue-800` + `text-blue-900` |
| **Étape en attente** | Fond blanc + bordure ambre | `bg-white border-amber-500 text-amber-600` |
| **Lignes connexion** | Vert si complète, gris sinon | `bg-emerald-500` / `bg-slate-200` |

### Icônes (Lucide React)

- Dossier : `FileText`
- Pré-consultation : `Phone`
- RDV Acte : `Calendar`
- Signatures : `PenTool`
- Complète : `Check`
- En attente : `Clock`

### Comportement

- **Cliquable** : Chaque étape navigue vers l'onglet correspondant
- **Hover** : `scale-110` sur les cercles
- **Message unique** : Un seul message contextuel sous la timeline (pas de répétition)

---

## 📁 Tâches

### TASK-01 : Endpoint API calcul statuts parcours
**Fichier :** `backend/routes/patient.py` (modifier)  
**Durée :** 2h

Créer un endpoint ou enrichir `/patient/me` avec les données nécessaires :

```python
# Response attendue
{
  "journey_status": {
    "dossier": {
      "created": true,
      "complete": false,  # Pour signature distante
      "missing_fields": ["parent2_name", "parent2_email", "parent2_phone"]
    },
    "pre_consultation": {
      "booked": true,
      "date": "2025-02-10T10:00:00Z"
    },
    "rdv_acte": {
      "booked": true,
      "date": "2025-02-25T09:00:00Z"
    },
    "signatures": {
      "complete": false,
      "parent1_signed": false,
      "parent2_signed": false,
      "reflection_delay": {
        "can_sign": false,
        "days_left": 5,
        "available_date": "2025-02-25"
      }
    }
  }
}
```

**Logique délai réflexion :**
- Calculer 15 jours après `pre_consultation.date`
- `can_sign = true` si date actuelle >= date_pre_consult + 15 jours

---

### TASK-02 : Composant PatientJourneyHeader.jsx
**Fichier :** `frontend/src/components/PatientJourneyHeader.jsx` (nouveau)  
**Durée :** 3h

Créer le composant React basé sur le prototype v4 fourni.

**Props attendues :**
```typescript
interface PatientJourneyHeaderProps {
  childName: string;
  email: string;
  journeyStatus: JourneyStatus; // Type depuis l'API
  onLogout: () => void;
  onNavigate: (tab: 'dossier' | 'rdv' | 'documents' | 'signatures') => void;
}
```

**Comportements :**
- Desktop : Timeline horizontale avec lignes de connexion
- Mobile : Timeline compacte avec labels abrégés
- Message contextuel unique selon état signatures

---

### TASK-03 : Hook usePatientJourney
**Fichier :** `frontend/src/hooks/usePatientJourney.js` (nouveau)  
**Durée :** 1h

Hook TanStack Query pour récupérer et calculer les statuts :

```javascript
export const usePatientJourney = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'journey'],
    queryFn: () => api.get('/patient/me'),
    select: (data) => data.journey_status
  });
  
  return {
    journeyStatus: data,
    isLoading,
    // Helper pour message contextuel
    signatureMessage: computeSignatureMessage(data)
  };
};
```

---

### TASK-04 : Intégration dans PatientDashboard
**Fichier :** `frontend/src/pages/PatientDashboard.jsx` (modifier)  
**Durée :** 2h

1. Supprimer l'ancien header (bloc dark avec infos enfant)
2. Importer et intégrer `PatientJourneyHeader`
3. Conserver les 4 onglets en dessous (Dossier, RDV, Documents, Signatures)
4. Connecter `onNavigate` pour changer d'onglet au clic sur une étape

```jsx
<PatientJourneyHeader
  childName={patient.child_full_name}
  email={user.email}
  journeyStatus={journeyStatus}
  onLogout={handleLogout}
  onNavigate={setActiveTab}
/>

{/* Onglets existants */}
<Tabs value={activeTab} onChange={setActiveTab}>
  ...
</Tabs>
```

---

### TASK-05 : Tests unitaires composant
**Fichier :** `frontend/src/components/__tests__/PatientJourneyHeader.test.jsx` (nouveau)  
**Durée :** 2h

Cas à tester :
1. Affiche "Créé" quand dossier créé
2. Affiche "RDV pris" quand pré-consultation bookée
3. Affiche message délai "Signature possible dans X jours"
4. Affiche message "Complétez le dossier pour signer à distance"
5. Affiche "Parent 1 et Parent 2 peut signer" quand tout OK
6. Navigation au clic sur étape
7. Responsive : labels abrégés sur mobile

---

### TASK-06 : Tests E2E parcours patient
**Fichier :** `frontend/cypress/e2e/patient-journey.cy.js` (nouveau)  
**Durée :** 2h

Scénarios :
1. Nouveau patient → Dossier "À créer", reste grisé
2. Dossier créé → Étape 1 verte, étape 2 bleue
3. RDV pris → Étapes 1-3 vertes
4. Délai non écoulé → Message ambre sous timeline
5. Clic sur étape → Navigation vers bon onglet

---

### TASK-07 : Adaptation mobile
**Fichier :** `frontend/src/components/PatientJourneyHeader.jsx` (modifier)  
**Durée :** 1h

Vérifier et ajuster :
- Labels abrégés : "Pré-consult" au lieu de "Pré-consultation"
- Taille cercles : `w-9 h-9` sur mobile
- Message contextuel : texte plus court si nécessaire
- Touch targets : minimum 44x44px

---

### TASK-08 : Documentation
**Fichier :** `docs/PATIENT_JOURNEY_COMPONENT.md` (nouveau)  
**Durée :** 1h

Documenter :
- Props et types
- Logique de calcul des statuts
- Règle des 15 jours
- Personnalisation couleurs
- Exemples d'utilisation

---

## 📊 Récapitulatif

| Tâche | Type | Durée | Priorité |
|-------|------|-------|----------|
| TASK-01 | Backend | 2h | P1 |
| TASK-02 | Frontend | 3h | P1 |
| TASK-03 | Frontend | 1h | P1 |
| TASK-04 | Frontend | 2h | P1 |
| TASK-05 | Test | 2h | P2 |
| TASK-06 | Test | 2h | P2 |
| TASK-07 | Frontend | 1h | P1 |
| TASK-08 | Doc | 1h | P3 |

**Total : 14h**

---

## 📎 Fichiers joints

- `PatientJourneyHeader-v4.jsx` — Prototype React complet à adapter
- Capture header actuel — Pour référence de ce qui est remplacé

---

## ✅ Critères d'acceptation

- [ ] Timeline visible sur desktop et mobile
- [ ] 4 étapes avec statuts corrects
- [ ] Clic sur étape = navigation vers onglet
- [ ] Message délai réflexion affiché correctement
- [ ] Pas de répétition de messages
- [ ] Fond gris clair + bleu foncé confiance
- [ ] Onglets conservés sous la timeline
- [ ] Tests passent
