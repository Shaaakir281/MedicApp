# M3 - Requetes KQL (MedicApp)

Ces requetes sont adaptees aux evenements envoyes par `EventTracker`.
Elles lisent les donnees dans `traces` (format actuel) et aussi `customEvents` (si active plus tard).

## 0) Base commune (a coller en haut de chaque requete)
```kusto
let events = materialize(
    union isfuzzy=true
    (
        customEvents
        | extend event_name = tostring(name)
        | project timestamp, event_name, customDimensions
    ),
    (
        traces
        | extend event_name = tostring(customDimensions.event_name)
        | extend event_name = iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)", 1, message), event_name)
        | where isnotempty(event_name)
        | project timestamp, event_name, customDimensions
    )
);
```

## DASH-01 - Activite patient

### 1) Inscriptions par jour (30 derniers jours)
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "patient_registered"
| where timestamp > ago(30d)
| summarize inscriptions=count() by jour=bin(timestamp, 1d)
| order by jour asc
```

### 2) Funnel parcours (30 derniers jours)
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let registered = toscalar(events | where event_name=="patient_registered" and timestamp>ago(30d) | summarize dcount(tostring(customDimensions.patient_id)));
let dossier_completed = toscalar(events | where event_name=="patient_dossier_completed" and timestamp>ago(30d) | summarize dcount(tostring(customDimensions.patient_id)));
let booked = toscalar(events | where event_name=="appointment_booked" and timestamp>ago(30d) | summarize dcount(tostring(customDimensions.patient_id)));
let signed = toscalar(events | where event_name=="signature_all_completed" and timestamp>ago(30d) | summarize dcount(strcat(tostring(customDimensions.procedure_id), ":", tostring(customDimensions.document_type))));
datatable(step:string, count:long)
[
    "1_registered", registered,
    "2_dossier_completed", dossier_completed,
    "3_booked", booked,
    "4_signed", signed
]
| order by step asc
| serialize
| extend previous = prev(count)
| extend drop_pct_vs_previous = iff(isnull(previous) or previous == 0, real(null), round((previous - count) * 100.0 / previous, 2))
```

### 3) Temps moyen par transition de parcours
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "patient_journey_transition"
| extend from_step = tostring(customDimensions.from_step)
| extend to_step = tostring(customDimensions.to_step)
| extend time_h = todouble(customDimensions.time_in_previous_step_hours)
| where isnotempty(from_step) and isnotempty(to_step)
| summarize avg_time_h=round(avg(time_h), 2), p50_h=round(percentile(time_h, 50), 2), p90_h=round(percentile(time_h, 90), 2) by from_step, to_step
| order by from_step asc, to_step asc
```

### 4) Patients actifs: semaine en cours vs precedente
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let this_week_start = startofweek(now());
let previous_week_start = startofweek(ago(7d));
let current = toscalar(
    events
    | where timestamp >= this_week_start
    | where isnotempty(tostring(customDimensions.patient_id))
    | summarize dcount(tostring(customDimensions.patient_id))
);
let previous = toscalar(
    events
    | where timestamp >= previous_week_start and timestamp < this_week_start
    | where isnotempty(tostring(customDimensions.patient_id))
    | summarize dcount(tostring(customDimensions.patient_id))
);
print active_patients_this_week=current, active_patients_previous_week=previous
| extend delta_pct = iff(active_patients_previous_week == 0, real(null), round((active_patients_this_week - active_patients_previous_week) * 100.0 / active_patients_previous_week, 2))
```

## DASH-02 - Signatures

### 1) Signatures initiees par mode (semaine)
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name in ("signature_yousign_initiated", "signature_cabinet_initiated")
| extend mode = iff(event_name contains "yousign", "yousign", "cabinet")
| extend signature_key = strcat(tostring(customDimensions.procedure_id), ":", tostring(customDimensions.document_type), ":", mode)
| summarize signatures_inities=dcount(signature_key) by semaine=bin(timestamp, 7d), mode
| order by semaine asc
```

### 2) Delai moyen de completion (jours)
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "signature_all_completed"
| extend total_time_days = todouble(customDimensions.measurement_total_time_days)
| where isfinite(total_time_days)
| summarize avg_days=round(avg(total_time_days), 2), p50_days=round(percentile(total_time_days, 50), 2), p90_days=round(percentile(total_time_days, 90), 2) by mode=tostring(customDimensions.mode)
```

### 3) Taux completees vs en attente (30 jours)
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let initiated = toscalar(
    events
    | where timestamp > ago(30d)
    | where event_name in ("signature_yousign_initiated", "signature_cabinet_initiated")
    | extend signature_key = strcat(tostring(customDimensions.procedure_id), ":", tostring(customDimensions.document_type))
    | summarize dcount(signature_key)
);
let completed = toscalar(
    events
    | where timestamp > ago(30d)
    | where event_name == "signature_all_completed"
    | extend signature_key = strcat(tostring(customDimensions.procedure_id), ":", tostring(customDimensions.document_type))
    | summarize dcount(signature_key)
);
print initiated=initiated, completed=completed
| extend pending = max_of(initiated - completed, 0)
| extend completion_rate_pct = iff(initiated == 0, real(null), round(completed * 100.0 / initiated, 2))
```

### 4) Signatures ouvertes > 7 jours sans completion
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let initiated =
    events
    | where event_name in ("signature_yousign_initiated", "signature_cabinet_initiated")
    | extend signature_key = strcat(tostring(customDimensions.procedure_id), ":", tostring(customDimensions.document_type))
    | summarize initiated_at=min(timestamp) by signature_key;
let completed =
    events
    | where event_name == "signature_all_completed"
    | extend signature_key = strcat(tostring(customDimensions.procedure_id), ":", tostring(customDimensions.document_type))
    | summarize completed_at=max(timestamp) by signature_key;
initiated
| join kind=leftouter completed on signature_key
| where isnull(completed_at) and initiated_at < ago(7d)
| project signature_key, initiated_at, days_open=round((now() - initiated_at) / 1d, 2)
| order by initiated_at asc
```

## DASH-03 - Rendez-vous

### 1) Taux de remplissage par jour
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "appointment_slot_utilization"
| extend slot_date = todatetime(strcat(tostring(customDimensions.slot_date), "T00:00:00Z"))
| extend booked = todouble(customDimensions.measurement_slots_booked)
| extend total = todouble(customDimensions.measurement_slots_total)
| extend rate = todouble(customDimensions.measurement_utilization_rate) * 100.0
| summarize booked=max(booked), total=max(total), fill_rate_pct=max(rate) by slot_date
| order by slot_date asc
```

### 2) RDV par type par semaine
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "appointment_booked"
| summarize rdv=count() by semaine=bin(timestamp, 7d), appointment_type=tostring(customDimensions.appointment_type)
| order by semaine asc
```

### 3) Taux d'annulation par type
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let booked =
    events
    | where timestamp > ago(30d) and event_name == "appointment_booked"
    | summarize booked=count() by appointment_type=tostring(customDimensions.appointment_type);
let cancelled =
    events
    | where timestamp > ago(30d) and event_name == "appointment_cancelled"
    | summarize cancelled=count() by appointment_type=tostring(customDimensions.appointment_type);
booked
| join kind=fullouter cancelled on appointment_type
| extend booked=coalesce(booked, 0), cancelled=coalesce(cancelled, 0)
| extend cancellation_rate_pct = iff(booked == 0, real(null), round(cancelled * 100.0 / booked, 2))
| order by appointment_type asc
```

### 4) Delai moyen inscription -> premier RDV
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let registered =
    events
    | where event_name == "patient_registered"
    | summarize registered_at=min(timestamp) by patient_id=tostring(customDimensions.patient_id);
let first_booking =
    events
    | where event_name == "appointment_booked"
    | summarize first_booking_at=min(timestamp) by patient_id=tostring(customDimensions.patient_id);
registered
| join kind=inner first_booking on patient_id
| where first_booking_at >= registered_at
| extend delay_days = todouble(first_booking_at - registered_at) / 1d
| summarize avg_delay_days=round(avg(delay_days), 2), p50_days=round(percentile(delay_days, 50), 2), p90_days=round(percentile(delay_days, 90), 2)
```

## DASH-04 - Securite

### 1) Echecs login par heure (par IP)
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "auth_login_failure"
| summarize attempts=count() by heure=bin(timestamp, 1h), ip=tostring(customDimensions.ip_address)
| order by heure asc
```

### 2) Comptes verrouilles cette semaine
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "auth_account_locked"
| where timestamp >= startofweek(now())
| summarize lockouts=count(), users=dcount(tostring(customDimensions.user_id))
```

### 3) Top 10 IP en echecs login (24h)
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "auth_login_failure"
| where timestamp > ago(24h)
| summarize attempts=count() by ip=tostring(customDimensions.ip_address)
| top 10 by attempts desc
```

### 4) Taux de succes MFA
```kusto
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let sent = toscalar(events | where timestamp > ago(30d) and event_name == "auth_mfa_sent" | summarize count());
let success = toscalar(events | where timestamp > ago(30d) and event_name == "auth_mfa_success" | summarize count());
let failure = toscalar(events | where timestamp > ago(30d) and event_name == "auth_mfa_failure" | summarize count());
print mfa_sent=sent, mfa_success=success, mfa_failure=failure
| extend mfa_success_rate_pct = iff(mfa_sent == 0, real(null), round(mfa_success * 100.0 / mfa_sent, 2))
```

## Seuils securite recommandes
- Brute-force: `> 20` echecs login par IP / heure.
- Lockout comptes: `> 3` lockouts / heure.
- MFA success rate: alerte si `< 70%` sur 24h.

