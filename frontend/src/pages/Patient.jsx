import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Toast from '../components/Toast.jsx';
import PdfPreviewModal from '../components/PdfPreviewModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { defaultProcedureValues, patientProcedureSchema } from '../lib/forms';
import { AuthPanel } from './patient/components/AuthPanel.jsx';
import { ProcedureForm } from './patient/components/ProcedureForm.jsx';
import { AppointmentsSection } from '../components/patient/AppointmentsSection.jsx';
import { AppointmentEditModal } from '../components/patient/AppointmentEditModal.jsx';
import { SchedulingPanel } from '../components/patient/SchedulingPanel.jsx';
import { PatientHeader } from '../components/patient/PatientHeader.jsx';
import { ProcedureChoice } from '../components/patient/ProcedureChoice.jsx';
import { ProcedureSummary } from '../components/patient/ProcedureSummary.jsx';
import { StepsCard } from '../components/patient/StepsCard.jsx';
import { usePatientProcedure } from '../hooks/usePatientProcedure.js';
import { usePatientAppointments } from '../hooks/usePatientAppointments.js';
import { formatChildAge } from '../utils/child.js';
import { requestPhoneOtp, verifyPhoneOtp } from '../lib/api.js';

const previewInitialState = { open: false, url: null, downloadUrl: null, title: null, type: null };

const Patient = () => {
  const {
    isAuthenticated,
    login,
    register: registerUser,
    logout,
    token,
    user,
    loading,
  } = useAuth();

  const formMethods = useForm({
    resolver: zodResolver(patientProcedureSchema),
    defaultValues: defaultProcedureValues,
  });
  const { reset, watch } = formMethods;

  const [procedureSelection, setProcedureSelection] = useState(null);

  const [registerFeedback, setRegisterFeedback] = useState(null);
  const [authError, setAuthError] = useState(null);

  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [previewState, setPreviewState] = useState(previewInitialState);
  const [otpCodes, setOtpCodes] = useState({ parent1: '', parent2: '' });
  const [otpSending, setOtpSending] = useState({ parent1: false, parent2: false });
  const [otpVerifying, setOtpVerifying] = useState({ parent1: false, parent2: false });

  const {
    procedureInfo,
    procedureCase,
    procedureLoading,
    sendingConsentEmail,
    isEditingCase,
    setIsEditingCase,
    stepsChecked,
    stepsAcknowledged,
    stepsSubmitting,
    setStepsChecked,
    loadProcedureCase,
    handleProcedureSubmit,
    handleSendConsentEmail,
    acknowledgeSteps,
  } = usePatientProcedure({
    token,
    isAuthenticated,
    procedureSelection,
    resetForm: reset,
    setError,
    setSuccessMessage,
  });

  const {
    currentMonth,
    selectedDate,
    availableSlots,
    selectedSlot,
    appointmentType,
    appointmentMode,
    slotsLoading,
    editModalOpen,
    editingAppointmentId,
    cancelingId,
    hasPreconsultation,
    hasAct,
    bothAppointmentsBooked,
    upcomingAppointments,
    pastAppointments,
    setAppointmentType,
    setAppointmentMode,
    setSelectedSlot,
    handlePrevMonth,
    handleNextMonth,
    handleDateSelect,
    handleCreateAppointment,
    handleEditAppointment,
    handleCancelAppointment,
    handleCloseEditModal,
    handleConfirmEdit,
    getPrescriptionUrls,
  } = usePatientAppointments({
    token,
    isAuthenticated,
    procedureSelection,
    procedureCase,
    loadProcedureCase,
    setError,
    setSuccessMessage,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setProcedureSelection(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  const handleLoginSubmit = async (credentials) => {
    setAuthError(null);
    setError(null);
    try {
      await login(credentials);
      setSuccessMessage('Connexion reussie. Vous pouvez renseigner le dossier et planifier vos rendez-vous.');
      await loadProcedureCase();
      return true;
    } catch (err) {
      setAuthError(err.message || 'Connexion impossible.');
      return false;
    }
  };

  const handleRegisterSubmit = async (payload) => {
    setRegisterFeedback(null);
    try {
      await registerUser({ ...payload, role: 'patient' });
      setRegisterFeedback({
        type: 'success',
        message: 'Inscription reussie. Un e-mail de validation a ete envoye, verifiez vos spams.',
      });
      return true;
    } catch (err) {
      setRegisterFeedback({ type: 'error', message: err.message || 'Inscription impossible.' });
      return false;
    }
  };

  const consentLink = procedureCase?.consent_download_url ?? null;

  const canSchedule = Boolean(
    procedureSelection === 'circumcision' &&
      procedureCase &&
      procedureCase.parental_authority_ack,
  );
  const showProcedureSelection = isAuthenticated && procedureSelection == null;
  const showProcedureForm = isAuthenticated && procedureSelection === 'circumcision';
  const showAutreMessage = isAuthenticated && procedureSelection === 'autre';
  const showScheduling =
    showProcedureForm && canSchedule && (!bothAppointmentsBooked || editingAppointmentId);
  const showConsentDownload = showProcedureForm && Boolean(consentLink);
  const showConsentPending = showProcedureForm && !consentLink && Boolean(procedureCase);
  const parent1Verified = Boolean(procedureCase?.parent1_phone_verified_at);
  const parent2Verified = Boolean(procedureCase?.parent2_phone_verified_at);

  const handleSendByEmail = (url) => {
    if (!url) {
      setError("L'ordonnance n'est pas disponible pour envoi par e-mail.");
      return;
    }
    const subject = encodeURIComponent('Ordonnance');
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver l'ordonnance via ce lien securise : ${url}\n\nCordialement,`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handlePreviewAppointmentPrescription = (appt) => {
    const { previewUrl, downloadUrl } = getPrescriptionUrls(appt);
    if (!previewUrl) {
      setError("L'ordonnance n'est pas disponible pour ce rendez-vous.");
      return;
    }
    setPreviewState({
      open: true,
      url: previewUrl,
      downloadUrl: downloadUrl || previewUrl,
      title: appt.appointment_type === 'act' ? 'Ordonnance acte' : 'Ordonnance pre-consultation',
      type: 'ordonnance',
    });
  };

  const handleRequestOtp = async (parent) => {
    if (!token) return;
    setError(null);
    setSuccessMessage(null);
    setOtpSending((prev) => ({ ...prev, [parent]: true }));
    try {
      await requestPhoneOtp(token, { parent });
      setSuccessMessage('Code SMS envoye.');
      await loadProcedureCase();
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpSending((prev) => ({ ...prev, [parent]: false }));
    }
  };

  const handleVerifyOtp = async (parent) => {
    if (!token) return;
    const code = otpCodes[parent]?.trim();
    if (!code) {
      setError('Veuillez saisir le code SMS.');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setOtpVerifying((prev) => ({ ...prev, [parent]: true }));
    try {
      await verifyPhoneOtp(token, { parent, code });
      setSuccessMessage('Numero verifie.');
      setOtpCodes((prev) => ({ ...prev, [parent]: '' }));
      await loadProcedureCase();
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpVerifying((prev) => ({ ...prev, [parent]: false }));
    }
  };

  const handleClosePreview = () => {
    setPreviewState(previewInitialState);
  };
  const previewActions = useMemo(() => {
    if (previewState.type === 'ordonnance' && (previewState.downloadUrl || previewState.url)) {
      return [
        <a
          key="download-ordonnance"
          className="btn btn-primary btn-sm"
          href={previewState.downloadUrl || previewState.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Telecharger le PDF
        </a>,
      ];
    }
    return null;
  }, [previewState.type, previewState.downloadUrl, previewState.url]);


  const childBirthdateString = watch('child_birthdate') || procedureCase?.child_birthdate || null;
  const childAgeDisplay = useMemo(() => formatChildAge(childBirthdateString), [childBirthdateString]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Espace patient</h1>
        </header>

        <AuthPanel
          onLogin={handleLoginSubmit}
          onRegister={handleRegisterSubmit}
          loading={loading}
          registerFeedback={registerFeedback}
          error={authError}
        />
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <PatientHeader userEmail={user?.email} onLogout={logout} />


      {showProcedureSelection && (
        <ProcedureChoice
          onSelectCircumcision={() => setProcedureSelection('circumcision')}
          onSelectOther={() => setProcedureSelection('autre')}
        />
      )}

      {showAutreMessage && (
        <section className="p-6 border rounded-xl bg-white shadow-sm">
          <h2 className="text-2xl font-semibold">Autre prise en charge</h2>
          <p className="text-sm text-slate-600">
            Ce parcours n&apos;est pas encore configuré. Merci de revenir vers le praticien pour plus
            d&apos;informations.
          </p>
        </section>
      )}

      {showProcedureForm && !stepsAcknowledged && (
        <StepsCard
          stepsChecked={stepsChecked}
          stepsSubmitting={stepsSubmitting}
          onCheck={setStepsChecked}
          onContinue={acknowledgeSteps}
        />
      )}

      {showProcedureForm && stepsAcknowledged && (
        <div className="text-sm text-slate-600">
          Besoin d&apos;aide ?{' '}
          <a className="link text-primary" href="/faq" target="_blank" rel="noopener noreferrer">
            Consulter la FAQ
          </a>
        </div>
      )}

      {showProcedureForm && !isEditingCase && procedureCase && (
        <ProcedureSummary procedureCase={procedureCase} onEdit={() => setIsEditingCase(true)} />
      )}

      {showProcedureForm && isEditingCase && (
        <FormProvider {...formMethods}>
          <ProcedureForm
            info={procedureInfo}
            childAgeDisplay={childAgeDisplay}
            loading={procedureLoading}
            onSubmit={handleProcedureSubmit}
            showConsentDownload={showConsentDownload}
            showConsentPending={showConsentPending}
            consentLink={consentLink}
            onSendConsent={handleSendConsentEmail}
            sendingConsentEmail={sendingConsentEmail}
            canSendConsent={Boolean(procedureCase)}
          />
        </FormProvider>
      )}

      {showProcedureForm && procedureCase && (
        <section className="p-6 border rounded-xl bg-white shadow-sm space-y-3">
          <h3 className="text-xl font-semibold">Verification des numéros par SMS</h3>
          <p className="text-sm text-slate-600">
            Validez chaque numero pour recevoir les codes de signature du consentement.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {['parent1', 'parent2'].map((parentKey) => {
              const isParent1 = parentKey === 'parent1';
              const phone = procedureCase?.[`${parentKey}_phone`] || 'Non renseigne';
              const verified = parentKey === 'parent1' ? parent1Verified : parent2Verified;
              const canSend = procedureCase?.[`${parentKey}_phone`];
              return (
                <div key={parentKey} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{isParent1 ? 'Parent 1' : 'Parent 2'}</p>
                      <p className="text-sm text-slate-600">Tel: {phone}</p>
                    </div>
                    <span className={`badge ${verified ? 'badge-success' : 'badge-warning'}`}>
                      {verified ? 'Verifie' : 'A verifier'}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => handleRequestOtp(parentKey)}
                      disabled={!canSend || otpSending[parentKey]}
                    >
                      {otpSending[parentKey] ? 'Envoi...' : 'Envoyer le code'}
                    </button>
                    <input
                      type="text"
                      className="input input-bordered input-sm"
                      placeholder="Code SMS"
                      value={otpCodes[parentKey]}
                      onChange={(e) =>
                        setOtpCodes((prev) => ({ ...prev, [parentKey]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleVerifyOtp(parentKey)}
                      disabled={otpVerifying[parentKey]}
                    >
                      {otpVerifying[parentKey] ? 'Verification...' : 'Valider'}
                    </button>
                  </div>
                  {!canSend && (
                    <p className="text-xs text-red-500">
                      Renseignez et enregistrez le numero de telephone pour ce parent.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {procedureCase?.appointments?.length ? (
        <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
          <h2 className="text-2xl font-semibold">Rendez-vous & ordonnances</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <AppointmentsSection
              title="A venir"
              appointments={upcomingAppointments}
              emptyMessage="Aucun rendez-vous planifie."
              variant="upcoming"
              getPrescriptionUrls={getPrescriptionUrls}
              onPreview={handlePreviewAppointmentPrescription}
              onSendEmail={handleSendByEmail}
              onEdit={handleEditAppointment}
              onCancel={handleCancelAppointment}
              cancelingId={cancelingId}
            />
            <AppointmentsSection
              title="Historique"
              appointments={pastAppointments}
              emptyMessage="Aucun rendez-vous passe."
              variant="past"
              getPrescriptionUrls={getPrescriptionUrls}
              onPreview={handlePreviewAppointmentPrescription}
              onSendEmail={handleSendByEmail}
              onEdit={handleEditAppointment}
              onCancel={handleCancelAppointment}
              cancelingId={cancelingId}
            />
          </div>
        </section>
      ) : null}


      {showScheduling && (
        <section className="space-y-6">
          <div className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
            <SchedulingPanel
              title="Planifier un rendez-vous"
              appointmentType={appointmentType}
              appointmentMode={appointmentMode}
              hasPreconsultation={hasPreconsultation}
              hasAct={hasAct}
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              availableSlots={availableSlots}
              selectedSlot={selectedSlot}
              slotsLoading={slotsLoading}
              onChangeType={(value) => setAppointmentType(value)}
              onChangeMode={(value) => setAppointmentMode(value)}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onSelectDate={handleDateSelect}
              onSelectSlot={(slot) => setSelectedSlot(slot === selectedSlot ? null : slot)}
              onConfirm={handleCreateAppointment}
            />
          </div>
        </section>
      )}

      <AppointmentEditModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        appointmentType={appointmentType}
        appointmentMode={appointmentMode}
        hasPreconsultation={hasPreconsultation}
        hasAct={hasAct}
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        availableSlots={availableSlots}
        selectedSlot={selectedSlot}
        slotsLoading={slotsLoading}
        onChangeType={(value) => setAppointmentType(value)}
        onChangeMode={(value) => setAppointmentMode(value)}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onSelectDate={handleDateSelect}
        onSelectSlot={(slot) => setSelectedSlot(slot === selectedSlot ? null : slot)}
        onConfirm={handleConfirmEdit}
      />

      {error && <div className="alert alert-error">{error}</div>}
      <Toast message={successMessage} isVisible={Boolean(successMessage)} onClose={() => setSuccessMessage(null)} />
      <PdfPreviewModal
        isOpen={previewState.open}
        onClose={handleClosePreview}
        title={previewState.title || 'Document'}
        url={previewState.url}
        actions={previewActions}
      />
    </div>
  );
};

export default Patient;
