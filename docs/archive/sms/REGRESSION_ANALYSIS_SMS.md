# Analyse des Régressions - Système de Vérification SMS

> Archive historique. Ne pas utiliser comme état courant du projet. Voir `docs/ETAT_PROJET.md`.

**Date:** 2025-12-21
**Contexte:** Migration du système OTP de `ProcedureCase` vers `Guardian` (nouveau module dossier)

---

## 📊 Comparaison des Systèmes

### ✅ **Ancien Système** (ProcedureCase - PRODUCTION)
**Fichiers:** `backend/routes/procedures.py`

#### Endpoints
```
POST /procedures/phone-otp/request
POST /procedures/phone-otp/verify
```

#### Flux
1. **Envoi code:**
   - Génère code 6 chiffres
   - TTL: 10 minutes
   - Stocké en clair dans `parent{1|2}_phone_otp_code`
   - Expire dans `parent{1|2}_phone_otp_expires_at`
   - Reset `phone_verified_at` si téléphone change

2. **Vérification:**
   - Comparaison code en clair
   - Vérifie expiration
   - Si OK: marque `parent{1|2}_phone_verified_at`
   - Efface code + expiration

#### Caractéristiques
- ✅ **Simple et fonctionnel**
- ✅ **En production, testé**
- ✅ **Code 6 chiffres**
- ✅ **Pas de cooldown** (peut renvoyer immédiatement)
- ✅ **Pas de limite de tentatives**
- ❌ **Code stocké en clair** (risque sécurité)
- ❌ **Pas de tracking (IP, User-Agent)**
- ❌ **Pas de table dédiée** (colonnes sur ProcedureCase)

---

### 🆕 **Nouveau Système** (Guardian - EN DÉVELOPPEMENT)
**Fichiers:** `backend/dossier/service.py`, `backend/routes/dossier.py`

#### Endpoints
```
POST /dossier/guardians/{guardian_id}/phone-verification/send
POST /dossier/guardians/{guardian_id}/phone-verification/verify
```

#### Flux
1. **Envoi code:**
   - Génère code 5 chiffres
   - TTL: 5 minutes (300s)
   - Cooldown: 30 secondes
   - Code hashé (SHA256)
   - Table dédiée `GuardianPhoneVerification`
   - Tracking IP + User-Agent

2. **Vérification:**
   - Comparaison hash
   - Limite 5 tentatives → LOCKED
   - Si OK: marque `Guardian.phone_verified_at` + `verification.verified_at`
   - Statuts: SENT → VERIFIED | EXPIRED | LOCKED

#### Caractéristiques
- ✅ **Code hashé** (sécurité renforcée)
- ✅ **Table dédiée** (audit trail complet)
- ✅ **Limite tentatives** (anti-brute force)
- ✅ **Cooldown 30s** (anti-spam)
- ✅ **Tracking IP/UA** (conformité RGPD)
- ✅ **Validation phonenumbers** (format E.164)
- ❌ **Code 5 chiffres** (vs 6 avant)
- ❌ **TTL 5 min** (vs 10 min avant)
- ⚠️ **Cooldown** peut frustrer utilisateurs
- ⚠️ **LOCKED après 5 essais** (ancien système illimité)

---

## 🚨 **Régressions Potentielles Identifiées**

### 1. **Incompatibilité des Routes API**
**Impact:** MAJEUR 🔴

**Problème:**
- Ancien frontend appelle `/procedures/phone-otp/request`
- Nouveau backend utilise `/dossier/guardians/{id}/phone-verification/send`

**Conséquences:**
- ❌ **BREAKING CHANGE** pour l'ancien système de signatures
- ❌ Les signatures Yousign utilisent encore `ProcedureCase.parent{1|2}_phone_verified_at`
- ❌ Le module `consents` vérifie ces champs pour autoriser signature à distance

**Fichiers impactés:**
- `backend/services/consents.py` - vérifie `parent{1|2}_phone_verified_at`
- `frontend/src/pages/Patient.jsx` - flux signature existant
- Tout le workflow de consentement Yousign

---

### 2. **Durée de Vie du Code Réduite**
**Impact:** MOYEN 🟠

**Changement:**
- Ancien: **10 minutes**
- Nouveau: **5 minutes**

**Risque:**
- Utilisateurs habitués à 10 min peuvent être surpris
- SMS parfois reçu avec 1-2 min de délai

**Recommandation:**
- Garder 10 minutes (modifier `TTL_SECONDS = 600`)
- Ou afficher clairement "5 min" dans l'UI

---

### 3. **Cooldown de 30 Secondes**
**Impact:** MOYEN 🟠

**Nouveau comportement:**
- Impossible de renvoyer code pendant 30 secondes
- Retourne HTTP 429 (Too Many Requests)

**Risque:**
- UX dégradée si utilisateur clique rapidement
- Message d'erreur peut être mal compris

**Recommandation:**
- Désactiver bouton "Renvoyer" pendant cooldown
- Afficher compte à rebours dans l'UI
- Ou réduire cooldown à 10-15 secondes

---

### 4. **Verrouillage Après 5 Tentatives**
**Impact:** MOYEN 🟠

**Nouveau comportement:**
- Après 5 codes incorrects → statut LOCKED
- Impossible de vérifier (même avec bon code)
- Il faut renvoyer un nouveau code

**Risque:**
- Utilisateur bloqué si tape mal 5 fois
- Pas de mécanisme de déblocage

**Recommandation:**
- Augmenter à 10 tentatives (moins restrictif)
- Ou permettre nouveau code après LOCKED (actuellement non géré)

---

### 5. **Code 5 Chiffres au lieu de 6**
**Impact:** FAIBLE 🟢

**Changement:**
- Ancien: 6 chiffres (000000 - 999999)
- Nouveau: 5 chiffres (00000 - 99999)

**Risque:**
- Sécurité légèrement réduite (10x moins de combinaisons)
- Mais avec limite 5 tentatives + cooldown, reste sécurisé

**Recommandation:**
- Garder 5 chiffres (acceptable) ou repasser à 6

---

### 6. **Double Vérification (Deux Sources de Vérité)**
**Impact:** MAJEUR 🔴

**Problème CRITIQUE:**
- `ProcedureCase.parent{1|2}_phone_verified_at` (ancien)
- `Guardian.phone_verified_at` (nouveau)
- **Les deux coexistent actuellement !**

**Conséquences:**
- Incohérences possibles
- Service `consents.py` lit encore `ProcedureCase`
- Nouveau dossier écrit dans `Guardian`

**Fichiers concernés:**
- `backend/dossier/service.py:259` - `_sync_to_procedure_case()` (tentative de sync)
- `backend/services/consents.py` - vérifie `ProcedureCase` pour signatures

**Action requise:**
- Vérifier que `_sync_to_procedure_case()` synchronise bien `phone_verified_at`
- Ou migrer `consents.py` pour lire `Guardian` au lieu de `ProcedureCase`

---

### 7. **Normalisation Téléphone E.164**
**Impact:** MOYEN 🟠

**Nouveau comportement:**
- Valide et normalise via `phonenumbers` library
- Rejette si invalide (HTTP 422)

**Risque:**
- Ancien système acceptait n'importe quelle chaîne
- Nouveau rejette formats invalides
- Peut bloquer si téléphone mal formaté en BDD

**Recommandation:**
- Migration de données nécessaire avant déploiement
- Nettoyer `ProcedureCase.parent{1|2}_phone` en format E.164

---

## 🛠️ **Plan d'Action pour Éviter Régressions**

### Phase 1: Coexistence (Actuel)
✅ Conserver les deux systèmes en parallèle
✅ Nouveau dossier synchronise vers `ProcedureCase` via `_sync_to_procedure_case()`

### Phase 2: Tests de Non-Régression (URGENT)
1. ✅ Vérifier que `_sync_to_procedure_case()` copie bien `phone_verified_at`
2. ⚠️ Tester workflow signature Yousign avec nouveau dossier
3. ⚠️ Tester ancien workflow `/procedures/phone-otp/*` (ne pas casser)
4. ⚠️ Valider que les deux systèmes ne se marchent pas dessus

### Phase 3: Migration Progressive
1. Modifier `consents.py` pour lire `Guardian` si disponible, sinon fallback `ProcedureCase`
2. Ajouter logs pour tracker quelle source est utilisée
3. Migrer données existantes de `ProcedureCase` → `Guardian`
4. Déprécier ancien endpoint (avec période de transition)

### Phase 4: Nettoyage
1. Supprimer colonnes `parent{1|2}_phone_otp_*` de `ProcedureCase`
2. Supprimer routes `/procedures/phone-otp/*`
3. Supprimer code de synchronisation

---

## ✅ **Points Positifs du Nouveau Système**

1. **Sécurité renforcée** (code hashé, limite tentatives)
2. **Audit trail complet** (table dédiée, IP/UA)
3. **Protection anti-spam** (cooldown)
4. **Conformité RGPD** (tracking consentement)
5. **Normalisation téléphone** (format E.164 standard)
6. **Modèle de données propre** (séparation Guardian vs ProcedureCase)

---

## ⚠️ **Recommandations Immédiates**

### CRITIQUE 🔴
1. **Vérifier `_sync_to_procedure_case()`** - S'assurer que `phone_verified_at` est bien copié
2. **Tester workflow signature** - Valider que Yousign fonctionne avec nouveau système
3. **Documenter migration** - Écrire plan de bascule ancien → nouveau

### IMPORTANT 🟠
4. **Augmenter TTL à 10 min** - Alignement avec ancien système
5. **Réduire cooldown à 15s** - Meilleure UX
6. **Augmenter max_attempts à 10** - Moins frustrant
7. **Code 6 chiffres** - Alignement avec ancien système

### NICE-TO-HAVE 🟢
8. **Migration données téléphone** - Nettoyer format E.164
9. **Tests automatisés** - Workflow OTP complet
10. **Monitoring** - Tracking taux de succès vérification

---

## 📝 **Checklist Migration**

- [ ] `_sync_to_procedure_case()` copie `phone_verified_at`
- [ ] Tests workflow signature Yousign avec Guardian
- [ ] Tests ancien endpoint `/procedures/phone-otp/*` (non cassé)
- [ ] Modifier paramètres (TTL, cooldown, attempts, code_length)
- [ ] Migration données téléphones E.164
- [ ] Modifier `consents.py` pour lire Guardian
- [ ] Tests de non-régression complets
- [ ] Documentation utilisateur (nouveau flux)
- [ ] Plan de rollback si problème

---

**Conclusion:**

Le nouveau système est **techniquement supérieur** mais présente **risques de régression majeurs** si déployé sans migration soigneuse. **Action critique:** Vérifier la synchronisation et tester le workflow de signature avant tout déploiement.
