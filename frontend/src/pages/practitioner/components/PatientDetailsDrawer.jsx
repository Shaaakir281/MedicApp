import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/Modal.jsx';
import { fetchSlots, createCabinetSession } from '../../../lib/api.js';
import { DrawerHeader } from './DrawerHeader.jsx';
import { CaseSummary } from './CaseSummary.jsx';
import { CaseForm } from './CaseForm.jsx';
import { ScheduleForm } from './ScheduleForm.jsx';
import { CaseStatus } from './CaseStatus.jsx';
import { PrescriptionsSection } from './PrescriptionsSection.jsx';
import { DocumentSignatureSection } from './DocumentSignatureSection.jsx';
import { practitionerSendSignature } from '../../../services/documentSignature.api.js';
import { mapPractitionerProcedureCase } from '../../../services/patientDashboard.mapper.js';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '--');
const toInputDate = (value) => (value ? new Date(value).toISOString().split('T')[0] : '');
const truncateTime = (value) => (value ? value.slice(0, 5) : '');

const buildCaseForm = (procedure, patient) => ({
  child_full_name: procedure?.child_full_name || patient?.child_full_name || '',
  child_birthdate: toInputDate(procedure?.child_birthdate),
  child_weight_kg: procedure?.child_weight_kg?.toString() ?? '',
  parent1_name: procedure?.parent1_name || '',
  parent1_first_name: procedure?.parent1_first_name || '',
  parent1_last_name: procedure?.parent1_last_name || '',
  parent1_email: procedure?.parent1_email || '',
  parent2_name: procedure?.parent2_name || '',
  parent2_first_name: procedure?.parent2_first_name || '',
  parent2_last_name: procedure?.parent2_last_name || '',
  parent2_email: procedure?.parent2_email || '',
  parent1_phone: procedure?.parent1_phone || '',
  parent2_phone: procedure?.parent2_phone || '',
  parent1_sms_optin: Boolean(procedure?.parent1_sms_optin),
  parent2_sms_optin: Boolean(procedure?.parent2_sms_optin),
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
  const nullable = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
    return value;
  };
  let parsedWeight = null;
  if (form.child_weight_kg !== '' && form.child_weight_kg !== null && form.child_weight_kg !== undefined) {
    const asNumber = Number.parseFloat(form.child_weight_kg);
    parsedWeight = Number.isNaN(asNumber) ? null : asNumber;
  }
  const trimmedChildName =
    typeof form.child_full_name === 'string' ? form.child_full_name.trim() : form.child_full_name || '';
  return {
    child_full_name: trimmedChildName || '',
    child_birthdate: form.child_birthdate || null,
    child_weight_kg: parsedWeight,
    parent1_name: nullable(form.parent1_name),
    parent1_first_name: nullable(form.parent1_first_name),
    parent1_last_name: nullable(form.parent1_last_name),
    parent1_email: nullable(form.parent1_email),
    parent2_name: nullable(form.parent2_name),
    parent2_first_name: nullable(form.parent2_first_name),
    parent2_last_name: nullable(form.parent2_last_name),
    parent2_email: nullable(form.parent2_email),
    parent1_phone: nullable(form.parent1_phone),
    parent2_phone: nullable(form.parent2_phone),
    parent1_sms_optin: Boolean(form.parent1_sms_optin),
    parent2_sms_optin: Boolean(form.parent2_sms_optin),
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
  token,
  appointment,
  onUpdateCase,
  onReschedule,
  onCreateAppointment,
  onPreview,
  onEdit,
  onSend,
  onDownloadConsent,
  onNavigateDate,
  onInitiateConsent,
  onRemindConsent,
  sendingId,
  updatingCase = false,
  updatingAppointment = false,
  creatingAppointment = false,
  consentActionLoading = false,
  prescriptionHistory = [],
}) {
  const currentAppointment = appointment || {};
  const { procedure, patient } = currentAppointment;

  const latestHistoryByType = (type) => {
    const entries = (prescriptionHistory || []).filter((entry) => entry.appointment_type === type);
    if (!entries.length) return null;
    return entries.reduce((latest, curr) =>
      new Date(curr.created_at) > new Date(latest.created_at) ? curr : latest,
    );
  };

  const distinctPrescriptions = [
    { type: 'preconsultation', label: 'Ordonnance pre-consultation' },
    { type: 'act', label: 'Ordonnance acte' },
  ];

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
  const [cabinetSession, setCabinetSession] = useState(null);
  const [creatingCabinetRole, setCreatingCabinetRole] = useState(null);
  const [cabinetError, setCabinetError] = useState(null);

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
  }, [procedure, patient]);

  useEffect(() => {
    const nextSchedule = buildScheduleForm(appointment);
    setScheduleForm(nextSchedule);
    setInitialScheduleForm(nextSchedule);
    setIsEditingSchedule(false);
    setAvailableSlots([]);
    setSlotsError(null);
    setEditedAppointmentId(appointment?.appointment_id ?? null);
    setCabinetSession(null);
    setCabinetError(null);
    setCreatingCabinetRole(null);
  }, [appointment]);

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
        setSlotsError(error?.message || "Impossible de charger les creneaux.");
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

  const handleSendSignature = async (caseId, documentType) => {
    if (!token) {
      console.error('Token manquant pour envoyer signature');
      return;
    }
    await practitionerSendSignature(token, caseId, documentType);
  };

  const handleCreateCabinetSession = async (role) => {
    if (!token || !appointment?.appointment_id) return;
    setCabinetError(null);
    setCreatingCabinetRole(role);
    try {
      const session = await createCabinetSession(token, {
        appointment_id: appointment.appointment_id,
        signer_role: role,
      });
      setCabinetSession(session);
    } catch (err) {
      setCabinetError(err?.message || 'Echec de création de la session tablette.');
    } finally {
      setCreatingCabinetRole(null);
    }
  };

  if (!appointment) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        <DrawerHeader
          patientName={patient?.child_full_name}
          appointmentDate={formatDate(appointment?.date)}
          onToggleCase={() => setIsEditingCase((prev) => !prev)}
          onToggleSchedule={() => setIsEditingSchedule((prev) => !prev)}
          isEditingCase={isEditingCase}
          isEditingSchedule={isEditingSchedule}
        />

        {!isEditingCase && (
          <CaseSummary
            appointment={appointment}
            onDownloadConsent={() => onDownloadConsent?.(appointment)}
          />
        )}

        {isEditingCase && (
          <form className="space-y-3 border rounded-2xl p-4 bg-slate-50" onSubmit={handleSubmitCase}>
            <CaseForm caseForm={caseForm} onChange={handleCaseInputChange} />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsEditingCase(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={updatingCase || Object.keys(caseDiff).length === 0}>
                {updatingCase ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {isEditingSchedule && (
          <ScheduleForm
            scheduleForm={scheduleForm}
            onChange={handleScheduleInputChange}
            onSelectSlot={handleSlotSelect}
            availableSlots={availableSlots}
            slotsLoading={slotsLoading}
            slotsError={slotsError}
            canUseSlot={canUseSlot}
            normalizedSelectedSlot={normalizedSelectedSlot}
            onCancel={() => setIsEditingSchedule(false)}
            onSubmit={handleSubmitSchedule}
            editedAppointmentId={editedAppointmentId}
            procedure={procedure}
            updatingAppointment={updatingAppointment}
            creatingAppointment={creatingAppointment}
          />
        )}

        <CaseStatus
          appointment={appointment}
          procedure={procedure}
          onNavigateDate={onNavigateDate}
          onInitiateConsent={onInitiateConsent}
          onRemindConsent={onRemindConsent}
          consentActionLoading={consentActionLoading}
        />

        {procedure && (
          <div className="bg-white border rounded-2xl p-4">
            <DocumentSignatureSection
              documentSignatures={mapPractitionerProcedureCase(procedure).documentSignatures || []}
              caseId={procedure.case_id}
              onSend={handleSendSignature}
              onRefresh={() => {
                // Refresh sera géré par le parent via onUpdateCase ou un refetch
              }}
            />
          </div>
        )}

        <div className="bg-slate-50 border rounded-2xl p-4 text-sm text-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-700">Session tablette (cabinet)</h4>
            {cabinetSession && <span className="badge badge-success">Active</span>}
          </div>
          <p className="text-sm text-slate-600">
            Générer un code pour faire signer sur tablette en cabinet (OTP désactivé).
          </p>
          <div className="flex gap-2 flex-wrap">
            {['parent1', 'parent2'].map((role) => (
              <button
                key={role}
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => handleCreateCabinetSession(role)}
                disabled={!token || creatingCabinetRole === role}
              >
                {creatingCabinetRole === role
                  ? 'Création...'
                  : `Créer session ${role === 'parent1' ? 'Parent 1' : 'Parent 2'}`}
              </button>
            ))}
          </div>
          {cabinetError && <p className="text-sm text-red-600">{cabinetError}</p>}
          {cabinetSession && (
            <div className="space-y-1">
              <p>Role : {cabinetSession.signer_role}</p>
              <p>
                Code : <span className="font-mono">{cabinetSession.session_code}</span>
              </p>
              <p>
                Lien tablette :{' '}
                <a
                  className="link link-primary break-all"
                  href={cabinetSession.tablet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cabinetSession.tablet_url}
                </a>
              </p>
              <p>
                Expiration :{' '}
                {cabinetSession.expires_at
                  ? new Date(cabinetSession.expires_at).toLocaleString('fr-FR')
                  : '—'}
              </p>
            </div>
          )}
        </div>

        <PrescriptionsSection
          appointment={appointment}
          distinctPrescriptions={distinctPrescriptions}
          latestHistoryByType={latestHistoryByType}
          onPreview={onPreview}
          onEdit={onEdit}
          onSend={onSend}
          sendingId={sendingId}
          onNavigateDate={onNavigateDate}
        />
      </div>
    </Modal>
  );
}
