import React from 'react';

import { AppointmentsSection } from '../AppointmentsSection.jsx';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function UpcomingAppointments({
  loading,
  appointments,
  getPrescriptionUrls,
  onPreviewPrescription,
  onSendByEmail,
  onEditAppointment,
  onCancelAppointment,
  cancelingId,
  onSelectAppointmentId,
  activeAppointmentId,
}) {
  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{LABELS_FR.patientSpace.appointments.upcoming}</h2>
        <p className="text-sm text-slate-600">Modifier / annuler si nécessaire.</p>
      </div>
      {loading && <div className="loading loading-spinner loading-sm" />}
      <AppointmentsSection
        title="À venir"
        appointments={appointments}
        emptyMessage="Aucun rendez-vous planifié."
        variant="upcoming"
        getPrescriptionUrls={getPrescriptionUrls}
        onPreview={onPreviewPrescription}
        onSendEmail={onSendByEmail}
        onEdit={onEditAppointment}
        onCancel={onCancelAppointment}
        cancelingId={cancelingId}
        onSelect={onSelectAppointmentId}
        activeAppointmentId={activeAppointmentId}
      />
    </section>
  );
}

