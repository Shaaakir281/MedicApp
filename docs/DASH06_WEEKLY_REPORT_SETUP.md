# DASH-06 - Rapport email hebdomadaire (Logic App)

Objectif: recevoir chaque lundi matin un email de synthese sur l'activite MedicApp, sans refaire du copier/coller a chaque fois.

## Prerequis
- Application Insights: `medicapp-appinsights`
- Resource Group: `medicapp-rg`
- Action Group email deja operationnel (OK)
- Logic App (Consumption) autorisee

## 1) Creer la Logic App
- Nom: `medicapp-weekly-monitoring-report`
- Type: `Consumption`
- Region: `westeurope`

## 2) Declencheur (Recurrence)
- Frequency: `Week`
- Interval: `1`
- Time zone: `Europe/Paris`
- On these days: `Monday`
- At these hours: `08`
- At these minutes: `00`

## 3) Ajouter 5 actions "Run query and list results"

Important: nomme exactement les actions ci-dessous pour pouvoir reutiliser les expressions email.

### Action 1 - `KQL_Registered`
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where timestamp > ago(7d) and event_name == "patient_registered"
| summarize value=count()
```

### Action 2 - `KQL_Signed`
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where timestamp > ago(7d) and event_name == "signature_all_completed"
| summarize value=count()
```

### Action 3 - `KQL_Booked`
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where timestamp > ago(7d) and event_name == "appointment_booked"
| summarize value=count()
```

### Action 4 - `KQL_Backend5xx`
```kusto
requests
| where timestamp > ago(7d)
| where tostring(resultCode) startswith "5"
| summarize value=count()
```

### Action 5 - `KQL_Security`
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where timestamp > ago(7d)
| where event_name in ("auth_account_locked", "auth_mfa_failure")
| summarize value=count()
```

Parametres communs de chaque action:
- Resource: `medicapp-appinsights`
- Time range: `Set in query`
- Visualization: `Table`

## 4) Ajouter l'action email

Action recommandee:
- `Office 365 Outlook - Send an email (V2)` (ou SMTP/SendGrid si besoin)

Sujet:
`MedicApp - Rapport hebdomadaire monitoring`

Corps HTML:
```html
<h2>MedicApp - Rapport hebdomadaire</h2>
<p>Periode: 7 derniers jours</p>
<ul>
  <li>Inscriptions: @{coalesce(first(body('KQL_Registered')?['value'])?['value'], 0)}</li>
  <li>Signatures completes: @{coalesce(first(body('KQL_Signed')?['value'])?['value'], 0)}</li>
  <li>RDV pris: @{coalesce(first(body('KQL_Booked')?['value'])?['value'], 0)}</li>
  <li>Erreurs backend 5xx: @{coalesce(first(body('KQL_Backend5xx')?['value'])?['value'], 0)}</li>
  <li>Alertes securite (lock/mfa fail): @{coalesce(first(body('KQL_Security')?['value'])?['value'], 0)}</li>
</ul>
```

## 5) Test
- `Run trigger` -> `Run now`
- Verifier que chaque action KQL est en `Succeeded`
- Verifier la reception de l'email et les valeurs

## 6) Exploitation
- Garde cette Logic App dans `medicapp-rg` pour centraliser les ops.
- Si besoin, ajoute ensuite une couleur/alerte visuelle dans le mail (ex: 5xx > 20).
- Si une expression ne passe pas, ouvre la sortie brute d'une action KQL et adapte `body('ActionName')`.
