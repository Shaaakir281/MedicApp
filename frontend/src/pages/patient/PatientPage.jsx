import React, { useEffect, useState } from 'react';

import { AuthPanel } from './components/AuthPanel.jsx';
import { PatientSpacePage } from './PatientSpacePage.jsx';
import { ProcedureChoice } from '../../components/patient/ProcedureChoice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { LABELS_FR } from '../../constants/labels.fr.js';

export default function PatientPage() {
  const { isAuthenticated, login, register: registerUser, token, user, logout, loading } = useAuth();

  const [procedureSelection, setProcedureSelection] = useState(null);
  const [registerFeedback, setRegisterFeedback] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setProcedureSelection(null);
    }
  }, [isAuthenticated]);

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
    try {
      await registerUser({ ...payload, role: 'patient' });
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

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{LABELS_FR.patientSpace.title}</h1>
        </header>

        <AuthPanel
          onLogin={handleLoginSubmit}
          onRegister={handleRegisterSubmit}
          loading={loading}
          registerFeedback={registerFeedback}
          error={authError}
        />
      </div>
    );
  }

  if (procedureSelection == null) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        <ProcedureChoice
          onSelectCircumcision={() => setProcedureSelection('circumcision')}
          onSelectOther={() => setProcedureSelection('autre')}
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
            <button type="button" className="btn btn-outline" onClick={() => setProcedureSelection(null)}>
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
      onChangeProcedure={() => setProcedureSelection(null)}
    />
  );
}

