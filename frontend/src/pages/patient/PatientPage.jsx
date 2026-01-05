import React, { useEffect, useRef, useState } from 'react';

import { AuthPanel } from './components/AuthPanel.jsx';
import { PatientSpacePage } from './PatientSpacePage.jsx';
import { ProcedureChoice } from '../../components/patient/ProcedureChoice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { LABELS_FR } from '../../constants/labels.fr.js';
import { resendVerificationEmail } from '../../lib/api.js';

const PROCEDURE_STORAGE_PREFIX = 'medicapp.patient.procedureSelection';

const isValidProcedureSelection = (value) => value === 'circumcision' || value === 'autre';

const buildProcedureStorageKey = (user) => {
  const userKey = user?.id ?? user?.email;
  if (!userKey) {
    return null;
  }
  return `${PROCEDURE_STORAGE_PREFIX}.${userKey}`;
};

export default function PatientPage() {
  const { isAuthenticated, login, register: registerUser, token, user, logout, loading } = useAuth();

  const [procedureSelection, setProcedureSelection] = useState(null);
  const [registerFeedback, setRegisterFeedback] = useState(null);
  const [resendFeedback, setResendFeedback] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [lastRegisterEmail, setLastRegisterEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const storageKeyRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!isAuthenticated) {
      setProcedureSelection(null);
      if (storageKeyRef.current) {
        window.localStorage.removeItem(storageKeyRef.current);
        storageKeyRef.current = null;
      }
      return;
    }
    const storageKey = buildProcedureStorageKey(user);
    storageKeyRef.current = storageKey;
    if (!storageKey || procedureSelection != null) {
      return;
    }
    const storedSelection = window.localStorage.getItem(storageKey);
    if (isValidProcedureSelection(storedSelection)) {
      setProcedureSelection(storedSelection);
    }
  }, [isAuthenticated, user?.id, user?.email, procedureSelection]);

  const handleProcedureSelection = (nextSelection) => {
    setProcedureSelection(nextSelection);
    if (typeof window === 'undefined') {
      return;
    }
    const storageKey = buildProcedureStorageKey(user);
    if (!storageKey || !isValidProcedureSelection(nextSelection)) {
      return;
    }
    window.localStorage.setItem(storageKey, nextSelection);
  };

  const clearProcedureSelection = () => {
    setProcedureSelection(null);
    if (typeof window === 'undefined') {
      return;
    }
    const storageKey = buildProcedureStorageKey(user);
    if (!storageKey) {
      return;
    }
    window.localStorage.removeItem(storageKey);
  };

  const handleLoginSubmit = async (credentials) => {
    setAuthError(null);
    try {
      await login(credentials);
      return true;
    } catch (err) {
      setAuthError(err?.message || 'Connexion impossible.');
      return false;
    }
  };

  const handleRegisterSubmit = async (payload) => {
    setRegisterFeedback(null);
    setResendFeedback(null);
    try {
      await registerUser({ ...payload, role: 'patient' });
      setLastRegisterEmail(payload.email || '');
      setRegisterFeedback({
        type: 'success',
        message:
          'Inscription réussie. Un e-mail de validation a été envoyé, vérifiez vos spams.',
      });
      return true;
    } catch (err) {
      setRegisterFeedback({
        type: 'error',
        message: err?.message || 'Inscription impossible.',
      });
      return false;
    }
  };

  const handleResendVerification = async (email) => {
    const normalized = (email || '').trim();
    if (!normalized) {
      setResendFeedback({ type: 'error', message: 'Veuillez renseigner un email.' });
      return;
    }
    setResendLoading(true);
    setResendFeedback(null);
    try {
      const resp = await resendVerificationEmail(normalized);
      setResendFeedback({
        type: 'success',
        message: resp?.detail || 'Un nouveau lien de verification a ete envoye.',
      });
    } catch (err) {
      setResendFeedback({
        type: 'error',
        message: err?.message || "Impossible d'envoyer un nouveau lien.",
      });
    } finally {
      setResendLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{LABELS_FR.patientSpace.title}</h1>
        </header>

        <AuthPanel
          onLogin={handleLoginSubmit}
          onRegister={handleRegisterSubmit}
          onResendVerification={handleResendVerification}
          loading={loading}
          registerFeedback={registerFeedback}
          resendFeedback={resendFeedback}
          resendLoading={resendLoading}
          lastRegisterEmail={lastRegisterEmail}
          error={authError}
        />
      </div>
    );
  }

  if (procedureSelection == null) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        <ProcedureChoice
          onSelectCircumcision={() => handleProcedureSelection('circumcision')}
          onSelectOther={() => handleProcedureSelection('autre')}
        />
      </div>
    );
  }

  if (procedureSelection === 'autre') {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        <section className="p-6 border rounded-xl bg-white shadow-sm">
          <h2 className="text-2xl font-semibold">Autre prise en charge</h2>
          <p className="text-sm text-slate-600">
            Ce parcours n&apos;est pas encore configuré. Merci de revenir vers le praticien pour
            plus d&apos;informations.
          </p>
          <div className="pt-4">
            <button type="button" className="btn btn-outline" onClick={clearProcedureSelection}>
              Changer
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <PatientSpacePage
      token={token}
      user={user}
      onLogout={logout}
      procedureSelection={procedureSelection}
      onChangeProcedure={clearProcedureSelection}
    />
  );
}
