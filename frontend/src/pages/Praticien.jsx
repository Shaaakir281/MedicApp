import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchPractitionerAgenda,
  fetchPractitionerStats,
  fetchNewPatients,
  createPrescription,
  sendPrescriptionLink,
  updatePrescription,
  updatePatientCase,
  rescheduleAppointment,
  createPractitionerAppointment,
  fetchPrescriptionHistory,
  API_BASE_URL,
} from '../lib/api.js';
import {
  PractitionerLogin,
  StatCard,
  AgendaControls,
  AgendaDay,
  PrescriptionEditor,
  PatientDetailsDrawer,
  NewPatientsList,
} from './practitioner/components';
import PdfPreviewModal from '../components/PdfPreviewModal.jsx';

const VIEW_OPTIONS = [1, 7, 14, 23];
const AUTO_REFRESH_INTERVAL_MS = 60_000;
const ACT_ITEMS = [
  'Bactigras 10x10 cm x 5',
  'Compresses stériles 5x5 cm x 10',
  'Set de pansement stérile',
  'Doliprane 2,4% (adapté au poids)',
  'Pansements compressifs 3x3 cm',
];
const PRECONSULT_ITEMS = [
  'Doliprane 2,4% (adapté au poids)',
  'Thermomètre électronique',
  'Carnet de santé',
];
const DEFAULT_INSTRUCTIONS =
  "Acheter les éléments 24h avant l'intervention, les conserver stériles et les apporter le jour J. En cas de complication (douleur importante, saignement, fièvre > 38,5°C), contacter immédiatement le praticien.";

const toDate = (isoDate) => new Date(`${isoDate}T00:00:00`);
const toISODate = (dateObj) => dateObj.toISOString().split('T')[0];
const addDays = (isoDate, delta) => {
  const base = toDate(isoDate);
  base.setDate(base.getDate() + delta);
  return toISODate(base);
};

const getDefaultStartDate = () => toISODate(new Date());

const Praticien = () => {
  const { isAuthenticated, login, logout, token, user, loading: authLoading } = useAuth();
  const [startDate, setStartDate] = useState(() => getDefaultStartDate());
  const [viewLength, setViewLength] = useState(7);
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeDownloadId, setActiveDownloadId] = useState(null);
  const [activeSendId, setActiveSendId] = useState(null);
  const [viewMode, setViewMode] = useState('agenda');
  const [editorState, setEditorState] = useState({
    open: false,
    appointmentId: null,
    items: [],
    instructions: '',
  });
  const [patientDrawer, setPatientDrawer] = useState({
    open: false,
    appointment: null,
  });
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyRefreshIndex, setHistoryRefreshIndex] = useState(0);
  const [previewState, setPreviewState] = useState({
    open: false,
    url: null,
    title: 'Aperçu ordonnance',
  });

  const endDate = useMemo(() => addDays(startDate, viewLength - 1), [startDate, viewLength]);

  const agendaQuery = useQuery({
    queryKey: ['practitionerAgenda', startDate, endDate, refreshIndex],
    queryFn: () => fetchPractitionerAgenda({ start: startDate, end: endDate }, token),
    enabled: Boolean(token),
    refetchInterval: token && viewMode === 'agenda' ? AUTO_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const statsQuery = useQuery({
    queryKey: ['practitionerStats', startDate, refreshIndex],
    queryFn: () => fetchPractitionerStats(startDate, token),
    enabled: Boolean(token),
    refetchInterval: token ? AUTO_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const newPatientsQuery = useQuery({
    queryKey: ['practitionerNewPatients', viewMode, refreshIndex],
    queryFn: () => fetchNewPatients({ days: 7 }, token),
    enabled: Boolean(token && viewMode === 'patients'),
    refetchInterval: token && viewMode === 'patients' ? AUTO_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const downloadMutation = useMutation({
    mutationFn: (appointmentId) => createPrescription(token, appointmentId),
  });

  const sendLinkMutation = useMutation({
    mutationFn: (appointmentId) => sendPrescriptionLink(token, appointmentId),
  });

  const updatePrescriptionMutation = useMutation({
    mutationFn: ({ appointmentId, payload }) => updatePrescription(token, appointmentId, payload),
  });

  const updateCaseMutation = useMutation({
    mutationFn: ({ caseId, payload }) => updatePatientCase(token, caseId, payload),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ appointmentId, payload }) => rescheduleAppointment(token, appointmentId, payload),
  });

  const createAppointmentMutation = useMutation({
    mutationFn: (payload) => createPractitionerAppointment(token, payload),
  });

  const handleLogin = async (credentials) => {
    setLoginError(null);
    try {
      await login(credentials);
    } catch (err) {
      setLoginError(err.message || 'Échec de la connexion');
    }
  };

  useEffect(() => {
    const appointmentId = patientDrawer.appointment?.appointment_id;
    if (!token || !appointmentId) {
      setPrescriptionHistory([]);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    fetchPrescriptionHistory(token, appointmentId)
      .then((data) => {
        if (!cancelled) {
          setPrescriptionHistory(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(err.message || 'Impossible de charger l’historique.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, patientDrawer.appointment?.appointment_id, historyRefreshIndex]);

  const handleRefresh = () => {
    setRefreshIndex((prev) => prev + 1);
    queryClient.invalidateQueries({ queryKey: ['practitionerAgenda'] });
    queryClient.invalidateQueries({ queryKey: ['practitionerStats'] });
  };

  const triggerHistoryRefresh = () => {
    setHistoryRefreshIndex((prev) => prev + 1);
  };

  const handleDownloadPrescription = async (appointmentId) => {
    setError(null);
    setSuccessMessage(null);
    setActiveDownloadId(appointmentId);
    try {
      const data = await downloadMutation.mutateAsync(appointmentId);
      const relativeUrl = data.url.startsWith('/') ? data.url : `/${data.url}`;
      const fullUrl = `${API_BASE_URL}${relativeUrl}`;
      window.open(fullUrl, '_blank', 'noopener');
      setSuccessMessage('Ordonnance générée.');
      triggerHistoryRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setActiveDownloadId(null);
    }
  };

  const handleDownloadConsent = (appointment) => {
    const url = appointment?.procedure?.consent_download_url;
    if (!url) {
      setError("Aucun consentement disponible pour ce dossier.");
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  const handleSendPrescription = async (appointmentId) => {
    setError(null);
    setSuccessMessage(null);
    setActiveSendId(appointmentId);
    try {
      await sendLinkMutation.mutateAsync(appointmentId);
      setSuccessMessage("Lien d'ordonnance envoyé au patient.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActiveSendId(null);
    }
  };

  const handleOpenEditor = (appointment) => {
    setEditorState({
      open: true,
      appointmentId: appointment.appointment_id,
      items: appointment.prescription_items || [],
      instructions: appointment.prescription_instructions || DEFAULT_INSTRUCTIONS,
      appointmentType: appointment.appointment_type,
    });
  };

  const handleCloseEditor = () => {
    setEditorState((prev) => ({ ...prev, open: false }));
  };

  const handleSubmitEditor = async ({ items, instructions }) => {
    if (!editorState.appointmentId) return;
    setError(null);
    setSuccessMessage(null);
    try {
      await updatePrescriptionMutation.mutateAsync({
        appointmentId: editorState.appointmentId,
        payload: { items, instructions },
      });
      setSuccessMessage('Ordonnance mise à jour.');
      handleCloseEditor();
      handleRefresh();
      triggerHistoryRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectPatient = (appointment) => {
    setPatientDrawer({ open: true, appointment });
    setPreviewState({ open: false, url: null, title: 'Aperçu ordonnance' });
  };

  const closePatientDrawer = () => setPatientDrawer({ open: false, appointment: null });

  const handleSelectNewPatient = (entry) => {
    if (!entry) return;
    const firstRelevantDate =
      entry.next_act_date || entry.next_preconsultation_date || entry.created_at;

    const pseudoAppointment = {
      appointment_id: null,
      appointment_type: entry.next_act_date ? 'act' : 'preconsultation',
      date: firstRelevantDate,
      patient: {
        child_full_name: entry.child_full_name,
        email: entry.patient_email,
      },
      procedure: entry.procedure,
      prescription_id: null,
      prescription_url: null,
      reminder_sent_at: null,
      reminder_opened_at: null,
      prescription_sent_at: null,
      prescription_last_download_at: null,
      prescription_download_count: 0,
    };
    setPatientDrawer({ open: true, appointment: pseudoAppointment });
  };

  const handleUpdateCase = async (caseId, payload) => {
    if (!caseId || !payload || Object.keys(payload).length === 0) return;
    const sanitizedPayload = { ...payload };
    if (Object.prototype.hasOwnProperty.call(sanitizedPayload, 'child_full_name')) {
      const trimmedName = sanitizedPayload.child_full_name?.trim?.() ?? '';
      if (!trimmedName) {
        setError("Le nom de l'enfant est obligatoire.");
        return;
      }
      sanitizedPayload.child_full_name = trimmedName;
    }
    if (
      Object.prototype.hasOwnProperty.call(sanitizedPayload, 'child_birthdate') &&
      !sanitizedPayload.child_birthdate
    ) {
      setError('La date de naissance est obligatoire.');
      return;
    }
    const normalizedPayload = Object.fromEntries(
      Object.entries(sanitizedPayload).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(normalizedPayload).length === 0) {
      return;
    }
    setError(null);
    setSuccessMessage(null);
    try {
      const updatedCase = await updateCaseMutation.mutateAsync({ caseId, payload: normalizedPayload });
      setPatientDrawer((prev) => {
        if (!prev.appointment) {
          return prev;
        }
        return {
          ...prev,
          appointment: {
            ...prev.appointment,
            procedure: updatedCase,
          },
        };
      });
      setSuccessMessage('Dossier patient mis à jour.');
      handleRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRescheduleAppointment = async (appointmentId, payload) => {
    if (!appointmentId || !payload || Object.keys(payload).length === 0) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const updatedAppointment = await rescheduleMutation.mutateAsync({
        appointmentId,
        payload,
      });
      setPatientDrawer({ open: true, appointment: updatedAppointment });
      setSuccessMessage('Rendez-vous mis à jour.');
      handleRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateAppointment = async (caseId, payload) => {
    if (!caseId || !payload) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const createdAppointment = await createAppointmentMutation.mutateAsync({
        case_id: caseId,
        ...payload,
      });
      setPatientDrawer({ open: true, appointment: createdAppointment });
      setSuccessMessage('Rendez-vous planifié.');
      handleRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto py-10">
        <PractitionerLogin onSubmit={handleLogin} loading={authLoading} error={loginError} />
      </div>
    );
  }

  const days = agendaQuery.data?.days ?? [];
  const displayedDays = viewLength === 1 ? days.slice(0, 1) : days;
  const loadingData = agendaQuery.isLoading || statsQuery.isLoading;
  const stats = statsQuery.data;

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Tableau de bord praticien</h1>
          {user?.email && <p className="text-sm text-slate-500">Connecté en tant que {user.email}</p>}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
          Se déconnecter
        </button>
      </header>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`btn btn-sm ${viewMode === 'agenda' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setViewMode('agenda')}
        >
          Agenda
        </button>
        <button
          type="button"
          className={`btn btn-sm ${viewMode === 'patients' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setViewMode('patients')}
        >
          Nouveaux dossiers
        </button>
      </div>
      {viewMode === 'agenda' && (
        <AgendaControls
          startDate={startDate}
          endDate={endDate}
          viewLength={viewLength}
          viewOptions={VIEW_OPTIONS}
          onChangeStart={setStartDate}
          onChangeLength={setViewLength}
          onRefresh={handleRefresh}
          loading={loadingData}
        />
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      <section className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <StatCard title="Rendez-vous du jour" value={stats?.total_appointments} tone="primary" />
        <StatCard title="Créations aujourd&apos;hui" value={stats?.bookings_created} />
        <StatCard title="Nouveaux patients (7j)" value={stats?.new_patients_week} tone="success" />
        <StatCard title="Relances nécessaires" value={stats?.follow_ups_required} tone="warning" />
        <StatCard title="Consents manquants" value={stats?.pending_consents} tone="danger" />
      </section>

      {viewMode === 'agenda' ? (
        <section className="space-y-8">
          {loadingData && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
              Chargement de l&apos;agenda...
            </div>
          )}
          {!loadingData &&
            displayedDays.map((day) => (
              <AgendaDay
                key={day.date}
                day={day}
                detailed={viewLength === 1}
                onDownloadPrescription={handleDownloadPrescription}
                onSendPrescription={handleSendPrescription}
                onSelectPatient={handleSelectPatient}
                onEditPrescription={handleOpenEditor}
                onDownloadConsent={handleDownloadConsent}
                downloadingId={activeDownloadId}
                sendingId={activeSendId}
              />
            ))}
        </section>
      ) : (
        <NewPatientsList
          patients={newPatientsQuery.data}
          loading={newPatientsQuery.isLoading}
          error={newPatientsQuery.error}
          onSelect={handleSelectNewPatient}
        />
      )}

      <PrescriptionEditor
        isOpen={editorState.open}
        onClose={handleCloseEditor}
        defaultItems={editorState.items}
        defaultInstructions={editorState.instructions}
        catalog={
          editorState.appointmentType === 'act'
            ? ACT_ITEMS
            : editorState.appointmentType === 'preconsultation'
            ? PRECONSULT_ITEMS
            : PRECONSULT_ITEMS
        }
        loading={updatePrescriptionMutation.isLoading}
        onSubmit={handleSubmitEditor}
      />
      <PatientDetailsDrawer
        isOpen={patientDrawer.open}
        onClose={closePatientDrawer}
        appointment={patientDrawer.appointment}
        onUpdateCase={handleUpdateCase}
        onReschedule={handleRescheduleAppointment}
        onCreateAppointment={handleCreateAppointment}
        onPreview={setPreviewState}
        updatingCase={updateCaseMutation.isLoading}
        updatingAppointment={rescheduleMutation.isLoading}
        creatingAppointment={createAppointmentMutation.isLoading}
        prescriptionHistory={prescriptionHistory}
        historyLoading={historyLoading}
        historyError={historyError}
      />
      <PdfPreviewModal
        isOpen={previewState.open}
        onClose={() => setPreviewState({ open: false, url: null, title: 'Aperçu ordonnance' })}
        url={previewState.url}
        title={previewState.title}
      />
    </div>
  );
};

export default Praticien;
