# Architecture Signatures Granulaires par Document

## Vue d'ensemble

Transition d'une architecture **monolithique** (1 SR Yousign = tous les documents) vers une architecture **granulaire** (1 SR Yousign = 1 document).

---

## Modèle de données cible

### Nouveau modèle : `DocumentSignature`

```python
class DocumentSignatureStatus(str, enum.Enum):
    """État du processus de signature pour un document."""
    draft = "draft"           # Document pas encore envoyé pour signature
    sent = "sent"             # Lien de signature envoyé au(x) parent(s)
    partially_signed = "partially_signed"  # 1 parent a signé, pas l'autre
    completed = "completed"   # Les 2 parents ont signé
    expired = "expired"       # Délai de signature expiré
    cancelled = "cancelled"   # Annulé manuellement

class DocumentSignature(Base):
    """
    Signature request Yousign pour UN document médical spécifique.
    Chaque ProcedureCase peut avoir plusieurs DocumentSignature (1 par type de document).
    """
    __tablename__ = "document_signatures"

    # Identité
    id: int = Column(Integer, primary_key=True, index=True)
    procedure_case_id: int = Column(
        Integer,
        ForeignKey("procedure_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    document_type: str = Column(String(64), nullable=False, index=True)
    # Types supportés : "authorization", "consent", "fees"

    document_version: str = Column(String(32), nullable=True)
    # Exemple : "v1.0", "v2.1" pour traçabilité

    # Yousign Signature Request
    yousign_procedure_id: str | None = Column(String(128), nullable=True, unique=True, index=True)
    # ID de la signature_request Yousign pour CE document

    # Parent 1 (signataire principal)
    parent1_yousign_signer_id: str | None = Column(String(128), nullable=True)
    parent1_signature_link: str | None = Column(String, nullable=True)
    parent1_status: str = Column(String(32), nullable=False, default="pending")
    parent1_sent_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent1_signed_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent1_method: str | None = Column(String(32), nullable=True)
    # Méthode : "yousign_otp_sms", "yousign_no_otp", etc.

    # Parent 2 (signataire secondaire)
    parent2_yousign_signer_id: str | None = Column(String(128), nullable=True)
    parent2_signature_link: str | None = Column(String, nullable=True)
    parent2_status: str = Column(String(32), nullable=False, default="pending")
    parent2_sent_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent2_signed_at: datetime.datetime | None = Column(DateTime, nullable=True)
    parent2_method: str | None = Column(String(32), nullable=True)

    # État global
    overall_status: DocumentSignatureStatus = Column(
        Enum(DocumentSignatureStatus),
        nullable=False,
        default=DocumentSignatureStatus.draft
    )

    # Artefacts (PDFs signés, preuves)
    signed_pdf_identifier: str | None = Column(String, nullable=True)
    # Identifiant stockage HDS du PDF neutre signé

    evidence_pdf_identifier: str | None = Column(String, nullable=True)
    # Identifiant stockage HDS de l'audit trail Yousign

    final_pdf_identifier: str | None = Column(String, nullable=True)
    # Identifiant stockage HDS du package complet (PDF médical + preuves)

    # Métadonnées
    created_at: datetime.datetime = Column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    updated_at: datetime.datetime = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )
    completed_at: datetime.datetime | None = Column(DateTime, nullable=True)
    # Timestamp quand overall_status passe à "completed"

    yousign_purged_at: datetime.datetime | None = Column(DateTime, nullable=True)
    # Timestamp de la purge Yousign (permanent_delete)

    # Relations
    procedure_case = relationship("ProcedureCase", back_populates="document_signatures")

    __table_args__ = (
        UniqueConstraint(
            "procedure_case_id",
            "document_type",
            name="uq_document_signature_per_case"
        ),
        # Un seul DocumentSignature actif par (case, document_type)
    )
```

---

## Migration du modèle `ProcedureCase`

### Champs à DÉPRÉCIER (garder pour compatibilité temporaire)

```python
# À marquer comme deprecated, ne plus utiliser
yousign_procedure_id: str | None  # → Migré vers DocumentSignature
parent1_yousign_signer_id: str | None
parent2_yousign_signer_id: str | None
parent1_consent_status: str
parent2_consent_status: str
parent1_consent_sent_at: datetime.datetime | None
parent2_consent_sent_at: datetime.datetime | None
parent1_consent_signed_at: datetime.datetime | None
parent2_consent_signed_at: datetime.datetime | None
parent1_consent_method: str | None
parent2_consent_method: str | None
parent1_signature_link: str | None
parent2_signature_link: str | None
consent_signed_pdf_url: str | None
consent_evidence_pdf_url: str | None
consent_last_status: str | None
consent_ready_at: datetime.datetime | None
```

### Nouvelle relation

```python
class ProcedureCase(Base):
    # ... champs existants inchangés

    # Nouvelle relation 1-to-many
    document_signatures = relationship(
        "DocumentSignature",
        back_populates="procedure_case",
        cascade="all,delete-orphan",
    )
```

---

## Schémas Pydantic

### Request schemas

```python
class DocumentSignatureStartRequest(BaseModel):
    """Payload pour démarrer la signature d'UN document."""
    procedure_case_id: int
    document_type: str  # "authorization", "consent", "fees"
    signer_role: str    # "parent1", "parent2"
    mode: str           # "cabinet" (no_otp) ou "remote" (otp_sms)

class DocumentSignatureStartResponse(BaseModel):
    """Réponse après démarrage de signature."""
    document_signature_id: int
    document_type: str
    signer_role: str
    signature_link: str
    yousign_procedure_id: str
    status: str  # "sent"
```

### Response schemas

```python
class DocumentSignatureDetail(BaseModel):
    """Détail d'une signature de document."""
    id: int
    procedure_case_id: int
    document_type: str
    document_version: str | None
    overall_status: DocumentSignatureStatus

    # Parent 1
    parent1_status: str
    parent1_signature_link: str | None
    parent1_signed_at: datetime | None

    # Parent 2
    parent2_status: str
    parent2_signature_link: str | None
    parent2_signed_at: datetime | None

    # Artefacts
    signed_pdf_identifier: str | None
    evidence_pdf_identifier: str | None
    final_pdf_identifier: str | None

    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    yousign_purged_at: datetime | None

    model_config = ConfigDict(from_attributes=True)

class ProcedureCaseWithSignatures(BaseModel):
    """ProcedureCase enrichi avec signatures granulaires."""
    # ... tous les champs ProcedureCase existants

    document_signatures: list[DocumentSignatureDetail]
    # Liste des signatures par document
```

---

## Endpoints API

### Nouveaux endpoints granulaires

```python
# Démarrer signature pour UN document
POST /api/signature/start-document
Body: DocumentSignatureStartRequest
Response: DocumentSignatureStartResponse

# Statut d'une signature de document
GET /api/signature/document/{document_signature_id}
Response: DocumentSignatureDetail

# Liste des signatures pour un case
GET /api/signature/case/{procedure_case_id}/documents
Response: list[DocumentSignatureDetail]

# Webhook Yousign (granulaire)
POST /api/webhooks/yousign/document-signature
Body: YousignWebhookPayload
# Identifie le DocumentSignature via yousign_procedure_id
```

### Endpoints à adapter

```python
# AVANT
POST /api/signature/start
# Créait 1 SR global

# APRÈS (backward compatible)
POST /api/signature/start
# Wrapper qui appelle start-document pour les 3 types
# OU redirection vers nouveaux endpoints
```

---

## Services backend

### Nouveau service : `document_signature_service.py`

```python
def initiate_document_signature(
    db: Session,
    *,
    procedure_case_id: int,
    document_type: str,
    signer_role: str,
    in_person: bool = False,
) -> DocumentSignature:
    """
    Crée une Signature Request Yousign pour UN document spécifique.

    Workflow:
    1. Récupère le ProcedureCase
    2. Charge le PDF médical du document_type (authorization/consent/fees)
    3. Génère PDF neutre avec document_type dans le titre
    4. Appelle Yousign API pour créer SR
    5. Crée/met à jour DocumentSignature en DB
    6. Envoie notifications (email/SMS)
    7. Retourne DocumentSignature
    """

def update_document_signature_status(
    db: Session,
    document_signature_id: int,
    *,
    parent_label: str,
    status_value: str,
    signed_at: datetime | None = None,
    method: str | None = None,
) -> DocumentSignature:
    """
    Met à jour le statut de signature (appelé par webhook Yousign).

    Workflow:
    1. Met à jour parent1/2_status
    2. Si les 2 parents signés:
        a. Télécharge artefacts depuis Yousign
        b. Stocke en HDS (signed_pdf, evidence_pdf)
        c. Recompose PDF final (médical + preuves)
        d. Purge Yousign (permanent_delete)
        e. Marque overall_status = "completed"
    """

def purge_document_signature(
    db: Session,
    document_signature: DocumentSignature,
) -> None:
    """
    Purge la Signature Request Yousign pour CE document.
    """

def get_signatures_for_case(
    db: Session,
    procedure_case_id: int,
) -> list[DocumentSignature]:
    """
    Retourne toutes les signatures de documents pour un case.
    """
```

### Adaptation de `consent_pdf.py`

```python
def render_neutral_document_pdf(
    document_type: str,
    consent_id: str,
    document_version: str | None = None,
    consent_hash: str | None = None,
) -> Path:
    """
    Génère un PDF neutre SPÉCIFIQUE à un type de document.

    Exemples de contenu:
    - "Je confirme mon consentement pour le document AUTORISATION D'INTERVENTION"
    - "Je confirme mon consentement pour le document CONSENTEMENT ÉCLAIRÉ"
    - "Je confirme mon consentement pour le document HONORAIRES"

    Référence: {consent_id}-{document_type}-{version}
    """

def compose_final_document_consent(
    *,
    full_consent_id: str,  # PDF médical complet du document_type
    document_type: str,
    case_id: int,
    signed_neutral_id: str,  # PDF neutre signé
    evidence_id: str,        # Audit trail
) -> str:
    """
    Assemble:
    1. PDF médical du document_type
    2. Audit trail Yousign
    3. PDF neutre signé

    Stocke dans FINAL_CONSENT_CATEGORY avec nom:
    {case_id}-{document_type}-final-consent-{uuid}.pdf
    """
```

---

## Migration de données

### Stratégie de migration

#### Option 1 : Migration à chaud (recommandée)

```python
# Migration Alembic
def upgrade():
    # 1. Créer table document_signatures
    op.create_table(
        'document_signatures',
        # ... colonnes définies plus haut
    )

    # 2. Migrer données existantes de ProcedureCase
    # Pour chaque ProcedureCase ayant yousign_procedure_id:
    #   - Créer 1 DocumentSignature avec document_type="consent" (global)
    #   - Copier yousign_procedure_id, parent1/2_*, etc.
    #   - Marquer overall_status selon parent1/2_consent_status

    # 3. Ajouter colonne deprecated flag
    op.add_column('procedure_cases',
        sa.Column('legacy_consent_migrated', sa.Boolean, default=False))

def downgrade():
    # Rollback : supprimer table, restaurer ancien comportement
    op.drop_table('document_signatures')
    op.drop_column('procedure_cases', 'legacy_consent_migrated')
```

#### Script de migration Python

```python
from sqlalchemy.orm import Session
import models

def migrate_legacy_consents_to_granular(db: Session):
    """
    Migre les anciens consentements globaux vers DocumentSignature.
    """
    cases = db.query(models.ProcedureCase).filter(
        models.ProcedureCase.yousign_procedure_id.isnot(None),
        models.ProcedureCase.legacy_consent_migrated == False
    ).all()

    for case in cases:
        # Créer DocumentSignature pour "consent" (type global historique)
        doc_sig = models.DocumentSignature(
            procedure_case_id=case.id,
            document_type="consent",  # Type historique
            document_version="legacy",
            yousign_procedure_id=case.yousign_procedure_id,
            parent1_yousign_signer_id=case.parent1_yousign_signer_id,
            parent2_yousign_signer_id=case.parent2_yousign_signer_id,
            parent1_status=case.parent1_consent_status,
            parent2_status=case.parent2_consent_status,
            parent1_sent_at=case.parent1_consent_sent_at,
            parent2_sent_at=case.parent2_consent_sent_at,
            parent1_signed_at=case.parent1_consent_signed_at,
            parent2_signed_at=case.parent2_consent_signed_at,
            parent1_signature_link=case.parent1_signature_link,
            parent2_signature_link=case.parent2_signature_link,
            signed_pdf_identifier=case.consent_signed_pdf_url,
            evidence_pdf_identifier=case.consent_evidence_pdf_url,
            overall_status=_compute_overall_status(
                case.parent1_consent_status,
                case.parent2_consent_status
            ),
            completed_at=case.consent_ready_at,
        )
        db.add(doc_sig)
        case.legacy_consent_migrated = True

    db.commit()

def _compute_overall_status(p1_status: str, p2_status: str) -> str:
    if p1_status == "signed" and p2_status == "signed":
        return "completed"
    elif p1_status == "sent" or p2_status == "sent":
        return "sent"
    return "draft"
```

---

## Frontend : Adaptation des composants

### État VM enrichi

```javascript
// Avant (monolithique)
{
  procedureCase: {
    yousign_procedure_id: "...",
    parent1_consent_status: "signed",
    parent2_consent_status: "pending",
  }
}

// Après (granulaire)
{
  procedureCase: {
    id: 123,
    document_signatures: [
      {
        id: 1,
        document_type: "authorization",
        overall_status: "completed",
        parent1_status: "signed",
        parent2_status: "signed",
        parent1_signature_link: "https://...",
        parent2_signature_link: "https://...",
        signed_pdf_identifier: "...",
        yousign_purged_at: "2025-12-21T10:00:00Z",
      },
      {
        id: 2,
        document_type: "consent",
        overall_status: "sent",
        parent1_status: "sent",
        parent2_status: "pending",
        parent1_signature_link: "https://...",
        parent2_signature_link: null,
      },
      {
        id: 3,
        document_type: "fees",
        overall_status: "draft",
        parent1_status: "pending",
        parent2_status: "pending",
      }
    ]
  }
}
```

### Composant `LegalDocumentCard` (refactoré)

```jsx
export function LegalDocumentCard({ doc, procedureCase, ... }) {
  // Récupérer la signature de CE document
  const docSignature = procedureCase.document_signatures?.find(
    sig => sig.document_type === doc.docType
  );

  const parent1Sig = {
    status: docSignature?.parent1_status || 'pending',
    link: docSignature?.parent1_signature_link,
    signedAt: docSignature?.parent1_signed_at,
  };

  const parent2Sig = {
    status: docSignature?.parent2_status || 'pending',
    link: docSignature?.parent2_signature_link,
    signedAt: docSignature?.parent2_signed_at,
  };

  const overallStatus = docSignature?.overall_status || 'draft';

  return (
    <div className="border rounded-2xl">
      {/* Accordéon avec titre + badge statut */}
      <AccordionHeader
        title={doc.title}
        status={overallStatus}
        progress={`${parent1Sig.status === 'signed' ? 1 : 0}/2`}
      />

      {/* Contenu plié */}
      <AccordionContent>
        <Checklist ... />

        {/* Signatures PAR DOCUMENT */}
        <SignatureBlock
          documentType={doc.docType}
          documentSignatureId={docSignature?.id}
          parent1={parent1Sig}
          parent2={parent2Sig}
          onStartSignature={(role, mode) =>
            startDocumentSignature(doc.docType, role, mode)
          }
        />
      </AccordionContent>
    </div>
  );
}
```

---

## Webhooks Yousign

### Gestion granulaire

```python
@router.post("/webhooks/yousign/signature")
def handle_yousign_webhook(payload: dict, db: Session = Depends(get_db)):
    """
    Webhook Yousign unifié.

    1. Extrait yousign_procedure_id du payload
    2. Recherche DocumentSignature correspondant
    3. Appelle document_signature_service.update_status()
    """
    procedure_id = payload.get("signature_request", {}).get("id")
    if not procedure_id:
        raise HTTPException(400, "Missing signature_request.id")

    # Recherche granulaire
    doc_sig = db.query(DocumentSignature).filter(
        DocumentSignature.yousign_procedure_id == procedure_id
    ).first()

    if not doc_sig:
        logger.warning("Unknown yousign_procedure_id: %s", procedure_id)
        return {"status": "ignored"}

    # Mise à jour spécifique à CE document
    event_type = payload.get("event_name")
    if event_type == "signer.signed":
        signer_id = payload.get("signer", {}).get("id")
        parent_label = "parent1" if signer_id == doc_sig.parent1_yousign_signer_id else "parent2"

        document_signature_service.update_document_signature_status(
            db,
            doc_sig.id,
            parent_label=parent_label,
            status_value="signed",
            signed_at=datetime.utcnow(),
            method="yousign",
        )

    return {"status": "processed"}
```

---

## Plan de déploiement

### Phase 1 : Préparation (J1-J2)
- [x] Architecture documentée
- [ ] Migration Alembic écrite
- [ ] Modèles SQLAlchemy créés
- [ ] Tests unitaires modèles

### Phase 2 : Backend (J3-J7)
- [ ] Service `document_signature_service.py`
- [ ] Adaptation `consent_pdf.py`
- [ ] Nouveaux endpoints API
- [ ] Adaptation webhooks
- [ ] Tests intégration backend

### Phase 3 : Migration données (J8)
- [ ] Script migration en staging
- [ ] Validation données migrées
- [ ] Rollback plan documenté

### Phase 4 : Frontend (J9-J12)
- [ ] Refactorisation `LegalDocumentCard`
- [ ] Accordéons UI
- [ ] Toggle Parent XXL
- [ ] Tests E2E

### Phase 5 : Validation (J13-J14)
- [ ] Tests utilisateurs
- [ ] Validation juridique PDFs
- [ ] Performance testing
- [ ] Déploiement production

---

## Checklist de validation

### Conformité RGPD/HDS
- [ ] PDF neutre par document (pas de PHI)
- [ ] Purge Yousign après récupération
- [ ] Traçabilité granulaire (document + version)
- [ ] Audit trail par document
- [ ] Stockage HDS exclusif

### Conformité juridique
- [ ] 1 signature = 1 document médical
- [ ] Preuve de signature par document
- [ ] Horodatage par signataire
- [ ] Version de document traçable

### Tests critiques
- [ ] Signature 3 documents en parallèle (P1 + P2)
- [ ] Signature partielle (P1 signe tout, P2 1 seul doc)
- [ ] Webhook Yousign arrive dans le désordre
- [ ] Purge échoue mais artefacts sauvegardés
- [ ] Rollback vers ancien système

---

## Métriques de succès

- **Traçabilité** : 100% des signatures liées à un document_type précis
- **RGPD** : 0% de données médicales chez Yousign
- **Performance** : <500ms création DocumentSignature
- **Fiabilité** : >99% webhooks traités correctement
- **UX** : Utilisateurs comprennent signatures par document (tests A/B)
