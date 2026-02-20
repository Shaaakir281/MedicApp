import { useCallback, useEffect, useMemo, useState } from 'react';

import { createAppointment, deleteAppointment, fetchSlots } from '../lib/api.js';
import { buildDocumentUrl } from '../utils/url.js';
import { formatDateISO, parseISODateLocal, sortAppointments } from '../utils/date.js';

const getAppointmentId = (appt) => appt?.appointment_id || appt?.id || null;

export function usePatientAppointments({
  token,
  isAuthenticated,
  procedureSelection,
  procedureCase,
  loadProcedureCase,
  setError,
  setSuccessMessage,
  onReloadDashboard,
  onShow14DayModal,
}) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [appointmentType, setAppointmentType] = useState('preconsultation');
  const [appointmentMode, setAppointmentMode] = useState('visio');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

  const appointmentsByType = useMemo(() => {
    const map = new Map();
    procedureCase?.appointments?.forEach((appt) => map.set(appt.appointment_type, appt));
    return map;
  }, [procedureCase]);

  const hasPreconsultation = appointmentsByType.has('preconsultation');
  const hasAct = appointmentsByType.has('act');
  const minSelectableDate = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (appointmentType !== 'act') {
      return todayStart;
    }

    const preconsultationAppt = appointmentsByType.get('preconsultation');
    if (!preconsultationAppt?.date) {
      return todayStart;
    }

    const preDate = parseISODateLocal(preconsultationAppt.date);
    if (!preDate) {
      return todayStart;
    }

    preDate.setHours(0, 0, 0, 0);
    const earliestActDate = new Date(preDate);
    earliestActDate.setDate(earliestActDate.getDate() + 15);
    return earliestActDate > todayStart ? earliestActDate : todayStart;
  }, [appointmentType, appointmentsByType]);

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
        .catch((err) => setError?.(err.message))
        .finally(() => setSlotsLoading(false));
    } else if (!(isAuthenticated && procedureSelection === 'circumcision')) {
      setAvailableSlots([]);
    }
  }, [isAuthenticated, procedureCase, procedureSelection, selectedDate, setError]);

  useEffect(() => {
    if (procedureSelection !== 'circumcision') {
      setSelectedDate(null);
      setSelectedSlot(null);
      setAvailableSlots([]);
      setAppointmentType('preconsultation');
      setAppointmentMode('visio');
    }
  }, [procedureSelection]);

  useEffect(() => {
    if (appointmentType === 'act' && !hasPreconsultation) {
      setAppointmentType('preconsultation');
    }
  }, [appointmentType, hasPreconsultation]);

  useEffect(() => {
    if (
      appointmentType === 'preconsultation' &&
      hasPreconsultation &&
      !hasAct &&
      !editingAppointmentId
    ) {
      setAppointmentType('act');
      setAppointmentMode('presentiel');
      setScheduleError(null);
    }
  }, [appointmentType, hasPreconsultation, hasAct, editingAppointmentId]);

  useEffect(() => {
    if (appointmentType === 'act' && appointmentMode !== 'presentiel') {
      setAppointmentMode('presentiel');
    }
  }, [appointmentType, appointmentMode]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [appointmentType]);

  useEffect(() => {
    if (scheduleError) {
      setScheduleError(null);
    }
  }, [appointmentType, appointmentMode, selectedDate, selectedSlot]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (scheduleError) {
      setScheduleError(null);
    }
  };

  const handleCreateAppointment = useCallback(async () => {
    if (
      procedureSelection !== 'circumcision' ||
      !selectedDate ||
      !selectedSlot ||
      !token ||
      !procedureCase
    ) {
      return;
    }
    setError?.(null);
    setSuccessMessage?.(null);
    setScheduleError(null);

    const currentAppointments = procedureCase?.appointments || [];
    const preconsultationAppt = currentAppointments.find(
      (appt) => appt.appointment_type === 'preconsultation',
    );
    if (appointmentType === 'act') {
      if (!preconsultationAppt) {
        setScheduleError("Planifiez d'abord la consultation pré-opératoire avant l'acte.");
        return;
      }
      const preDate = preconsultationAppt.date ? parseISODateLocal(preconsultationAppt.date) : null;
      const diffDays = preDate
        ? (selectedDate.getTime() - preDate.getTime()) / (1000 * 60 * 60 * 24)
        : null;
      if (diffDays !== null && diffDays < 15) {
        if (onShow14DayModal && preDate) {
          const preConsultDateFormatted = preDate.toLocaleDateString('fr-FR');
          const earliestActDate = new Date(preDate);
          earliestActDate.setDate(earliestActDate.getDate() + 15);
          const earliestActDateFormatted = earliestActDate.toLocaleDateString('fr-FR');
          onShow14DayModal({
            title: 'Règle des 15 jours',
            message:
              "Pour des raisons médicales et légales, l'acte doit être réalisé au minimum 15 jours après la pré-consultation.\n\n" +
              `Votre pré-consultation : ${preConsultDateFormatted}\n` +
              `Date la plus tôt pour l'acte : ${earliestActDateFormatted}\n\n` +
              'Veuillez sélectionner une date ultérieure.',
          });
        } else {
          setScheduleError("L'acte doit être au moins 15 jours après la pré-consultation.");
        }
        return;
      }
    }

    if (
      appointmentType === 'preconsultation' &&
      hasPreconsultation &&
      !editingAppointmentId
    ) {
      setScheduleError('Une consultation pré-opératoire est déjà planifiée.');
      return;
    }

    try {
      if (editingAppointmentId) {
        await deleteAppointment(token, editingAppointmentId, { cascadeAct: false });
      }
      const payload = {
        date: formatDateISO(selectedDate),
        time: `${selectedSlot}:00`,
        appointment_type: appointmentType,
        procedure_id: procedureCase.id,
        mode: appointmentType === 'act' ? 'presentiel' : appointmentMode,
      };
      await createAppointment(token, payload);
      const modeLabel = payload.mode === 'visio' ? 'en visio' : 'en présentiel';
      setSuccessMessage?.(
        `Rendez-vous confirmé le ${payload.date} à ${selectedSlot} (${modeLabel}). Un e-mail de confirmation a été envoyé.`,
      );
      setSelectedSlot(null);
      setAvailableSlots((prev) => prev.filter((slot) => slot !== selectedSlot));
      setEditingAppointmentId(null);
      setEditModalOpen(false);
      await loadProcedureCase?.();
      await onReloadDashboard?.();
      return true;
    } catch (err) {
      setScheduleError(err?.message || 'Impossible de planifier ce rendez-vous.');
      return false;
    }
  }, [
    procedureSelection,
    selectedDate,
    selectedSlot,
    token,
    procedureCase,
    appointmentType,
    appointmentMode,
    editingAppointmentId,
    hasPreconsultation,
    loadProcedureCase,
    onReloadDashboard,
    onShow14DayModal,
    setError,
    setSuccessMessage,
  ]);

  const handleEditAppointment = useCallback(
    (appt) => {
      if (!appt) return;
      const apptId = getAppointmentId(appt);
      setError?.(null);
      setSuccessMessage?.(null);
      setEditingAppointmentId(apptId);
      setAppointmentType(appt.appointment_type || 'preconsultation');
      setAppointmentMode(appt.mode || (appt.appointment_type === 'act' ? 'presentiel' : 'visio'));
      const parsedDate = parseISODateLocal(appt.date);
      setSelectedDate(parsedDate || new Date());
      setSelectedSlot(appt.time ? appt.time.slice(0, 5) : null);
      setEditModalOpen(true);
      setScheduleError(null);
    },
    [setError, setSuccessMessage],
  );

  const handleCancelAppointment = useCallback(
    async (appt) => {
      const apptId = getAppointmentId(appt);
      if (!apptId || !token || cancelingId) return;
      const isPreconsultation = appt?.appointment_type === 'preconsultation';
      const hasLinkedAct = Boolean(isPreconsultation && hasAct);
      if (hasLinkedAct) {
        const confirmed = window.confirm(
          "Si vous annulez la pré-consultation, le rendez-vous d'acte ne peut pas être conservé.\n\n" +
            "Les deux rendez-vous seront annulés. Vous pourrez reprendre rendez-vous si un créneau reste disponible et respecte la règle des 15 jours.\n\n" +
            "Confirmer l'annulation ?",
        );
        if (!confirmed) return;
      }
      setCancelingId(apptId);
      setError?.(null);
      setSuccessMessage?.(null);
      try {
        await deleteAppointment(token, apptId, { cascadeAct: isPreconsultation });
        if (hasLinkedAct) {
          setSuccessMessage?.(
            "Rendez-vous pré-opératoire et rendez-vous d'acte annulés. Vous pouvez reprendre rendez-vous dans le respect du délai légal de 15 jours.",
          );
        } else {
          setSuccessMessage?.('Rendez-vous annulé. Vous pouvez en planifier un nouveau.');
        }
        await loadProcedureCase?.();
        await onReloadDashboard?.();
      } catch (err) {
        setError?.(err.message);
      } finally {
        setCancelingId(null);
        if (editingAppointmentId === apptId) {
          setEditingAppointmentId(null);
          setEditModalOpen(false);
        }
      }
    },
    [cancelingId, editingAppointmentId, hasAct, loadProcedureCase, onReloadDashboard, setError, setSuccessMessage, token],
  );

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingAppointmentId(null);
    setSelectedSlot(null);
    setScheduleError(null);
  };

  const handleConfirmEdit = async () => {
    const ok = await handleCreateAppointment();
    if (ok) {
      setEditModalOpen(false);
    }
  };

  const todayISO = useMemo(() => formatDateISO(new Date()), []);
  const appointments = procedureCase?.appointments || [];
  const upcomingAppointments = sortAppointments(
    appointments.filter((appt) => appt.date && appt.date >= todayISO),
  );
  const pastAppointments = sortAppointments(
    appointments.filter((appt) => appt.date && appt.date < todayISO),
    { desc: true },
  );

  const getPrescriptionUrls = (appt) => {
    const signed = Boolean(appt?.prescription_signed || appt?.prescription_signed_at);
    const downloadUrl = signed ? buildDocumentUrl(appt?.prescription_url) : null;
    const previewUrl = signed ? buildDocumentUrl(appt?.prescription_url, { mode: 'inline' }) : null;
    return {
      downloadUrl: downloadUrl || null,
      previewUrl: previewUrl || null,
      signed,
    };
  };

  const bothAppointmentsBooked = hasPreconsultation && hasAct;

  return {
    currentMonth,
    selectedDate,
    availableSlots,
    selectedSlot,
    appointmentType,
    appointmentMode,
    slotsLoading,
    scheduleError,
    editModalOpen,
    editingAppointmentId,
    cancelingId,
    hasPreconsultation,
    hasAct,
    minSelectableDate,
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
  };
}
