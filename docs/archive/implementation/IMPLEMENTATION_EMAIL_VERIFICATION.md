# Implémentation de la Vérification Email pour les Guardians

> Archive d'implémentation. Voir `docs/ETAT_PROJET.md` pour le statut courant.

## Vue d'ensemble

Ce document décrit l'implémentation complète de la vérification email pour les parents/tuteurs (guardians), permettant la signature électronique à distance.

## Architecture

### Principe

- **Parent 1** (compte utilisateur principal) : Email automatiquement vérifié via le système d'authentification existant
- **Parent 2** : Vérification via lien email avec token sécurisé (pattern similaire à l'inscription utilisateur)

### Modèle de données

#### Table `guardians`
```python
email_verified_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
```

#### Table `guardian_email_verifications`
```python
id: str (UUID)
guardian_id: str (FK → guardians.id)
email: str (255 chars)
token_hash: str (SHA256, 128 chars, unique, indexed)
expires_at: datetime (24h TTL)
status: str (sent|verified|expired)
sent_at: datetime
consumed_at: datetime (nullable)
ip_address: str (nullable, audit trail)
user_agent: str (nullable, audit trail)
```

## Backend Implementation

### 1. Migration
**Fichier** : `backend/migrations/versions/20241221_add_guardian_email_verification.py`

```python
def upgrade():
    # Ajouter colonne email_verified_at à guardians
    op.add_column('guardians',
        sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True))

    # Créer table guardian_email_verifications
    op.create_table(
        'guardian_email_verifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('guardian_id', sa.String(36), sa.ForeignKey('guardians.id', ondelete='CASCADE')),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token_hash', sa.String(128), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.String(512), nullable=True),
    )
    op.create_index('ix_gev_token_hash', 'guardian_email_verifications', ['token_hash'])
```

### 2. Modèles
**Fichier** : `backend/dossier/models.py`

```python
class EmailVerificationStatus(str, Enum):
    sent = "sent"
    verified = "verified"
    expired = "expired"

class Guardian(Base):
    # ... champs existants
    email_verified_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    email_verifications = relationship(
        "GuardianEmailVerification",
        back_populates="guardian",
        cascade="all, delete-orphan"
    )

class GuardianEmailVerification(Base):
    __tablename__ = "guardian_email_verifications"
    id: str = sa.Column(sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    guardian_id: str = sa.Column(sa.String(36), sa.ForeignKey("guardians.id", ondelete="CASCADE"))
    email: str = sa.Column(sa.String(255), nullable=False)
    token_hash: str = sa.Column(sa.String(128), nullable=False, unique=True, index=True)
    expires_at = sa.Column(sa.DateTime(timezone=True), nullable=False)
    status: str = sa.Column(sa.String(16), nullable=False)
    sent_at = sa.Column(sa.DateTime(timezone=True), nullable=False)
    consumed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)
    ip_address: str = sa.Column(sa.String(64), nullable=True)
    user_agent: str = sa.Column(sa.String(512), nullable=True)
    guardian = relationship("Guardian", back_populates="email_verifications")
```

### 3. Schémas Pydantic
**Fichier** : `backend/dossier/schemas.py`

```python
class Guardian(GuardianBase):
    id: str
    phone_verified_at: Optional[datetime] = None
    email_verified_at: Optional[datetime] = None  # Nouveau champ
    # ...

class EmailSendRequest(BaseModel):
    email: Optional[EmailStr] = None

class EmailSendResponse(BaseModel):
    status: str  # "sent"
    email: str   # Email où le lien a été envoyé

class EmailVerifyResponse(BaseModel):
    verified: bool
    verified_at: Optional[datetime] = None
```

### 4. Service de Vérification
**Fichier** : `backend/dossier/email_verification_service.py`

#### Constantes
```python
EMAIL_TOKEN_TTL_HOURS = 24  # Durée de validité du lien
```

#### Fonctions principales

**Génération de token sécurisé**
```python
def _random_token() -> str:
    """Génère un token sécurisé de 32 bytes URL-safe."""
    return secrets.token_urlsafe(32)

def _hash_token(token: str) -> str:
    """Hash SHA256 du token pour stockage en base."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
```

**Envoi de l'email de vérification**
```python
def send_email_verification(
    db: Session,
    guardian_id: str,
    current_user,
    *,
    email_override: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> Tuple[GuardianEmailVerification, str]:
    """
    1. Vérifie les droits d'accès (ownership via child.patient_id)
    2. Invalide les vérifications précédentes en attente
    3. Génère un token sécurisé
    4. Crée l'enregistrement GuardianEmailVerification
    5. Envoie l'email avec le lien de vérification
    6. Retourne (verification, email)
    """
```

**Vérification du token**
```python
def verify_email_token(
    db: Session,
    guardian_id: str,
    token: str,
    *,
    ip_address: str | None,
    user_agent: str | None,
) -> GuardianEmailVerification:
    """
    1. Hash le token et recherche en base
    2. Vérifie que le token n'a pas expiré
    3. Vérifie qu'il n'a pas déjà été utilisé
    4. Marque le guardian.email_verified_at
    5. Marque la verification comme consumed
    6. Retourne la verification

    Exceptions:
    - 404 si guardian introuvable
    - 400 si token invalide/expiré/utilisé
    """
```

### 5. Template Email
**Fichier** : `backend/services/email.py`

```python
def send_guardian_verification_email(
    to_email: str,
    guardian_name: str,
    child_name: str,
    verification_link: str,
) -> None:
    subject = f"[{app_name}] Vérifiez votre adresse e-mail"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Vérification de votre adresse e-mail</h2>

        <p>Bonjour <strong>{guardian_name}</strong>,</p>

        <p>Dans le cadre du dossier médical de <strong>{child_name}</strong>,
        nous avons besoin de vérifier votre adresse e-mail.</p>

        <p>Cette vérification vous permettra de :</p>
        <ul>
            <li>Signer électroniquement les documents médicaux à distance</li>
            <li>Recevoir les notifications importantes</li>
        </ul>

        <p style="text-align: center; margin: 30px 0;">
            <a href="{verification_link}"
               style="background-color: #3b82f6; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Vérifier mon adresse e-mail
            </a>
        </p>

        <p style="color: #666; font-size: 12px;">
            Ce lien est valide pendant 24 heures.
        </p>

        <p style="color: #666; font-size: 12px;">
            Si vous n'avez pas demandé cette vérification, ignorez cet e-mail.
        </p>
    </div>
    """

    send_email(subject, to_email, text_body, html_body=html_body)
```

### 6. Routes API
**Fichier** : `backend/routes/dossier.py`

#### POST `/dossier/guardians/{guardian_id}/email-verification/send`
```python
@router.post(
    "/guardians/{guardian_id}/email-verification/send",
    response_model=schemas.EmailSendResponse,
)
def send_email_verification(
    guardian_id: UUID,
    payload: schemas.EmailSendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> schemas.EmailSendResponse:
    """
    Envoie un email de vérification au guardian.

    Body: { "email": "optional@override.com" }

    Response: {
        "status": "sent",
        "email": "parent@example.com"
    }
    """
```

#### GET `/dossier/guardians/{guardian_id}/email-verification/verify?token=xxx`
```python
@router.get(
    "/guardians/{guardian_id}/email-verification/verify",
    response_model=schemas.EmailVerifyResponse,
)
def verify_email_token(
    guardian_id: UUID,
    token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.EmailVerifyResponse:
    """
    Vérifie le token email (appelé depuis le lien email).

    Query params: ?token=xxx

    Response: {
        "verified": true,
        "verified_at": "2024-12-21T10:30:00Z"
    }

    Note: Pas d'authentification requise (lien public avec token sécurisé)
    """
```

## Frontend Implementation

### 1. API Client
**Fichier** : `frontend/src/services/dossier.api.js`

```javascript
export async function sendGuardianEmailVerification({ token, guardianId, email } = {}) {
  if (!guardianId) {
    throw new Error('guardianId requis pour envoyer l\'email de vérification.');
  }
  return apiRequest(`/dossier/guardians/${guardianId}/email-verification/send`, {
    method: 'POST',
    token,
    body: { email },
  });
}
```

### 2. Hook useDossier
**Fichier** : `frontend/src/hooks/useDossier.js`

```javascript
const sendEmailVerification = async (role) => {
  const guardianId = vm?.guardians?.[role]?.id;
  if (!guardianId) {
    setError('Identifiant parent manquant.');
    return;
  }

  setError(null);
  setSuccess(null);

  try {
    const resp = await sendGuardianEmailVerification({
      token,
      guardianId,
      email: vm.guardians[role].email || undefined,
    });
    setSuccess(`Email de vérification envoyé à ${resp.email}`);
  } catch (err) {
    setError(err?.message || "Envoi de l'email impossible.");
  }
};

return {
  // ... exports existants
  sendEmailVerification,
};
```

### 3. Component GuardianForm
**Fichier** : `frontend/src/components/patient/dossier/GuardianForm.jsx`

#### Props
```javascript
export function GuardianForm({
  // ... props existantes
  // Nouvelles props pour vérification email
  onSendEmailVerification = null,
  sendingEmail = false,
  isUserAccount = false,        // true si Parent 1
  userEmailVerified = false,    // true si email user déjà vérifié
})
```

#### UI - Parent 1 (compte principal)
```jsx
{isUserAccount && isEmailVerified && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-2">
    <p className="text-xs text-green-800 flex items-center gap-1">
      <svg>✓</svg>
      Email vérifié (compte principal)
    </p>
  </div>
)}
```

#### UI - Parent 2 (email non vérifié)
```jsx
{!isUserAccount && onSendEmailVerification && !isEmailVerified && formState[`${prefix}Email`] && (
  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
    <div className="flex items-start gap-2">
      <svg className="h-4 w-4 text-purple-600">📧</svg>
      <p className="text-xs text-purple-800">
        La vérification email permet la signature électronique à distance.
      </p>
    </div>

    <button
      type="button"
      className="btn btn-sm btn-secondary w-full"
      onClick={onSendEmailVerification}
      disabled={sendingEmail}
    >
      {sendingEmail ? 'Envoi en cours...' : "Envoyer l'email de vérification"}
    </button>

    <p className="text-xs text-purple-700">
      📧 Un lien de vérification sera envoyé à {formState[`${prefix}Email`]}
    </p>
  </div>
)}
```

#### UI - Parent 2 (email vérifié)
```jsx
{!isUserAccount && isEmailVerified && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-2">
    <p className="text-xs text-green-800 flex items-center gap-1">
      <svg>✓</svg>
      Email vérifié - Signature électronique activée
    </p>
  </div>
)}
```

### 4. Page PatientTabDossier
**Fichier** : `frontend/src/pages/patient/PatientTabDossier.jsx`

```jsx
export function PatientTabDossier({ token, currentUser }) {
  const [sendingEmailRole, setSendingEmailRole] = useState(null);

  const handleSendEmailVerification = async (role) => {
    setSendingEmailRole(role);
    await dossier.sendEmailVerification(role);
    setSendingEmailRole(null);
  };

  return (
    <div className="space-y-4">
      {/* ... */}

      <GuardianForm
        title="Parent / Tuteur 1"
        prefix="parent1"
        // ... autres props
        isUserAccount={true}
        userEmailVerified={currentUser?.email_verified || false}
      />

      <GuardianForm
        title="Parent / Tuteur 2"
        prefix="parent2"
        // ... autres props
        onSendEmailVerification={() => handleSendEmailVerification('PARENT_2')}
        sendingEmail={sendingEmailRole === 'PARENT_2'}
      />
    </div>
  );
}
```

## Flux de Vérification

### Parent 1 (Compte utilisateur)
1. L'utilisateur crée son compte → email vérifié via système auth existant
2. `currentUser.email_verified` passe à `true`
3. GuardianForm affiche badge vert "Email vérifié (compte principal)"
4. **Aucune action requise** - vérification automatique

### Parent 2 (Guardian secondaire)
1. Utilisateur saisit email du Parent 2 dans formulaire
2. Clique sur "Envoyer l'email de vérification" (bouton violet)
3. Backend génère token sécurisé et envoie email
4. Parent 2 reçoit email avec lien : `https://app.example.com/api/dossier/guardians/{id}/email-verification/verify?token=xxx`
5. Parent 2 clique sur le lien
6. Backend vérifie token et met à jour `guardian.email_verified_at`
7. Page de confirmation affichée
8. Au prochain chargement du dossier, badge vert "Email vérifié - Signature électronique activée"

## Sécurité

### Token
- Généré via `secrets.token_urlsafe(32)` (256 bits d'entropie)
- Stocké hashé en SHA256 en base de données
- Token brut transmis une seule fois dans l'email
- Validité : 24 heures
- Usage unique (consumed_at vérifié)

### Audit Trail
- `ip_address` et `user_agent` enregistrés lors de l'envoi
- `ip_address` et `user_agent` enregistrés lors de la vérification
- Permet investigation en cas d'abus

### Invalidation
- Les tokens précédents en attente sont expirés lors d'un nouvel envoi
- Les tokens expirés/consommés retournent erreur 400

### Accès
- Envoi : nécessite authentification + ownership via `child.patient_id`
- Vérification : endpoint public mais nécessite le token secret

## Testing

### Backend
```bash
# Créer migration
alembic upgrade head

# Tests manuels via curl
curl -X POST http://localhost:8000/api/dossier/guardians/{guardian_id}/email-verification/send \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"email": "parent@example.com"}'

# Vérifier token (copier depuis email)
curl http://localhost:8000/api/dossier/guardians/{guardian_id}/email-verification/verify?token={token}
```

### Frontend
1. Connexion utilisateur (Parent 1)
2. Naviguer vers onglet "Dossier"
3. Vérifier badge vert sur Parent 1
4. Saisir email Parent 2
5. Cliquer "Envoyer l'email de vérification"
6. Vérifier console logs backend (email envoyé)
7. Copier lien depuis logs
8. Ouvrir lien dans navigateur
9. Vérifier page de confirmation
10. Rafraîchir onglet Dossier
11. Vérifier badge vert sur Parent 2

## Cas d'Usage

### Signature Électronique à Distance
- Consentement parental pour procédure
- Autorisation de sortie
- Documents administratifs

Avec email vérifié → signature via lien OTP email (Yousign)
Sans email vérifié → signature en cabinet uniquement

### Notifications
- Rappels de rendez-vous
- Résultats d'examens disponibles
- Alertes importantes

## Intégration avec Signature (Yousign)

```python
# Dans signature_service.py (futur)
def can_sign_remotely(guardian: Guardian) -> bool:
    """Vérifie si guardian peut signer à distance."""
    return (
        guardian.phone_verified_at is not None or
        guardian.email_verified_at is not None
    )

def create_signature_session(guardian: Guardian, document_id: str):
    if guardian.email_verified_at:
        # Signature via email OTP
        return create_email_signature_session(guardian.email, document_id)
    elif guardian.phone_verified_at:
        # Signature via SMS OTP
        return create_sms_signature_session(guardian.phone_e164, document_id)
    else:
        raise ValueError("Guardian must verify email or phone before remote signing")
```

## Checklist de Déploiement

- [ ] Exécuter migration Alembic en production
- [ ] Vérifier configuration SMTP (email service)
- [ ] Tester envoi email en environnement de production
- [ ] Vérifier `APP_BASE_URL` dans settings (pour génération lien)
- [ ] Monitorer logs pour erreurs d'envoi email
- [ ] Vérifier que `currentUser` est bien passé au composant PatientTabDossier
- [ ] Tester workflow complet : envoi → clic lien → vérification → badge

## Notes Techniques

### Différences avec Vérification SMS
- SMS : Code 6 chiffres, TTL 10 min, vérification inline
- Email : Token URL-safe, TTL 24h, vérification via lien externe

### Réutilisation du Code Auth
- Pattern similaire à `user_email_verifications`
- Fonction `_hash_token()` identique
- Template email similaire à email d'inscription

### Performance
- Index sur `token_hash` pour lookup rapide
- Cascade delete sur `guardian_id` (nettoyage automatique)
- Pas de requêtes N+1 (relations chargées avec dossier)

## Support

En cas de problème :
1. Vérifier logs backend (`uvicorn.error`)
2. Vérifier email dans spam/courrier indésirable
3. Vérifier TTL token (24h)
4. Vérifier configuration SMTP
5. Tester avec email différent (éviter cache email)
