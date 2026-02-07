import React, { useState } from 'react';

import { AuthPanel } from './components/AuthPanel.jsx';
import { PatientSpacePage } from './PatientSpacePage.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { LABELS_FR } from '../../constants/labels.fr.js';
import { resendVerificationEmail } from '../../lib/api.js';

export default function PatientPage() {
  const { isAuthenticated, login, register: registerUser, token, user, logout, loading } = useAuth();

  const [registerFeedback, setRegisterFeedback] = useState(null);
  const [resendFeedback, setResendFeedback] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [lastRegisterEmail, setLastRegisterEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

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
        message: 'Inscription réussie. Un e-mail de validation a été envoyé, vérifiez vos spams.',
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
        message: resp?.detail || 'Un nouveau lien de vérification a été envoyé.',
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

  return <PatientSpacePage token={token} user={user} onLogout={logout} />;
}
