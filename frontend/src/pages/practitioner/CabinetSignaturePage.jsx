import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from '../../context/AuthContext.jsx';
import { usePractitionerMfa } from '../../hooks/usePractitionerMfa.js';
import { createCabinetSession, fetchCabinetPatientsToday } from '../../lib/api.js';
import { PractitionerHeader, PractitionerLogin, PractitionerMfa } from './components';

const PRACTITIONER_PIN = '1234';

const hasAllSigned = (patient) =>
  Boolean(patient?.authorization_signed && patient?.consent_signed && patient?.fees_signed);

export default function CabinetSignaturePage() {
  const { isAuthenticated, logout, token, user } = useAuth();
  const {
    mfaRequired,
    mfaEmail,
    mfaPhone,
    startLogin,
    sendCode,
    verifyCode,
    resetMfa,
    loading: mfaLoading,
    error: mfaError,
    message: mfaMessage,
  } = usePractitionerMfa();
  const [pinInput, setPinInput] = useState(PRACTITIONER_PIN);
  const [unlocked, setUnlocked] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [sessionCreated, setSessionCreated] = useState(null);
  const [error, setError] = useState(null);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['cabinet-patients', unlocked],
    queryFn: () => fetchCabinetPatientsToday(token),
    enabled: unlocked && Boolean(token),
  });

  const sessionMutation = useMutation({
    mutationFn: ({ appointmentId, parentRole }) =>
      createCabinetSession(token, { appointment_id: appointmentId, signer_role: parentRole }),
    onSuccess: (payload) => {
      setError(null);
      setSessionCreated(payload);
    },
    onError: (err) => {
      setError(err?.message || 'Creation de session impossible.');
    },
  });

  const handlePinSubmit = (event) => {
    event.preventDefault();
    if (pinInput === PRACTITIONER_PIN) {
      setError(null);
      setUnlocked(true);
      setPinInput(PRACTITIONER_PIN);
    } else {
      setError('Code PIN incorrect.');
      setPinInput(PRACTITIONER_PIN);
    }
  };

  const handleAuthorizeSignature = (patient, parentRole) => {
    if (!patient?.appointment_id) {
      setError('Rendez-vous introuvable pour ce patient.');
      return;
    }
    const roleLabel = parentRole === 'parent1' ? 'Parent 1' : 'Parent 2';
    const confirmed = window.confirm(
      `Autoriser signature pour ${patient.child_name} (${roleLabel}) ?`
    );
    if (!confirmed) return;
    setSelectedPatient(patient);
    sessionMutation.mutate({ appointmentId: patient.appointment_id, parentRole });
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto py-10">
        {mfaRequired ? (
          <PractitionerMfa
            email={mfaEmail}
            phone={mfaPhone}
            onSend={sendCode}
            onVerify={verifyCode}
            onCancel={resetMfa}
            loading={mfaLoading}
            error={mfaError}
            message={mfaMessage}
          />
        ) : (
          <PractitionerLogin onSubmit={startLogin} loading={mfaLoading} error={mfaError} />
        )}
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-6">
        <div className="card w-full max-w-md bg-white shadow-xl">
          <div className="card-body space-y-4">
            <h1 className="text-xl font-semibold text-center">Signature en cabinet</h1>
            <p className="text-sm text-slate-600 text-center">
              Entrez le code PIN praticien pour acceder a la tablette de signature.
            </p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handlePinSubmit} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                placeholder="Code PIN"
                className="input input-bordered w-full text-center text-xl tracking-widest"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                maxLength={4}
                autoFocus
              />
              <button type="submit" className="btn btn-primary w-full">
                Deverrouiller
              </button>
            </form>
            <Link to="/praticien" className="btn btn-ghost btn-sm">
              Retour agenda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (sessionCreated) {
    return (
      <div className="min-h-screen bg-slate-50/70">
        <PractitionerHeader userEmail={user?.email} onLogout={logout} />
        <div className="max-w-3xl mx-auto px-6 pb-10">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-2xl font-semibold text-slate-800">Session active</h2>
            <p className="text-slate-600">
              Patient : <span className="font-semibold">{selectedPatient?.child_name || '-'}</span>
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
              <p>
                Role : <span className="font-medium">{sessionCreated.signer_role}</span>
              </p>
              <p>
                Code : <span className="font-mono">{sessionCreated.session_code}</span>
              </p>
              <p>
                Lien tablette :{' '}
                <a
                  className="link link-primary break-all"
                  href={sessionCreated.tablet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {sessionCreated.tablet_url}
                </a>
              </p>
              <p>
                Expiration :{' '}
                {sessionCreated.expires_at
                  ? new Date(sessionCreated.expires_at).toLocaleString('fr-FR')
                  : '-'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setSessionCreated(null);
                  setSelectedPatient(null);
                }}
              >
                Retour a la liste
              </button>
              <Link to="/praticien" className="btn btn-ghost">
                Retour agenda
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <PractitionerHeader userEmail={user?.email} onLogout={logout} />
      <div className="max-w-5xl mx-auto px-6 pb-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Patients du jour</h1>
            <p className="text-sm text-slate-600">Signature en cabinet</p>
          </div>
          <div className="flex gap-2">
            <Link to="/praticien/documents" className="btn btn-sm btn-outline">
              Suivi documents
            </Link>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setUnlocked(false)}>
              Verrouiller
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {isLoading && <span className="loading loading-spinner loading-sm" />}

        {!isLoading && !patients.length && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500">
            Aucun patient prevu aujourd'hui.
          </div>
        )}

        <div className="grid gap-4">
          {patients.map((patient) => {
            const signedAll = hasAllSigned(patient);
            const timeLabel = patient.appointment_time
              ? String(patient.appointment_time).slice(0, 5)
              : '';
            return (
              <div key={patient.id} className="card bg-white shadow-md border border-slate-200">
                <div className="card-body space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="card-title text-xl">{patient.child_name}</h2>
                      <p className="text-sm text-slate-600">
                        {timeLabel} {patient.appointment_type === 'act' ? 'Acte' : 'Pré-consultation'}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>Documents ? signer</div>
                      <div className="flex gap-1 justify-end mt-1">
                        {!patient.authorization_signed && (
                          <span className="badge badge-warning badge-sm">Autorisation</span>
                        )}
                        {!patient.consent_signed && (
                          <span className="badge badge-warning badge-sm">Consentement</span>
                        )}
                        {!patient.fees_signed && (
                          <span className="badge badge-warning badge-sm">Honoraires</span>
                        )}
                        {signedAll && <span className="badge badge-success badge-sm">Tout signe</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => handleAuthorizeSignature(patient, 'parent1')}
                      disabled={sessionMutation.isLoading || signedAll}
                    >
                      Session Parent 1
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => handleAuthorizeSignature(patient, 'parent2')}
                      disabled={sessionMutation.isLoading || signedAll}
                    >
                      Session Parent 2
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
