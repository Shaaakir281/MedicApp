# MedicApp - Runbook Monitoring

Date: 2026-02-19
Scope: production (`medicapp-rg`)

## 1. Outils de suivi
- Dashboard Azure: `medicapp-monitoring-dashboard`
- Application Insights: `medicapp-appinsights`
- Action group email: `medicapp-alerts-email`
- Rapport hebdomadaire: Logic App `medicapp-weekly-monitoring-report`

## 2. Routine quotidienne (5-10 min)
1. Ouvrir `medicapp-monitoring-dashboard`.
2. Verifier en priorite:
- `[Securite] Top 10 IP echecs (24h)`
- `[Securite] Taux succes MFA`
- `[RDV] Taux annulation`
- `[Signatures] ouvertes > 7 jours`
3. Ouvrir Azure Monitor -> `Alerts` -> filtrer `Last 24 hours`.
4. Traiter d'abord les `Sev1`, puis `Sev2`.

## 3. Routine hebdomadaire (15-20 min)
1. Lire l'email `MedicApp - Rapport hebdomadaire monitoring`.
2. Comparer aux dashboards:
- Inscriptions
- RDV pris
- Signatures completes
- Erreurs 5xx
- Alertes securite
3. Noter les anomalies dans le suivi sprint/ops.

## 4. Regles d'alerte actives (prod)

### Technique (M1)
- `MedicApp - Erreurs 5xx`
- `MedicApp - Temps de reponse degrade` (anti-bruit: `>5s`, fenetre `15m`, eval `5m`, `Sev3`)
- `MedicApp - CPU eleve`
- `MedicApp - Memoire elevee`
- `MedicApp - Connexions DB elevees`
- `MedicApp - Stockage DB eleve`
- `MedicApp - Exceptions backend`

### Metier/securite (M4)
- `MedicApp - Nouvelle inscription`
- `MedicApp - Signature completee`
- `MedicApp - Delai reflexion termine`
- `MedicApp - Parcours abandonne detecte`
- `MedicApp - Taux erreurs anormal`
- `MedicApp - Brute force suspecte`

## 5. Procedure de triage rapide (15 min)
1. Identifier l'alerte (nom, severite, heure `Fired`).
2. Ouvrir `Investigate` puis corréler avec:
- `requests` (codes, volume)
- `exceptions`
- traces d'evenements `auth_*`, `appointment_*`, `signature_*`
3. Evaluer impact:
- aucun impact patient visible
- impact partiel (fonction lente)
- blocage fonctionnel
4. Action:
- corriger/redemarrer/configurer si necessaire
- verifier `Resolved`
- consigner l'incident (heure, cause, action)

## 6. Playbooks courts par alerte

### `MedicApp - Brute force suspecte` (Sev1)
1. Identifier IP source et volume.
2. Verifier lockouts et MFA failures.
3. Activer blocage WAF/IP si pattern confirme.
4. Contrôler retour a la normale sur 30 min.

### `MedicApp - Taux erreurs anormal` (Sev2)
1. Verifier 5xx + endpoint dominant.
2. Correlier avec deploiement/restart recents.
3. Si incident actif: mitigation immediate (rollback/restart/correctif).

### `MedicApp - Temps de reponse degrade` (Sev3)
1. Verifier s'il y a trafic reel (éviter faux positif faible trafic).
2. Corréler CPU/Memoire/DB connections.
3. Surveiller retour sous seuil.

## 7. Bonnes pratiques
- Ne pas modifier simultanement plusieurs regles.
- Faire un test controle apres chaque changement.
- Conserver les noms d'alertes stables (historique lisible).
- Mettre a jour `docs/SPRINT_MONITORING_STATUS.md` apres chaque evolution.

## 8. Smoke check CLI (rapide)
Commande:
```powershell
.\scripts\monitoring_smoke_check.ps1
```

Options utiles:
```powershell
.\scripts\monitoring_smoke_check.ps1 -Days 30
.\scripts\monitoring_smoke_check.ps1 -ResourceGroup medicapp-rg -AppInsights medicapp-appinsights -Days 14
```

Le script affiche:
- volume des events metier clefs (`patient_registered`, `appointment_booked`, `signature_all_completed`, etc.)
- volume `patient_journey_transition`
- volume `requests` en 5xx
- top transitions `from_step -> to_step`
