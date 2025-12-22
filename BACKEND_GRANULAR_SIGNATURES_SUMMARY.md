# Backend - Signatures Granulaires : Récapitulatif

## ✅ Travail accompli

### 1. **Architecture & Documentation**
- [AUDIT_YOUSIGN_RGPD.md](AUDIT_YOUSIGN_RGPD.md) : Audit complet RGPD/HDS
- [ARCHITECTURE_GRANULAR_SIGNATURES.md](ARCHITECTURE_GRANULAR_SIGNATURES.md) : Architecture détaillée

### 2. **Modèle de données**
**Fichier** : [backend/models.py](backend/models.py)

```python
class DocumentSignatureStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    partially_signed = "partially_signed"
    completed = "completed"
    expired = "expired"
    cancelled = "cancelled"

class DocumentSignature(Base):
    # 1 DocumentSignature = 1 type de document (authorization/consent/fees)
    procedure_case_id: int  # FK → ProcedureCase
    document_type: str      # "authorization", "consent", "fees"
    yousign_procedure_id: str  # SR Yousign unique par document

    # Parent 1 + Parent 2 (statut indépendant)
    parent1_status, parent1_signature_link, parent1_signed_at
    parent2_status, parent2_signature_link, parent2_signed_at

    # Artefacts HDS
    signed_pdf_identifier, evidence_pdf_identifier, final_pdf_identifier

    # Métadonnées
    overall_status: DocumentSignatureStatus
    completed_at, yousign_purged_at
```

**Relation ajoutée** :
```python
ProcedureCase.document_signatures = relationship(
    "DocumentSignature",
    cascade="all,delete-orphan"
)
```

---

### 3. **Migration Alembic**
**Fichier** : [backend/migrations/versions/20241222_add_document_signatures.py](backend/migrations/versions/20241222_add_document_signatures.py)

✅ **Exécutée** : `alembic upgrade head`

**Actions** :
- Création table `document_signatures`
- Migration automatique des consentements existants → DocumentSignature (type="consent", version="legacy")
- Flag `legacy_consent_migrated` sur ProcedureCase
- Indexes de performance (procedure_case_id, document_type, yousign_procedure_id)

---

### 4. **Schémas Pydantic**
**Fichier** : [backend/schemas.py](backend/schemas.py#L469-L551)

```python
# Request/Response
DocumentSignatureStartRequest(procedure_case_id, document_type, signer_role, mode)
DocumentSignatureStartResponse(document_signature_id, signature_link, yousign_procedure_id)

# Detail
DocumentSignatureDetail(
    id, document_type, overall_status,
    parent1_status, parent1_signature_link, parent1_signed_at,
    parent2_status, parent2_signature_link, parent2_signed_at,
    signed_pdf_identifier, evidence_pdf_identifier, final_pdf_identifier,
    yousign_purged_at
)

# Summary
CaseDocumentSignaturesSummary(
    procedure_case_id,
    document_signatures: List[DocumentSignatureDetail]
)
```

---

### 5. **Service backend**
**Fichier** : [backend/services/document_signature_service.py](backend/services/document_signature_service.py)

#### Fonctions principales

**`initiate_document_signature()`**
```python
def initiate_document_signature(
    db: Session,
    *,
    procedure_case_id: int,
    document_type: str,  # "authorization", "consent", "fees"
    in_person: bool = False,
) -> DocumentSignature:
    """
    Workflow:
    1. Récupère ProcedureCase
    2. Génère PDF neutre SPÉCIFIQUE au document_type
    3. Crée Signature Request Yousign (1 SR = 1 document)
    4. Persiste DocumentSignature en DB
    5. Envoie notifications (RGPD: messages neutres)
    """
```

**RGPD** :
- Pseudonymisation : `first_name="Parent"`, `last_name="1"`
- Messages neutres : "Vous avez un document médical à signer : Autorisation d'intervention"
- Pas de nom d'enfant dans email/SMS

**`update_document_signature_status()`**
```python
def update_document_signature_status(
    db: Session,
    document_signature_id: int,
    *,
    parent_label: str,  # "parent1" ou "parent2"
    status_value: str,  # "signed"
    signed_at: Optional[datetime] = None,
    ...
) -> DocumentSignature:
    """
    Workflow (appelé par webhook Yousign):
    1. Met à jour parent1/2_status
    2. Si 2 parents signés:
        a. Télécharge artefacts Yousign
        b. Stocke en HDS (signed_pdf, evidence_pdf)
        c. Recompose PDF final (médical + preuves)
        d. Purge Yousign (permanent_delete)
        e. Marque overall_status = "completed"
    """
```

**`purge_document_signature()`**
```python
def purge_document_signature(doc_sig: DocumentSignature) -> None:
    """
    RGPD: Suppression permanente chez Yousign après récupération locale.
    """
    client.delete_signature_request(
        doc_sig.yousign_procedure_id,
        permanent_delete=True
    )
```

---

### 6. **Adaptation consent_pdf.py**
**Fichier** : [backend/services/consent_pdf.py](backend/services/consent_pdf.py)

**Nouvelle fonction** :
```python
def render_neutral_document_pdf(
    document_type: str,           # "authorization", "consent", "fees"
    consent_id: str,
    document_version: Optional[str] = None,
    consent_hash: Optional[str] = None,
) -> Path:
    """
    Génère PDF neutre SPÉCIFIQUE au document_type.

    Exemples de contenu:
    - "Je confirme mon consentement pour le document AUTORISATION D'INTERVENTION"
    - "Je confirme mon consentement pour le document CONSENTEMENT ÉCLAIRÉ"
    - "Je confirme mon consentement pour le document HONORAIRES"

    Référence: {consent_id}-{document_type}-{version}
    """
```

**Template HTML** : [backend/templates/consent_neutral_document.html](backend/templates/consent_neutral_document.html)

**Assemblage granulaire** :
```python
def compose_final_document_consent(
    *,
    full_consent_id: str,
    document_type: str,  # NOUVEAU
    case_id: int,
    signed_ids: list[str],
    evidence_ids: list[str],
) -> Optional[str]:
    """
    Assemble:
    1. PDF médical du document_type
    2. Audit trail Yousign
    3. PDF neutre signé

    Nom fichier: {case_id}-{document_type}-final-{uuid}.pdf
    """
```

---

### 7. **Routes API**
**Fichier** : [backend/routes/document_signature.py](backend/routes/document_signature.py)

#### Endpoints créés

**POST `/api/signature/start-document`**
```python
def start_document_signature(
    payload: DocumentSignatureStartRequest,
    ...
) -> DocumentSignatureStartResponse:
    """
    Démarre signature pour UN document spécifique.

    Body:
    {
        "procedure_case_id": 123,
        "document_type": "authorization",  # ou "consent", "fees"
        "signer_role": "parent1",
        "mode": "remote"  # ou "cabinet"
    }

    Response:
    {
        "document_signature_id": 456,
        "document_type": "authorization",
        "signature_link": "https://yousign.app/...",
        "yousign_procedure_id": "sr_...",
        "status": "sent"
    }
    ```
"""
```

**GET `/api/signature/document/{document_signature_id}`**
```python
def get_document_signature_status(...) -> DocumentSignatureDetail:
    """Récupère statut d'une signature de document."""
```

**GET `/api/signature/case/{procedure_case_id}/documents`**
```python
def get_case_document_signatures(...) -> CaseDocumentSignaturesSummary:
    """
    Liste TOUTES les signatures de documents pour un case.

    Response:
    {
        "procedure_case_id": 123,
        "document_signatures": [
            {
                "id": 1,
                "document_type": "authorization",
                "overall_status": "completed",
                "parent1_status": "signed",
                "parent2_status": "signed",
                ...
            },
            {
                "id": 2,
                "document_type": "consent",
                "overall_status": "sent",
                "parent1_status": "sent",
                "parent2_status": "pending",
                ...
            },
            ...
        ]
    }
    """
```

**POST `/api/signature/webhook/yousign-document`**
```python
def handle_yousign_document_webhook(payload: dict, ...) -> dict:
    """
    Webhook Yousign granulaire.

    Flow:
    1. Extrait yousign_procedure_id
    2. Recherche DocumentSignature correspondant
    3. Si event = "signer.signed":
        a. Identifie parent1 ou parent2
        b. Appelle update_document_signature_status()
        c. Déclenche téléchargement + assemblage + purge si complet
    """
```

---

## 🔐 Conformité RGPD/HDS

### ✅ PDF Neutre par document
- Chaque document a son propre PDF neutre
- Contenu : "Je confirme mon consentement pour le document {TYPE}"
- Référence : `{case_id}-{document_type}-{version}`
- Hash SHA-256 du PDF médical complet (optionnel)

### ✅ Pseudonymisation
```python
signers.append({
    "label": "parent1",
    "email": email,
    "phone": phone,
    "first_name": "Parent",  # Pseudonyme
    "last_name": "1",        # Pseudonyme
})
```

### ✅ Messages neutres
```python
# AVANT (non conforme)
f"Vous pouvez signer le consentement pour {child_full_name}."

# APRÈS (conforme)
f"Vous avez un document médical à signer : {doc_label}.\n"
f"Référence : {case.id}-{document_type}"
```

### ✅ Purge automatique
```python
if both_signed:
    # Télécharger artefacts
    _download_and_store_artifacts(...)

    # Assembler package final HDS
    _assemble_final_document(...)

    # Purge Yousign (permanent_delete)
    purge_document_signature(doc_sig)
    doc_sig.yousign_purged_at = datetime.utcnow()
```

### ✅ Traçabilité granulaire
- 1 DocumentSignature = 1 document médical
- Version du document traçée
- Horodatage par signataire
- Audit trail par document

---

## 🧪 Tests recommandés

### Tests unitaires
```python
def test_create_document_signature():
    doc_sig = initiate_document_signature(
        db, procedure_case_id=1, document_type="authorization"
    )
    assert doc_sig.document_type == "authorization"
    assert doc_sig.overall_status == DocumentSignatureStatus.sent

def test_update_parent1_signed():
    update_document_signature_status(
        db, doc_sig.id, parent_label="parent1", status_value="signed"
    )
    assert doc_sig.parent1_status == "signed"
    assert doc_sig.overall_status == DocumentSignatureStatus.partially_signed

def test_both_parents_signed_triggers_purge():
    # Parent 1 signe
    update_document_signature_status(..., parent_label="parent1", ...)
    # Parent 2 signe
    update_document_signature_status(..., parent_label="parent2", ...)

    # Vérifications
    assert doc_sig.overall_status == DocumentSignatureStatus.completed
    assert doc_sig.yousign_purged_at is not None
    assert doc_sig.final_pdf_identifier is not None
```

### Tests d'intégration
```bash
# 1. Démarrer signatures pour 3 documents
POST /api/signature/start-document {"document_type": "authorization", ...}
POST /api/signature/start-document {"document_type": "consent", ...}
POST /api/signature/start-document {"document_type": "fees", ...}

# 2. Simuler webhooks Yousign
POST /api/signature/webhook/yousign-document {
    "event_name": "signer.signed",
    "signature_request": {"id": "sr_..."},
    "signer": {"id": "signer_..."}
}

# 3. Vérifier statut granulaire
GET /api/signature/case/123/documents
```

---

## 📊 Compatibilité backward

### Migration des anciennes signatures
- Table `procedure_cases` conserve les colonnes legacy (deprecated)
- Flag `legacy_consent_migrated` = true après migration
- Anciennes signatures converties en DocumentSignature (type="consent", version="legacy")

### Endpoints legacy
- `/api/signature/start` : Garde compatibilité temporaire
- Peut wrapper les 3 appels à `/api/signature/start-document` si nécessaire

---

## 🚀 Déploiement

### Prérequis
1. ✅ Migration Alembic exécutée : `alembic upgrade head`
2. Template HTML créé : `backend/templates/consent_neutral_document.html`
3. Router intégré : `routes/__init__.py` → `document_signature_router`

### Vérifications post-déploiement
```bash
# Vérifier migration
SELECT COUNT(*) FROM document_signatures WHERE document_type = 'consent' AND document_version = 'legacy';

# Tester endpoint
curl -X POST http://localhost:8000/api/signature/start-document \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "procedure_case_id": 1,
    "document_type": "authorization",
    "signer_role": "parent1",
    "mode": "remote"
  }'

# Vérifier webhook
curl -X POST http://localhost:8000/api/signature/webhook/yousign-document \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "signer.signed",
    "signature_request": {"id": "sr_xxx"},
    "signer": {"id": "signer_xxx"}
  }'
```

---

## 📝 TODO Frontend (Option C)

### Adaptations nécessaires

1. **Mapper backend → frontend**
```javascript
// Nouveau format VM
{
  procedureCase: {
    id: 123,
    document_signatures: [
      { id: 1, document_type: "authorization", overall_status: "completed", ... },
      { id: 2, document_type: "consent", overall_status: "sent", ... },
      { id: 3, document_type: "fees", overall_status: "draft", ... }
    ]
  }
}
```

2. **Composant LegalDocumentCard** (accordéon)
```jsx
<LegalDocumentCard
  doc={doc}  // Catalog document
  docSignature={procedureCase.document_signatures.find(s => s.document_type === doc.docType)}
  onStartSignature={(docType, role, mode) => startDocumentSignature(...)}
/>
```

3. **API client**
```javascript
export async function startDocumentSignature({ token, procedureCaseId, documentType, signerRole, mode }) {
  return apiRequest('/signature/start-document', {
    method: 'POST',
    token,
    body: { procedure_case_id: procedureCaseId, document_type: documentType, signer_role: signerRole, mode }
  });
}

export async function getCaseDocumentSignatures({ token, procedureCaseId }) {
  return apiRequest(`/signature/case/${procedureCaseId}/documents`, { token });
}
```

---

## ✅ Checklist finale backend

- [x] Modèle `DocumentSignature` créé
- [x] Migration Alembic exécutée
- [x] Service `document_signature_service.py` implémenté
- [x] Adaptation `consent_pdf.py` (PDF neutres + assemblage granulaire)
- [x] Template HTML `consent_neutral_document.html`
- [x] Schémas Pydantic complets
- [x] Routes API granulaires (`/start-document`, `/document/{id}`, `/case/{id}/documents`, `/webhook`)
- [x] Router intégré dans `main.py`
- [x] Pseudonymisation signataires
- [x] Messages neutres (pas de PHI)
- [x] Purge automatique Yousign par document
- [x] Tests unitaires recommandés documentés

**Statut** : ✅ **Backend 100% complété**

**Prochaine étape** : Frontend (Option C) - Accordéons + signatures granulaires
