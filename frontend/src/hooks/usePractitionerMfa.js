import { useCallback, useMemo, useState } from 'react';

import { loginUser } from '../lib/api.js';
import { sendPractitionerMfaCode, verifyPractitionerMfaCode } from '../services/mfa.api.js';
import { useAuth } from '../context/AuthContext.jsx';

const PHONE_ERROR =
  "Veuillez saisir un numero au format +33XXXXXXXXX (ex: +33612345678).";

const normalizePhone = (rawPhone) => {
  if (!rawPhone) return null;
  const cleaned = String(rawPhone).replace(/[\s().-]/g, '');
  if (!cleaned) return null;

  let normalized = cleaned;

  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (normalized.startsWith('+33')) {
    normalized = normalized.replace(/^\+330/, '+33');
  } else if (normalized.startsWith('0')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length === 10) {
      normalized = `+33${digits.slice(1)}`;
    }
  }

  if (!/^\+33[1-9]\d{8}$/.test(normalized)) {
    return null;
  }

  return normalized;
};

export function usePractitionerMfa() {
  const { completeLogin } = useAuth();
  const [mfaState, setMfaState] = useState({
    required: false,
    tempToken: null,
    email: null,
    phone: '',
  });
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const startLogin = useCallback(
    async (credentials) => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const data = await loginUser(credentials);
        if (data?.requires_mfa) {
          setMfaState({
            required: true,
            tempToken: data.temp_token,
            email: credentials.email,
            phone: credentials.phone || '',
          });
          setMessage(data.message || 'Code MFA requis.');
          return { requiresMfa: true };
        }
        completeLogin(data, credentials.email);
        return { requiresMfa: false };
      } catch (err) {
        setError(err?.message || 'Echec de la connexion.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [completeLogin],
  );

  const sendCode = useCallback(
    async (phone) => {
      if (!mfaState.tempToken) {
        setError('Session MFA invalide.');
        return false;
      }
      const trimmed = phone?.trim();
      let normalizedPhone = null;
      if (trimmed) {
        normalizedPhone = normalizePhone(trimmed);
        if (!normalizedPhone) {
          setError(PHONE_ERROR);
          return false;
        }
      }
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const response = await sendPractitionerMfaCode({
          token: mfaState.tempToken,
          phone: normalizedPhone ?? undefined,
        });
        setMfaState((prev) => ({
          ...prev,
          phone: normalizedPhone || prev.phone,
        }));
        setMessage(response?.message || 'Code envoye.');
        return true;
      } catch (err) {
        setError(err?.message || "Impossible d'envoyer le code.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [mfaState.tempToken],
  );

  const verifyCode = useCallback(
    async (code) => {
      if (!mfaState.tempToken) {
        setError('Session MFA invalide.');
        return false;
      }
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const tokens = await verifyPractitionerMfaCode({
          token: mfaState.tempToken,
          code,
        });
        completeLogin(tokens, mfaState.email);
        setMfaState({ required: false, tempToken: null, email: null, phone: '' });
        return true;
      } catch (err) {
        setError(err?.message || 'Code MFA invalide.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [completeLogin, mfaState.email, mfaState.tempToken],
  );

  const resetMfa = useCallback(() => {
    setError(null);
    setMessage(null);
    setMfaState({ required: false, tempToken: null, email: null, phone: '' });
  }, []);

  const state = useMemo(
    () => ({
      mfaRequired: mfaState.required,
      mfaEmail: mfaState.email,
      mfaPhone: mfaState.phone,
      error,
      message,
      loading,
    }),
    [mfaState, error, message, loading],
  );

  return {
    ...state,
    startLogin,
    sendCode,
    verifyCode,
    resetMfa,
  };
}
