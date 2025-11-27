import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchPractitionerAgenda,
  fetchPractitionerStats,
  fetchNewPatients,
  createPrescription,
  signPrescription,
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
  'Antiseptique cutane type Biseptine 250 ml',
  'Compresses steriles non tissees 5x5 cm',
  'Pansements compressifs 3x3 cm',
  "Paracetamol pediatrique (Doliprane 2,4 %) 15 mg/kg par prise (base sur le poids actualise de l'enfant)",
  'Serum physiologique sterile 0,9 %',
  'Gants steriles usage unique',
  'Creme cicatrisante type Cicalfate',
];
const PRECONSULT_ITEMS = [
  "Carnet de sante de l'enfant - A presenter le jour de la consultation",
  'Compte-rendu du pediatre ou medecin traitant - Moins de 6 mois',
  "Thermometre electronique - Verifier l'absence de fievre",
  "Paracetamol pediatrique (Doliprane 2,4 %) - 15 mg/kg par prise (base sur le poids actualise de l'enfant)",
];
const DEFAULT_INSTRUCTION_LINES = [
  "Acheter l'ensemble du materiel au plus tard 48 h avant l'intervention et conserver les dispositifs steriles fermes.",
  "Realiser une toilette soigneuse avec antiseptique la veille et le matin de l'acte.",
  "Respecter la posologie des antalgiques adaptee au poids de l'enfant ; ne pas depasser 4 prises par 24 h.",
  "Surveiller la plaie : rougeur anormale, saignement continu ou fievre >= 38 C necessitent un avis medical rapide.",
  "En cas de doute ou d'effet indesirable, contacter immediatement le praticien via le numero d'astreinte communique.",
];
const DEFAULT_INSTRUCTIONS = DEFAULT_INSTRUCTION_LINES.join('\n');

const toDate = (isoDate) => new Date(`${isoDate}T00:00:00`);
const toISODate = (dateObj) => dateObj.toISOString().split('T')[0];
const normalizeISODate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return toISODate(value);
  }
  if (typeof value === 'string') {
    if (value.includes('T')) return value.split('T')[0];
    return value;
  }
  return null;
};
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
  const [previewingId, setPreviewingId] = useState(null);
  const [activeSendId, setActiveSendId] = useState(null);
  const [signingId, setSigningId] = useState(null);
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
  const buildDefaultPreviewState = () => ({
    open: false,
    url: null,
    title: "Apercu de l'ordonnance",
    appointmentId: null,
    mode: 'view',
  });
  const [previewState, setPreviewState] = useState(buildDefaultPreviewState);
  const resetPreviewState = () => setPreviewState(buildDefaultPreviewState());

  const findAppointmentById = (appointmentId) => {
    if (!appointmentId) return null;
    const days = agendaQuery.data?.days || [];
    for (const day of days) {
      const found = day.appointments?.find((appt) => appt.appointment_id === appointmentId);
      if (found) return found;
    }
    if (patientDrawer.appointment?.appointment_id === appointmentId) {
      return patientDrawer.appointment;
    }
    return null;
  };

  const toAbsoluteUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalized}`;
  };

  const appendQueryParam = (url, key, value) => {
    if (!url || url.includes(`${key}=`)) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${key}=${value}`;
  };

  const buildPractitionerUrl = (path, { inline = false, channel = 'preview' } = {}) => {
    if (!path) return null;
    let url = toAbsoluteUrl(path);
    url = appendQueryParam(url, 'actor', 'practitioner');
    url = appendQueryParam(url, 'channel', channel);
    if (inline) {
      url = appendQueryParam(url, 'mode', 'inline');
    }
    return url;
  };

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

  const ensurePrescriptionMutation = useMutation({
    mutationFn: (appointmentId) => createPrescription(token, appointmentId),
  });

  const signMutation = useMutation({
    mutationFn: (appointmentId) => signPrescription(token, appointmentId),
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
      setLoginError(err.message || 'Echec de la connexion');
    }
  };

  useEffect(() => {
    const overview = patientDrawer.appointment?.procedure?.appointments_overview || [];
    const appointmentIds = Array.from(
      new Set(overview.map((entry) => entry.appointment_id).filter(Boolean)),
    );
    if (!token || appointmentIds.length === 0) {
      setPrescriptionHistory([]);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    Promise.all(
      appointmentIds.map((id) =>
        fetchPrescriptionHistory(token, id).catch((err) => {
          throw new Error(err.message || 'Historique indisponible');
        }),
      ),
    )
      .then((allHistories) => {
        if (cancelled) return;
        setPrescriptionHistory(allHistories.flat());
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(err.message || "Impossible de charger l'historique.");
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
  }, [token, patientDrawer.appointment?.procedure?.appointments_overview, historyRefreshIndex]);

  const handleRefresh = () => {
    setRefreshIndex((prev) => prev + 1);
    queryClient.invalidateQueries({ queryKey: ['practitionerAgenda'] });
    queryClient.invalidateQueries({ queryKey: ['practitionerStats'] });
  };

  const triggerHistoryRefresh = () => {
    setHistoryRefreshIndex((prev) => prev + 1);
  };

  const openPreviewWithUrl = ({ url, appointmentId = null, title, mode = 'view' }) => {
    if (!url) return;
    setPreviewState({
      open: true,
      url,
      title: title || "Apercu de l'ordonnance",
      appointmentId,
      mode,
    });
  };

  const handlePreviewDocument = async (appointment, { mode = 'view' } = {}) => {
    if (!appointment) return;
    const appointmentId = appointment.appointment_id;
    if (!appointmentId) return;
    setError(null);
    setSuccessMessage(null);
    setPreviewingId(appointmentId);
    try {
      let previewPath = appointment.prescription_url;
      let generated = false;
      if (!previewPath) {
        const data = await ensurePrescriptionMutation.mutateAsync(appointmentId);
        previewPath = data.url;
        generated = true;
      }
      const previewUrl = buildPractitionerUrl(previewPath, { inline: true, channel: 'preview' });
      openPreviewWithUrl({
        url: previewUrl,
        appointmentId,
        title:
          mode === 'sign' ? "Verifiez l'ordonnance avant signature" : "Apercu de l'ordonnance",
        mode,
      });
      if (generated) {
        setSuccessMessage('Ordonnance generee.');
        triggerHistoryRefresh();
        handleRefresh();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewingId(null);
    }
  };

  const handleDirectPreview = (appointment, { url, title }) => {
    if (!url) return;
    openPreviewWithUrl({
      url,
      appointmentId: appointment?.appointment_id ?? null,
      title: title || "Apercu de l'ordonnance",
      mode: 'view',
    });
  };

  const handlePreviewAction = (appointment, options = {}) => {
    if (options.url) {
      handleDirectPreview(appointment, options);
    } else {
      handlePreviewDocument(appointment, options);
    }
  };

  const handleSignAppointment = async (appointmentId) => {
    if (!appointmentId) return;
    setError(null);
    setSuccessMessage(null);
    setSigningId(appointmentId);
    try {
      const data = await signMutation.mutateAsync(appointmentId);
      const previewUrl = buildPractitionerUrl(data.preview_url, { inline: true, channel: 'signature' });
      setSuccessMessage('Ordonnance signee et envoyee au patient.');
      triggerHistoryRefresh();
      handleRefresh();
      openPreviewWithUrl({
        url: previewUrl,
        appointmentId,
        title: "Ordonnance signee",
        mode: 'view',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSigningId(null);
    }
  };

  const handleConfirmSignature = async () => {
    if (!previewState.appointmentId) return;
    await handleSignAppointment(previewState.appointmentId);
  };

  const handleDownloadConsent = (appointment) => {
    const url = appointment?.procedure?.consent_download_url;
    if (!url) {
      setError("Aucun consentement disponible pour ce dossier.");
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  const handleSendPrescription = async (appointment) => {
    const appointmentId = appointment?.appointment_id;
    if (!appointmentId) return;
    if (!appointment?.prescription_signed_at) {
      setError("Veuillez signer l'ordonnance avant l'envoi au patient.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setActiveSendId(appointmentId);
    try {
      await sendLinkMutation.mutateAsync(appointmentId);
      setSuccessMessage('Lien renvoye au patient.');
    } catch (err) {
      setError(err.message);
    } finally {
      setActiveSendId(null);
    }
  };

  const handleOpenEditor = (appointment) => {
    // Ferme la fenêtre dossier patient pour éviter toute superposition
    setPatientDrawer({ open: false, appointment: null });
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

  const handleEditFromPreview = () => {
    if (!previewState.appointmentId) return;
    const appt = findAppointmentById(previewState.appointmentId);
    if (!appt) {
      setError("Impossible de retrouver ce rendez-vous pour modification.");
      return;
    }
    handleOpenEditor(appt);
    resetPreviewState();
  };

  const handleSubmitEditor = async ({ items, instructions }) => {
    if (!editorState.appointmentId) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await updatePrescriptionMutation.mutateAsync({
        appointmentId: editorState.appointmentId,
        payload: { items, instructions },
      });
      setSuccessMessage('Ordonnance mise a jour.');
      handleCloseEditor();
      const previewUrl = buildPractitionerUrl(data.url, { inline: true, channel: 'preview' });
      if (previewUrl) {
        openPreviewWithUrl({
          url: previewUrl,
          appointmentId: data.appointment_id,
          title: "Apercu de l'ordonnance",
          mode: 'sign',
        });
      }
      handleRefresh();
      triggerHistoryRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectPatient = (appointment) => {
    setPatientDrawer({ open: true, appointment });
    resetPreviewState();
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
      setSuccessMessage('Dossier patient mis a jour.');
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
      setSuccessMessage('Rendez-vous mis a jour.');
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
      setSuccessMessage('Rendez-vous planifie.');
      handleRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNavigateToDate = (dateValue) => {
    const isoDate = normalizeISODate(dateValue);
    if (!isoDate) return;
    setViewMode('agenda');
    setViewLength(7);
    setStartDate(isoDate);
    handleRefresh();
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
  const previewActions = [
    previewState.mode === 'sign' ? (
      <button
        key="sign"
        type="button"
        className={`btn btn-primary ${signingId === previewState.appointmentId ? 'loading' : ''}`}
        onClick={handleConfirmSignature}
        disabled={signingId === previewState.appointmentId}
      >
        {signingId === previewState.appointmentId ? 'Signature en cours...' : 'Signer et archiver'}
      </button>
    ) : null,
    <button key="edit" type="button" className="btn" onClick={handleEditFromPreview} disabled={!previewState.appointmentId}>
      Modifier l&apos;ordonnance
    </button>,
  ].filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Tableau de bord praticien</h1>
          {user?.email && <p className="text-sm text-slate-500">Connecte en tant que {user.email}</p>}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
          Se deconnecter
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
        <StatCard title="Creations aujourd&apos;hui" value={stats?.bookings_created} />
        <StatCard title="Nouveaux patients (7j)" value={stats?.new_patients_week} tone="success" />
        <StatCard title="Relances necessaires" value={stats?.follow_ups_required} tone="warning" />
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
                onSign={(appointment) => handlePreviewDocument(appointment, { mode: 'sign' })}
                onSendPrescription={handleSendPrescription}
                onSelectPatient={handleSelectPatient}
                onEditPrescription={handleOpenEditor}
                onDownloadConsent={handleDownloadConsent}
                previewingId={previewingId}
                signingId={signingId}
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
        catalog={Array.from(
          new Set([
            ...(editorState.appointmentType === 'act'
              ? ACT_ITEMS
              : editorState.appointmentType === 'preconsultation'
              ? PRECONSULT_ITEMS
              : PRECONSULT_ITEMS),
            ...(editorState.items || []),
          ]),
        )}
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
        onPreview={handlePreviewAction}
        onSign={(appointment) => handlePreviewDocument(appointment, { mode: 'sign' })}
        onEdit={handleOpenEditor}
        onSend={handleSendPrescription}
        onNavigateDate={handleNavigateToDate}
        previewingId={previewingId}
        signingId={signingId}
        sendingId={activeSendId}
        updatingCase={updateCaseMutation.isLoading}
        updatingAppointment={rescheduleMutation.isLoading}
        creatingAppointment={createAppointmentMutation.isLoading}
        prescriptionHistory={prescriptionHistory}
        historyLoading={historyLoading}
        historyError={historyError}
      />
      <PdfPreviewModal
        isOpen={previewState.open}
        onClose={resetPreviewState}
        url={previewState.url}
        title={previewState.title}
        actions={previewActions}
      />
    </div>
  );
}

export default Praticien;

