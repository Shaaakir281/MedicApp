// Feature flags produit.
//
// Pour le pilote, certaines briques deja codees sont masquees du parcours actif
// sans etre supprimees (code dormant, reactivable en une ligne ou via env).
//
// Surcharge possible via variables d'environnement Vite (VITE_*) :
//   VITE_REMOTE_SIGNATURE_ENABLED=true
//   VITE_EXPLAINER_VIDEO_ENABLED=true
//   VITE_PAYMENT_ENABLED=true
//   VITE_TELECONSULTATION_ENABLED=true

const asBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

export const FEATURES = {
  // Signature a distance (Yousign). Desactivee pour le pilote :
  // les signatures se font sur place / sur tablette via la signature cabinet.
  REMOTE_SIGNATURE_ENABLED: asBool(import.meta.env.VITE_REMOTE_SIGNATURE_ENABLED, false),

  // Video explicative de preparation. Masquee pour le pilote, option future.
  EXPLAINER_VIDEO_ENABLED: asBool(import.meta.env.VITE_EXPLAINER_VIDEO_ENABLED, false),

  // Paiement Stripe de la consultation prealable. Desactive tant que le flux
  // n'est pas visible dans l'interface patient.
  PAYMENT_ENABLED: asBool(import.meta.env.VITE_PAYMENT_ENABLED, false),

  // Salle de teleconsultation integree. S'active apres le socle LiveKit.
  TELECONSULTATION_ENABLED: asBool(import.meta.env.VITE_TELECONSULTATION_ENABLED, false),
};
