# Sprint Monitoring - Etat d'avancement

Date: 2026-02-15

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
  - `patient_journey_transition` (base): `Partiel`
  - `reflection_period_ended`: `Fait` (job interne)
  - `patient_journey_abandoned`: `Fait` (job interne)

## M3 - Dashboards KQL
- DASH-01 a DASH-04: `Pret` (requetes KQL disponibles dans `docs/M3_KQL_QUERIES.md`)
- DASH-05: `Partiel` (dashboard cree: `medicapp-monitoring-dashboard`; pinning tuiles a finaliser)
- DASH-06: `Pret a configurer` (guide + KQL dans `docs/DASH06_WEEKLY_REPORT_SETUP.md`)

## M4 - Alertes metier
- ALERT-01 nouvelle inscription: `A faire`
- ALERT-02 signatures completes: `A faire`
- ALERT-03 fin delai de reflexion: `Code fait` / `planification Azure a faire`
- ALERT-04 taux d'erreur anormal: `A faire`
- ALERT-05 brute-force: `A faire`
- ALERT-06 parcours abandonne: `Code fait` / `planification Azure a faire`

## Changements backend ajoutes pour M4
- Endpoint interne securise:
  - `GET /internal/check-reflection-period`
  - `GET /internal/check-abandoned-journeys`
- Header requis: `X-Internal-Key`
- Variable d'env: `INTERNAL_JOBS_KEY`
