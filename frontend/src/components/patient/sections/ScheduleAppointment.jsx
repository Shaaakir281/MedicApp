import React from 'react';

import { SchedulingPanel } from '../SchedulingPanel.jsx';
import { BlockingNotice, Button } from '../../ui';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function ScheduleAppointment({
  appointments,
  show,
  missingFields = [],
  needsSave = false,
  errorMessage = null,
  onCompleteDossier,
}) {
  if (!show) {
    if (missingFields.length > 0) {
      return (
        <div className="space-y-3">
          <BlockingNotice
            title="Rendez-vous indisponible"
            message="Pour prendre rendez-vous, complétez les informations de l’enfant et du parent 1 (nom, prénom, date de naissance)."
          />
          {onCompleteDossier && (
            <div className="flex justify-end">
              <Button type="button" onClick={onCompleteDossier}>
                Compléter le dossier
              </Button>
            </div>
          )}
        </div>
      );
    }
    if (needsSave) {
      return (
        <div className="space-y-3">
          <BlockingNotice
            title="Rendez-vous indisponible"
            message="Enregistrez le dossier pour planifier un rendez-vous."
          />
          {onCompleteDossier && (
            <div className="flex justify-end">
              <Button type="button" onClick={onCompleteDossier}>
                Compléter le dossier
              </Button>
            </div>
          )}
        </div>
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
