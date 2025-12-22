import React, { useState, useEffect } from 'react';

import { InputField } from '../../ui';
import { PhoneInput } from './PhoneInput.jsx';

export function GuardianForm({
  title,
  prefix,
  formState,
  onChange,
  required = false,
  // Props pour vérification SMS intégrée
  guardianData = null,
  verificationState = null,
  onSendCode = null,
  onVerifyCode = null,
  sending = false,
  verifying = false,
  // Props pour vérification email
  onSendEmailVerification = null,
  sendingEmail = false,
  isUserAccount = false, // true si c'est le compte user (Parent 1)
  userEmailVerified = false, // true si email user déjà vérifié
}) {
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const isPhoneVerified = guardianData?.phoneVerifiedAt || verificationState?.step === 'verified';
  const isEmailVerified = guardianData?.emailVerifiedAt || (isUserAccount && userEmailVerified);
  const canSendCode = formState[`${prefix}Phone`] && !sending;
  const showCodeInput = verificationState?.step === 'sent' && !isPhoneVerified;

  // Gérer le compte à rebours
  useEffect(() => {
    if (verificationState?.cooldownSec > 0) {
      setCountdown(verificationState.cooldownSec);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [verificationState?.cooldownSec]);

  const handleSend = () => {
    if (onSendCode) {
      onSendCode();
    }
  };

  const handleVerify = () => {
    if (onVerifyCode && code.trim()) {
      onVerifyCode(code.trim());
      setCode('');
    }
  };

  return (
    <div className="space-y-3 border rounded-xl p-4 bg-slate-50">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        {(isPhoneVerified || isEmailVerified) && (
          <span className="badge badge-success badge-sm gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Vérifié
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InputField
          label="Prénom"
          placeholder="Prénom"
          value={formState[`${prefix}FirstName`] || ''}
          onChange={(e) => onChange(`${prefix}FirstName`, e.target.value)}
          required={required}
        />
        <InputField
          label="Nom"
          placeholder="Nom"
          value={formState[`${prefix}LastName`] || ''}
          onChange={(e) => onChange(`${prefix}LastName`, e.target.value)}
          required={required}
        />
      </div>

      <InputField
        label="Email"
        type="email"
        placeholder="parent@email.com"
        value={formState[`${prefix}Email`] || ''}
        onChange={(e) => onChange(`${prefix}Email`, e.target.value)}
        required={required}
      />

      {/* Vérification Email intégrée */}
      {isUserAccount && isEmailVerified && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <p className="text-xs text-green-800 flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Email vérifié (compte principal)
          </p>
        </div>
      )}

      {!isUserAccount && onSendEmailVerification && !isEmailVerified && formState[`${prefix}Email`] && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <p className="text-xs text-purple-800">
              La vérification email permet la signature électronique à distance.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary w-full"
            onClick={onSendEmailVerification}
            disabled={sendingEmail}
          >
            {sendingEmail ? 'Envoi en cours...' : "Envoyer l'email de vérification"}
          </button>
          <p className="text-xs text-purple-700">
            📧 Un lien de vérification sera envoyé à {formState[`${prefix}Email`]}
          </p>
        </div>
      )}

      {!isUserAccount && isEmailVerified && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <p className="text-xs text-green-800 flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Email vérifié - Signature électronique activée
          </p>
        </div>
      )}

      <PhoneInput
        label="Téléphone"
        value={formState[`${prefix}Phone`] || ''}
        onChange={(val) => onChange(`${prefix}Phone`, val)}
        required={required}
      />

      {/* Vérification SMS intégrée directement après le téléphone */}
      {onSendCode && !isPhoneVerified && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-blue-800">
              La vérification du téléphone permet la signature à distance par SMS.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-primary w-full"
            onClick={handleSend}
            disabled={!canSendCode || countdown > 0}
          >
            {sending
              ? 'Envoi en cours...'
              : countdown > 0
                ? `Renvoyer dans ${countdown}s`
                : showCodeInput
                  ? 'Renvoyer le code'
                  : 'Envoyer le code de vérification'}
          </button>

          {showCodeInput && (
            <div className="space-y-2 pt-2 border-t border-blue-200">
              <label className="text-xs font-medium text-blue-900">Code reçu par SMS</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="6"
                  placeholder="123456"
                  className="input input-bordered input-sm flex-1 text-center text-lg tracking-widest font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code.trim()) {
                      handleVerify();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={handleVerify}
                  disabled={verifying || !code.trim()}
                >
                  {verifying ? 'Vérification...' : 'Valider'}
                </button>
              </div>
              {verificationState?.expiresInSec && (
                <p className="text-xs text-blue-700">
                  ⏱️ Valide pendant {Math.floor(verificationState.expiresInSec / 60)} minutes
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Message si téléphone déjà vérifié */}
      {isPhoneVerified && guardianData?.phoneE164 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
          <p className="text-xs text-green-800 flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Téléphone vérifié - Signature SMS activée
          </p>
        </div>
      )}
    </div>
  );
}
