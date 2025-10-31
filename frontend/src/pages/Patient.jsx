import React, { useEffect, useMemo, useState } from 'react';
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

const initialProcedureForm = {
  child_full_name: '',
  child_birthdate: '',
  child_weight_kg: '',
  parent1_name: '',
  parent1_email: '',
  parent2_name: '',
  parent2_email: '',
  parental_authority_ack: false,
  notes: '',
};

const Patient = () => {
  const { isAuthenticated, login, register, logout, token, user, loading } = useAuth();

  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [appointmentType, setAppointmentType] = useState('preconsultation');
  const [appointmentMode, setAppointmentMode] = useState('visio');
  const [procedureSelection, setProcedureSelection] = useState(null);

  const [registerForm, setRegisterForm] = useState({ email: '', password: '', password_confirm: '', role: 'patient' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerFeedback, setRegisterFeedback] = useState(null);

  const [procedureInfo, setProcedureInfo] = useState(null);
  const [procedureCase, setProcedureCase] = useState(null);
  const [procedureForm, setProcedureForm] = useState(initialProcedureForm);

  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [procedureLoading, setProcedureLoading] = useState(false);
  const [sendingConsentEmail, setSendingConsentEmail] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setProcedureSelection(null);
      setProcedureCase(null);
      setProcedureForm(initialProcedureForm);
      setProcedureInfo(null);
      return;
    }
  }, [isAuthenticated]);

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
    if (!token || procedureSelection !== 'circumcision') return;
    setProcedureLoading(true);
    try {
      const current = await fetchCurrentProcedure(token);
      setProcedureCase(current);
      if (current) {
        setProcedureForm({
          child_full_name: current.child_full_name,
          child_birthdate: current.child_birthdate,
          child_weight_kg: current.child_weight_kg ?? '',
          parent1_name: current.parent1_name ?? '',
          parent1_email: current.parent1_email ?? '',
          parent2_name: current.parent2_name ?? '',
          parent2_email: current.parent2_email ?? '',
          parental_authority_ack: current.parental_authority_ack ?? false,
          notes: current.notes ?? '',
        });
      } else {
        setProcedureForm(initialProcedureForm);
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
      setProcedureForm(initialProcedureForm);
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

  const handleRegisterChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    setError(null);
    setRegisterFeedback(null);
    try {
      await register(registerForm);
      setRegisterFeedback({
        type: 'success',
        message: "Inscription reussie. Verifiez votre boite mail pour confirmer votre adresse.",
      });
    } catch (err) {
      setRegisterFeedback({ type: 'error', message: err.message });
    }
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      await login(loginForm);
      setSuccessMessage('Connexion reussie. Vous pouvez maintenant renseigner les informations necessaires.');
      await loadProcedureCase();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleProcedureFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProcedureForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleProcedureSubmit = async (event) => {
    event.preventDefault();
    if (!token || procedureSelection !== 'circumcision') {
      setError("Veuillez selectionner la circoncision et vous connecter avant d'enregistrer le dossier.");
      return;
    }
    setError(null);
    try {
      const payload = {
        procedure_type: 'circumcision',
        child_full_name: procedureForm.child_full_name,
        child_birthdate: procedureForm.child_birthdate,
        child_weight_kg: procedureForm.child_weight_kg ? Number(procedureForm.child_weight_kg) : null,
        parent1_name: procedureForm.parent1_name,
        parent1_email: procedureForm.parent1_email || null,
        parent2_name: procedureForm.parent2_name || null,
        parent2_email: procedureForm.parent2_email || null,
        parental_authority_ack: procedureForm.parental_authority_ack,
        notes: procedureForm.notes || null,
      };

      const caseData = await saveProcedure(token, payload);
      setProcedureCase(caseData);
      setSuccessMessage('Dossier mis a jour. Un consentement pre-rempli est disponible au telechargement.');
    } catch (err) {
      setError(err.message);
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
    const modeLabel = payload.mode === 'visio' ? 'en visio' : 'en presentiel';
    setSuccessMessage(`Rendez-vous confirme le ${payload.date} a ${selectedSlot} (${modeLabel}). Un e-mail de confirmation a ete envoye.`);
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
    procedureCase.parental_authority_ack
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
      setSuccessMessage('Lien de consentement envoye par e-mail.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingConsentEmail(false);
    }
  };

  const childBirthdateString = procedureForm.child_birthdate || procedureCase?.child_birthdate || null;
  const childAgeDisplay = useMemo(
    () => formatChildAge(childBirthdateString),
    [childBirthdateString],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Espace patient</h1>
        {isAuthenticated && (
          <div className="text-sm text-slate-600 flex items-center space-x-4">
            <span>Connecte en tant que {user?.email}</span>
            <button type="button" className="btn btn-sm" onClick={logout}>
              Se deconnecter
            </button>
          </div>
        )}
      </header>

      {showProcedureSelection && (
        <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
          <h2 className="text-2xl font-semibold">Choisir le type de prise en charge</h2>
          <p className="text-sm text-slate-600">
            Selectionnez le type d&apos;acte afin d&apos;afficher les informations correspondantes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setProcedureSelection('circumcision')}
            >
              Circoncision rituelle
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setProcedureSelection('autre')}
            >
              Autre acte
            </button>
          </div>
        </section>
      )}

      {showAutreMessage && (
        <section className="p-6 border rounded-xl bg-white shadow-sm">
          <h2 className="text-2xl font-semibold">Autre prise en charge</h2>
          <p className="text-sm text-slate-600">
            Ce parcours n&apos;est pas encore configure. Merci de revenir vers le praticien pour plus d&apos;informations.
          </p>
        </section>
      )}

      {showProcedureForm && procedureInfo && (
        <section className="p-6 border rounded-xl bg-white shadow-sm">
          <h2 className="text-2xl font-semibold mb-3">{procedureInfo.title}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {procedureInfo.sections.map((section) => (
              <div key={section.heading} className="space-y-2">
                <h3 className="font-semibold text-lg">{section.heading}</h3>
                <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isAuthenticated && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="p-6 border rounded-xl space-y-4 bg-white shadow-sm">
            <h2 className="text-xl font-semibold">Creer un compte</h2>
            <form onSubmit={submitRegister} className="space-y-3">
              <input
                type="email"
                name="email"
                value={registerForm.email}
                onChange={handleRegisterChange}
                className="input input-bordered w-full"
                placeholder="Email"
                required
              />
              <input
                type="password"
                name="password"
                value={registerForm.password}
                onChange={handleRegisterChange}
                className="input input-bordered w-full"
                placeholder="Mot de passe (min. 8 caracteres)"
                required
              />
              <input
                type="password"
                name="password_confirm"
                value={registerForm.password_confirm}
                onChange={handleRegisterChange}
                className="input input-bordered w-full"
                placeholder="Confirmer le mot de passe"
                required
              />
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'En cours...' : 'Inscription'}
              </button>
            </form>
            {registerFeedback && (
              <p className={`text-sm ${registerFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {registerFeedback.message}
              </p>
            )}
          </div>

          <div className="p-6 border rounded-xl space-y-4 bg-white shadow-sm">
            <h2 className="text-xl font-semibold">Se connecter</h2>
            <form onSubmit={submitLogin} className="space-y-3">
              <input
                type="email"
                name="email"
                value={loginForm.email}
                onChange={handleLoginChange}
                className="input input-bordered w-full"
                placeholder="Email"
                required
              />
              <input
                type="password"
                name="password"
                value={loginForm.password}
                onChange={handleLoginChange}
                className="input input-bordered w-full"
                placeholder="Mot de passe"
                required
              />
              <button type="submit" className="btn btn-secondary w-full" disabled={loading}>
                {loading ? 'Connexion...' : 'Connexion'}
              </button>
            </form>
            <p className="text-xs text-slate-500">
              Apres linscription, pensez a valider votre adresse en cliquant sur le lien recu par e-mail (verifiez vos spams).
            </p>
          </div>
        </section>
      )}

      {showProcedureForm && (
        <section className="p-6 border rounded-xl bg-white shadow-sm space-y-6">
          <h2 className="text-2xl font-semibold">Dossier de circoncision</h2>
          <form onSubmit={handleProcedureSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Informations sur lenfant</h3>
              <input
                type="text"
                name="child_full_name"
                value={procedureForm.child_full_name}
                onChange={handleProcedureFormChange}
                className="input input-bordered w-full"
                placeholder="Nom complet de lenfant"
                required
              />
              <input
                type="date"
                name="child_birthdate"
                value={procedureForm.child_birthdate}
                onChange={handleProcedureFormChange}
                className="input input-bordered w-full"
                required
              />
              {childAgeDisplay && (
                <p className="text-sm text-slate-600">Age : {childAgeDisplay}</p>
              )}
              <input
                type="number"
                step="0.1"
                min="0"
                name="child_weight_kg"
                value={procedureForm.child_weight_kg}
                onChange={handleProcedureFormChange}
                className="input input-bordered w-full"
                placeholder="Poids en kg"
              />
              <textarea
                name="notes"
                value={procedureForm.notes}
                onChange={handleProcedureFormChange}
                className="textarea textarea-bordered w-full"
                placeholder="Notes medicales (allergies, traitements...)"
              />
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="parental_authority_ack"
                  checked={procedureForm.parental_authority_ack}
                  onChange={handleProcedureFormChange}
                  className="checkbox"
                />
                <span>Je comprends que le consentement des deux titulaires de lautorite parentale est obligatoire.</span>
              </label>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Parents / responsables legaux</h3>
              <input
                type="text"
                name="parent1_name"
                value={procedureForm.parent1_name}
                onChange={handleProcedureFormChange}
                className="input input-bordered w-full"
                placeholder="Parent / tuteur 1 (obligatoire)"
                required
              />
              <input
                type="email"
                name="parent1_email"
                value={procedureForm.parent1_email}
                onChange={handleProcedureFormChange}
                className="input input-bordered w-full"
                placeholder="Email parent 1 (facultatif)"
              />
              <input
                type="text"
                name="parent2_name"
                value={procedureForm.parent2_name}
                onChange={handleProcedureFormChange}
                className="input input-bordered w-full"
                placeholder="Parent / tuteur 2 (optionnel)"
              />
              <input
                type="email"
                name="parent2_email"
                value={procedureForm.parent2_email}
                onChange={handleProcedureFormChange}
                className="input input-bordered w-full"
                placeholder="Email parent 2 (optionnel)"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={procedureLoading}>
                {procedureLoading ? 'Enregistrement...' : 'Enregistrer le dossier'}
              </button>
            </div>
          </form>

          {showConsentDownload && (
            <div className="p-4 rounded-lg border bg-slate-50 space-y-2">
              <h3 className="font-semibold">Consentement pre-rempli</h3>
              <p className="text-sm text-slate-600">
                Telechargez le document, faites-le signer par les deux parents, puis apportez-le le jour de lintervention.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a className="btn btn-sm btn-outline" href={consentLink}>
                  Telecharger le consentement
                </a>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleSendConsentEmail}
                  disabled={sendingConsentEmail}
                >
                  {sendingConsentEmail ? 'Envoi en cours...' : 'Envoyer le lien par e-mail'}
                </button>
              </div>
            </div>
          )}
          {showConsentPending && (
            <div className="p-4 rounded-lg border bg-slate-50 space-y-2">
              <h3 className="font-semibold">Consentement en preparation</h3>
              <p className="text-sm text-slate-600">
                Le document de consentement est en cours de generation. Vous recevrez un lien de
                telechargement par e-mail des qu&apos;il sera pret.
              </p>
            </div>
          )}
        </section>
      )}

      {showScheduling && (
        <section className="space-y-6">
          <div className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold">Planifier un rendez-vous</h2>
            <div className="flex items-center space-x-3">
              <label htmlFor="appointmentType" className="font-medium">Type de rendez-vous :</label>
              <select
                id="appointmentType"
                className="select select-bordered"
                value={appointmentType}
                onChange={(event) => setAppointmentType(event.target.value)}
              >
                <option value="preconsultation" disabled={hasPreconsultation}>
                  Consultation pre-operatoire
                </option>
                <option value="act" disabled={!hasPreconsultation || hasAct}>
                  Acte chirurgical
                </option>
              </select>
            </div>
            {appointmentType === 'preconsultation' ? (
              <div className="flex items-center space-x-3">
                <label htmlFor="appointmentMode" className="font-medium">Format :</label>
                <select
                  id="appointmentMode"
                  className="select select-bordered"
                  value={appointmentMode}
                  onChange={(event) => setAppointmentMode(event.target.value)}
                >
                  <option value="visio">Visio</option>
                  <option value="presentiel">Presentiel</option>
                </select>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Format : presence obligatoire au cabinet.</p>
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
                  Creneaux disponibles le {selectedDate.toLocaleDateString('fr-FR')}
                </h3>
                {slotsLoading ? (
                  <p className="text-sm text-slate-500">Chargement des creneaux...</p>
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
