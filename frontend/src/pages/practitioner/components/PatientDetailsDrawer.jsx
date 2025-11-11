import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/Modal.jsx';
import { SectionHeading } from '../../../components/ui';
import { API_BASE_URL, fetchSlots } from '../../../lib/api.js';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '--');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('fr-FR') : '--');
const toInputDate = (value) => (value ? new Date(value).toISOString().split('T')[0] : '');
const truncateTime = (value) => (value ? value.slice(0, 5) : '');
const labelForAppointmentType = (value) => {
  if (value === 'act') return 'Acte';
  if (value === 'preconsultation') return 'Pré-consultation';
  return 'Autre';
};

const buildCaseForm = (procedure, patient) => ({
  child_full_name: procedure?.child_full_name || patient?.child_full_name || '',
  child_birthdate: toInputDate(procedure?.child_birthdate),
  child_weight_kg: procedure?.child_weight_kg?.toString() ?? '',
  parent1_name: procedure?.parent1_name || '',
  parent1_email: procedure?.parent1_email || '',
  parent2_name: procedure?.parent2_name || '',
  parent2_email: procedure?.parent2_email || '',
  parental_authority_ack: Boolean(procedure?.parental_authority_ack),
  notes: procedure?.notes || '',
});

const buildScheduleForm = (appointment) => ({
  date: appointment?.date || '',
  time: truncateTime(appointment?.time),
  appointment_type: appointment?.appointment_type || 'act',
  mode: appointment?.mode || '',
  status: appointment?.status || '',
});

const sanitizeCaseValues = (form) => {
  const nullable = (value) => (value === '' ? null : value);
  let parsedWeight = null;
  if (form.child_weight_kg !== '' && form.child_weight_kg !== null && form.child_weight_kg !== undefined) {
    const asNumber = Number.parseFloat(form.child_weight_kg);
    parsedWeight = Number.isNaN(asNumber) ? null : asNumber;
  }
  return {
    child_full_name: form.child_full_name || '',
    child_birthdate: form.child_birthdate || null,
    child_weight_kg: parsedWeight,
    parent1_name: nullable(form.parent1_name),
    parent1_email: nullable(form.parent1_email),
    parent2_name: nullable(form.parent2_name),
    parent2_email: nullable(form.parent2_email),
    parental_authority_ack: Boolean(form.parental_authority_ack),
    notes: nullable(form.notes),
  };
};

const normalizeTimePayload = (value) => {
  if (!value) return null;
  const normalized = value.length === 5 ? `${value}:00` : value;
  return normalized;
};

const normalizeModeForType = (appointmentType, mode) => {
  if (appointmentType === 'act') {
    return 'presentiel';
  }
  if (mode && mode.length) {
    return mode;
  }
  if (appointmentType === 'preconsultation') {
    return 'visio';
  }
  return null;
};

const sanitizeScheduleValues = (form) => ({
  date: form.date || null,
  time: normalizeTimePayload(form.time),
  appointment_type: form.appointment_type || null,
  mode: normalizeModeForType(form.appointment_type, form.mode),
  status: form.status || null,
});

const HOURLY_SLOTS = Array.from({ length: 10 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);

const summaryToScheduleForm = (summary) =>
  summary
    ? {
        date: summary.date || '',
        time: truncateTime(summary.time),
        appointment_type: summary.appointment_type,
        mode: summary.mode || '',
        status: summary.status || '',
      }
    : null;

export function PatientDetailsDrawer({
  isOpen,
  onClose,
  appointment,
  onUpdateCase,
  onReschedule,
  onCreateAppointment,
  onPreview,
  updatingCase = false,
  updatingAppointment = false,
  creatingAppointment = false,
  prescriptionHistory = [],
  historyLoading = false,
  historyError = null,
}) {
  if (!appointment) return null;
  const { procedure, patient } = appointment;
  const buildAbsoluteUrl = (path, inline = false, channel = 'download') => {
    if (!path) return null;
    const base = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const separator = base.includes('?') ? '&' : '?';
    const actorChannel = `${separator}actor=practitioner&channel=${channel}`;
    const inlineParam = inline ? '&mode=inline' : '';
    return `${base}${actorChannel}${inlineParam}`;
  };
  const prescriptionUrl = buildAbsoluteUrl(appointment.prescription_url, false, 'download');
  const prescriptionPreviewUrl = buildAbsoluteUrl(appointment.prescription_url, true, 'preview');

  const [isEditingCase, setIsEditingCase] = useState(false);
  const [caseForm, setCaseForm] = useState(buildCaseForm(procedure, patient));
  const [initialCaseForm, setInitialCaseForm] = useState(buildCaseForm(procedure, patient));
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(buildScheduleForm(appointment));
  const [initialScheduleForm, setInitialScheduleForm] = useState(buildScheduleForm(appointment));
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [editedAppointmentId, setEditedAppointmentId] = useState(appointment?.appointment_id ?? null);

  const appointmentSummariesByType = useMemo(() => {
    const entries = procedure?.appointments_overview ?? [];
    return entries.reduce((acc, item) => {
      acc[item.appointment_type] = item;
      return acc;
    }, {});
  }, [procedure?.appointments_overview]);

  useEffect(() => {
    const nextCaseForm = buildCaseForm(procedure, patient);
    setCaseForm(nextCaseForm);
    setInitialCaseForm(nextCaseForm);
    setIsEditingCase(false);
  }, [procedure, patient?.child_full_name]);

  useEffect(() => {
    const nextSchedule = buildScheduleForm(appointment);
    setScheduleForm(nextSchedule);
    setInitialScheduleForm(nextSchedule);
    setIsEditingSchedule(false);
    setAvailableSlots([]);
    setSlotsError(null);
    setEditedAppointmentId(appointment?.appointment_id ?? null);
  }, [appointment?.appointment_id, appointment?.date, appointment?.time]);

  useEffect(() => {
    if (!isEditingSchedule || !scheduleForm.date) {
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    fetchSlots(scheduleForm.date)
      .then((data) => {
        if (cancelled) return;
        setAvailableSlots(data?.slots ?? []);
      })
      .catch((error) => {
        if (cancelled) return;
        setSlotsError(error?.message || "Impossible de charger les créneaux.");
        setAvailableSlots([]);
      })
      .finally(() => {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isEditingSchedule, scheduleForm.date]);

  useEffect(() => {
    if (scheduleForm.appointment_type === 'act' && scheduleForm.mode !== 'presentiel') {
      setScheduleForm((prev) => ({ ...prev, mode: 'presentiel' }));
    }
  }, [scheduleForm.appointment_type, scheduleForm.mode]);

  const caseDiff = useMemo(() => {
    const current = sanitizeCaseValues(caseForm);
    const initial = sanitizeCaseValues(initialCaseForm);
    return Object.fromEntries(
      Object.entries(current).filter(([key, value]) => value !== initial[key]),
    );
  }, [caseForm, initialCaseForm]);

  const sanitizedScheduleValues = useMemo(() => sanitizeScheduleValues(scheduleForm), [scheduleForm]);
  const sanitizedInitialScheduleValues = useMemo(
    () => sanitizeScheduleValues(initialScheduleForm),
    [initialScheduleForm],
  );
  const scheduleDiff = useMemo(() => {
    return Object.fromEntries(
      Object.entries(sanitizedScheduleValues).filter(
        ([key, value]) => value !== sanitizedInitialScheduleValues[key],
      ),
    );
  }, [sanitizedScheduleValues, sanitizedInitialScheduleValues]);

  const normalizedSelectedSlot = scheduleForm.time || '';
  const availableSlotSet = useMemo(() => new Set(availableSlots), [availableSlots]);
  const canUseSlot = (slot) =>
    availableSlotSet.has(slot) || (normalizedSelectedSlot && slot === normalizedSelectedSlot);

  const handleSlotSelect = (slot) => {
    if (!canUseSlot(slot)) {
      return;
    }
    setScheduleForm((prev) => ({
      ...prev,
      time: prev.time === slot ? '' : slot,
    }));
  };

  const handleCaseInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCaseForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleScheduleInputChange = (event) => {
    const { name, value } = event.target;
    if (name === 'appointment_type') {
      const summary = appointmentSummariesByType[value];
      if (summary) {
        const nextForm = summaryToScheduleForm(summary);
        if (nextForm) {
          setScheduleForm(nextForm);
          setInitialScheduleForm(nextForm);
          setEditedAppointmentId(summary.appointment_id);
          return;
        }
      }
      const fallbackForm = {
        date: scheduleForm.date || '',
        time: '',
        appointment_type: value,
        mode: value === 'act' ? 'presentiel' : scheduleForm.mode || 'visio',
        status: 'pending',
      };
      setScheduleForm(fallbackForm);
      setInitialScheduleForm(fallbackForm);
      setEditedAppointmentId(null);
      return;
    }
    setScheduleForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitCase = async (event) => {
    event.preventDefault();
    if (!procedure?.case_id || !onUpdateCase || Object.keys(caseDiff).length === 0) {
      setIsEditingCase(false);
      return;
    }
    try {
      await onUpdateCase(procedure.case_id, caseDiff);
      setIsEditingCase(false);
    } catch {
      /* handled upstream */
    }
  };

  const handleSubmitSchedule = async (event) => {
    event.preventDefault();
    const payload = sanitizedScheduleValues;
    if (!payload.date || !payload.time) {
      return;
    }
    const targetAppointmentId = editedAppointmentId;
    const isCreation = !targetAppointmentId;
    try {
      if (isCreation) {
        if (!procedure?.case_id || !onCreateAppointment) {
          return;
        }
        await onCreateAppointment(procedure.case_id, {
          appointment_type: payload.appointment_type,
          date: payload.date,
          time: payload.time,
          mode: payload.mode,
        });
      } else {
        if (!onReschedule) {
          return;
        }
        if (Object.keys(scheduleDiff).length === 0) {
          setIsEditingSchedule(false);
          return;
        }
        await onReschedule(targetAppointmentId, scheduleDiff);
      }
      setIsEditingSchedule(false);
    } catch {
      /* handled upstream */
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading
            title={`Dossier de ${patient?.child_full_name || 'Patient'}`}
            subtitle={`Rendez-vous du ${formatDate(appointment.date)}`}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsEditingCase((prev) => !prev)}
            >
              {isEditingCase ? 'Fermer le mode édition' : 'Modifier le dossier'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={!appointment?.appointment_id}
              onClick={() => setIsEditingSchedule((prev) => !prev)}
            >
              {isEditingSchedule ? 'Fermer la replanification' : 'Replanifier'}
            </button>
          </div>
        </div>

        {isEditingCase && (
          <form className="space-y-3 border rounded-2xl p-4 bg-slate-50" onSubmit={handleSubmitCase}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text">Nom de l&apos;enfant</span>
                <input
                  type="text"
                  name="child_full_name"
                  className="input input-bordered"
                  value={caseForm.child_full_name}
                  onChange={handleCaseInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Date de naissance</span>
                <input
                  type="date"
                  name="child_birthdate"
                  className="input input-bordered"
                  value={caseForm.child_birthdate}
                  onChange={handleCaseInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Poids (kg)</span>
                <input
                  type="number"
                  name="child_weight_kg"
                  step="0.1"
                  className="input input-bordered"
                  value={caseForm.child_weight_kg}
                  onChange={handleCaseInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Autorité parentale confirmée</span>
                <input
                  type="checkbox"
                  name="parental_authority_ack"
                  className="toggle toggle-primary"
                  checked={caseForm.parental_authority_ack}
                  onChange={handleCaseInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Parent 1</span>
                <input
                  type="text"
                  name="parent1_name"
                  className="input input-bordered"
                  value={caseForm.parent1_name}
                  onChange={handleCaseInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Email parent 1</span>
                <input
                  type="email"
                  name="parent1_email"
                  className="input input-bordered"
                  value={caseForm.parent1_email}
                  onChange={handleCaseInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Parent 2</span>
                <input
                  type="text"
                  name="parent2_name"
                  className="input input-bordered"
                  value={caseForm.parent2_name}
                  onChange={handleCaseInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Email parent 2</span>
                <input
                  type="email"
                  name="parent2_email"
                  className="input input-bordered"
                  value={caseForm.parent2_email}
                  onChange={handleCaseInputChange}
                />
              </label>
            </div>
            <label className="form-control">
              <span className="label-text">Notes</span>
              <textarea
                name="notes"
                rows={3}
                className="textarea textarea-bordered"
                value={caseForm.notes}
                onChange={handleCaseInputChange}
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsEditingCase(false)}>
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={updatingCase}
              >
                {updatingCase ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {isEditingSchedule && (
          <form
            className="space-y-3 border rounded-2xl p-4 bg-slate-50"
            onSubmit={handleSubmitSchedule}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text">Date</span>
                <input
                  type="date"
                  name="date"
                  className="input input-bordered"
                  value={scheduleForm.date}
                  onChange={handleScheduleInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Heure</span>
                <input
                  type="time"
                  name="time"
                  className="input input-bordered"
                  value={scheduleForm.time}
                  onChange={handleScheduleInputChange}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Type</span>
                <select
                  name="appointment_type"
                  className="select select-bordered"
                  value={scheduleForm.appointment_type}
                  onChange={handleScheduleInputChange}
                >
                  <option value="act">Acte</option>
                  <option value="preconsultation">Pré-consultation</option>
                  <option value="general">Autre</option>
                </select>
                <span className="text-xs text-slate-500">
                  {appointmentSummariesByType[scheduleForm.appointment_type]
                    ? 'Rendez-vous existant : vous pouvez le replanifier.'
                    : 'Aucun rendez-vous de ce type. Sélectionnez une date pour le planifier.'}
                </span>
              </label>
              <label className="form-control">
                <span className="label-text">Mode</span>
                <select
                  name="mode"
                  className="select select-bordered"
                  value={scheduleForm.mode || ''}
                  onChange={handleScheduleInputChange}
                  disabled={scheduleForm.appointment_type === 'act'}
                >
                  <option value="">Non précisé</option>
                  <option value="presentiel">Présentiel</option>
                  <option value="visio">Visio</option>
                </select>
                {scheduleForm.appointment_type === 'act' && (
                  <span className="text-xs text-slate-500 mt-1">Un acte se déroule toujours en présentiel.</span>
                )}
              </label>
              <label className="form-control">
                <span className="label-text">Statut</span>
                <select
                  name="status"
                  className="select select-bordered"
                  value={scheduleForm.status}
                  onChange={handleScheduleInputChange}
                >
                  <option value="pending">En attente</option>
                  <option value="validated">Confirmé</option>
                </select>
              </label>
            </div>
            <div className="space-y-2">
              <span className="label-text font-medium">Créneaux disponibles</span>
              {slotsLoading ? (
                <p className="text-sm text-slate-500">Chargement des créneaux...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {HOURLY_SLOTS.map((slot) => {
                    const isSelected = normalizedSelectedSlot === slot;
                    const disabled = !canUseSlot(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`px-4 py-2 rounded-md border text-sm ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 hover:bg-blue-50'
                        } ${disabled && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={disabled && !isSelected}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
              {slotsError && <p className="text-xs text-red-600">{slotsError}</p>}
              {!slotsLoading && !slotsError && !availableSlots.length && (
                <p className="text-xs text-slate-500">
                  Aucun créneau libre pour cette date. Veuillez sélectionner un autre jour.
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsEditingSchedule(false)}>
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={
                  (!editedAppointmentId && !procedure?.case_id) ||
                  (editedAppointmentId ? updatingAppointment : creatingAppointment)
                }
              >
                {editedAppointmentId
                  ? updatingAppointment
                    ? 'Replanification...'
                    : 'Appliquer'
                  : creatingAppointment
                  ? 'Planification...'
                  : 'Planifier'}
              </button>
            </div>
          </form>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-700">Statut dossier</h4>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
              <li>Autorité parentale : {procedure?.parental_authority_ack ? 'OK' : 'Manquante'}</li>
              <li>Checklist : {procedure?.has_checklist ? 'OK' : 'À fournir'}</li>
              <li>Consentement : {procedure?.has_consent ? 'OK' : 'À récupérer'}</li>
              <li>Ordonnance : {procedure?.has_ordonnance ? 'OK' : 'Non générée'}</li>
              <li>
                Pré-consultation :{' '}
                {procedure?.has_preconsultation
                  ? `Planifiée le ${formatDate(procedure.next_preconsultation_date)}`
                  : 'Non planifiée'}
              </li>
              <li>
                Acte :{' '}
                {procedure?.has_act_planned
                  ? `Planifié le ${formatDate(procedure.next_act_date)}`
                  : 'Non planifié'}
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-700">À surveiller</h4>
            {procedure?.missing_items?.length ? (
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                {procedure.missing_items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Aucun élément manquant.</p>
            )}
          </div>
        </div>

        {procedure?.notes && !isEditingCase && (
          <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600">
            <strong>Notes :</strong> {procedure.notes}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600 space-y-1">
            <strong>Rappel rendez-vous</strong>
            <p>Envoyé : {formatDate(appointment.reminder_sent_at)}</p>
            <p>
              Ouvert :{' '}
              {appointment.reminder_opened_at
                ? new Date(appointment.reminder_opened_at).toLocaleString('fr-FR')
                : 'Non lu'}
            </p>
          </div>
          <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600 space-y-1">
            <strong>Ordonnance</strong>
            <p>Envoyée : {formatDate(appointment.prescription_sent_at)}</p>
            <p>
              Dernier téléchargement :{' '}
              {appointment.prescription_last_download_at
                ? new Date(appointment.prescription_last_download_at).toLocaleString('fr-FR')
                : '--'}
            </p>
            <p>Téléchargements : {appointment.prescription_download_count || 0}</p>
            <div className="flex gap-2">
              {prescriptionPreviewUrl ? (
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={() =>
                    onPreview?.({
                      open: true,
                      url: prescriptionPreviewUrl,
                      title: 'Aperçu - Ordonnance',
                    })
                  }
                >
                  Prévisualiser
                </button>
              ) : (
                <p className="text-xs text-slate-500 flex-1">Aucune ordonnance générée.</p>
              )}
              {prescriptionUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => window.open(prescriptionUrl, '_blank', 'noopener')}
                >
                  Télécharger
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <strong className="text-xs uppercase tracking-wide text-slate-500">
                Historique
              </strong>
              {historyLoading && <p className="text-xs text-slate-500">Chargement...</p>}
              {historyError && (
                <p className="text-xs text-red-600">Erreur: {historyError}</p>
              )}
              {!historyLoading && !historyError && !prescriptionHistory.length && (
                <p className="text-xs text-slate-500">
                  Aucune version disponible pour l’instant.
                </p>
              )}
              {!historyLoading && !historyError && prescriptionHistory.length > 0 && (
                <div className="space-y-2">
                  {prescriptionHistory.map((version) => {
                    const versionDownloadUrl = buildAbsoluteUrl(version.url, false, 'download');
                    const versionPreviewUrl = buildAbsoluteUrl(version.url, true, 'preview');
                    return (
                      <div
                        key={version.id}
                        className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-700 text-xs">
                              {labelForAppointmentType(version.appointment_type)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatDateTime(version.created_at)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() =>
                                onPreview?.({
                                  open: true,
                                  url: versionPreviewUrl,
                                  title: `Aperçu - ${labelForAppointmentType(version.appointment_type)}`,
                                })
                              }
                              disabled={!versionPreviewUrl}
                            >
                              Prévisualiser
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => window.open(versionDownloadUrl, '_blank', 'noopener')}
                              disabled={!versionDownloadUrl}
                            >
                              Télécharger
                            </button>
                          </div>
                        </div>
                        {version.items?.length ? (
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {version.items.join(', ')}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">
                            Aucun détail d’items enregistré.
                          </p>
                        )}
                        {version.downloads?.length ? (
                          <div className="pt-1 border-t border-dashed border-slate-200 mt-2">
                            <p className="text-[11px] font-semibold text-slate-600">Téléchargements</p>
                            <ul className="text-[10px] text-slate-500 space-y-1">
                              {version.downloads.map((log) => (
                                <li key={log.id}>
                                  {formatDateTime(log.downloaded_at)} —{' '}
                                  {log.actor === 'patient' || log.actor === 'patient_link'
                                    ? 'Patient'
                                    : 'Praticien'}{' '}
                                  ({log.channel.replace('_', ' ')})
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400">Aucun téléchargement enregistré.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
