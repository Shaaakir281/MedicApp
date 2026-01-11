import React, { useState } from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';
import { sendConsentSignatureLinkByEmail } from '../../../services/patientDashboard.api.js';

export function SendLinkPanel({
  token,
  documentType,
  primaryLabel,
  primaryEmail,
  secondaryLabel,
  secondaryEmail,
  onReloadDashboard,
  setError,
  setSuccessMessage,
}) {
  const [customEmail, setCustomEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (email) => {
    if (!token || !email) return;
    setError?.(null);
    setSuccessMessage?.(null);
    setSending(true);
    try {
      await sendConsentSignatureLinkByEmail({ token, email, documentType });
      setSuccessMessage?.(`Lien envoyé à ${email}.`);
      await onReloadDashboard?.();
    } catch (err) {
      setError?.(err?.message || "Échec de l'envoi du lien.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700 font-semibold">{LABELS_FR.patientSpace.documents.signature.sendLink}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className="btn btn-xs btn-outline"
          onClick={() => handleSend(primaryEmail)}
          disabled={!primaryEmail || sending}
        >
          {primaryLabel} ({primaryEmail || 'email absent'})
        </button>
        <button
          type="button"
          className="btn btn-xs btn-outline"
          onClick={() => handleSend(secondaryEmail)}
          disabled={!secondaryEmail || sending}
        >
          {secondaryLabel} ({secondaryEmail || 'email absent'})
        </button>
        <input
          type="email"
          className="input input-bordered input-xs"
          placeholder="Autre email"
          value={customEmail}
          onChange={(e) => setCustomEmail(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-xs btn-primary"
          onClick={() => handleSend(customEmail)}
          disabled={!customEmail || sending}
        >
          {sending ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
}

