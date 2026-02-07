# Infrastructure Azure HDS - MedicApp

## Documentation Technique de l'Architecture Sécurisée

**Version :** 1.0
**Date de création :** [DATE À REMPLIR]
**Dernière mise à jour :** [DATE À REMPLIR]
**Statut :** En vigueur
**Classification :** Confidentiel - Usage interne

---

## Table des Matières

1. [Architecture Réseau](#1-architecture-réseau)
2. [Checklist Conformité HDS](#2-checklist-conformité-hds)
3. [Procédure de Vérification](#3-procédure-de-vérification)
4. [Contacts et Références](#4-contacts-et-références)

---

## 1. Architecture Réseau

### 1.1 Vue d'ensemble

L'infrastructure MedicApp est déployée sur Microsoft Azure dans la région **France Central**, certifiée Hébergeur de Données de Santé (HDS). L'architecture utilise des **Private Endpoints** pour garantir que toutes les communications entre les services restent dans le réseau privé Azure, sans exposition à Internet.

### 1.2 Schéma Architecture VNet

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            AZURE FRANCE CENTRAL (HDS)                                │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                        VNET: medicapp-vnet-prod                                 │ │
│  │                        Address Space: 10.0.0.0/16                               │ │
│  │                                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │              SUBNET: snet-app (10.0.1.0/24)                              │   │ │
│  │  │              Rôle: App Service VNet Integration                          │   │ │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐    │   │ │
│  │  │  │                                                                  │    │   │ │
│  │  │  │   ┌─────────────┐          ┌─────────────┐                      │    │   │ │
│  │  │  │   │ App Service │          │ App Service │                      │    │   │ │
│  │  │  │   │   Backend   │          │   Worker    │                      │    │   │ │
│  │  │  │   │  (FastAPI)  │          │   (Jobs)    │                      │    │   │ │
│  │  │  │   └──────┬──────┘          └──────┬──────┘                      │    │   │ │
│  │  │  │          │                        │                              │    │   │ │
│  │  │  └──────────┼────────────────────────┼──────────────────────────────┘    │   │ │
│  │  └─────────────┼────────────────────────┼───────────────────────────────────┘   │ │
│  │                │                        │                                        │ │
│  │                │    TRAFIC PRIVÉ UNIQUEMENT                                     │ │
│  │                │    (via Private Endpoints)                                      │ │
│  │                │                        │                                        │ │
│  │  ┌─────────────┼────────────────────────┼───────────────────────────────────┐   │ │
│  │  │             ▼                        ▼                                   │   │ │
│  │  │              SUBNET: snet-private-endpoints (10.0.2.0/24)                │   │ │
│  │  │              Rôle: Hébergement des Private Endpoints                     │   │ │
│  │  │                                                                          │   │ │
│  │  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │   │ │
│  │  │  │  Private Endpoint│  │  Private Endpoint│  │  Private Endpoint│       │   │ │
│  │  │  │    PostgreSQL    │  │   Blob Storage   │  │    Key Vault     │       │   │ │
│  │  │  │                  │  │                  │  │                  │       │   │ │
│  │  │  │  10.0.2.10       │  │  10.0.2.20       │  │  10.0.2.30       │       │   │ │
│  │  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │   │ │
│  │  │           │                     │                     │                  │   │ │
│  │  └───────────┼─────────────────────┼─────────────────────┼──────────────────┘   │ │
│  │              │                     │                     │                       │ │
│  └──────────────┼─────────────────────┼─────────────────────┼───────────────────────┘ │
│                 │                     │                     │                         │
│                 ▼                     ▼                     ▼                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │   Azure Database     │  │   Azure Blob         │  │   Azure Key Vault    │        │
│  │   for PostgreSQL     │  │   Storage            │  │                      │        │
│  │   Flexible Server    │  │   (Documents HDS)    │  │   (Secrets)          │        │
│  │                      │  │                      │  │                      │        │
│  │  ⛔ Accès public     │  │  ⛔ Accès public     │  │  ⛔ Accès public     │        │
│  │     DÉSACTIVÉ        │  │     DÉSACTIVÉ        │  │     DÉSACTIVÉ        │        │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘        │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                        │
                                        │ HTTPS (TLS 1.3)
                                        │ via Application Gateway / Front Door
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    INTERNET                                          │
│                                                                                      │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                             │
│   │  Patients   │    │  Praticien  │    │   Yousign   │                             │
│   │  (Parents)  │    │             │    │  (Webhooks) │                             │
│   └─────────────┘    └─────────────┘    └─────────────┘                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Détail des Subnets

| Subnet | Plage CIDR | Rôle | Services hébergés |
|--------|------------|------|-------------------|
| **snet-app** | 10.0.1.0/24 | VNet Integration pour App Service | Backend API, Workers |
| **snet-private-endpoints** | 10.0.2.0/24 | Hébergement des Private Endpoints | PE-PostgreSQL, PE-Blob, PE-KeyVault |
| **snet-gateway** | 10.0.3.0/24 | Application Gateway (optionnel) | WAF, Load Balancer |
| **snet-bastion** | 10.0.4.0/24 | Azure Bastion (administration) | Accès sécurisé aux VMs |

### 1.4 Private Endpoints Configurés

#### 1.4.1 Private Endpoint PostgreSQL

| Propriété | Valeur |
|-----------|--------|
| **Nom** | pe-medicapp-db-prod |
| **Ressource cible** | medicapp-db-prod.postgres.database.azure.com |
| **Sous-ressource** | postgresqlServer |
| **Subnet** | snet-private-endpoints |
| **Adresse IP privée** | 10.0.2.10 |
| **Zone DNS privée** | privatelink.postgres.database.azure.com |

**Configuration Azure CLI :**

```bash
# Créer le Private Endpoint pour PostgreSQL
az network private-endpoint create \
  --name pe-medicapp-db-prod \
  --resource-group medicapp-prod-rg \
  --vnet-name medicapp-vnet-prod \
  --subnet snet-private-endpoints \
  --private-connection-resource-id $(az postgres flexible-server show \
    --name medicapp-db-prod \
    --resource-group medicapp-prod-rg \
    --query id -o tsv) \
  --group-id postgresqlServer \
  --connection-name plc-medicapp-db-prod

# Créer la zone DNS privée
az network private-dns zone create \
  --resource-group medicapp-prod-rg \
  --name privatelink.postgres.database.azure.com

# Lier la zone DNS au VNet
az network private-dns link vnet create \
  --resource-group medicapp-prod-rg \
  --zone-name privatelink.postgres.database.azure.com \
  --name link-medicapp-vnet \
  --virtual-network medicapp-vnet-prod \
  --registration-enabled false

# Créer l'enregistrement DNS
az network private-endpoint dns-zone-group create \
  --resource-group medicapp-prod-rg \
  --endpoint-name pe-medicapp-db-prod \
  --name default \
  --private-dns-zone privatelink.postgres.database.azure.com \
  --zone-name postgres
```

#### 1.4.2 Private Endpoint Blob Storage

| Propriété | Valeur |
|-----------|--------|
| **Nom** | pe-medicapp-stor-prod |
| **Ressource cible** | medicappstorprod.blob.core.windows.net |
| **Sous-ressource** | blob |
| **Subnet** | snet-private-endpoints |
| **Adresse IP privée** | 10.0.2.20 |
| **Zone DNS privée** | privatelink.blob.core.windows.net |

**Configuration Azure CLI :**

```bash
# Créer le Private Endpoint pour Blob Storage
az network private-endpoint create \
  --name pe-medicapp-stor-prod \
  --resource-group medicapp-prod-rg \
  --vnet-name medicapp-vnet-prod \
  --subnet snet-private-endpoints \
  --private-connection-resource-id $(az storage account show \
    --name medicappstorprod \
    --resource-group medicapp-prod-rg \
    --query id -o tsv) \
  --group-id blob \
  --connection-name plc-medicapp-stor-prod

# Créer la zone DNS privée
az network private-dns zone create \
  --resource-group medicapp-prod-rg \
  --name privatelink.blob.core.windows.net

# Lier la zone DNS au VNet
az network private-dns link vnet create \
  --resource-group medicapp-prod-rg \
  --zone-name privatelink.blob.core.windows.net \
  --name link-medicapp-vnet \
  --virtual-network medicapp-vnet-prod \
  --registration-enabled false

# Créer l'enregistrement DNS
az network private-endpoint dns-zone-group create \
  --resource-group medicapp-prod-rg \
  --endpoint-name pe-medicapp-stor-prod \
  --name default \
  --private-dns-zone privatelink.blob.core.windows.net \
  --zone-name blob
```

#### 1.4.3 Private Endpoint Key Vault

| Propriété | Valeur |
|-----------|--------|
| **Nom** | pe-medicapp-kv-prod |
| **Ressource cible** | medicapp-kv-prod.vault.azure.net |
| **Sous-ressource** | vault |
| **Subnet** | snet-private-endpoints |
| **Adresse IP privée** | 10.0.2.30 |
| **Zone DNS privée** | privatelink.vaultcore.azure.net |

**Configuration Azure CLI :**

```bash
# Créer le Private Endpoint pour Key Vault
az network private-endpoint create \
  --name pe-medicapp-kv-prod \
  --resource-group medicapp-prod-rg \
  --vnet-name medicapp-vnet-prod \
  --subnet snet-private-endpoints \
  --private-connection-resource-id $(az keyvault show \
    --name medicapp-kv-prod \
    --resource-group medicapp-prod-rg \
    --query id -o tsv) \
  --group-id vault \
  --connection-name plc-medicapp-kv-prod

# Créer la zone DNS privée
az network private-dns zone create \
  --resource-group medicapp-prod-rg \
  --name privatelink.vaultcore.azure.net

# Lier la zone DNS au VNet
az network private-dns link vnet create \
  --resource-group medicapp-prod-rg \
  --zone-name privatelink.vaultcore.azure.net \
  --name link-medicapp-vnet \
  --virtual-network medicapp-vnet-prod \
  --registration-enabled false

# Créer l'enregistrement DNS
az network private-endpoint dns-zone-group create \
  --resource-group medicapp-prod-rg \
  --endpoint-name pe-medicapp-kv-prod \
  --name default \
  --private-dns-zone privatelink.vaultcore.azure.net \
  --zone-name vault
```

### 1.5 VNet Integration App Service

| Propriété | Valeur |
|-----------|--------|
| **App Service** | medicapp-api-prod |
| **Plan** | Premium V3 (P1v3) |
| **VNet** | medicapp-vnet-prod |
| **Subnet délégué** | snet-app |
| **Routage** | Tout le trafic via VNet |

**Configuration Azure CLI :**

```bash
# Activer VNet Integration pour App Service
az webapp vnet-integration add \
  --name medicapp-api-prod \
  --resource-group medicapp-prod-rg \
  --vnet medicapp-vnet-prod \
  --subnet snet-app

# Configurer le routage de tout le trafic via VNet
az webapp config appsettings set \
  --name medicapp-api-prod \
  --resource-group medicapp-prod-rg \
  --settings WEBSITE_VNET_ROUTE_ALL=1

# Activer les DNS privés
az webapp config appsettings set \
  --name medicapp-api-prod \
  --resource-group medicapp-prod-rg \
  --settings WEBSITE_DNS_SERVER=168.63.129.16
```

### 1.6 Network Security Groups (NSG)

#### NSG pour snet-app

| Règle | Direction | Priorité | Source | Destination | Port | Action |
|-------|-----------|----------|--------|-------------|------|--------|
| AllowAppServiceInbound | Inbound | 100 | AzureCloud | VirtualNetwork | 443 | Allow |
| AllowVNetOutbound | Outbound | 100 | VirtualNetwork | VirtualNetwork | * | Allow |
| AllowAzureServicesOutbound | Outbound | 110 | VirtualNetwork | AzureCloud | 443 | Allow |
| DenyAllInbound | Inbound | 4096 | * | * | * | Deny |
| DenyInternetOutbound | Outbound | 4096 | * | Internet | * | Deny |

#### NSG pour snet-private-endpoints

| Règle | Direction | Priorité | Source | Destination | Port | Action |
|-------|-----------|----------|--------|-------------|------|--------|
| AllowVNetInbound | Inbound | 100 | VirtualNetwork | VirtualNetwork | * | Allow |
| DenyAllInbound | Inbound | 4096 | * | * | * | Deny |
| DenyAllOutbound | Outbound | 4096 | * | * | * | Deny |

---

## 2. Checklist Conformité HDS

### 2.1 Checklist Infrastructure

```markdown
# CHECKLIST CONFORMITÉ INFRASTRUCTURE HDS
Date de vérification : __/__/____
Vérificateur : ________________

## Réseau et Isolation

### Private Endpoints
- [ ] Private Endpoint PostgreSQL créé et fonctionnel
- [ ] Private Endpoint Blob Storage créé et fonctionnel
- [ ] Private Endpoint Key Vault créé et fonctionnel
- [ ] Zones DNS privées configurées pour chaque service
- [ ] Enregistrements DNS résolus correctement

### VNet Integration
- [ ] VNet Integration App Service activée
- [ ] Subnet dédié pour App Service (snet-app)
- [ ] WEBSITE_VNET_ROUTE_ALL=1 configuré
- [ ] DNS Azure (168.63.129.16) configuré

### Network Security Groups
- [ ] NSG appliqué sur snet-app
- [ ] NSG appliqué sur snet-private-endpoints
- [ ] Règles de sortie Internet bloquées (sauf exceptions)
- [ ] Logs NSG activés vers Log Analytics

## Désactivation Accès Public

### PostgreSQL
- [ ] Accès réseau public désactivé
- [ ] Firewall rules vides (aucune IP autorisée)
- [ ] Connexion uniquement via Private Endpoint

### Blob Storage
- [ ] Accès réseau public désactivé
- [ ] "Allow Blob public access" désactivé
- [ ] Firewall rules : "Deny" par défaut
- [ ] Connexion uniquement via Private Endpoint

### Key Vault
- [ ] Accès réseau public désactivé
- [ ] Firewall : "Allow trusted Microsoft services"
- [ ] Connexion uniquement via Private Endpoint

## Contrats et Certifications

### Azure Healthcare
- [ ] Contrat Azure signé avec clause HDS
- [ ] Région France Central sélectionnée
- [ ] Attestation HDS Azure téléchargée et archivée

### Conformité
- [ ] Audit trail activé (Azure Monitor)
- [ ] Logs conservés 1 an minimum
- [ ] Chiffrement au repos activé (AES-256)
- [ ] Chiffrement en transit (TLS 1.3)

Signature vérificateur : ________________
Date : __/__/____
```

### 2.2 État Actuel de Conformité

| Élément | Statut | Date vérification | Commentaire |
|---------|--------|-------------------|-------------|
| Private Endpoint PostgreSQL | [ ] À configurer | - | - |
| Private Endpoint Blob Storage | [ ] À configurer | - | - |
| Private Endpoint Key Vault | [ ] À configurer | - | - |
| VNet Integration App Service | [ ] À configurer | - | - |
| Accès public DB désactivé | [ ] À configurer | - | - |
| Accès public Blob désactivé | [ ] À configurer | - | - |
| Accès public Key Vault désactivé | [ ] À configurer | - | - |
| Contrat Azure Healthcare signé | [ ] À vérifier | - | - |
| Attestation HDS archivée | [ ] À faire | - | - |

### 2.3 Actions Requises par Priorité

| Priorité | Action | Responsable | Échéance |
|----------|--------|-------------|----------|
| **CRITIQUE** | Désactiver accès public PostgreSQL | [NOM] | [DATE] |
| **CRITIQUE** | Désactiver accès public Blob Storage | [NOM] | [DATE] |
| **CRITIQUE** | Créer Private Endpoints | [NOM] | [DATE] |
| **HAUTE** | Configurer VNet Integration | [NOM] | [DATE] |
| **HAUTE** | Vérifier contrat Azure HDS | [NOM] | [DATE] |
| **MOYENNE** | Configurer NSG restrictifs | [NOM] | [DATE] |
| **MOYENNE** | Activer logs audit | [NOM] | [DATE] |

---

## 3. Procédure de Vérification

### 3.1 Vérifier les Private Endpoints

#### Test 1 : Vérifier l'état des Private Endpoints

```bash
#!/bin/bash
# verify_private_endpoints.sh

echo "=== Vérification des Private Endpoints MedicApp ==="
echo ""

RESOURCE_GROUP="medicapp-prod-rg"

# Liste des Private Endpoints à vérifier
ENDPOINTS=("pe-medicapp-db-prod" "pe-medicapp-stor-prod" "pe-medicapp-kv-prod")

for EP in "${ENDPOINTS[@]}"; do
  echo "--- Vérification: $EP ---"

  # État de connexion
  STATE=$(az network private-endpoint show \
    --name $EP \
    --resource-group $RESOURCE_GROUP \
    --query "privateLinkServiceConnections[0].privateLinkServiceConnectionState.status" \
    -o tsv 2>/dev/null)

  if [ "$STATE" == "Approved" ]; then
    echo "✅ État: $STATE"
  else
    echo "❌ État: $STATE (attendu: Approved)"
  fi

  # Adresse IP privée
  IP=$(az network private-endpoint show \
    --name $EP \
    --resource-group $RESOURCE_GROUP \
    --query "customDnsConfigs[0].ipAddresses[0]" \
    -o tsv 2>/dev/null)

  echo "   IP Privée: $IP"
  echo ""
done
```

#### Test 2 : Vérifier la résolution DNS privée

```bash
#!/bin/bash
# verify_dns_resolution.sh

echo "=== Vérification Résolution DNS Privée ==="
echo ""

# Depuis une VM dans le VNet ou via Cloud Shell connecté au VNet

# PostgreSQL
echo "--- PostgreSQL ---"
POSTGRES_FQDN="medicapp-db-prod.postgres.database.azure.com"
POSTGRES_IP=$(nslookup $POSTGRES_FQDN | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
echo "FQDN: $POSTGRES_FQDN"
echo "IP résolue: $POSTGRES_IP"

if [[ $POSTGRES_IP == 10.0.2.* ]]; then
  echo "✅ Résolution via Private Endpoint (IP privée)"
else
  echo "❌ Résolution via IP publique - Private Endpoint non fonctionnel"
fi
echo ""

# Blob Storage
echo "--- Blob Storage ---"
BLOB_FQDN="medicappstorprod.blob.core.windows.net"
BLOB_IP=$(nslookup $BLOB_FQDN | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
echo "FQDN: $BLOB_FQDN"
echo "IP résolue: $BLOB_IP"

if [[ $BLOB_IP == 10.0.2.* ]]; then
  echo "✅ Résolution via Private Endpoint (IP privée)"
else
  echo "❌ Résolution via IP publique - Private Endpoint non fonctionnel"
fi
echo ""

# Key Vault
echo "--- Key Vault ---"
KV_FQDN="medicapp-kv-prod.vault.azure.net"
KV_IP=$(nslookup $KV_FQDN | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
echo "FQDN: $KV_FQDN"
echo "IP résolue: $KV_IP"

if [[ $KV_IP == 10.0.2.* ]]; then
  echo "✅ Résolution via Private Endpoint (IP privée)"
else
  echo "❌ Résolution via IP publique - Private Endpoint non fonctionnel"
fi
```

#### Test 3 : Vérifier la connectivité depuis App Service

```bash
#!/bin/bash
# verify_app_connectivity.sh

echo "=== Test Connectivité depuis App Service ==="
echo ""

APP_NAME="medicapp-api-prod"
RESOURCE_GROUP="medicapp-prod-rg"

# Test connexion PostgreSQL via tcpping
echo "--- Test PostgreSQL ---"
az webapp ssh --name $APP_NAME --resource-group $RESOURCE_GROUP << 'EOF'
  # Installer tcpping si nécessaire
  apt-get update && apt-get install -y netcat-openbsd

  # Test connexion PostgreSQL port 5432
  nc -zv medicapp-db-prod.postgres.database.azure.com 5432
  if [ $? -eq 0 ]; then
    echo "✅ Connexion PostgreSQL OK via Private Endpoint"
  else
    echo "❌ Connexion PostgreSQL échouée"
  fi
EOF

# Test connexion Blob Storage via curl
echo ""
echo "--- Test Blob Storage ---"
az webapp ssh --name $APP_NAME --resource-group $RESOURCE_GROUP << 'EOF'
  curl -s -o /dev/null -w "%{http_code}" \
    https://medicappstorprod.blob.core.windows.net/?comp=list
  # Un code 403 (Forbidden) est attendu car pas d'auth, mais prouve la connectivité
EOF
```

### 3.2 Vérifier que l'Accès Public est Bloqué

#### Test 1 : Vérifier accès public PostgreSQL

```bash
#!/bin/bash
# verify_postgres_public_access.sh

echo "=== Vérification Accès Public PostgreSQL ==="
echo ""

RESOURCE_GROUP="medicapp-prod-rg"
SERVER_NAME="medicapp-db-prod"

# Vérifier le paramètre "public network access"
PUBLIC_ACCESS=$(az postgres flexible-server show \
  --name $SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "network.publicNetworkAccess" \
  -o tsv)

echo "Public Network Access: $PUBLIC_ACCESS"

if [ "$PUBLIC_ACCESS" == "Disabled" ]; then
  echo "✅ Accès public désactivé"
else
  echo "❌ ALERTE: Accès public activé - À désactiver immédiatement!"
fi

# Vérifier les firewall rules
echo ""
echo "Firewall Rules:"
az postgres flexible-server firewall-rule list \
  --name $SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --output table

RULES_COUNT=$(az postgres flexible-server firewall-rule list \
  --name $SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "length(@)")

if [ "$RULES_COUNT" == "0" ]; then
  echo "✅ Aucune règle firewall (accès uniquement via Private Endpoint)"
else
  echo "⚠️ $RULES_COUNT règle(s) firewall présente(s) - À vérifier"
fi
```

**Commande pour désactiver l'accès public PostgreSQL :**

```bash
# Désactiver l'accès public
az postgres flexible-server update \
  --name medicapp-db-prod \
  --resource-group medicapp-prod-rg \
  --public-network-access Disabled

# Supprimer toutes les firewall rules existantes
for RULE in $(az postgres flexible-server firewall-rule list \
  --name medicapp-db-prod \
  --resource-group medicapp-prod-rg \
  --query "[].name" -o tsv); do
  az postgres flexible-server firewall-rule delete \
    --name $RULE \
    --server-name medicapp-db-prod \
    --resource-group medicapp-prod-rg \
    --yes
done
```

#### Test 2 : Vérifier accès public Blob Storage

```bash
#!/bin/bash
# verify_blob_public_access.sh

echo "=== Vérification Accès Public Blob Storage ==="
echo ""

RESOURCE_GROUP="medicapp-prod-rg"
STORAGE_ACCOUNT="medicappstorprod"

# Vérifier "Allow Blob public access"
BLOB_PUBLIC=$(az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "allowBlobPublicAccess" \
  -o tsv)

echo "Allow Blob Public Access: $BLOB_PUBLIC"

if [ "$BLOB_PUBLIC" == "false" ]; then
  echo "✅ Accès public aux blobs désactivé"
else
  echo "❌ ALERTE: Accès public aux blobs activé!"
fi

# Vérifier le paramètre réseau
DEFAULT_ACTION=$(az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "networkRuleSet.defaultAction" \
  -o tsv)

echo ""
echo "Default Network Action: $DEFAULT_ACTION"

if [ "$DEFAULT_ACTION" == "Deny" ]; then
  echo "✅ Accès réseau par défaut bloqué"
else
  echo "❌ ALERTE: Accès réseau par défaut autorisé!"
fi

# Vérifier les IP rules
echo ""
echo "IP Rules:"
az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "networkRuleSet.ipRules" \
  -o table
```

**Commande pour désactiver l'accès public Blob Storage :**

```bash
# Désactiver l'accès public aux blobs
az storage account update \
  --name medicappstorprod \
  --resource-group medicapp-prod-rg \
  --allow-blob-public-access false

# Bloquer l'accès réseau par défaut
az storage account update \
  --name medicappstorprod \
  --resource-group medicapp-prod-rg \
  --default-action Deny

# Autoriser uniquement les services Azure de confiance
az storage account update \
  --name medicappstorprod \
  --resource-group medicapp-prod-rg \
  --bypass AzureServices
```

#### Test 3 : Vérifier accès public Key Vault

```bash
#!/bin/bash
# verify_keyvault_public_access.sh

echo "=== Vérification Accès Public Key Vault ==="
echo ""

RESOURCE_GROUP="medicapp-prod-rg"
VAULT_NAME="medicapp-kv-prod"

# Vérifier le paramètre réseau
PUBLIC_ACCESS=$(az keyvault show \
  --name $VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.publicNetworkAccess" \
  -o tsv)

echo "Public Network Access: $PUBLIC_ACCESS"

if [ "$PUBLIC_ACCESS" == "Disabled" ]; then
  echo "✅ Accès public désactivé"
else
  echo "❌ ALERTE: Accès public activé!"
fi

# Vérifier l'action par défaut
DEFAULT_ACTION=$(az keyvault show \
  --name $VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.networkAcls.defaultAction" \
  -o tsv)

echo ""
echo "Default Network Action: $DEFAULT_ACTION"

if [ "$DEFAULT_ACTION" == "Deny" ]; then
  echo "✅ Accès réseau par défaut bloqué"
else
  echo "⚠️ Accès réseau par défaut: $DEFAULT_ACTION"
fi
```

**Commande pour désactiver l'accès public Key Vault :**

```bash
# Désactiver l'accès public et bloquer par défaut
az keyvault update \
  --name medicapp-kv-prod \
  --resource-group medicapp-prod-rg \
  --public-network-access Disabled \
  --default-action Deny \
  --bypass AzureServices
```

### 3.3 Test de Bout en Bout depuis Internet

Ce test vérifie qu'il est **impossible** d'accéder aux services depuis Internet.

```bash
#!/bin/bash
# test_public_access_blocked.sh

echo "=== Test Accès Public Bloqué (depuis Internet) ==="
echo "Ce test doit être exécuté depuis une machine HORS du VNet Azure"
echo ""

# Test PostgreSQL
echo "--- Test PostgreSQL (doit échouer) ---"
timeout 5 nc -zv medicapp-db-prod.postgres.database.azure.com 5432 2>&1
if [ $? -ne 0 ]; then
  echo "✅ Connexion PostgreSQL refusée depuis Internet"
else
  echo "❌ ALERTE: Connexion PostgreSQL possible depuis Internet!"
fi

echo ""

# Test Blob Storage (sans auth)
echo "--- Test Blob Storage (doit retourner 403 ou timeout) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 \
  "https://medicappstorprod.blob.core.windows.net/legal-documents-signed?restype=container&comp=list")

if [ "$HTTP_CODE" == "403" ] || [ "$HTTP_CODE" == "000" ]; then
  echo "✅ Accès Blob Storage refusé depuis Internet (HTTP $HTTP_CODE)"
else
  echo "⚠️ Code HTTP: $HTTP_CODE - À vérifier"
fi

echo ""

# Test Key Vault
echo "--- Test Key Vault (doit retourner 403) ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 \
  "https://medicapp-kv-prod.vault.azure.net/secrets?api-version=7.4")

if [ "$HTTP_CODE" == "403" ] || [ "$HTTP_CODE" == "000" ]; then
  echo "✅ Accès Key Vault refusé depuis Internet (HTTP $HTTP_CODE)"
else
  echo "⚠️ Code HTTP: $HTTP_CODE - À vérifier"
fi
```

### 3.4 Rapport de Vérification

```markdown
# RAPPORT DE VÉRIFICATION INFRASTRUCTURE HDS
Date : __/__/____
Vérificateur : ________________
Environnement : Production

## Résumé

| Test | Résultat | Commentaire |
|------|----------|-------------|
| Private Endpoint PostgreSQL | [ ] OK / [ ] KO | |
| Private Endpoint Blob Storage | [ ] OK / [ ] KO | |
| Private Endpoint Key Vault | [ ] OK / [ ] KO | |
| DNS privé PostgreSQL | [ ] OK / [ ] KO | |
| DNS privé Blob | [ ] OK / [ ] KO | |
| DNS privé Key Vault | [ ] OK / [ ] KO | |
| Accès public PostgreSQL bloqué | [ ] OK / [ ] KO | |
| Accès public Blob bloqué | [ ] OK / [ ] KO | |
| Accès public Key Vault bloqué | [ ] OK / [ ] KO | |
| VNet Integration App Service | [ ] OK / [ ] KO | |
| Connectivité App → DB | [ ] OK / [ ] KO | |
| Connectivité App → Blob | [ ] OK / [ ] KO | |
| Test accès Internet bloqué | [ ] OK / [ ] KO | |

## Anomalies Détectées

| # | Description | Sévérité | Action corrective |
|---|-------------|----------|-------------------|
| 1 | | | |
| 2 | | | |

## Conclusion

[ ] Infrastructure CONFORME aux exigences HDS
[ ] Infrastructure NON CONFORME - Actions correctives requises

Signature : ________________
Date : __/__/____
```

---

## 4. Contacts et Références

### 4.1 Documentation Azure HDS

| Ressource | Lien |
|-----------|------|
| **Certification HDS Azure** | [https://docs.microsoft.com/fr-fr/azure/compliance/offerings/offering-hds-france](https://docs.microsoft.com/fr-fr/azure/compliance/offerings/offering-hds-france) |
| **Attestation HDS (PDF)** | [https://servicetrust.microsoft.com](https://servicetrust.microsoft.com) → Rechercher "HDS" |
| **Régions Azure France** | [https://azure.microsoft.com/fr-fr/explore/global-infrastructure/geographies/#geographies](https://azure.microsoft.com/fr-fr/explore/global-infrastructure/geographies/#geographies) |
| **Private Link Documentation** | [https://docs.microsoft.com/fr-fr/azure/private-link/](https://docs.microsoft.com/fr-fr/azure/private-link/) |
| **Azure Healthcare APIs** | [https://docs.microsoft.com/fr-fr/azure/healthcare-apis/](https://docs.microsoft.com/fr-fr/azure/healthcare-apis/) |

### 4.2 Support Azure Healthcare

| Contact | Coordonnées |
|---------|-------------|
| **Support Azure** | Via le portail Azure → Aide + support |
| **Support Premium** | Si contrat support Premier/Unified |
| **Équipe Healthcare France** | Contacter votre représentant Microsoft |

### 4.3 Références Réglementaires

| Texte | Description |
|-------|-------------|
| **Décret n°2018-137** | Référentiel de certification HDS |
| **Article L. 1111-8 CSP** | Hébergement des données de santé |
| **Articles R. 1111-8-8 et suivants CSP** | Conditions d'agrément HDS |
| **RGPD Article 32** | Sécurité du traitement |
| **ISO 27001** | Système de management de la sécurité de l'information |

### 4.4 Contacts Internes MedicApp

| Rôle | Nom | Email | Téléphone |
|------|-----|-------|-----------|
| **Responsable Infrastructure** | [NOM À REMPLIR] | [EMAIL] | [TÉL] |
| **Administrateur Azure** | [NOM À REMPLIR] | [EMAIL] | [TÉL] |
| **DPO** | Dr. [NOM À REMPLIR] | [EMAIL] | [TÉL] |
| **RSSI** | [NOM À REMPLIR] | [EMAIL] | [TÉL] |

---

## Annexes

### Annexe A : Commandes de Déploiement Complètes

```bash
#!/bin/bash
# deploy_hds_infrastructure.sh
# Script complet de déploiement infrastructure HDS

set -e

RESOURCE_GROUP="medicapp-prod-rg"
LOCATION="francecentral"
VNET_NAME="medicapp-vnet-prod"

echo "=== Déploiement Infrastructure HDS MedicApp ==="

# 1. Créer le Resource Group
echo "1. Création Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Créer le VNet
echo "2. Création VNet..."
az network vnet create \
  --name $VNET_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --address-prefix 10.0.0.0/16

# 3. Créer les subnets
echo "3. Création Subnets..."

# Subnet pour App Service
az network vnet subnet create \
  --name snet-app \
  --resource-group $RESOURCE_GROUP \
  --vnet-name $VNET_NAME \
  --address-prefixes 10.0.1.0/24 \
  --delegations Microsoft.Web/serverFarms

# Subnet pour Private Endpoints
az network vnet subnet create \
  --name snet-private-endpoints \
  --resource-group $RESOURCE_GROUP \
  --vnet-name $VNET_NAME \
  --address-prefixes 10.0.2.0/24 \
  --disable-private-endpoint-network-policies true

# 4. Créer les zones DNS privées
echo "4. Création Zones DNS Privées..."

ZONES=(
  "privatelink.postgres.database.azure.com"
  "privatelink.blob.core.windows.net"
  "privatelink.vaultcore.azure.net"
)

for ZONE in "${ZONES[@]}"; do
  az network private-dns zone create \
    --resource-group $RESOURCE_GROUP \
    --name $ZONE

  az network private-dns link vnet create \
    --resource-group $RESOURCE_GROUP \
    --zone-name $ZONE \
    --name "link-$VNET_NAME" \
    --virtual-network $VNET_NAME \
    --registration-enabled false
done

echo "=== Déploiement terminé ==="
echo "Prochaine étape: Créer les Private Endpoints pour chaque service"
```

### Annexe B : Diagramme de Flux Réseau

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUX RÉSEAU MEDICAPP                             │
└─────────────────────────────────────────────────────────────────────────┘

UTILISATEUR (Internet)
        │
        │ HTTPS (443)
        ▼
┌─────────────────┐
│ Azure Front Door│ ◄─── WAF, DDoS Protection
│   ou App GW     │
└────────┬────────┘
         │
         │ HTTPS (443)
         ▼
┌─────────────────┐
│   App Service   │ ◄─── VNet Integration activée
│    Backend      │
└────────┬────────┘
         │
         │ Via VNet (trafic privé)
         │
    ┌────┴────┬────────────┐
    │         │            │
    ▼         ▼            ▼
┌───────┐ ┌───────┐ ┌─────────┐
│  PE   │ │  PE   │ │   PE    │
│Postgres│ │ Blob │ │Key Vault│
└───┬───┘ └───┬───┘ └────┬────┘
    │         │          │
    ▼         ▼          ▼
┌───────┐ ┌───────┐ ┌─────────┐
│  DB   │ │Storage│ │ Secrets │
│       │ │       │ │         │
└───────┘ └───────┘ └─────────┘

Légende:
─────── Trafic chiffré (TLS 1.3)
PE      Private Endpoint
```

---

## Historique des Versions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | [DATE] | [NOM] | Version initiale |

---

**Document maintenu par :** [NOM À REMPLIR]
**Dernière revue :** [DATE À REMPLIR]
**Prochaine revue :** [DATE + 6 MOIS]

---

*Ce document est confidentiel et destiné à un usage interne uniquement.*
*MedicApp - Infrastructure Azure HDS*
