import { useCallback, useMemo, useState } from 'react';

import { loginUser } from '../lib/api.js';
import { sendPractitionerMfaCode, verifyPractitionerMfaCode } from '../services/mfa.api.js';
import { useAuth } from '../context/AuthContext.jsx';

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
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const response = await sendPractitionerMfaCode({
          token: mfaState.tempToken,
          phone,
        });
        setMfaState((prev) => ({ ...prev, phone: phone || prev.phone }));
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
