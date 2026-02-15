# DASH-06 - Rapport email hebdomadaire (Logic App)

Objectif: recevoir chaque lundi matin un email de synthese sur l'activite MedicApp.

## Prerequis
- Application Insights: `medicapp-appinsights`
- Action Group email deja operationnel (OK)
- Logic App (Consumption) autorisee dans `medicapp-rg`

## Option retenue
- Azure Logic App (recurrence hebdomadaire)
- Requetes KQL sur Application Insights
- Email texte/HTML de synthese

## Requetes KQL (7 derniers jours)

### A) Inscriptions semaine
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

### B) Signatures completes semaine
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

### C) RDV pris semaine
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

### D) Erreurs backend 5xx semaine
```kusto
requests
| where timestamp > ago(7d)
| where tostring(resultCode) startswith "5"
| summarize value=count()
```

### E) Alertes securite semaine
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

## Configuration Logic App (portail)

1. Creer une Logic App Consumption
- Nom: `medicapp-weekly-monitoring-report`
- Resource Group: `medicapp-rg`
- Region: `westeurope`

2. Declencheur
- `Recurrence`
- Frequence: `Week`
- Intervalle: `1`
- Jour: `Monday`
- Heure: `08:00`
- Fuseau: `Europe/Paris`

3. Actions KQL
- Ajouter 5 actions `Azure Monitor Logs - Run query and list results`
- Workspace/Resource: `medicapp-appinsights`
- Time range: `Set in query`
- Coller les requetes A a E

4. Construire le mail
- Action `Office 365 Outlook - Send an email (V2)` (ou connecteur SMTP/SendGrid selon ton setup)
- Sujet: `MedicApp - Rapport hebdomadaire monitoring`
- Corps (HTML) exemple:
  - Inscriptions: valeur A
  - Signatures completes: valeur B
  - RDV pris: valeur C
  - Erreurs 5xx: valeur D
  - Alertes securite: valeur E

5. Tester
- `Run trigger` -> `Run now`
- Verifier reception email
- Verifier les valeurs correspondent aux Logs

## Conseils
- Commencer avec email texte simple, puis passer en HTML.
- Ajouter ensuite des seuils (ex: 5xx > 20) avec couleur rouge/orange.
- Conserver cette Logic App dans `medicapp-rg` pour centraliser l'ops.

