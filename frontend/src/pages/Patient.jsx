import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Calendar from '../components/Calendar.jsx';
import TimeSlots from '../components/TimeSlots.jsx';
import Toast from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createAppointment,
  fetchCurrentProcedure,
  fetchProcedureInfo,
  fetchSlots,
  saveProcedure,
  sendConsentLink,
} from '../lib/api.js';
import { defaultProcedureValues, patientProcedureSchema } from '../lib/forms';
import { AuthPanel } from './patient/components/AuthPanel.jsx';
import { ProcedureForm } from './patient/components/ProcedureForm.jsx';

const formatDateISO = (date) => date.toISOString().split('T')[0];

const formatChildAge = (birthdateString) => {
  if (!birthdateString) {
    return null;
  }
  const birthdate = new Date(birthdateString);
  if (Number.isNaN(birthdate.getTime())) {
    return null;
  }
  const totalMonths = Math.floor((Date.now() - birthdate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
  if (totalMonths < 0) {
    return null;
  }
  if (totalMonths < 12) {
    return `${totalMonths} mois`;
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (months === 0) {
    return `${years} an${years > 1 ? 's' : ''}`;
  }
  return `${years} an${years > 1 ? 's' : ''} ${months} mois`;
};

const mapProcedureToFormValues = (procedure) => ({
  child_full_name: procedure?.child_full_name ?? '',
  child_birthdate: procedure?.child_birthdate ?? '',
  child_weight_kg:
    typeof procedure?.child_weight_kg === 'number' ? String(procedure.child_weight_kg) : '',
  parent1_name: procedure?.parent1_name ?? '',
  parent1_email: procedure?.parent1_email ?? '',
  parent2_name: procedure?.parent2_name ?? '',
  parent2_email: procedure?.parent2_email ?? '',
  parental_authority_ack: Boolean(procedure?.parental_authority_ack),
  notes: procedure?.notes ?? '',
});

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

  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [appointmentType, setAppointmentType] = useState('preconsultation');
  const [appointmentMode, setAppointmentMode] = useState('visio');
  const [procedureSelection, setProcedureSelection] = useState(null);

  const [registerFeedback, setRegisterFeedback] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [procedureInfo, setProcedureInfo] = useState(null);
  const [procedureCase, setProcedureCase] = useState(null);

  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [procedureLoading, setProcedureLoading] = useState(false);
  const [sendingConsentEmail, setSendingConsentEmail] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setProcedureSelection(null);
      setProcedureCase(null);
      reset(defaultProcedureValues);
      setProcedureInfo(null);
    }
  }, [isAuthenticated, reset]);

  useEffect(() => {
    if (!isAuthenticated || procedureSelection !== 'circumcision') {
      setProcedureInfo(null);
      return;
    }
    let cancelled = false;
    fetchProcedureInfo()
      .then((info) => {
        if (!cancelled) {
          setProcedureInfo(info);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, procedureSelection]);

  const loadProcedureCase = async () => {
    if (!token || procedureSelection !== 'circumcision') {
      return;
    }
    setProcedureLoading(true);
    try {
      const current = await fetchCurrentProcedure(token);
      setProcedureCase(current);
      if (current) {
        reset(mapProcedureToFormValues(current));
      } else {
        reset(defaultProcedureValues);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcedureLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && procedureSelection === 'circumcision') {
      loadProcedureCase();
    } else if (!isAuthenticated || procedureSelection !== 'circumcision') {
      setProcedureCase(null);
      reset(defaultProcedureValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, procedureSelection]);

  useEffect(() => {
    if (
      isAuthenticated &&
      procedureSelection === 'circumcision' &&
      procedureCase &&
      selectedDate
    ) {
      const isoDate = formatDateISO(selectedDate);
      setSlotsLoading(true);
      fetchSlots(isoDate)
        .then((data) => {
          const slots = data.slots || [];
          let filtered = slots;
          const todayISO = formatDateISO(new Date());
          if (isoDate === todayISO) {
            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            filtered = slots.filter((slot) => {
              const [hour, minute] = slot.split(':').map(Number);
              return hour * 60 + minute >= nowMinutes;
            });
          }
          setAvailableSlots(filtered);
          setSelectedSlot(null);
        })
        .catch((err) => setError(err.message))
        .finally(() => setSlotsLoading(false));
    } else if (!(isAuthenticated && procedureSelection === 'circumcision')) {
      setAvailableSlots([]);
    }
  }, [isAuthenticated, procedureCase, procedureSelection, selectedDate]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  useEffect(() => {
    if (procedureSelection !== 'circumcision') {
      setSelectedDate(null);
      setSelectedSlot(null);
      setAvailableSlots([]);
      setAppointmentType('preconsultation');
      setAppointmentMode('visio');
    }
  }, [procedureSelection]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleLoginSubmit = async (credentials) => {
    setAuthError(null);
    setError(null);
    try {
      await login(credentials);
      setSuccessMessage('Connexion réussie. Vous pouvez renseigner le dossier et planifier vos rendez-vous.');
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
        message: 'Inscription réussie. Vérifiez votre e-mail pour valider votre compte.',
      });
      return true;
    } catch (err) {
      setRegisterFeedback({ type: 'error', message: err.message || 'Inscription impossible.' });
      return false;
    }
  };

  const handleProcedureSubmit = async (values) => {
    if (!token || procedureSelection !== 'circumcision') {
      setError("Veuillez sélectionner la circoncision et vous connecter avant d'enregistrer le dossier.");
      return;
    }
    setError(null);
    setProcedureLoading(true);
    try {
      const payload = {
        procedure_type: 'circumcision',
        ...values,
      };
      const caseData = await saveProcedure(token, payload);
      setProcedureCase(caseData);
      reset(mapProcedureToFormValues(caseData));
      setSuccessMessage('Dossier mis à jour. Un consentement pré-rempli est disponible au téléchargement.');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcedureLoading(false);
    }
  };

  const handleCreateAppointment = async () => {
    if (
      procedureSelection !== 'circumcision' ||
      !selectedDate ||
      !selectedSlot ||
      !token ||
      !procedureCase
    ) {
      return;
    }
    setError(null);
    try {
      const payload = {
        date: formatDateISO(selectedDate),
        time: `${selectedSlot}:00`,
        appointment_type: appointmentType,
        procedure_id: procedureCase.id,
        mode: appointmentType === 'act' ? 'presentiel' : appointmentMode,
      };
      await createAppointment(token, payload);
      const modeLabel = payload.mode === 'visio' ? 'en visio' : 'en présentiel';
      setSuccessMessage(
        `Rendez-vous confirmé le ${payload.date} à ${selectedSlot} (${modeLabel}). Un e-mail de confirmation a été envoyé.`,
      );
      setSelectedSlot(null);
      setAvailableSlots((prev) => prev.filter((slot) => slot !== selectedSlot));
      await loadProcedureCase();
    } catch (err) {
      setError(err.message);
    }
  };

  const consentLink = procedureCase?.consent_download_url ?? null;
  const appointmentsByType = new Map();
  procedureCase?.appointments?.forEach((appt) => appointmentsByType.set(appt.appointment_type, appt));
  const hasPreconsultation = appointmentsByType.has('preconsultation');
  const hasAct = appointmentsByType.has('act');

  useEffect(() => {
    if (appointmentType === 'act' && !hasPreconsultation) {
      setAppointmentType('preconsultation');
    }
  }, [appointmentType, hasPreconsultation]);

  useEffect(() => {
    if (appointmentType === 'act' && appointmentMode !== 'presentiel') {
      setAppointmentMode('presentiel');
    }
  }, [appointmentType, appointmentMode]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [appointmentType]);

  const canSchedule = Boolean(
    procedureSelection === 'circumcision' &&
      procedureCase &&
      procedureCase.parental_authority_ack,
  );
  const showProcedureSelection = isAuthenticated && procedureSelection == null;
  const showProcedureForm = isAuthenticated && procedureSelection === 'circumcision';
  const showAutreMessage = isAuthenticated && procedureSelection === 'autre';
  const showScheduling = showProcedureForm && canSchedule;
  const showConsentDownload = showProcedureForm && Boolean(consentLink);
  const showConsentPending = showProcedureForm && !consentLink && Boolean(procedureCase);

  const handleSendConsentEmail = async () => {
    if (!token || sendingConsentEmail) {
      return;
    }
    setError(null);
    setSendingConsentEmail(true);
    try {
      await sendConsentLink(token);
      setSuccessMessage('Lien de consentement envoyé par e-mail.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingConsentEmail(false);
    }
  };

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
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Espace patient</h1>
        <div className="text-sm text-slate-600 flex items-center space-x-4">
          <span>Connecté en tant que {user?.email}</span>
          <button type="button" className="btn btn-sm" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </header>

      {showProcedureSelection && (
        <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
          <h2 className="text-2xl font-semibold">Choisir le type de prise en charge</h2>
          <p className="text-sm text-slate-600">
            Sélectionnez le type d&apos;acte afin d&apos;afficher les informations correspondantes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setProcedureSelection('circumcision')}
            >
              Circoncision rituelle
            </button>
            <button type="button" className="btn" onClick={() => setProcedureSelection('autre')}>
              Autre acte
            </button>
          </div>
        </section>
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

      {showProcedureForm && (
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

      {showScheduling && (
        <section className="space-y-6">
          <div className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold">Planifier un rendez-vous</h2>
            <div className="flex items-center space-x-3">
              <label htmlFor="appointmentType" className="font-medium">
                Type de rendez-vous :
              </label>
              <select
                id="appointmentType"
                className="select select-bordered"
                value={appointmentType}
                onChange={(event) => setAppointmentType(event.target.value)}
              >
                <option value="preconsultation" disabled={hasPreconsultation}>
                  Consultation pré-opératoire
                </option>
                <option value="act" disabled={!hasPreconsultation || hasAct}>
                  Acte chirurgical
                </option>
              </select>
            </div>
            {appointmentType === 'preconsultation' ? (
              <div className="flex items-center space-x-3">
                <label htmlFor="appointmentMode" className="font-medium">
                  Format :
                </label>
                <select
                  id="appointmentMode"
                  className="select select-bordered"
                  value={appointmentMode}
                  onChange={(event) => setAppointmentMode(event.target.value)}
                >
                  <option value="visio">Visio</option>
                  <option value="presentiel">Présentiel</option>
                </select>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Format : présence obligatoire au cabinet.</p>
            )}
            <Calendar
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onSelectDate={handleDateSelect}
            />

            {selectedDate && (
              <div className="space-y-3">
                <h3 className="text-lg font-medium">
                  Créneaux disponibles le {selectedDate.toLocaleDateString('fr-FR')}
                </h3>
                {slotsLoading ? (
                  <p className="text-sm text-slate-500">Chargement des créneaux...</p>
                ) : (
                  <TimeSlots
                    availableSlots={availableSlots}
                    selectedSlot={selectedSlot}
                    onSelectSlot={(slot) => setSelectedSlot(slot === selectedSlot ? null : slot)}
                  />
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selectedSlot}
                  onClick={handleCreateAppointment}
                >
                  Confirmer le rendez-vous
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      <Toast message={successMessage} isVisible={Boolean(successMessage)} onClose={() => setSuccessMessage(null)} />
    </div>
  );
};

export default Patient;
