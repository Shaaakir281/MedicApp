import React from 'react';

import { SchedulingPanel } from '../SchedulingPanel.jsx';
import { BlockingNotice } from '../../ui';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function ScheduleAppointment({
  appointments,
  show,
  missingFields = [],
  needsSave = false,
  errorMessage = null,
}) {
  if (!show) {
    if (missingFields.length > 0) {
      return (
        <BlockingNotice
          title="Rendez-vous indisponible"
          message="Completez d'abord :"
          items={missingFields}
        />
      );
    }
    if (needsSave) {
      return (
        <BlockingNotice
          title="Rendez-vous indisponible"
          message="Enregistrez le dossier pour planifier un rendez-vous."
        />
      );
    }
    return null;
  }

  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{LABELS_FR.patientSpace.appointments.schedule}</h2>
        <p className="text-sm text-slate-600">{LABELS_FR.patientSpace.appointments.scheduleHint}</p>
      </div>
      <SchedulingPanel
        title={null}
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
        onConfirm={appointments.handleCreateAppointment}
        actionNotice={
          errorMessage ? (
            <BlockingNotice title="Rendez-vous indisponible" message={errorMessage} />
          ) : null
        }
      />
    </section>
  );
}
