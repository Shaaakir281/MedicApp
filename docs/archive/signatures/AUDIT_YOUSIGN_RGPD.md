# Audit RGPD/HDS - Implémentation Yousign Actuelle

> Archive d'audit datée. Elle ne remplace pas une validation juridique ou HDS actuelle.

**Date** : 2025-12-21
**Contexte** : Analyse de l'architecture existante avant refonte vers signatures granulaires par document

---

## État des lieux : Architecture actuelle

### ✅ Points conformes à la DPIA

#### 1. PDF Neutre (Minimisation des données)
**Fichier** : `backend/templates/consent_neutral.html`
```html
<!-- Contenu transmis à Yousign -->
- consent_id : UUID unique (référence interne)
- consent_hash : SHA-256 du PDF médical complet (optionnel)
- AUCUNE donnée médicale
- AUCUN nom de patient
- AUCUN nom de praticien
```

**Service** : `backend/services/consent_pdf.py:render_neutral_consent_pdf()`
```python
def render_neutral_consent_pdf(consent_id: str, consent_hash: Optional[str] = None) -> Path:
    # Génère un PDF générique sans PHI (Protected Health Information)
```

**✅ Conforme** : Yousign ne reçoit QUE le PDF neutre, jamais le contenu médical.

---

#### 2. Purge automatique Yousign
**Fichier** : `backend/services/consents.py:373`
```python
def purge_yousign_signature(case: models.ProcedureCase) -> None:
    """Best-effort cleanup of the Yousign signature request (no PHI retained externally)."""
    client.delete_signature_request(case.yousign_procedure_id, permanent_delete=True)
```

**Déclenchement** : `consents.py:434` (quand les 2 parents ont signé)
```python
if case.parent1_consent_status == "signed" and case.parent2_consent_status == "signed":
    # Récupération des artefacts localement
    # ...
    # Purge Yousign après récupération locale
    try:
        purge_yousign_signature(case)
    except Exception:
        logger.exception("Echec de purge Yousign pour le dossier %s", case.id)
```

**✅ Conforme** : Suppression permanente dès récupération locale des PDFs signés + audit trail.

---

#### 3. Recomposition locale dans environnement HDS
**Fichier** : `backend/services/consent_pdf.py:131`
```python
def compose_final_consent(
    *,
    full_consent_id: str,  # Consentement médical complet
    case_id: int,
    signed_ids: list[str] | None = None,  # PDFs neutres signés
    evidence_ids: list[str] | None = None,  # Audit trails
) -> Optional[str]:
    """Merge consent + audits + signed neutral PDFs into a single PDF (local storage only)."""
    # 1. Charge le PDF médical complet (HDS)
    # 2. Ajoute les audit trails (HDS)
    # 3. Ajoute les PDFs neutres signés (HDS)
    # → Résultat : Dossier complet stocké dans HDS uniquement
```

**✅ Conforme** : Reconstitution dans l'infrastructure HDS, pas chez Yousign.

---

#### 4. Stockage des artefacts en HDS uniquement
**Catégories de stockage** :
```python
SIGNED_CONSENT_CATEGORY = "signed_consents"      # PDFs neutres signés
EVIDENCE_CATEGORY = "consent_evidences"          # Audit trails
FINAL_CONSENT_CATEGORY = "final_consents"        # Dossiers complets
```

**Conservation** :
- Yousign : 0 jour (purge immédiate après récupération)
- HDS : Durée légale de conservation médicale

**✅ Conforme** : Données de santé jamais stockées chez Yousign.

---

### ⚠️ Points à améliorer (RGPD/HDS)

#### 1. Données envoyées à Yousign (Contact information)
**Fichier** : `backend/services/consents.py:44`
```python
def _build_signers_payload(case: models.ProcedureCase, auth_mode: str = "otp_sms") -> list[dict]:
    signers = []
    if case.parent1_name and (case.parent1_email or case.parent1_phone):
        email = _ensure_email(case.parent1_email, case.parent1_phone, "parent1")
        signers.append({
            "label": "parent1",
            "email": email,              # Email du parent
            "phone": case.parent1_phone, # Téléphone du parent (format E164)
            "auth_mode": auth_mode,
        })
```

**Problème** :
- ❌ `parent1_name` / `parent2_name` : Nom complet des parents envoyé à Yousign
- ❌ Email/Téléphone : Identifiants directs envoyés à Yousign

**Impact DPIA** :
- Yousign reçoit des données personnelles (nom, email, téléphone)
- Pas de données de santé, mais identité des parents
- Conformité partielle : minimisation pas maximale

**Recommandation** :
```python
# Pseudonymiser les noms de parents
signers.append({
    "label": "parent1",
    "email": email,
    "phone": case.parent1_phone,
    "auth_mode": auth_mode,
    "first_name": "Parent",  # Pseudonyme
    "last_name": "1",        # Pseudonyme
})
```

---

#### 2. Emails de notification contenant le lien de signature
**Fichier** : `backend/services/consents.py:199`
```python
def _send_initial_notifications(case: models.ProcedureCase) -> None:
    child = case.child_full_name  # ⚠️ Nom complet de l'enfant dans email/SMS

    def _build_body(link: str) -> str:
        return (
            f"Vous pouvez signer le consentement pour {child}.\n"  # ⚠️ PHI dans email
            f"Lien de signature securise : {link}\n"
            f"{app_name}"
        )

    if case.parent1_signature_link and case.parent1_sms_optin and case.parent1_phone:
        send_sms(case.parent1_phone, _build_body(case.parent1_signature_link))
```

**Problème** :
- ❌ `child_full_name` envoyé dans email/SMS
- ❌ Lien contient potentiellement le `consent_id` (UUID traçable)

**Impact DPIA** :
- Email non chiffré contient identité de l'enfant
- SMS non chiffré contient identité de l'enfant
- Fuite potentielle si email/SMS intercepté

**Recommandation** :
```python
def _build_body(link: str) -> str:
    return (
        f"Vous avez un document médical à signer.\n"  # Neutre
        f"Lien de signature sécurisé : {link}\n"
        f"{app_name}"
    )
```

---

#### 3. Logs applicatifs
**Fichier** : `backend/services/consents.py:123`
```python
logger.info("initiate_consent -> Yousign procedure=%s signers=%s", procedure.procedure_id, procedure.signers)
```

**Problème** :
- ⚠️ `procedure.signers` loggué peut contenir email/téléphone
- Logs = données persistantes, possibilité de fuite

**Recommandation** :
```python
logger.info("initiate_consent -> Yousign procedure=%s signer_count=%d", procedure.procedure_id, len(procedure.signers))
```

---

### 🔴 Problème CRITIQUE : Architecture monolithique (1 SR = tous les documents)

#### Architecture actuelle
```
1 ProcedureCase (dossier patient)
    └─ 1 Signature Request Yousign
        └─ 1 PDF neutre
        └─ 2 Signers (Parent 1 + Parent 2)
```

**Problème identifié** :
- ❌ **Un seul PDF neutre pour TOUS les documents** (Autorisation + Consentement + Honoraires)
- ❌ **Impossible de distinguer quel document a été signé**
- ❌ **Pas de traçabilité granulaire** : On sait que "Parent 1 a signé", mais pas "Parent 1 a signé le Consentement Éclairé v2.1"

**Impact DPIA** :
- Non-conformité juridique : Chaque document médical doit avoir sa propre signature
- Non-conformité technique : Impossible de prouver qu'un document spécifique a été signé
- Non-conformité RGPD : Manque de granularité dans la traçabilité

---

## Recommandations prioritaires (ordre de criticité)

### 🔴 CRITIQUE : Signatures granulaires par document
**Objectif** : 1 Signature Request Yousign = 1 Document médical

**Architecture cible** :
```
1 ProcedureCase
    ├─ Document 1 (Autorisation)
    │   └─ 1 Signature Request Yousign
    │       └─ 1 PDF neutre ("Consentement doc_authorization_v1")
    │       └─ 2 Signers
    ├─ Document 2 (Consentement Éclairé)
    │   └─ 1 Signature Request Yousign
    │       └─ 1 PDF neutre ("Consentement doc_consent_v2")
    │       └─ 2 Signers
    └─ Document 3 (Honoraires)
        └─ 1 Signature Request Yousign
            └─ 1 PDF neutre ("Consentement doc_fees_v1")
            └─ 2 Signers
```

**Modifications à faire** :
1. Créer modèle `DocumentSignature` (1 par document)
2. Migrer `yousign_procedure_id` de `ProcedureCase` vers `DocumentSignature`
3. Adapter `initiate_consent()` pour accepter `document_type`
4. Créer 3 endpoints distincts :
   - `/signature/start-authorization`
   - `/signature/start-consent`
   - `/signature/start-fees`

---

### 🟠 IMPORTANT : Pseudonymisation des signataires
**Objectif** : Yousign ne doit pas connaître l'identité réelle des parents

**Modifications** :
```python
# AVANT
signers.append({
    "first_name": case.parent1_first_name,  # "Jean"
    "last_name": case.parent1_last_name,    # "Dupont"
})

# APRÈS
signers.append({
    "first_name": "Parent",
    "last_name": "1",
    "info": {
        "custom_note": f"Signataire référencé comme PARENT_1 dans dossier {case.id}"
    }
})
```

---

### 🟠 IMPORTANT : Neutralisation des emails/SMS
**Objectif** : Ne jamais mentionner le nom de l'enfant dans les communications

**Modifications** :
```python
# AVANT
f"Vous pouvez signer le consentement pour {child_full_name}.\n"

# APRÈS
f"Vous avez un document médical à signer électroniquement.\n"
f"Référence : {consent_id}\n"  # UUID anonyme
```

---

### 🟡 MOYEN : Logs sécurisés
**Objectif** : Ne jamais logger de PII (Personally Identifiable Information)

**Modifications** :
```python
# AVANT
logger.info("initiate_consent -> signers=%s", procedure.signers)

# APRÈS
logger.info("initiate_consent -> procedure_id=%s signer_count=%d", procedure.procedure_id, len(procedure.signers))
```

---

## Checklist de conformité DPIA

### ✅ Déjà conforme
- [x] PDF neutre sans données médicales
- [x] Purge automatique Yousign après signature complète
- [x] Recomposition locale en HDS
- [x] Stockage long terme exclusivement en HDS
- [x] Hashing SHA-256 du consentement médical

### ⚠️ Partiellement conforme
- [ ] Pseudonymisation des signataires (noms réels envoyés)
- [ ] Neutralisation des notifications (nom enfant dans email/SMS)
- [ ] Logs sécurisés (PII parfois loggué)

### 🔴 Non conforme
- [ ] **Signatures granulaires par document** (CRITIQUE)
- [ ] Traçabilité document-par-document
- [ ] Purge par document (actuellement purge globale)

---

## Plan d'action recommandé

### Phase 1 : URGENT (Conformité juridique)
1. Implémenter architecture signatures granulaires
2. Migrer modèle de données (`DocumentSignature`)
3. Créer endpoints par document
4. Tests de non-régression

### Phase 2 : IMPORTANT (Minimisation RGPD)
1. Pseudonymiser signataires Yousign
2. Neutraliser emails/SMS
3. Sécuriser logs applicatifs

### Phase 3 : OPTIMISATION (UX + RGPD)
1. Accordéons frontend (plan déjà défini)
2. Toggle parent XXL
3. Progression granulaire par document

---

## Estimation impact migration

### Modifications backend (5-7 jours)
- Nouvelle table `document_signatures`
- Migration `yousign_procedure_id` vers table granulaire
- Adapter services `consents.py` + `consent_pdf.py`
- Endpoints API par document
- Webhooks Yousign par document

### Modifications frontend (3-4 jours)
- Refactoriser `LegalDocumentCard` pour signatures individuelles
- Adapter `SignatureActions` avec état par document
- Mise à jour mappers/VM

### Tests & validation (2-3 jours)
- Tests unitaires backend
- Tests E2E signature complète
- Validation juridique des PDFs

**Total estimé** : 10-14 jours

---

## Risques identifiés

### Risque 1 : Régression UX
**Probabilité** : Moyenne
**Impact** : Faible
**Mitigation** : Tests utilisateurs avant déploiement

### Risque 2 : Perte de données en migration
**Probabilité** : Faible
**Impact** : CRITIQUE
**Mitigation** :
- Backup complet avant migration
- Script de migration testé en staging
- Rollback plan documenté

### Risque 3 : Incompatibilité Yousign API v3
**Probabilité** : Faible
**Impact** : Moyen
**Mitigation** :
- Validation avec sandbox Yousign
- Tests mock mode avant production

---

## Conclusion

**État actuel** : Architecture fonctionnelle mais non conforme RGPD/juridique pour signatures granulaires.

**Priorité absolue** : Implémenter signatures par document (conformité juridique).

**Conformité DPIA** : 70% conforme (minimisation OK, granularité KO).

**Recommandation** : Bloquer déploiement production tant que signatures granulaires non implémentées.
