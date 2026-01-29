import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { StatusDot } from '../../components/ui/StatusDot.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePractitionerMfa } from '../../hooks/usePractitionerMfa.js';
import {
  createCabinetSession,
  fetchDocumentsDashboard,
  resendDocumentsDashboard,
} from '../../lib/api.js';
import { downloadDocumentSignatureFile, downloadLegalDocumentPreview } from '../../services/documentSignature.api.js';
import { PractitionerHeader, PractitionerLogin, PractitionerMfa, StatCard } from './components';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'incomplete', label: 'Incomplets' },
  { value: 'complete', label: 'Complets' },
];

const DATE_OPTIONS = [
  { value: 'upcoming', label: 'A venir' },
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 jours' },
  { value: 'all', label: 'Toutes dates' },
];

const resolveDotStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'signed') return 'done';
  if (normalized === 'sent') return 'pending';
  return 'draft';
};

const formatDate = (value) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('fr-FR');
};

const formatTime = (value) => {
  if (!value) return '';
  return String(value).slice(0, 5);
};

const formatType = (value) => {
  if (value === 'act') return 'Acte';
  if (value === 'preconsultation') return 'Pre-consultation';
  return value || '--';
};

const StatusCell = ({ status }) => {
  const parent1 = status?.parent1_status;
  const parent2 = status?.parent2_status;
  return (
    <div className="flex items-center justify-center gap-3 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1">
        <StatusDot status={resolveDotStatus(parent1)} />
        P1
      </span>
      <span className="inline-flex items-center gap-1">
        <StatusDot status={resolveDotStatus(parent2)} />
        P2
      </span>
    </div>
  );
};

export default function DocumentsDashboard() {
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
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState('upcoming');
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents-dashboard', status, dateRange],
    queryFn: () => fetchDocumentsDashboard(token, { status, dateRange }),
    enabled: Boolean(token),
  });

  const resendMutation = useMutation({
    mutationFn: ({ caseId, parentRole }) => resendDocumentsDashboard(token, caseId, parentRole),
    onSuccess: (payload) => {
      setActionError(null);
      setActionMessage(payload?.detail || 'Relance envoyee.');
      queryClient.invalidateQueries({ queryKey: ['documents-dashboard'] });
    },
    onError: (err) => {
      setActionMessage(null);
      setActionError(err?.message || 'Relance impossible.');
    },
  });

  const sessionMutation = useMutation({
    mutationFn: ({ appointmentId, parentRole }) =>
      createCabinetSession(token, { appointment_id: appointmentId, signer_role: parentRole }),
    onSuccess: (payload, variables) => {
      const purpose = variables?.purpose || 'tablet';
      setActionError(null);
      setActiveSession(payload ? { ...payload, purpose } : null);
      setActionMessage(
        purpose === 'activation' ? 'Activation cabinet activee.' : 'Session tablette creee.',
      );
    },
    onError: (err) => {
      setActionMessage(null);
      setActionError(err?.message || 'Creation de session impossible.');
    },
  });

  const stats = data?.stats || {};
  const cases = data?.cases || [];

  const handleResend = (caseId, parentRole) => {
    if (!caseId) return;
    resendMutation.mutate({ caseId, parentRole });
  };

  const handleCreateSession = (appointmentId, parentRole, purpose) => {
    if (!appointmentId) {
      setActionError("Aucun rendez-vous associe a ce dossier.");
      return;
    }
    sessionMutation.mutate({ appointmentId, parentRole, purpose });
  };

  const handlePreviewDocument = async ({ caseId, docType, docStatus }) => {
    if (!token || !caseId) return;
    try {
      let blob = null;
      const fullySigned =
        String(docStatus?.parent1_status || '').toLowerCase() === 'signed' &&
        String(docStatus?.parent2_status || '').toLowerCase() === 'signed';
      if (fullySigned && docStatus?.document_signature_id) {
        try {
          blob = await downloadDocumentSignatureFile({
            token,
            documentSignatureId: docStatus.document_signature_id,
            fileKind: 'final',
            inline: true,
          });
        } catch (err) {
          blob = null;
        }
      }
      if (!blob) {
        blob = await downloadLegalDocumentPreview({
          token,
          procedureCaseId: caseId,
          documentType: docType,
          inline: true,
        });
      }
      if (!blob) {
        setActionError('Document indisponible.');
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setActionError(err?.message || 'Document indisponible.');
    }
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

  return (
    <div className="min-h-screen bg-slate-50/50">
      <PractitionerHeader userEmail={user?.email} onLogout={logout} />
      <div className="max-w-6xl mx-auto px-6 pb-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link to="/praticien" className="btn btn-sm btn-ghost">
              Retour agenda
            </Link>
            <h2 className="text-xl font-semibold text-slate-800">Suivi documents</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/praticien/signature-cabinet" className="btn btn-sm btn-outline">
              Signature cabinet
            </Link>
          </div>
        </div>

        {(actionMessage || actionError) && (
          <div className={`alert ${actionError ? 'alert-error' : 'alert-success'}`}>
            {actionError || actionMessage}
          </div>
        )}

        {activeSession && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm space-y-1">
            <p className="font-semibold text-slate-700">
              {activeSession.purpose === 'activation' ? 'Activation cabinet activee' : 'Session cabinet active'}
            </p>
            <p>Role : {activeSession.signer_role}</p>
            {activeSession.purpose !== 'activation' && (
              <>
                <p>
                  Code : <span className="font-mono">{activeSession.session_code}</span>
                </p>
                <p>
                  Lien tablette :{' '}
                  <a
                    className="link link-primary break-all"
                    href={activeSession.tablet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {activeSession.tablet_url}
                  </a>
                </p>
              </>
            )}
            {activeSession.expires_at && (
              <p>
                Expiration : {new Date(activeSession.expires_at).toLocaleString('fr-FR')}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Dossiers complets" value={stats.complete || 0} tone="success" />
          <StatCard title="Dossiers incomplets" value={stats.incomplete || 0} tone="warning" />
          <StatCard title="Relances necessaires" value={stats.reminders || 0} tone="danger" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="select select-bordered select-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="select select-bordered select-sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            {DATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="alert alert-error">{error.message || 'Chargement impossible.'}</div>}
        {isLoading && <span className="loading loading-spinner loading-sm" />}

        {!isLoading && !cases.length && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500">
            Aucun dossier a afficher.
          </div>
        )}

        {!!cases.length && (
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date RDV</th>
                  <th>Type</th>
                  <th className="text-center">Autorisation</th>
                  <th className="text-center">Consentement</th>
                  <th className="text-center">Honoraires</th>
                  <th className="text-center">Voir</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="font-semibold text-slate-800">{row.child_name}</div>
                      <div className="text-xs text-slate-500">{row.parent_email || '-'}</div>
                    </td>
                    <td>{formatDate(row.appointment_date)} {formatTime(row.appointment_time)}</td>
                    <td>{formatType(row.appointment_type)}</td>
                    <td><StatusCell status={row.authorization} /></td>
                    <td><StatusCell status={row.consent} /></td>
                    <td><StatusCell status={row.fees} /></td>
                    <td className="text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handlePreviewDocument({ caseId: row.id, docType: 'authorization', docStatus: row.authorization })}
                          disabled={!token || !row.id}
                        >
                          Autorisation
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handlePreviewDocument({ caseId: row.id, docType: 'consent', docStatus: row.consent })}
                          disabled={!token || !row.id}
                        >
                          Consentement
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handlePreviewDocument({ caseId: row.id, docType: 'fees', docStatus: row.fees })}
                          disabled={!token || !row.id}
                        >
                          Honoraires
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="dropdown dropdown-end">
                        <button type="button" className="btn btn-xs btn-ghost">Actions</button>
                        <ul className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-56">
                          <li>
                            <button
                              type="button"
                              onClick={() => handleResend(row.id, 'parent1')}
                              disabled={resendMutation.isLoading}
                            >
                              Relancer Parent 1
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => handleResend(row.id, 'parent2')}
                              disabled={resendMutation.isLoading}
                            >
                              Relancer Parent 2
                            </button>
                          </li>
                          <li className="divider" />
                          <li>
                            <button
                              type="button"
                              onClick={() => handleCreateSession(row.appointment_id, 'parent1', 'activation')}
                              disabled={sessionMutation.isLoading}
                            >
                              Activer cabinet Parent 1
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => handleCreateSession(row.appointment_id, 'parent2', 'activation')}
                              disabled={sessionMutation.isLoading}
                            >
                              Activer cabinet Parent 2
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => handleCreateSession(row.appointment_id, 'parent1', 'tablet')}
                              disabled={sessionMutation.isLoading}
                            >
                              Session tablette Parent 1
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => handleCreateSession(row.appointment_id, 'parent2', 'tablet')}
                              disabled={sessionMutation.isLoading}
                            >
                              Session tablette Parent 2
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
