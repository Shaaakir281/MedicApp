# Sprint Monitoring - Etat d'avancement

Date: 2026-02-19

## M1 - Alertes techniques (Azure)
- MON-01 Action Group email: `Fait` (`medicapp-alerts-email`)
- MON-02 Alerte HTTP 5xx: `Fait` (`MedicApp - Erreurs 5xx`)
- MON-03 Alerte temps de reponse: `Fait` (`MedicApp - Temps de reponse degrade`)
- MON-04 Alerte exceptions backend: `Fait` (`MedicApp - Exceptions backend`)
- MON-05 Alertes CPU/Memoire: `Fait` (`MedicApp - CPU eleve`, `MedicApp - Memoire elevee`)
- MON-06 Alertes PostgreSQL: `Fait` (`MedicApp - Connexions DB elevees`, `MedicApp - Stockage DB eleve`)
- MON-07 Test de bout en bout: `Fait` (email recu + jobs internes executes avec succes)

## M2 - Logging metier (backend)
- LOG-10 EventTracker singleton + injection app: `Fait`
- LOG-11 Inscriptions/dossier:
  - `patient_registered`: `Fait`
  - `patient_dossier_completed`: `Fait`
  - `patient_email_verified`: `Fait`
  - `patient_phone_verified`: `Fait`
- LOG-12 Signatures:
  - `signature_yousign_initiated/completed`: `Fait`
  - `signature_cabinet_initiated/completed`: `Fait`
  - `signature_all_completed`: `Fait`
- LOG-13 Rendez-vous:
  - `appointment_booked/cancelled`: `Fait`
  - `appointment_slot_utilization`: `Fait`
- LOG-14 Ordonnances:
  - `prescription_generated`: `Fait`
  - `prescription_downloaded`: `Fait`
- LOG-15 Securite:
  - `auth_login_success/failure`: `Fait`
  - `auth_mfa_sent/success/failure`: `Fait`
  - `auth_account_locked`: `Fait`
- LOG-16 Parcours patient:
  - `patient_journey_transition` (base): `Fait`
  - `reflection_period_ended`: `Fait` (job interne)
  - `patient_journey_abandoned`: `Fait` (job interne)

## M3 - Dashboards KQL
- DASH-01 a DASH-04: `Configure` (tuiles dashboard ajoutees; KQL dans `docs/M3_KQL_QUERIES.md`)
- DASH-05: `Fait` (dashboard structure et en-tete operationnel finalises)
- DASH-06: `Fait` (Logic App hebdomadaire configuree + email de synthese recu)

## M4 - Alertes metier
- ALERT-01 nouvelle inscription: `Fait` (`MedicApp - Nouvelle inscription`)
- ALERT-02 signatures completes: `Fait` (`MedicApp - Signature completee`)
- ALERT-03 fin delai de reflexion: `Fait` (`MedicApp - Delai reflexion termine`)
- ALERT-04 taux d'erreur anormal: `Fait` (`MedicApp - Taux erreurs anormal`)
- ALERT-05 brute-force: `Fait` (`MedicApp - Brute force suspecte`)
- ALERT-06 parcours abandonne: `Fait` (`MedicApp - Parcours abandonne detecte`)

## Ajustements anti-bruit (production)
- 2026-02-19 - Alerte `MedicApp - Temps de reponse degrade` ajustee:
  - seuil `HttpResponseTime`: `> 5s` (avant `> 3s`)
  - fenetre d'agregation: `PT15M` (avant `PT5M`)
  - frequence d'evaluation: `PT5M` (avant `PT1M`)
  - severite: `Sev3` (avant `Sev2`)
- 2026-02-19 - Alertes metier M4 configurees en production (scheduled query rules):
  - `MedicApp - Nouvelle inscription` (Sev4)
  - `MedicApp - Signature completee` (Sev4)
  - `MedicApp - Delai reflexion termine` (Sev3)
  - `MedicApp - Parcours abandonne detecte` (Sev3)
  - `MedicApp - Taux erreurs anormal` (Sev2, requete anti-bruit: trafic >= 20 et taux 5xx > 5% / 15m)
  - `MedicApp - Brute force suspecte` (Sev1, >= 10 echecs login/IP / 15m)

## Changements backend ajoutes pour M4
- Endpoint interne securise:
  - `GET /internal/check-reflection-period`
  - `GET /internal/check-abandoned-journeys`
- Header requis: `X-Internal-Key`
- Variable d'env: `INTERNAL_JOBS_KEY`

## Exploitation monitoring
- Runbook operationnel: `docs/MONITORING_RUNBOOK.md`
