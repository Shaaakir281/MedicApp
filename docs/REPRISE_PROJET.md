# MedicApp - Pause et reprise du projet

Derniere verification: 2026-06-10

Ce document est la source de verite operationnelle pour reprendre MedicApp apres la mise en pause de l'infrastructure Azure.

## 1. Depot de reference

- Dossier local: `C:\Users\fathi\OneDrive\App_medical\MedicApp`
- Depot GitHub: `https://github.com/Shaaakir281/MedicApp`
- Remote Git: `origin`
- Branche de reference: `main`
- Resource Group Azure: `medicapp-rg`
- Abonnement Azure utilise: `Abonnement 1`

Verification rapide:

```powershell
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git status --short --branch
az account show --output table
```

## 2. Etat de pause verifie

Etat constate le 2026-06-10:

| Composant | Ressource | Etat |
|---|---|---|
| Backend | `medicapp-backend-prod` | Arrete |
| App Service Plan | `medicapp-plan` | `F1` Free |
| Domaine backend | `staging.medicapp.sethostscope.dev` | Retire du Web App |
| Certificat backend | certificat Azure existant | Valide jusqu'au 2026-08-08 |
| PostgreSQL | `medicappdbprod` | Supprime |
| Container Registry | `medicappregistry` | Supprime |
| Frontend | `medicapp-frontend` | Free, domaine `app.medicapp.sethostscope.dev` actif |
| Logic Apps | trois workflows MedicApp | Desactives |
| Monitoring | App Insights, alertes et dashboard | Conserves |
| Secrets | Key Vault et settings App Service | Conserves |

Points a ne pas oublier:

- `DATABASE_URL` existe encore dans les settings du backend, mais pointe vers la base supprimee.
- `DOCKER_CUSTOM_IMAGE_NAME` pointe encore vers l'ancien ACR supprime.
- `DOCKER_REGISTRY_SERVER_PASSWORD` est vide.
- Les secrets GitHub `AZURE_REGISTRY_*` existent encore, mais leurs anciennes valeurs sont obsoletes.
- Les migrations Alembic ne sont pas executees automatiquement au demarrage du conteneur.
- Le DNS `staging.medicapp.sethostscope.dev` pointe toujours vers le backend Azure.

## 3. Ressources conservees

Ces ressources n'ont pas besoin d'etre recreees:

- `medicapp-rg`
- `medicapp-plan`
- `medicapp-backend-prod`
- `medicapp-frontend`
- `medicapp-keyvault-prod`
- `medicapp-appinsights`
- alertes Azure Monitor
- dashboard Azure Monitor
- connexions Logic Apps
- Logic Apps des jobs et du rapport hebdomadaire

La configuration Mailjet/DNS est egalement conservee:

- SPF sur `medicapp.sethostscope.dev`
- DKIM sur `mailjet._domainkey.medicapp.sethostscope.dev`
- DMARC sur `_dmarc.medicapp.sethostscope.dev`
- MX OVH sur `medicapp.sethostscope.dev`
- redirection `no-reply@medicapp.sethostscope.dev`

Le statut du domaine et de l'expediteur doit toutefois etre recontrole dans l'interface Mailjet au moment de la reprise.

## 4. Procedure de reprise

Executer les etapes dans cet ordre.

### 4.1 Variables de travail

```powershell
$ResourceGroup = "medicapp-rg"
$Location = "westeurope"
$Plan = "medicapp-plan"
$WebApp = "medicapp-backend-prod"
$Registry = "medicappregistry"
$PostgresServer = "medicappdbprod"
$Database = "medscript"
$PostgresAdmin = "medicappadmin"
```

Se connecter et verifier le bon abonnement:

```powershell
az login
az account show --output table
gh auth status
```

### 4.2 Repasser le backend en B1

Le plan `F1` ne convient pas au conteneur de production avec domaine personnalise et SSL SNI.

```powershell
az appservice plan update `
  --resource-group $ResourceGroup `
  --name $Plan `
  --sku B1
```

### 4.3 Recreer Azure Container Registry

```powershell
az acr create `
  --resource-group $ResourceGroup `
  --name $Registry `
  --sku Basic `
  --admin-enabled true

$RegistryServer = az acr show `
  --resource-group $ResourceGroup `
  --name $Registry `
  --query loginServer `
  --output tsv

$RegistryUser = az acr credential show `
  --name $Registry `
  --query username `
  --output tsv

$RegistryPassword = az acr credential show `
  --name $Registry `
  --query "passwords[0].value" `
  --output tsv
```

Mettre a jour les secrets GitHub Actions:

```powershell
gh secret set AZURE_REGISTRY_LOGIN_SERVER `
  --repo Shaaakir281/MedicApp `
  --body $RegistryServer

gh secret set AZURE_REGISTRY_USERNAME `
  --repo Shaaakir281/MedicApp `
  --body $RegistryUser

gh secret set AZURE_REGISTRY_PASSWORD `
  --repo Shaaakir281/MedicApp `
  --body $RegistryPassword
```

Mettre a jour les identifiants du registre dans App Service:

```powershell
az webapp config appsettings set `
  --resource-group $ResourceGroup `
  --name $WebApp `
  --settings `
    DOCKER_REGISTRY_SERVER_URL="https://$RegistryServer" `
    DOCKER_REGISTRY_SERVER_USERNAME="$RegistryUser" `
    DOCKER_REGISTRY_SERVER_PASSWORD="$RegistryPassword"
```

### 4.4 Recreer PostgreSQL

Saisir un nouveau mot de passe fort. Ne pas l'enregistrer dans Git.

```powershell
$SecurePassword = Read-Host "Nouveau mot de passe PostgreSQL" -AsSecureString
$PostgresPassword = [System.Net.NetworkCredential]::new("", $SecurePassword).Password
$PublicIp = (Invoke-RestMethod "https://api.ipify.org").Trim()

az postgres flexible-server create `
  --resource-group $ResourceGroup `
  --name $PostgresServer `
  --location $Location `
  --tier Burstable `
  --sku-name Standard_B1ms `
  --storage-size 32 `
  --admin-user $PostgresAdmin `
  --admin-password $PostgresPassword `
  --public-access $PublicIp

az postgres flexible-server firewall-rule create `
  --resource-group $ResourceGroup `
  --name $PostgresServer `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0

az postgres flexible-server db create `
  --resource-group $ResourceGroup `
  --server-name $PostgresServer `
  --database-name $Database
```

Construire l'URL SQLAlchemy en encodant le mot de passe:

```powershell
$EncodedPassword = [System.Uri]::EscapeDataString($PostgresPassword)
$DatabaseUrl = "postgresql+psycopg2://${PostgresAdmin}:${EncodedPassword}@${PostgresServer}.postgres.database.azure.com/${Database}?sslmode=require"

az webapp config appsettings set `
  --resource-group $ResourceGroup `
  --name $WebApp `
  --settings DATABASE_URL="$DatabaseUrl"
```

### 4.5 Appliquer les migrations et recreer les donnees fictives

Depuis la racine du depot:

```powershell
Push-Location backend
$env:DATABASE_URL = $DatabaseUrl

.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe scripts\seed_practitioner_demo.py --reset

Remove-Item Env:DATABASE_URL
Pop-Location
```

Si le virtualenv n'existe plus:

```powershell
Push-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Pop-Location
```

### 4.6 Construire et deployer le backend

Le workflow `.github/workflows/backend-cicd.yml` construit l'image, la pousse dans ACR et deploie le Web App.

```powershell
gh workflow run backend-cicd.yml `
  --repo Shaaakir281/MedicApp `
  --ref main

Start-Sleep -Seconds 5

$RunId = gh run list `
  --repo Shaaakir281/MedicApp `
  --workflow backend-cicd.yml `
  --branch main `
  --limit 1 `
  --json databaseId `
  --jq ".[0].databaseId"

gh run watch $RunId `
  --repo Shaaakir281/MedicApp `
  --exit-status
```

Puis demarrer le backend:

```powershell
az webapp start `
  --resource-group $ResourceGroup `
  --name $WebApp
```

Verifier l'image configuree:

```powershell
az webapp config container show `
  --resource-group $ResourceGroup `
  --name $WebApp `
  --output table
```

### 4.7 Tester avant de remettre le domaine backend

```powershell
Invoke-WebRequest `
  -Uri "https://medicapp-backend-prod.azurewebsites.net/" `
  -Method Get
```

Verifier ensuite:

- connexion patient
- creation de dossier
- OTP SMS
- email de verification
- prise et annulation de rendez-vous
- signature Yousign
- logs Application Insights

### 4.8 Remettre le domaine backend

Le CNAME DNS existe toujours. Au 2026-06-10, le certificat Azure existant expire le 2026-08-08.

```powershell
az webapp config hostname add `
  --resource-group $ResourceGroup `
  --webapp-name $WebApp `
  --hostname staging.medicapp.sethostscope.dev

az webapp config ssl bind `
  --resource-group $ResourceGroup `
  --name $WebApp `
  --hostname staging.medicapp.sethostscope.dev `
  --certificate-thumbprint E9DFAE812D0E650ACDEF56C15062D7E7E77A347B `
  --ssl-type SNI
```

Si la reprise a lieu apres le 2026-08-08, regenerer le certificat avant le binding SSL.

### 4.9 Reactiver les Logic Apps

Ne les reactiver qu'apres validation du backend et de la base:

```powershell
$Workflows = @(
  "medicapp-job-abandoned-weekly",
  "medicapp-job-reflection-daily",
  "medicapp-weekly-monitoring-report"
)

foreach ($Workflow in $Workflows) {
  az logic workflow update `
    --resource-group $ResourceGroup `
    --name $Workflow `
    --state Enabled
}
```

## 5. Configuration a controler

Les settings applicatifs sensibles sont encore presents dans App Service. Ne pas les copier dans la documentation.

Verifier seulement leur presence:

```powershell
az webapp config appsettings list `
  --resource-group $ResourceGroup `
  --name $WebApp `
  --query "[].name" `
  --output table
```

Point fonctionnel a revoir lors de la reprise:

- `FRONTEND_BASE_URL` pointe encore vers le hostname Azure Static Web Apps.
- Le domaine public frontend est `https://app.medicapp.sethostscope.dev`.
- Decider si les liens envoyes par email doivent utiliser le domaine public, puis tester les flux avant modification.

## 6. Validation finale

```powershell
az appservice plan show `
  --resource-group $ResourceGroup `
  --name $Plan `
  --query "{sku:sku.name,tier:sku.tier}" `
  --output table

az postgres flexible-server show `
  --resource-group $ResourceGroup `
  --name $PostgresServer `
  --query "{state:state,sku:sku.name}" `
  --output table

az acr show `
  --resource-group $ResourceGroup `
  --name $Registry `
  --query "{loginServer:loginServer,sku:sku.name}" `
  --output table

az logic workflow list `
  --resource-group $ResourceGroup `
  --query "[].{name:name,state:state}" `
  --output table
```

Le smoke check monitoring est disponible dans `scripts/monitoring_smoke_check.ps1`.

## 7. Hygiene du depot

Avant tout commit de reprise:

- ne pas inclure les modifications generees dans `frontend/node_modules/.vite/`
- ne pas inclure les fichiers temporaires `.tmp_*`
- verifier les fichiers non suivis avec `git status --short`
- effectuer les changements par petits lots testes
