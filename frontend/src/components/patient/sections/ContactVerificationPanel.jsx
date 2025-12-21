import React, { useMemo, useState } from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';
import { requestGuardianPhoneOtp, verifyGuardianPhoneOtp } from '../../../services/patientDashboard.api.js';

const buildGuardian = (procedureCase, dashboard, role) => {
  const fromDash = (dashboard?.guardians || []).find((g) => g?.label === role) || null;
  const prefix = role === 'parent1' ? 'parent1' : 'parent2';
  return {
    role,
    name: fromDash?.name || procedureCase?.[`${prefix}_name`] || '',
    email: fromDash?.email || procedureCase?.[`${prefix}_email`] || '',
    phone: fromDash?.phone || procedureCase?.[`${prefix}_phone`] || '',
    verified:
      (role === 'parent1'
        ? dashboard?.contact_verification?.parent1_verified
        : dashboard?.contact_verification?.parent2_verified) ??
      Boolean(procedureCase?.[`${prefix}_phone_verified_at`]),
  };
};

export function ContactVerificationPanel({
  token,
  procedureCase,
  dashboard,
  onReloadCase,
  onReloadDashboard,
  setError,
  setSuccessMessage,
}) {
  const guardians = useMemo(
    () => [buildGuardian(procedureCase, dashboard, 'parent1'), buildGuardian(procedureCase, dashboard, 'parent2')],
    [procedureCase, dashboard],
  );

  const [otpCodes, setOtpCodes] = useState({ parent1: '', parent2: '' });
  const [otpSending, setOtpSending] = useState({ parent1: false, parent2: false });
  const [otpVerifying, setOtpVerifying] = useState({ parent1: false, parent2: false });

  const handleRequestOtp = async (role) => {
    if (!token) return;
    setError?.(null);
    setSuccessMessage?.(null);
    setOtpSending((prev) => ({ ...prev, [role]: true }));
    try {
      await requestGuardianPhoneOtp({ token, parentRole: role });
      setSuccessMessage?.('Code SMS envoyé.');
      await onReloadCase?.();
      await onReloadDashboard?.();
    } catch (err) {
      setError?.(err?.message || "Impossible d'envoyer le code.");
    } finally {
      setOtpSending((prev) => ({ ...prev, [role]: false }));
    }
  };

  const handleVerifyOtp = async (role) => {
    if (!token) return;
    const code = otpCodes[role]?.trim();
    if (!code) {
      setError?.('Veuillez saisir le code SMS.');
      return;
    }
    setError?.(null);
    setSuccessMessage?.(null);
    setOtpVerifying((prev) => ({ ...prev, [role]: true }));
    try {
      await verifyGuardianPhoneOtp({ token, parentRole: role, code });
      setSuccessMessage?.('Téléphone vérifié.');
      setOtpCodes((prev) => ({ ...prev, [role]: '' }));
      await onReloadCase?.();
      await onReloadDashboard?.();
    } catch (err) {
      setError?.(err?.message || 'Échec de vérification.');
    } finally {
      setOtpVerifying((prev) => ({ ...prev, [role]: false }));
    }
  };

  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Vérification contact</h2>
        <p className="text-sm text-slate-600">
          Validation SMS (Parent 1 / Parent 2) pour signer à distance.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {guardians.map((guardian) => {
          const role = guardian.role;
          const canSend = Boolean(guardian.phone);
          return (
            <div key={role} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{LABELS_FR.patientSpace.guardians[role]}</p>
                  <p className="text-sm text-slate-600">
                    {guardian.email || 'Email non renseigné'} • {guardian.phone || 'Téléphone manquant'}
                  </p>
                </div>
                <span className={`badge ${guardian.verified ? 'badge-success' : 'badge-warning'}`}>
                  {guardian.verified ? 'Vérifié' : 'À vérifier'}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => handleRequestOtp(role)}
                  disabled={!canSend || otpSending[role]}
                >
                  {otpSending[role] ? 'Envoi…' : LABELS_FR.patientSpace.guardians.requestOtp}
                </button>
                <input
                  type="text"
                  className="input input-bordered input-sm"
                  placeholder={LABELS_FR.patientSpace.guardians.otpPlaceholder}
                  value={otpCodes[role] || ''}
                  onChange={(e) => setOtpCodes((prev) => ({ ...prev, [role]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => handleVerifyOtp(role)}
                  disabled={otpVerifying[role]}
                >
                  {otpVerifying[role] ? 'Vérification…' : LABELS_FR.patientSpace.guardians.verifyOtp}
                </button>
              </div>
              {!canSend && (
                <p className="text-xs text-red-500">
                  Renseignez et enregistrez le numéro de téléphone pour ce parent.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

