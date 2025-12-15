import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';
import {
  updatePrescription,
  updatePatientCase,
  rescheduleAppointment,
  createPractitionerAppointment,
  initiateConsentProcedure,
  remindConsent,
} from '../lib/api.js';
import {
  PractitionerLogin,
  StatCard,
  PrescriptionEditor,
  PatientDetailsDrawer,
  NewPatientsList,
  PractitionerHeader,
  ViewToggle,
  AgendaView,
} from './practitioner/components';
import PdfPreviewModal from '../components/PdfPreviewModal.jsx';
import { usePractitionerData } from '../hooks/usePractitionerData.js';
import { usePrescriptionHistory } from '../hooks/usePrescriptionHistory.js';
import { usePractitionerPrescriptions } from '../hooks/usePractitionerPrescriptions.js';

const VIEW_OPTIONS = [1, 7, 14, 23];
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

const normalizeISODate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    if (value.includes('T')) return value.split('T')[0];
    return value;
  }
  return null;
};

const Praticien = () => {
  const { isAuthenticated, login, logout, token, user, loading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState('agenda');
  const [error, setError] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
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
  const updateDrawerProcedure = (updatedProcedure) => {
    setPatientDrawer((prev) => {
      if (!prev.appointment) return prev;
      return {
        ...prev,
        appointment: {
          ...prev.appointment,
          procedure: updatedProcedure,
        },
      };
    });
  };
  const {
    startDate,
    setStartDate,
    viewLength,
    setViewLength,
    endDate,
    agendaQuery,
    statsQuery,
    newPatientsQuery,
    displayedDays,
    loadingData,
    handleRefresh,
  } = usePractitionerData({ token, viewMode });

  const {
    prescriptionHistory,
    historyLoading,
    historyError,
    triggerHistoryRefresh,
  } = usePrescriptionHistory({
    token,
    appointmentsOverview: patientDrawer.appointment?.procedure?.appointments_overview || [],
  });

  const {
    previewingId,
    activeSendId,
    signingId,
    previewState,
    resetPreviewState,
    handlePreviewDocument,
    handlePreviewAction,
    handleConfirmSignature,
    handleSendPrescription,
    buildPractitionerUrl,
  } = usePractitionerPrescriptions({
    token,
    setError,
    setSuccessMessage,
    handleRefresh,
    triggerHistoryRefresh,
  });

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

  const initiateConsentMutation = useMutation({
    mutationFn: (caseId) => initiateConsentProcedure(token, caseId),
  });

  const remindConsentMutation = useMutation({
    mutationFn: (caseId) => remindConsent(token, caseId),
  });

  const handleLogin = async (credentials) => {
    setLoginError(null);
    try {
      await login(credentials);
    } catch (err) {
      setLoginError(err.message || 'Echec de la connexion');
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
        handlePreviewAction(
          { appointment_id: data.appointment_id },
          { url: previewUrl, title: "Apercu de l'ordonnance", mode: 'sign' },
        );
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
      updateDrawerProcedure(updatedCase);
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

  const handleInitiateConsent = async (caseId) => {
    if (!caseId) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const updatedCase = await initiateConsentMutation.mutateAsync(caseId);
      updateDrawerProcedure(updatedCase);
      setSuccessMessage('Consentement envoye (Yousign + SMS).');
      handleRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemindConsent = async (caseId) => {
    if (!caseId) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const updatedCase = await remindConsentMutation.mutateAsync(caseId);
      updateDrawerProcedure(updatedCase);
      setSuccessMessage('Rappel de consentement renvoye.');
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

  const stats = statsQuery.data;
  const consentActionLoading = initiateConsentMutation.isLoading || remindConsentMutation.isLoading;
  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <PractitionerHeader userEmail={user?.email} onLogout={logout} />

      <ViewToggle viewMode={viewMode} onChange={setViewMode} />
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
        <AgendaView
          displayedDays={displayedDays}
          viewLength={viewLength}
          startDate={startDate}
          endDate={endDate}
          viewOptions={VIEW_OPTIONS}
          onChangeStart={setStartDate}
          onChangeLength={setViewLength}
          onRefresh={handleRefresh}
          loadingData={loadingData}
          onSign={(appointment) => handlePreviewDocument(appointment, { mode: 'sign' })}
          onSendPrescription={handleSendPrescription}
          onSelectPatient={handleSelectPatient}
          onEditPrescription={handleOpenEditor}
          onDownloadConsent={handleDownloadConsent}
          previewingId={previewingId}
          signingId={signingId}
          sendingId={activeSendId}
        />
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
        token={token}
        appointment={patientDrawer.appointment}
        onUpdateCase={handleUpdateCase}
        onReschedule={handleRescheduleAppointment}
        onCreateAppointment={handleCreateAppointment}
        onPreview={handlePreviewAction}
        onSign={(appointment) => handlePreviewDocument(appointment, { mode: 'sign' })}
        onEdit={handleOpenEditor}
        onSend={handleSendPrescription}
        onNavigateDate={handleNavigateToDate}
        onInitiateConsent={handleInitiateConsent}
        onRemindConsent={handleRemindConsent}
        previewingId={previewingId}
        signingId={signingId}
        sendingId={activeSendId}
        updatingCase={updateCaseMutation.isLoading}
        updatingAppointment={rescheduleMutation.isLoading}
        creatingAppointment={createAppointmentMutation.isLoading}
        consentActionLoading={consentActionLoading}
        prescriptionHistory={prescriptionHistory}
        historyLoading={historyLoading}
        historyError={historyError}
      />
      <PdfPreviewModal
        isOpen={previewState.open}
        onClose={resetPreviewState}
        url={previewState.url}
        title={previewState.title}
        actions={[
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
        ].filter(Boolean)}
      />
    </div>
  );
}

export default Praticien;
