import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Toast from '../components/Toast.jsx';
import PdfPreviewModal from '../components/PdfPreviewModal.jsx';
import { PatientHeader } from '../components/patient/PatientHeader.jsx';
import { AuthPanel } from './patient/components/AuthPanel.jsx';
import { ProcedureChoice } from '../components/patient/ProcedureChoice.jsx';
import { ProcedureSummary } from '../components/patient/ProcedureSummary.jsx';
import { ProcedureForm } from './patient/components/ProcedureForm.jsx';
import { StepsCard } from '../components/patient/StepsCard.jsx';
import { AppointmentsSection } from '../components/patient/AppointmentsSection.jsx';
import { AppointmentEditModal } from '../components/patient/AppointmentEditModal.jsx';
import { SchedulingPanel } from '../components/patient/SchedulingPanel.jsx';
import { ConsentSection } from '../components/patient/ConsentSection.jsx';
import { LegalChecklist } from '../components/LegalChecklist.jsx';
import { DashboardSummary } from '../components/patient/DashboardSummary.jsx';
import { DashboardSection } from '../components/patient/DashboardSection.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePatientProcedure } from '../hooks/usePatientProcedure.js';
import { usePatientAppointments } from '../hooks/usePatientAppointments.js';
import { usePatientDashboard } from '../hooks/usePatientDashboard.js';
import { defaultProcedureValues, patientProcedureSchema } from '../lib/forms';
import {
  requestPhoneOtp,
  verifyPhoneOtp,
  sendConsentLinkCustom,
  startSignature,
  downloadSignedConsent,
} from '../lib/api.js';
import { formatChildAge } from '../utils/child.js';
import { sortAppointments } from '../utils/date.js';

const previewInitialState = { open: false, url: null, downloadUrl: null, title: null, type: null };

const Patient = () => {
  const { isAuthenticated, login, register: registerUser, logout, token, user, loading } = useAuth();

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
  const [consentSendEmail, setConsentSendEmail] = useState('');
  const [consentSendLoading, setConsentSendLoading] = useState(false);
  const [consentSendRecipient, setConsentSendRecipient] = useState(null);
  const [signatureLoading, setSignatureLoading] = useState({ parent1: false, parent2: false });
  const [legalStatus, setLegalStatus] = useState(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState(null);
  const [consentFetching, setConsentFetching] = useState(false);

  const {
    procedureInfo,
    procedureCase,
    procedureLoading,
    isEditingCase,
    setIsEditingCase,
    stepsChecked,
    stepsAcknowledged,
    stepsSubmitting,
    setStepsChecked,
    loadProcedureCase,
    handleProcedureSubmit,
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
    if (!procedureCase) {
      setLegalStatus(null);
    }
  }, [procedureCase]);

  useEffect(() => {
    if (procedureCase?.appointments?.length) {
      const sorted = sortAppointments(procedureCase.appointments);
      const now = new Date();
      const next = sorted.find((appt) => {
        const apptDate = new Date(appt.date);
        return apptDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
      });
      setActiveAppointmentId((next || sorted[0])?.id || sorted[0]?.appointment_id || null);
    } else {
      setActiveAppointmentId(null);
    }
  }, [procedureCase]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  const {
    dashboard,
    loading: dashboardLoading,
    error: dashboardError,
    reload: reloadDashboard,
  } = usePatientDashboard({
    token,
    appointmentId: activeAppointmentId,
  });

  useEffect(() => {
    if (dashboard?.legal_status) {
      setLegalStatus(dashboard.legal_status);
    }
  }, [dashboard]);

  const handleLoginSubmit = async (credentials) => {
    setAuthError(null);
    setError(null);
    try {
      await login(credentials);
      setSuccessMessage(
        'Connexion reussie. Vous pouvez renseigner le dossier et planifier vos rendez-vous.',
      );
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
    procedureSelection === 'circumcision' && procedureCase && procedureCase.parental_authority_ack,
  );
  const showProcedureSelection = isAuthenticated && procedureSelection == null;
  const showProcedureForm = isAuthenticated && procedureSelection === 'circumcision';
  const showAutreMessage = isAuthenticated && procedureSelection === 'autre';
  const showScheduling =
    showProcedureForm && canSchedule && (!bothAppointmentsBooked || editingAppointmentId);

  const parent1Verified =
    dashboard?.contact_verification?.parent1_verified ??
    Boolean(procedureCase?.parent1_phone_verified_at);
  const parent2Verified =
    dashboard?.contact_verification?.parent2_verified ??
    Boolean(procedureCase?.parent2_phone_verified_at);
  const consentSignedUrl =
    dashboard?.signature?.signed_pdf_url ?? procedureCase?.consent_signed_pdf_url ?? null;
  const signatureAppointmentId = useMemo(() => {
    if (activeAppointmentId) return activeAppointmentId;
    if (!procedureCase?.appointments?.length) return null;
    const actAppt = procedureCase.appointments.find((appt) => appt.appointment_type === 'act');
    if (actAppt) return actAppt.id;
    return procedureCase.appointments[0]?.id || null;
  }, [activeAppointmentId, procedureCase]);
  const legalComplete = legalStatus?.complete ?? dashboard?.legal_status?.complete ?? false;

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
      await reloadDashboard();
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
      await reloadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpVerifying((prev) => ({ ...prev, [parent]: false }));
    }
  };

  const fetchSignedConsentBlob = async () => {
    if (!token) throw new Error('Utilisateur non authentifie');
    setConsentFetching(true);
    try {
      return await downloadSignedConsent(token);
    } finally {
      setConsentFetching(false);
    }
  };

  const handlePreviewConsent = async () => {
    try {
      const blob = await fetchSignedConsentBlob();
      if (!blob) {
        setError('Consentement indisponible.');
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreviewState({
        open: true,
        url,
        downloadUrl: url,
        title: 'Consentement signe',
        type: 'consent',
      });
    } catch (err) {
      setError(err.message || 'Consentement indisponible.');
    }
  };

  const handleDownloadConsent = async () => {
    try {
      const blob = await fetchSignedConsentBlob();
      if (!blob) {
        setError('Consentement indisponible.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'consentement-signe.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Consentement indisponible.');
    }
  };

  const handleSendConsentLinkCustom = async (email) => {
    if (!token || !email) return;
    setError(null);
    setSuccessMessage(null);
    setConsentSendLoading(true);
    try {
      await sendConsentLinkCustom(token, { email });
      setConsentSendRecipient(email);
      setSuccessMessage('Lien de consentement envoyé.');
      await reloadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setConsentSendLoading(false);
    }
  };

  const handleStartSignature = async (parentKey, { inPerson = false } = {}) => {
    if (!token) return;
    if (!signatureAppointmentId) {
      setError('Aucun rendez-vous cible pour la signature.');
      return;
    }
    if (!legalComplete) {
      setError('Veuillez valider les 3 documents avant de lancer la signature.');
      return;
    }
    const isVerified = parentKey === 'parent1' ? parent1Verified : parent2Verified;
    if (!isVerified) {
      setError('Numero non verifie pour ce parent.');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setSignatureLoading((prev) => ({ ...prev, [parentKey]: true }));
    try {
      const response = await startSignature(token, {
        appointmentId: signatureAppointmentId,
        signerRole: parentKey,
        mode: inPerson ? 'cabinet' : 'remote',
      });
      await loadProcedureCase();
      await reloadDashboard();
      const link = response?.signature_link;
      if (link) {
        window.open(link, '_blank', 'noopener');
      } else {
        setError('Lien de signature indisponible pour ce parent.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSignatureLoading((prev) => ({ ...prev, [parentKey]: false }));
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
    if (previewState.type === 'consent' && previewState.url) {
      return [
        <a
          key="download-consent"
          className="btn btn-primary btn-sm"
          href={previewState.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Telecharger le consentement
        </a>,
      ];
    }
    return null;
  }, [previewState.type, previewState.downloadUrl, previewState.url]);

  const childBirthdateString = watch('child_birthdate') || procedureCase?.child_birthdate || null;
  const childAgeDisplay = useMemo(() => formatChildAge(childBirthdateString), [childBirthdateString]);

  const appointmentOptions = useMemo(
    () => sortAppointments(procedureCase?.appointments || []),
    [procedureCase],
  );
  const guardians = useMemo(() => {
    if (dashboard?.guardians?.length) return dashboard.guardians;
    if (!procedureCase) return [];
    const items = [
      {
        label: 'parent1',
        name: procedureCase.parent1_name,
        email: procedureCase.parent1_email,
        phone: procedureCase.parent1_phone,
        sms_optin: procedureCase.parent1_sms_optin,
        receives_codes: procedureCase.parent1_sms_optin,
        phone_verified_at: procedureCase.parent1_phone_verified_at,
        signature_link: procedureCase.parent1_signature_link,
      },
    ];
    if (procedureCase.parent2_name || procedureCase.parent2_email || procedureCase.parent2_phone) {
      items.push({
        label: 'parent2',
        name: procedureCase.parent2_name,
        email: procedureCase.parent2_email,
        phone: procedureCase.parent2_phone,
        sms_optin: procedureCase.parent2_sms_optin,
        receives_codes: procedureCase.parent2_sms_optin,
        phone_verified_at: procedureCase.parent2_phone_verified_at,
        signature_link: procedureCase.parent2_signature_link,
      });
    }
    return items;
  }, [dashboard?.guardians, procedureCase]);
  const childSummary = dashboard?.child || {
    full_name: procedureCase?.child_full_name,
    birthdate: procedureCase?.child_birthdate,
    weight_kg: procedureCase?.child_weight_kg,
    notes: procedureCase?.notes,
  };
  const signatureEntries = dashboard?.signature?.entries || [];
  const signatureComplete = Boolean(
    dashboard?.signature?.signed_pdf_url ||
      signatureEntries.some((entry) => (entry?.status || '').toLowerCase() === 'signed'),
  );
  const dashboardUpcoming = dashboard?.appointments?.upcoming || upcomingAppointments;
  const dashboardHistory = dashboard?.appointments?.history || pastAppointments;

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
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <PatientHeader userEmail={user?.email} onLogout={logout} />

      {dashboardError && <div className="alert alert-warning">{dashboardError}</div>}
      {error && <div className="alert alert-error">{error}</div>}

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
            Ce parcours n&apos;est pas encore configure. Merci de revenir vers le praticien pour plus
            d&apos;informations.
          </p>
        </section>
      )}

      {showProcedureForm && (
        <>
          <DashboardSummary
            child={childSummary}
            guardians={guardians}
            legalComplete={legalComplete}
            signatureComplete={signatureComplete}
            appointments={appointmentOptions}
            activeAppointmentId={signatureAppointmentId || activeAppointmentId}
            onSelectAppointment={(value) => setActiveAppointmentId(value)}
          />

          {!stepsAcknowledged && (
            <DashboardSection
              title="Checklist parcours"
              subtitle="Confirmez les etapes avant de renseigner le dossier."
              badge="Dossier"
            >
              <StepsCard
                stepsChecked={stepsChecked}
                stepsSubmitting={stepsSubmitting}
                onCheck={setStepsChecked}
                onContinue={acknowledgeSteps}
              />
            </DashboardSection>
          )}

          <DashboardSection
            title="Dossier enfant"
            subtitle="Identite, poids, notes et responsables legaux."
            badge="Identite"
            defaultOpen={Boolean(!isEditingCase)}
          >
            {stepsAcknowledged && (
              <div className="text-sm text-slate-600 pb-4">
                Besoin d&apos;aide ?{' '}
                <a className="link text-primary" href="/faq" target="_blank" rel="noopener noreferrer">
                  Consulter la FAQ
                </a>
              </div>
            )}
            {!isEditingCase && procedureCase && (
              <ProcedureSummary procedureCase={procedureCase} onEdit={() => setIsEditingCase(true)} />
            )}
            {isEditingCase && (
              <FormProvider {...formMethods}>
                <ProcedureForm
                  info={procedureInfo}
                  childAgeDisplay={childAgeDisplay}
                  loading={procedureLoading}
                  onSubmit={handleProcedureSubmit}
                />
              </FormProvider>
            )}
          </DashboardSection>

          <DashboardSection
            title="Responsables & verification contact"
            subtitle="Coordonnees des parents et validation SMS pour la signature."
            badge="Contacts"
          >
            <div className="grid md:grid-cols-2 gap-4">
              {guardians.map((guardian) => {
                const key = guardian.label;
                const verified = key === 'parent1' ? parent1Verified : parent2Verified;
                const canSend = Boolean(guardian.phone);
                return (
                  <div key={key} className="border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold capitalize">{guardian.name || key}</p>
                        <p className="text-sm text-slate-600">
                          {guardian.email || 'Email non renseigne'} • {guardian.phone || 'Telephone manquant'}
                        </p>
                      </div>
                      <span className={`badge ${verified ? 'badge-success' : 'badge-warning'}`}>
                        {verified ? 'Verifie' : 'A verifier'}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => handleRequestOtp(key)}
                        disabled={!canSend || otpSending[key]}
                      >
                        {otpSending[key] ? 'Envoi...' : 'Envoyer le code'}
                      </button>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        placeholder="Code SMS"
                        value={otpCodes[key] || ''}
                        onChange={(e) =>
                          setOtpCodes((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleVerifyOtp(key)}
                        disabled={otpVerifying[key]}
                      >
                        {otpVerifying[key] ? 'Verification...' : 'Valider'}
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
          </DashboardSection>

          <DashboardSection
            title="Rendez-vous a venir"
            subtitle="Pre-consultation et acte, liens ordonnances."
            badge={`${dashboardUpcoming?.length || 0} RDV`}
          >
            {dashboardLoading && <div className="loading loading-spinner loading-sm" />}
            <AppointmentsSection
              title="A venir"
              appointments={dashboardUpcoming}
              emptyMessage="Aucun rendez-vous planifie."
              variant="upcoming"
              getPrescriptionUrls={getPrescriptionUrls}
              onPreview={handlePreviewAppointmentPrescription}
              onSendEmail={handleSendByEmail}
              onEdit={handleEditAppointment}
              onCancel={handleCancelAppointment}
              cancelingId={cancelingId}
              onSelect={(apptId) => setActiveAppointmentId(apptId)}
              activeAppointmentId={signatureAppointmentId}
            />
          </DashboardSection>

          <DashboardSection
            title="Historique RDV"
            subtitle="Consultations passees et ordonnances associees."
            badge="Historique"
            defaultOpen={false}
          >
            <AppointmentsSection
              title="Historique"
              appointments={dashboardHistory}
              emptyMessage="Aucun rendez-vous passe."
              variant="past"
              getPrescriptionUrls={getPrescriptionUrls}
              onPreview={handlePreviewAppointmentPrescription}
              onSendEmail={handleSendByEmail}
              onEdit={handleEditAppointment}
              onCancel={handleCancelAppointment}
              cancelingId={cancelingId}
              onSelect={(apptId) => setActiveAppointmentId(apptId)}
              activeAppointmentId={signatureAppointmentId}
            />
          </DashboardSection>

          <DashboardSection
            title="Documents a valider"
            subtitle="Checklist des 3 documents (autorisation, consentement, honoraires)."
            badge={legalComplete ? 'Checklist complete' : 'A completer'}
          >
            {signatureAppointmentId ? (
              <LegalChecklist
                appointmentId={signatureAppointmentId}
                token={token}
                onStatusChange={(statusPayload) => {
                  setLegalStatus(statusPayload);
                  reloadDashboard();
                }}
              />
            ) : (
              <p className="text-sm text-slate-600">
                Selectionnez un rendez-vous pour afficher la checklist legale.
              </p>
            )}
          </DashboardSection>

          <DashboardSection
            title="Signature"
            subtitle="Envoyer les liens, signer a distance ou en cabinet."
            badge="Consentement"
          >
            {signatureEntries.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 pb-4">
                {signatureEntries.map((entry) => (
                  <div key={entry.signer_role} className="border rounded-lg p-3 bg-slate-50">
                    <p className="font-semibold capitalize">{entry.signer_role}</p>
                    <p className="text-sm text-slate-600">Statut : {entry.status || 'pending'}</p>
                    {entry.sent_at && (
                      <p className="text-xs text-slate-500">
                        Envoye le {new Date(entry.sent_at).toLocaleString('fr-FR')}
                      </p>
                    )}
                    {entry.signed_at && (
                      <p className="text-xs text-slate-500">
                        Signe le {new Date(entry.signed_at).toLocaleString('fr-FR')}
                      </p>
                    )}
                    {entry.signature_link && (
                      <a
                        className="link text-primary text-sm"
                        href={entry.signature_link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ouvrir le lien
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            <ConsentSection
              procedureCase={procedureCase}
              onPreview={handlePreviewConsent}
              onPreviewSigned={handlePreviewConsent}
              onDownloadSigned={handleDownloadConsent}
              consentAvailable={Boolean(consentSignedUrl)}
              consentLoading={consentFetching}
              parent1Verified={parent1Verified}
              parent2Verified={parent2Verified}
              onSendLink={handleSendConsentLinkCustom}
              customEmail={consentSendEmail}
              setCustomEmail={setConsentSendEmail}
              sendInProgress={consentSendLoading}
              lastRecipient={consentSendRecipient}
              onSign={handleStartSignature}
              signatureLoading={signatureLoading}
              legalComplete={legalComplete}
            />
          </DashboardSection>

          {showScheduling && (
            <DashboardSection
              title="Planifier un rendez-vous"
              subtitle="Reserver une pre-consultation ou l'acte."
              badge="Planning"
            >
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
            </DashboardSection>
          )}
        </>
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

      <Toast
        message={successMessage}
        isVisible={Boolean(successMessage)}
        onClose={() => setSuccessMessage(null)}
      />
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
