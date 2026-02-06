# Plan de Reprise d'Activité (PRA) et Plan de Continuité d'Activité (PCA)

## MedicApp - Plateforme de Gestion de Procédures Médicales

**Version :** 1.0
**Date de création :** [DATE À REMPLIR]
**Dernière mise à jour :** [DATE À REMPLIR]
**Statut :** En vigueur
**Classification :** Confidentiel - Usage interne

---

## Table des Matières

1. [Introduction et Objectifs](#1-introduction-et-objectifs)
2. [Périmètre et Responsabilités](#2-périmètre-et-responsabilités)
3. [Analyse d'Impact (BIA)](#3-analyse-dimpact-bia)
4. [Objectifs RPO/RTO](#4-objectifs-rporto)
5. [Architecture de Sauvegarde](#5-architecture-de-sauvegarde)
6. [Scénarios de Sinistre](#6-scénarios-de-sinistre)
7. [Procédures de Restauration](#7-procédures-de-restauration)
8. [Plan de Communication de Crise](#8-plan-de-communication-de-crise)
9. [Contacts d'Urgence](#9-contacts-durgence)
10. [Tests et Exercices](#10-tests-et-exercices)
11. [Maintenance du Plan](#11-maintenance-du-plan)
12. [Annexes](#12-annexes)

---

## 1. Introduction et Objectifs

### 1.1 Contexte

MedicApp est une plateforme médicale hébergeant des **données de santé** (HDS) pour la gestion de procédures chirurgicales pédiatriques. La disponibilité et l'intégrité de ces données sont essentielles pour :

- La continuité des soins aux patients
- La conformité réglementaire (RGPD, HDS)
- Les obligations légales de conservation du dossier médical (20 ans)

### 1.2 Objectifs du PRA/PCA

| Objectif | Description |
|----------|-------------|
| **Continuité** | Maintenir les services critiques en cas d'incident |
| **Reprise** | Restaurer l'ensemble des services après un sinistre majeur |
| **Protection** | Préserver l'intégrité des données de santé |
| **Conformité** | Respecter les exigences HDS et RGPD |

### 1.3 Définitions

| Terme | Définition |
|-------|------------|
| **PCA** | Plan de Continuité d'Activité - Maintien des opérations pendant un incident |
| **PRA** | Plan de Reprise d'Activité - Restauration complète après sinistre |
| **RPO** | Recovery Point Objective - Perte de données maximale acceptable |
| **RTO** | Recovery Time Objective - Durée maximale d'interruption acceptable |
| **MTPD** | Maximum Tolerable Period of Disruption - Durée maximale d'indisponibilité |
| **BIA** | Business Impact Analysis - Analyse d'impact sur l'activité |

---

## 2. Périmètre et Responsabilités

### 2.1 Périmètre couvert

#### Composants applicatifs

| Composant | Criticité | Localisation |
|-----------|-----------|--------------|
| **API Backend (FastAPI)** | Critique | Azure App Service |
| **Frontend (React)** | Critique | Azure Static Web Apps |
| **Base de données PostgreSQL** | Critique | Azure Database for PostgreSQL |
| **Stockage documents (PDFs)** | Critique | Azure Blob Storage (HDS) |
| **Secrets et clés** | Critique | Azure Key Vault |
| **Logs et monitoring** | Important | Azure Monitor / Application Insights |

#### Données protégées

| Type de données | Criticité | Durée conservation |
|-----------------|-----------|-------------------|
| Dossiers patients | Critique | 20 ans |
| Documents signés (consentements) | Critique | 20 ans |
| Prescriptions médicales | Critique | 20 ans |
| Logs d'audit | Important | 1 an minimum |
| Données de connexion | Standard | 1 an |

### 2.2 Responsabilités

| Rôle | Responsable | Contact |
|------|-------------|---------|
| **Responsable PRA/PCA** | Dr. [NOM À REMPLIR] | [EMAIL À REMPLIR] |
| **Contact technique** | [NOM TECHNIQUE À REMPLIR] | [EMAIL À REMPLIR] |
| **Support Azure** | Microsoft Azure Support | Portal Azure |
| **Hébergeur HDS** | Microsoft Azure France | support.microsoft.com |

### 2.3 Escalade

```
Niveau 1 : Incident détecté
    ↓ (15 min sans résolution)
Niveau 2 : Contact technique alerté
    ↓ (1h sans résolution)
Niveau 3 : Responsable PRA/PCA + Support Azure
    ↓ (4h sans résolution)
Niveau 4 : Activation PRA complet
```

---

## 3. Analyse d'Impact (BIA)

### 3.1 Processus métier critiques

| Processus | Impact si indisponible | MTPD |
|-----------|----------------------|------|
| Consultation dossier patient | Prise en charge dégradée | 4h |
| Signature documents (Yousign) | Report rendez-vous | 24h |
| Génération ordonnances | Prescription manuelle possible | 24h |
| Prise de rendez-vous | Téléphone en backup | 48h |
| Accès aux documents signés | Preuves légales inaccessibles | 4h |

### 3.2 Impact par durée d'indisponibilité

| Durée | Impact opérationnel | Impact légal | Impact image |
|-------|---------------------|--------------|--------------|
| < 1h | Faible (patients en attente) | Aucun | Négligeable |
| 1h - 4h | Modéré (report consultations) | Faible | Faible |
| 4h - 24h | Élevé (journée perdue) | Modéré (audit HDS) | Modéré |
| 24h - 72h | Critique (perte patients) | Élevé (non-conformité) | Élevé |
| > 72h | Catastrophique | Très élevé (sanctions) | Très élevé |

### 3.3 Dépendances externes

| Service externe | Criticité | Alternative |
|-----------------|-----------|-------------|
| Microsoft Azure | Critique | Aucune (région secondaire) |
| Yousign (signature) | Important | Signature manuscrite temporaire |
| Twilio (SMS) | Faible | Email uniquement |
| DNS (domaine) | Critique | DNS secondaire |

---

## 4. Objectifs RPO/RTO

### 4.1 Objectifs par composant

| Composant | RPO | RTO | Justification |
|-----------|-----|-----|---------------|
| **Base de données** | 1 heure | 2 heures | Données patient critiques |
| **Documents signés** | 0 (temps réel) | 4 heures | Preuve légale, réplication synchrone |
| **API Backend** | N/A | 1 heure | Redéploiement rapide |
| **Frontend** | N/A | 30 min | Assets statiques |
| **Secrets Key Vault** | 0 | 1 heure | Soft-delete + récupération |
| **Logs audit** | 24 heures | 8 heures | Moins critique |

### 4.2 Synthèse globale

| Métrique | Objectif | Cible contractuelle |
|----------|----------|---------------------|
| **RPO global** | 1 heure | 4 heures max |
| **RTO global** | 4 heures | 8 heures max |
| **Disponibilité** | 99.5% | 99% minimum |
| **Durée maintenance planifiée** | 4h/mois max | Fenêtre nuit (2h-6h) |

### 4.3 Métriques de suivi

```
Disponibilité mensuelle = (Temps total - Temps indisponibilité) / Temps total × 100

Objectif : > 99.5%
Seuil d'alerte : < 99.9%
Seuil critique : < 99.5%
```

---

## 5. Architecture de Sauvegarde

### 5.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                    AZURE FRANCE CENTRAL                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ App Service │  │  PostgreSQL │  │     Blob Storage        │  │
│  │  (Backend)  │  │  (Primary)  │  │   (Documents HDS)       │  │
│  └─────────────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│                          │                      │                │
│                          ▼                      ▼                │
│                   ┌──────────────┐      ┌──────────────┐        │
│                   │ Backup Vault │      │ GRS Replica  │        │
│                   │  (7j, 30j)   │      │ (West Europe)│        │
│                   └──────────────┘      └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AZURE WEST EUROPE (DR)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ App Service │  │  PostgreSQL │  │     Blob Storage        │  │
│  │  (Standby)  │  │  (Replica)  │  │      (GRS Copy)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Stratégie de sauvegarde par composant

#### Base de données PostgreSQL

| Type | Fréquence | Rétention | Méthode |
|------|-----------|-----------|---------|
| **Automatique Azure** | Continue (PITR) | 7 jours | Point-in-time recovery |
| **Backup quotidien** | 1x/jour (3h00) | 30 jours | Azure Backup |
| **Backup hebdomadaire** | 1x/semaine (dimanche) | 90 jours | Azure Backup |
| **Backup mensuel** | 1x/mois (1er) | 1 an | Azure Backup |
| **Backup annuel** | 1x/an (1er janvier) | 7 ans | Azure Backup + Archive |

**Configuration Azure CLI :**

```bash
# Activer backup automatique PostgreSQL
az postgres flexible-server update \
  --resource-group medicapp-prod-rg \
  --name medicapp-db-prod \
  --backup-retention 7

# Créer politique de backup long terme
az backup policy create \
  --resource-group medicapp-prod-rg \
  --vault-name medicapp-backup-vault \
  --name PostgreSQL-LongTerm \
  --policy '{
    "dailySchedule": { "retentionDays": 30 },
    "weeklySchedule": { "retentionWeeks": 12 },
    "monthlySchedule": { "retentionMonths": 12 },
    "yearlySchedule": { "retentionYears": 7 }
  }'
```

#### Stockage Blob (Documents signés)

| Configuration | Valeur |
|---------------|--------|
| **Réplication** | GRS (Geo-Redundant Storage) |
| **Région primaire** | France Central |
| **Région secondaire** | West Europe |
| **Soft delete** | 14 jours |
| **Versioning** | Activé (30 jours) |
| **Immutabilité** | Activée (documents signés) |

**Configuration Azure CLI :**

```bash
# Activer GRS + soft delete + versioning
az storage account update \
  --name medicappstorprod \
  --resource-group medicapp-prod-rg \
  --sku Standard_GRS \
  --enable-blob-delete-retention true \
  --blob-delete-retention-days 14

az storage account blob-service-properties update \
  --account-name medicappstorprod \
  --enable-versioning true
```

#### Key Vault (Secrets)

| Configuration | Valeur |
|---------------|--------|
| **Soft delete** | Activé (90 jours) |
| **Purge protection** | Activé |
| **Backup manuel** | Mensuel (script) |

**Script de backup secrets :**

```bash
#!/bin/bash
# backup_keyvault.sh - À exécuter mensuellement

VAULT_NAME="medicapp-kv-prod"
BACKUP_DIR="/secure/keyvault-backups/$(date +%Y-%m)"

mkdir -p "$BACKUP_DIR"

# Lister et sauvegarder chaque secret
for SECRET_NAME in $(az keyvault secret list --vault-name $VAULT_NAME --query "[].name" -o tsv); do
  az keyvault secret backup \
    --vault-name $VAULT_NAME \
    --name $SECRET_NAME \
    --file "$BACKUP_DIR/${SECRET_NAME}.backup"
done

echo "Backup Key Vault terminé : $BACKUP_DIR"
```

### 5.3 Vérification des sauvegardes

| Vérification | Fréquence | Responsable |
|--------------|-----------|-------------|
| Intégrité backup DB | Hebdomadaire | Automatique (script) |
| Test restauration DB | Mensuel | Contact technique |
| Vérification réplication Blob | Quotidienne | Azure Monitor |
| Audit backup Key Vault | Mensuel | Responsable PRA |

### 5.4 Export RGPD encadre (donnees critiques)

- Export autorise uniquement via variable `EXPORT_CRITICAL_DATA_ALLOWED=true`.
- Motif obligatoire (`--reason`) pour traçabilite RGPD.
- Journal d'export `export_audit.jsonl` a conserver.
- Export chiffre (ZIP) recommande pour toute sortie de donnees.

---

## 6. Scénarios de Sinistre

### 6.1 Scénario 1 : Panne Azure région France Central

| Élément | Détail |
|---------|--------|
| **Probabilité** | Faible |
| **Impact** | Critique |
| **Durée estimée** | 2-24 heures |
| **Détection** | Azure Status + Monitoring |

**Procédure de réponse :**

1. **T+0** : Alerte Azure Status détectée
2. **T+15min** : Évaluation impact (vérifier si région secondaire accessible)
3. **T+30min** : Décision bascule vers West Europe si > 2h estimé
4. **T+1h** : Activation infrastructure DR
5. **T+2h** : Communication patients (email/SMS)
6. **T+4h** : Service restauré sur région secondaire

**Actions techniques :**

```bash
# 1. Vérifier statut région secondaire
az postgres flexible-server show \
  --resource-group medicapp-dr-rg \
  --name medicapp-db-dr

# 2. Promouvoir réplica PostgreSQL
az postgres flexible-server replica promote \
  --resource-group medicapp-dr-rg \
  --name medicapp-db-dr

# 3. Mettre à jour DNS
az network dns record-set a update \
  --resource-group medicapp-dns-rg \
  --zone-name medicapp.fr \
  --name api \
  --set "aRecords[0].ipv4Address=<DR_IP>"

# 4. Redéployer App Service sur région DR
az webapp deployment source config \
  --resource-group medicapp-dr-rg \
  --name medicapp-api-dr \
  --repo-url <GIT_REPO> \
  --branch main
```

### 6.2 Scénario 2 : Cyberattaque (Ransomware)

| Élément | Détail |
|---------|--------|
| **Probabilité** | Moyenne |
| **Impact** | Critique |
| **Durée estimée** | 24-72 heures |
| **Détection** | Azure Defender + anomalies accès |

**Procédure de réponse :**

1. **T+0** : Alerte sécurité détectée
2. **T+5min** : Isoler ressources compromises
3. **T+15min** : Évaluer périmètre (quelles données touchées)
4. **T+30min** : Activer plan incident sécurité
5. **T+1h** : Notification CNIL si données personnelles (obligation 72h)
6. **T+4h** : Restauration depuis backup pré-infection
7. **T+24h** : Analyse forensique

**Actions techniques :**

```bash
# 1. Isoler le réseau (bloquer accès)
az network nsg rule create \
  --resource-group medicapp-prod-rg \
  --nsg-name medicapp-nsg \
  --name BlockAllInbound \
  --priority 100 \
  --direction Inbound \
  --access Deny \
  --source-address-prefixes '*'

# 2. Révoquer tous les tokens d'accès
# (invalider sessions en cours)

# 3. Rotation clés Key Vault
az keyvault key rotate \
  --vault-name medicapp-kv-prod \
  --name encryption-key

# 4. Identifier dernier backup sain
az backup recoverypoint list \
  --resource-group medicapp-prod-rg \
  --vault-name medicapp-backup-vault \
  --container-name medicapp-db-prod \
  --item-name medicapp-db-prod \
  --query "[?properties.recoveryPointTime < '2024-01-15T00:00:00Z']"

# 5. Restaurer depuis backup sain
az backup restore restore-disks \
  --resource-group medicapp-prod-rg \
  --vault-name medicapp-backup-vault \
  --container-name medicapp-db-prod \
  --item-name medicapp-db-prod \
  --rp-name <RECOVERY_POINT_NAME>
```

### 6.3 Scénario 3 : Erreur humaine (suppression accidentelle)

| Élément | Détail |
|---------|--------|
| **Probabilité** | Élevée |
| **Impact** | Modéré à élevé |
| **Durée estimée** | 30 min - 4 heures |
| **Détection** | Logs audit + alertes |

**Procédure de réponse :**

#### Suppression de données en base

```bash
# 1. Identifier le point dans le temps avant suppression
# (consulter logs d'audit)

# 2. Point-in-time restore PostgreSQL
az postgres flexible-server restore \
  --resource-group medicapp-prod-rg \
  --name medicapp-db-restored \
  --source-server medicapp-db-prod \
  --restore-point-in-time "2024-01-15T10:30:00Z"

# 3. Extraire données supprimées
pg_dump -h medicapp-db-restored.postgres.database.azure.com \
  -U admin -d medicapp \
  -t procedure_cases \
  --data-only > deleted_data.sql

# 4. Réimporter dans base production
psql -h medicapp-db-prod.postgres.database.azure.com \
  -U admin -d medicapp < deleted_data.sql

# 5. Supprimer serveur temporaire
az postgres flexible-server delete \
  --resource-group medicapp-prod-rg \
  --name medicapp-db-restored
```

#### Suppression de documents Blob

```bash
# 1. Lister versions supprimées (soft delete)
az storage blob list \
  --account-name medicappstorprod \
  --container-name legal-documents-signed \
  --include d \
  --query "[?properties.deleted==true]"

# 2. Restaurer blob supprimé
az storage blob undelete \
  --account-name medicappstorprod \
  --container-name legal-documents-signed \
  --name "consentement/case-123-signed.pdf"
```

### 6.4 Scénario 4 : Compromission credentials

| Élément | Détail |
|---------|--------|
| **Probabilité** | Moyenne |
| **Impact** | Élevé |
| **Durée estimée** | 2-8 heures |
| **Détection** | Azure AD + logs connexion anormaux |

**Procédure de réponse :**

```bash
# 1. Révoquer accès immédiatement
az ad user update --id <USER_ID> --account-enabled false

# 2. Rotation de tous les secrets
az keyvault secret set --vault-name medicapp-kv-prod \
  --name database-password --value "$(openssl rand -base64 32)"

az keyvault secret set --vault-name medicapp-kv-prod \
  --name jwt-secret --value "$(openssl rand -base64 64)"

# 3. Invalider toutes les sessions
# (redémarrer App Service pour vider cache)
az webapp restart --name medicapp-api-prod --resource-group medicapp-prod-rg

# 4. Audit des accès suspects
az monitor activity-log list \
  --resource-group medicapp-prod-rg \
  --start-time "2024-01-14T00:00:00Z" \
  --query "[?authorization.action contains 'write']"
```

### 6.5 Scénario 5 : Défaillance Yousign (signature électronique)

| Élément | Détail |
|---------|--------|
| **Probabilité** | Faible |
| **Impact** | Modéré |
| **Durée estimée** | Variable (dépend Yousign) |
| **Détection** | Erreurs webhook + monitoring API |

**Procédure de réponse :**

1. Vérifier statut Yousign : [status.yousign.com](https://status.yousign.com)
2. Si indisponibilité confirmée :
   - Informer patients d'un report de signature
   - Proposer signature manuscrite temporaire (scan)
   - Conserver PDFs non signés en attente
3. À la reprise :
   - Relancer signatures en attente
   - Vérifier webhooks reçus

---

## 7. Procédures de Restauration

### 7.1 Restauration Base de Données PostgreSQL

#### Depuis Point-in-Time Recovery (< 7 jours)

```bash
#!/bin/bash
# restore_db_pitr.sh

RESOURCE_GROUP="medicapp-prod-rg"
SOURCE_SERVER="medicapp-db-prod"
RESTORE_SERVER="medicapp-db-restored-$(date +%Y%m%d%H%M)"
RESTORE_TIME="2024-01-15T10:30:00Z"  # À ajuster

echo "=== Restauration PITR PostgreSQL ==="
echo "Source: $SOURCE_SERVER"
echo "Destination: $RESTORE_SERVER"
echo "Point dans le temps: $RESTORE_TIME"

# Étape 1: Restaurer vers nouveau serveur
az postgres flexible-server restore \
  --resource-group $RESOURCE_GROUP \
  --name $RESTORE_SERVER \
  --source-server $SOURCE_SERVER \
  --restore-point-in-time "$RESTORE_TIME"

# Étape 2: Vérifier restauration
az postgres flexible-server show \
  --resource-group $RESOURCE_GROUP \
  --name $RESTORE_SERVER \
  --query "state"

# Étape 3: Tester connexion
PGPASSWORD=$DB_PASSWORD psql \
  -h "${RESTORE_SERVER}.postgres.database.azure.com" \
  -U admin -d medicapp \
  -c "SELECT COUNT(*) FROM procedure_cases;"

echo "=== Restauration terminée ==="
echo "Serveur restauré: $RESTORE_SERVER"
echo "IMPORTANT: Vérifier les données avant de basculer"
```

#### Depuis Backup Vault (> 7 jours)

```bash
#!/bin/bash
# restore_db_vault.sh

RESOURCE_GROUP="medicapp-prod-rg"
VAULT_NAME="medicapp-backup-vault"
RECOVERY_POINT=""  # À récupérer via liste

# Lister les points de récupération disponibles
az backup recoverypoint list \
  --resource-group $RESOURCE_GROUP \
  --vault-name $VAULT_NAME \
  --container-name medicapp-db-prod \
  --item-name medicapp-db-prod \
  --query "[].{Name:name, Time:properties.recoveryPointTime}" \
  --output table

# Restaurer depuis point sélectionné
az backup restore restore-disks \
  --resource-group $RESOURCE_GROUP \
  --vault-name $VAULT_NAME \
  --container-name medicapp-db-prod \
  --item-name medicapp-db-prod \
  --rp-name "$RECOVERY_POINT" \
  --target-resource-group $RESOURCE_GROUP
```

### 7.2 Restauration Documents Blob Storage

#### Depuis Soft Delete (< 14 jours)

```bash
#!/bin/bash
# restore_blob_softdelete.sh

STORAGE_ACCOUNT="medicappstorprod"
CONTAINER="legal-documents-signed"

# Lister documents supprimés
echo "=== Documents supprimés récupérables ==="
az storage blob list \
  --account-name $STORAGE_ACCOUNT \
  --container-name $CONTAINER \
  --include d \
  --query "[?properties.deleted==true].{Name:name, DeletedTime:properties.deletedTime}" \
  --output table

# Restaurer un document spécifique
BLOB_NAME="consentement/case-123-signed.pdf"
az storage blob undelete \
  --account-name $STORAGE_ACCOUNT \
  --container-name $CONTAINER \
  --name "$BLOB_NAME"

echo "Document restauré: $BLOB_NAME"
```

#### Depuis Version Précédente

```bash
#!/bin/bash
# restore_blob_version.sh

STORAGE_ACCOUNT="medicappstorprod"
CONTAINER="legal-documents-signed"
BLOB_NAME="consentement/case-123-signed.pdf"

# Lister versions disponibles
az storage blob list \
  --account-name $STORAGE_ACCOUNT \
  --container-name $CONTAINER \
  --prefix "$BLOB_NAME" \
  --include v \
  --query "[].{Name:name, Version:versionId, LastModified:properties.lastModified}" \
  --output table

# Restaurer version spécifique
VERSION_ID="2024-01-14T10:00:00.0000000Z"
az storage blob copy start \
  --account-name $STORAGE_ACCOUNT \
  --destination-container $CONTAINER \
  --destination-blob "$BLOB_NAME" \
  --source-account-name $STORAGE_ACCOUNT \
  --source-container $CONTAINER \
  --source-blob "$BLOB_NAME" \
  --source-blob-version "$VERSION_ID"
```

#### Depuis Réplica Géo-Redondant

```bash
#!/bin/bash
# restore_blob_grs.sh

# En cas de perte région primaire, basculer vers secondaire
PRIMARY_ACCOUNT="medicappstorprod"
SECONDARY_ACCOUNT="${PRIMARY_ACCOUNT}-secondary"

# Initier failover (ATTENTION: opération irréversible)
az storage account failover \
  --name $PRIMARY_ACCOUNT \
  --resource-group medicapp-prod-rg \
  --yes

echo "Failover initié. La région secondaire devient primaire."
echo "Cette opération peut prendre plusieurs heures."
```

### 7.3 Restauration Key Vault

#### Depuis Soft Delete (< 90 jours)

```bash
#!/bin/bash
# restore_keyvault_secret.sh

VAULT_NAME="medicapp-kv-prod"
SECRET_NAME="database-password"

# Lister secrets supprimés
az keyvault secret list-deleted \
  --vault-name $VAULT_NAME \
  --query "[].{Name:name, DeletedDate:deletedDate}" \
  --output table

# Récupérer secret supprimé
az keyvault secret recover \
  --vault-name $VAULT_NAME \
  --name $SECRET_NAME

echo "Secret récupéré: $SECRET_NAME"
```

#### Depuis Backup

```bash
#!/bin/bash
# restore_keyvault_backup.sh

VAULT_NAME="medicapp-kv-prod"
BACKUP_FILE="/secure/keyvault-backups/2024-01/database-password.backup"

# Restaurer depuis fichier backup
az keyvault secret restore \
  --vault-name $VAULT_NAME \
  --file "$BACKUP_FILE"

echo "Secret restauré depuis backup"
```

### 7.4 Redéploiement Application

```bash
#!/bin/bash
# redeploy_app.sh

RESOURCE_GROUP="medicapp-prod-rg"
BACKEND_APP="medicapp-api-prod"
FRONTEND_APP="medicapp-web-prod"

echo "=== Redéploiement MedicApp ==="

# 1. Redéployer Backend
echo "Redéploiement Backend..."
az webapp deployment source sync \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP

# 2. Redémarrer pour appliquer nouvelles configs
az webapp restart \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP

# 3. Vérifier santé
sleep 30
HEALTH=$(curl -s "https://${BACKEND_APP}.azurewebsites.net/health" | jq -r '.status')
if [ "$HEALTH" == "healthy" ]; then
  echo "Backend: OK"
else
  echo "Backend: ERREUR - Vérifier logs"
  az webapp log tail --resource-group $RESOURCE_GROUP --name $BACKEND_APP
fi

# 4. Redéployer Frontend (Static Web App)
echo "Redéploiement Frontend..."
# Le frontend se redéploie automatiquement via GitHub Actions

echo "=== Redéploiement terminé ==="
```

---

## 8. Plan de Communication de Crise

### 8.1 Matrice de communication

| Destinataire | Quand | Canal | Contenu |
|--------------|-------|-------|---------|
| **Contact technique** | T+0 (immédiat) | Téléphone + SMS | Alerte technique |
| **Responsable PRA** | T+15min | Téléphone | Décision activation PRA |
| **Patients concernés** | T+2h (si > 4h estimé) | Email + SMS | Info indisponibilité |
| **CNIL** | T+72h max (si données) | Formulaire officiel | Notification violation |
| **Ordre des médecins** | Si impact patient | Courrier | Information |

### 8.2 Templates de communication

#### Email patients - Indisponibilité temporaire

```
Objet : [MedicApp] Maintenance en cours - Service temporairement indisponible

Madame, Monsieur,

La plateforme MedicApp est actuellement indisponible en raison d'une
maintenance technique exceptionnelle.

Nos équipes travaillent à rétablir le service dans les meilleurs délais.

En attendant, vous pouvez nous contacter :
- Par téléphone : [NUMÉRO]
- Par email : [EMAIL]

Nous vous prions de nous excuser pour la gêne occasionnée.

L'équipe MedicApp
```

#### SMS patients - Alerte courte

```
[MedicApp] Service temporairement indisponible.
Rétablissement prévu : [HEURE].
Contact : [TÉLÉPHONE]
```

### 8.3 Notification CNIL (si violation données)

En cas de violation de données personnelles, notification obligatoire à la CNIL sous 72h via :
- **Formulaire** : [https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles](https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles)
- **Contenu** : Nature violation, catégories données, nombre personnes, mesures prises

---

## 9. Contacts d'Urgence

### 9.1 Contacts internes

| Rôle | Nom | Téléphone | Email | Disponibilité |
|------|-----|-----------|-------|---------------|
| **Responsable PRA** | Dr. [NOM] | [TÉL] | [EMAIL] | 24/7 |
| **Contact technique** | [NOM] | [TÉL] | [EMAIL] | Heures ouvrées |
| **Backup technique** | [NOM] | [TÉL] | [EMAIL] | Si indisponible |

### 9.2 Contacts externes

| Service | Contact | Téléphone | Portail |
|---------|---------|-----------|---------|
| **Azure Support** | Microsoft | N/A | portal.azure.com |
| **Yousign Support** | Yousign | N/A | support.yousign.com |
| **Twilio Support** | Twilio | N/A | console.twilio.com |
| **Registrar DNS** | [REGISTRAR] | [TÉL] | [URL] |

### 9.3 Contacts réglementaires

| Autorité | Contact | Délai notification |
|----------|---------|-------------------|
| **CNIL** | cnil.fr/notifications | 72h (violation données) |
| **ANSSI** | cert.ssi.gouv.fr | Si cyberattaque majeure |
| **Ordre des médecins** | conseil-national.medecin.fr | Si impact soins |

---

## 10. Tests et Exercices

### 10.1 Programme de tests

| Test | Fréquence | Durée | Responsable |
|------|-----------|-------|-------------|
| **Restauration DB (PITR)** | Mensuel | 2h | Contact technique |
| **Restauration Blob** | Trimestriel | 1h | Contact technique |
| **Failover région** | Annuel | 4h | Responsable PRA |
| **Exercice complet PRA** | Annuel | 1 jour | Équipe complète |
| **Test communication** | Semestriel | 1h | Responsable PRA |

### 10.2 Checklist test restauration DB

```markdown
# Test Restauration Base de Données
Date : __/__/____
Testeur : ________________

## Préparation
- [ ] Identifier point de restauration cible
- [ ] Vérifier espace disponible
- [ ] Prévenir équipe technique

## Exécution
- [ ] Lancer commande restauration
- [ ] Attendre fin restauration (noter durée : ___ min)
- [ ] Vérifier état serveur restauré

## Validation
- [ ] Connexion possible à la base
- [ ] Nombre de patients correct (attendu: ___, réel: ___)
- [ ] Derniers documents présents
- [ ] Logs audit cohérents

## Nettoyage
- [ ] Supprimer serveur de test
- [ ] Documenter résultats

## Résultat
- [ ] SUCCÈS - RTO respecté (__h__min < 2h)
- [ ] ÉCHEC - Raison : ________________

Signature : ________________
```

### 10.3 Checklist exercice PRA complet

```markdown
# Exercice PRA Complet
Date : __/__/____
Scénario simulé : ________________

## Phase 1 : Détection (T+0)
- [ ] Alerte reçue et comprise
- [ ] Contact technique alerté en < 15min
- [ ] Responsable PRA informé en < 30min

## Phase 2 : Évaluation (T+30min)
- [ ] Périmètre impacté identifié
- [ ] Décision activation PRA prise
- [ ] Équipe mobilisée

## Phase 3 : Restauration (T+1h à T+4h)
- [ ] Base de données restaurée
- [ ] Documents accessibles
- [ ] Application fonctionnelle
- [ ] Tests de validation passés

## Phase 4 : Communication (T+2h)
- [ ] Patients informés (si applicable)
- [ ] Template utilisé correct
- [ ] Canal communication fonctionnel

## Métriques
- Temps détection : __h__min
- Temps décision : __h__min
- Temps restauration : __h__min
- RTO atteint : OUI / NON

## Axes d'amélioration
1. ________________
2. ________________
3. ________________

Validé par : ________________
```

### 10.4 Rapport de test

Après chaque test, un rapport doit être rédigé incluant :

1. **Date et type de test**
2. **Participants**
3. **Scénario exécuté**
4. **Durée effective vs objectif**
5. **Problèmes rencontrés**
6. **Actions correctives**
7. **Mise à jour du PRA si nécessaire**

---

## 11. Maintenance du Plan

### 11.1 Revue périodique

| Événement | Action | Responsable |
|-----------|--------|-------------|
| **Trimestriel** | Revue contacts d'urgence | Responsable PRA |
| **Semestriel** | Revue procédures | Contact technique |
| **Annuel** | Revue complète PRA/PCA | Équipe complète |
| **À chaque changement** | Mise à jour architecture | Contact technique |

### 11.2 Déclencheurs de mise à jour

Le PRA/PCA doit être mis à jour lors de :

- Changement d'hébergeur ou de région Azure
- Ajout de nouveaux composants critiques
- Modification de la politique de backup
- Résultat de test révélant des lacunes
- Incident réel ayant activé le PRA
- Changement réglementaire (HDS, RGPD)
- Changement de contacts d'urgence

### 11.3 Historique des révisions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | [DATE] | [NOM] | Version initiale |

---

## 12. Annexes

### Annexe A : Architecture technique détaillée

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE MEDICAPP                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   Frontend   │────▶│   Backend    │────▶│      Base de données     │ │
│  │  (React SPA) │     │  (FastAPI)   │     │      (PostgreSQL)        │ │
│  │              │     │              │     │                          │ │
│  │ Static Web   │     │ App Service  │     │ Azure DB for PostgreSQL  │ │
│  │    Apps      │     │   Linux      │     │    Flexible Server       │ │
│  └──────────────┘     └──────┬───────┘     └──────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   Yousign    │◀───▶│   Webhooks   │     │     Blob Storage         │ │
│  │  (Signature) │     │              │     │   (Documents HDS)        │ │
│  │              │     │              │     │                          │ │
│  │   Externe    │     │  App Service │     │ legal_documents_signed/  │ │
│  └──────────────┘     └──────────────┘     │ legal_documents_evidence/│ │
│                                            │ legal_documents_final/   │ │
│                                            └──────────────────────────┘ │
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │  Key Vault   │     │   Twilio     │     │   Azure Monitor          │ │
│  │  (Secrets)   │     │   (SMS)      │     │   (Logs + Alertes)       │ │
│  └──────────────┘     └──────────────┘     └──────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Annexe B : Liste des secrets Key Vault

| Secret | Usage | Rotation |
|--------|-------|----------|
| `database-connection-string` | Connexion PostgreSQL | Annuelle |
| `jwt-secret` | Authentification tokens | Annuelle |
| `yousign-api-key` | API signature | Sur demande |
| `twilio-auth-token` | API SMS | Sur demande |
| `encryption-key` | Chiffrement données | Annuelle |
| `storage-connection-string` | Accès Blob | Annuelle |

### Annexe C : Commandes Azure CLI fréquentes

```bash
# Vérifier état des ressources
az resource list --resource-group medicapp-prod-rg --output table

# Voir logs App Service
az webapp log tail --name medicapp-api-prod --resource-group medicapp-prod-rg

# Vérifier métriques PostgreSQL
az monitor metrics list \
  --resource medicapp-db-prod \
  --resource-group medicapp-prod-rg \
  --resource-type Microsoft.DBforPostgreSQL/flexibleServers \
  --metric cpu_percent,memory_percent

# Lister backups disponibles
az backup recoverypoint list \
  --resource-group medicapp-prod-rg \
  --vault-name medicapp-backup-vault \
  --container-name medicapp-db-prod \
  --item-name medicapp-db-prod

# Vérifier réplication Blob
az storage account show \
  --name medicappstorprod \
  --query "statusOfSecondary"
```

### Annexe D : Checklist activation PRA

```markdown
# ACTIVATION PRA - CHECKLIST D'URGENCE

## 1. Évaluation (5 min)
□ Nature de l'incident identifiée
□ Périmètre impacté évalué
□ Durée estimée > seuil RTO ?

## 2. Décision (5 min)
□ Responsable PRA contacté
□ Décision activation formalisée
□ Équipe technique mobilisée

## 3. Communication (10 min)
□ Équipe informée du rôle de chacun
□ Canal communication établi

## 4. Exécution (variable)
□ Procédure appropriée identifiée
□ Commandes exécutées
□ Progression documentée

## 5. Validation (30 min)
□ Services restaurés et testés
□ Données vérifiées
□ Accès utilisateurs confirmés

## 6. Clôture
□ Communication fin d'incident
□ Rapport post-incident rédigé
□ Actions amélioration identifiées
```

---

**Document maintenu par :** Dr. [NOM À REMPLIR]
**Dernière revue :** [DATE À REMPLIR]
**Prochaine revue :** [DATE + 1 AN]

---

*Ce document est confidentiel et destiné à un usage interne uniquement.*
*MedicApp - Plateforme de Gestion de Procédures Médicales*
