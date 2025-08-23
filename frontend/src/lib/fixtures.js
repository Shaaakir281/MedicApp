/**
 * This module defines functions that return static data used to seed the
 * application. These seeds simulate data that would normally come from
 * a database or API. Modify these values to customise the demo.
 */

export const getPracticienSeed = () => {
  return {
    // Pre‑reserved appointments (seeded)
    appointmentsSeed: [
      { date: '2025-09-01', time: '10:00' },
      { date: '2025-09-01', time: '11:00' },
      { date: '2025-09-02', time: '09:30' },
    ],
    // Patients scheduled for today with flags for UI state
    patientsToday: [
      {
        nom: 'Marc Dupont, 67 ans',
        heure: '11:30',
        acte: 'Biopsie cutanée',
        urgent: true,
        validated: false,
        note: '⚠️ Sous anticoagulants • Surveillance requise',
      },
      {
        nom: 'Léa Marceau, 34 ans',
        heure: '10:00',
        acte: 'Ablation grain de beauté',
        urgent: false,
        validated: false,
        note: '📋 Allergie pénicilline notée',
      },
      {
        nom: 'Sophie Martin, 42 ans',
        heure: '14:00',
        acte: 'Exérèse kyste',
        urgent: false,
        validated: true,
        note: '✅ Ordonnance envoyée • Patient notifié',
      },
    ],
  };
};

export const getUiMetrics = () => {
  return {
    rdvToday: 8,
    pending: 5,
    urgent: 2,
    validatedMonth: 47,
  };
};