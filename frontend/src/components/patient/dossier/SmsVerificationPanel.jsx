import React, { useState } from 'react';

const ROLE_LABELS = {
  PARENT_1: 'Parent 1',
  PARENT_2: 'Parent 2',
};

export function SmsVerificationPanel({ vm, onSend, onVerify, sendingRole, verifyingRole }) {
  const [codes, setCodes] = useState({ PARENT_1: '', PARENT_2: '' });

  const guardians = vm?.guardians || {};
  const verification = vm?.verification || {};

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-white">
      <div>
        <p className="font-semibold">Vérification SMS</p>
        <p className="text-sm text-slate-600">Code OTP requis pour signature à distance.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {Object.entries(guardians).map(([role, guardian]) => {
          const canSend = Boolean(guardian.phoneE164);
          const status = verification[role]?.step || 'idle';
          const verified = status === 'verified' || Boolean(guardian.phoneVerifiedAt);
          return (
            <div key={role} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{ROLE_LABELS[role] || role}</p>
                  <p className="text-sm text-slate-600">
                    {guardian.email || 'Email manquant'} · {guardian.phoneE164 || 'Téléphone manquant'}
                  </p>
                </div>
                <span className={`badge ${verified ? 'badge-success' : 'badge-warning'}`}>
                  {verified ? 'Vérifié' : 'À vérifier'}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => onSend(role)}
                  disabled={!canSend || sendingRole === role}
                >
                  {sendingRole === role ? 'Envoi…' : 'Envoyer le code'}
                </button>
                <input
                  type="text"
                  className="input input-bordered input-sm"
                  placeholder="Code SMS"
                  value={codes[role] || ''}
                  onChange={(e) => setCodes((prev) => ({ ...prev, [role]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onVerify(role, codes[role])}
                  disabled={verifyingRole === role}
                >
                  {verifyingRole === role ? 'Vérification…' : 'Valider'}
                </button>
              </div>
              {status === 'sent' && (
                <p className="text-xs text-slate-500">
                  Code envoyé. Expire dans ~{verification[role]?.expiresInSec || 300}s
                  {verification[role]?.cooldownSec ? ` · cooldown ${verification[role].cooldownSec}s` : ''}.
                </p>
              )}
              {!canSend && <p className="text-xs text-red-500">Renseignez le téléphone pour ce parent.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
