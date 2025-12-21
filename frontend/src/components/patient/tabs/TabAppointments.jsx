import React from 'react';

import { AppointmentEditModal } from '../AppointmentEditModal.jsx';
import { AppointmentHistory } from '../sections/AppointmentHistory.jsx';
import { ScheduleAppointment } from '../sections/ScheduleAppointment.jsx';
import { UpcomingAppointments } from '../sections/UpcomingAppointments.jsx';

export function TabAppointments({
  dashboardLoading,
  dashboardUpcoming,
  dashboardHistory,
  activeAppointmentId,
  setActiveAppointmentId,
  appointments,
  showScheduling,
  setError,
  setPreviewState,
}) {
  const handleSendByEmail = (url) => {
    if (!url) {
      setError?.("L'ordonnance n'est pas disponible pour envoi par e-mail.");
      return;
    }
    const subject = encodeURIComponent('Ordonnance');
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver l'ordonnance via ce lien sécurisé : ${url}\n\nCordialement,`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handlePreviewAppointmentPrescription = (appt) => {
    const { previewUrl, downloadUrl } = appointments.getPrescriptionUrls(appt);
    if (!previewUrl) {
      setError?.("L'ordonnance n'est pas disponible pour ce rendez-vous.");
      return;
    }
    setPreviewState?.({
      open: true,
      url: previewUrl,
      downloadUrl: downloadUrl || previewUrl,
      title: appt.appointment_type === 'act' ? 'Ordonnance acte' : 'Ordonnance pré-consultation',
      type: 'ordonnance',
    });
  };

  return (
    <div className="space-y-6">
      <UpcomingAppointments
        loading={dashboardLoading}
        appointments={dashboardUpcoming}
        getPrescriptionUrls={appointments.getPrescriptionUrls}
        onPreviewPrescription={handlePreviewAppointmentPrescription}
        onSendByEmail={handleSendByEmail}
        onEditAppointment={appointments.handleEditAppointment}
        onCancelAppointment={appointments.handleCancelAppointment}
        cancelingId={appointments.cancelingId}
        onSelectAppointmentId={(apptId) => setActiveAppointmentId?.(apptId)}
        activeAppointmentId={activeAppointmentId}
      />

      <AppointmentHistory
        appointments={dashboardHistory}
        getPrescriptionUrls={appointments.getPrescriptionUrls}
        onPreviewPrescription={handlePreviewAppointmentPrescription}
        onSendByEmail={handleSendByEmail}
        onEditAppointment={appointments.handleEditAppointment}
        onCancelAppointment={appointments.handleCancelAppointment}
        cancelingId={appointments.cancelingId}
        onSelectAppointmentId={(apptId) => setActiveAppointmentId?.(apptId)}
        activeAppointmentId={activeAppointmentId}
      />

      <ScheduleAppointment appointments={appointments} show={showScheduling} />

      <AppointmentEditModal
        isOpen={appointments.editModalOpen}
        onClose={appointments.handleCloseEditModal}
        appointmentType={appointments.appointmentType}
        appointmentMode={appointments.appointmentMode}
        hasPreconsultation={appointments.hasPreconsultation}
        hasAct={appointments.hasAct}
        currentMonth={appointments.currentMonth}
        selectedDate={appointments.selectedDate}
        availableSlots={appointments.availableSlots}
        selectedSlot={appointments.selectedSlot}
        slotsLoading={appointments.slotsLoading}
        onChangeType={appointments.setAppointmentType}
        onChangeMode={appointments.setAppointmentMode}
        onPrevMonth={appointments.handlePrevMonth}
        onNextMonth={appointments.handleNextMonth}
        onSelectDate={appointments.handleDateSelect}
        onSelectSlot={(slot) =>
          appointments.setSelectedSlot(slot === appointments.selectedSlot ? null : slot)
        }
        onConfirm={appointments.handleConfirmEdit}
      />
    </div>
  );
}
