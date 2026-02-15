# M3 - Dashboard Azure Monitor (mise en place)

Dashboard cree:
- Nom: `medicapp-monitoring-dashboard`
- Resource Group: `medicapp-rg`
- ID: `/subscriptions/22045923-e995-4df0-8001-27de3b66290f/resourceGroups/medicapp-rg/providers/Microsoft.Portal/dashboards/medicapp-monitoring-dashboard`

Fichiers versionnes:
- Proprietes dashboard: `docs/azure_dashboard_medicapp_monitoring_properties.json`
- ARM template: `docs/azure_dashboard_medicapp_monitoring_arm.json`
- Requetes KQL: `docs/M3_KQL_QUERIES.md`

## Ajouter les tuiles KQL au dashboard

1. Ouvrir `medicapp-appinsights` -> `Logs`.
2. Copier/coller une requete de `docs/M3_KQL_QUERIES.md`.
3. Executer la requete.
4. Cliquer `Pin to dashboard` / `Epingler au tableau de bord`.
5. Choisir `medicapp-monitoring-dashboard`.
6. Refaire pour chaque requete prioritaire.

## Ordre recommande des tuiles

Section Activite patient:
- Inscriptions par jour (DASH-01.1)
- Funnel parcours (DASH-01.2)
- Patients actifs semaine (DASH-01.4)

Section Signatures:
- Signatures initiees par mode (DASH-02.1)
- Delai moyen completion (DASH-02.2)
- Signatures ouvertes > 7 jours (DASH-02.4)

Section Rendez-vous:
- Taux remplissage par jour (DASH-03.1)
- RDV par type (DASH-03.2)
- Taux annulation (DASH-03.3)

Section Securite:
- Echecs login par heure (DASH-04.1)
- Top IP echecs (DASH-04.3)
- Taux succes MFA (DASH-04.4)

## Verification rapide

- Le dashboard charge sans erreur.
- Chaque tuile affiche des donnees sur 24h/7j selon la requete.
- Les tuiles securite montrent bien les events `auth_*`.

