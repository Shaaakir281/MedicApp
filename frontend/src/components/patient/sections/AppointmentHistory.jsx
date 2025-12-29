import React from 'react';

import { AppointmentsSection } from '../AppointmentsSection.jsx';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function AppointmentHistory({
  appointments,
  getPrescriptionUrls,
  onPreviewPrescription,
  onSendByEmail,
  onEditAppointment,
  onCancelAppointment,
  cancelingId,
  onSelectAppointmentId,
  activeAppointmentId,
  onViewPrescription,
}) {
  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{LABELS_FR.patientSpace.appointments.history}</h2>
        <p className="text-sm text-slate-600">Rendez-vous passés et ordonnances associées.</p>
      </div>
      <AppointmentsSection
        title="Historique"
        appointments={appointments}
        emptyMessage="Aucun rendez-vous passé."
        variant="past"
        getPrescriptionUrls={getPrescriptionUrls}
        onPreview={onPreviewPrescription}
        onSendEmail={onSendByEmail}
        onEdit={onEditAppointment}
        onCancel={onCancelAppointment}
        cancelingId={cancelingId}
        onSelect={onSelectAppointmentId}
        activeAppointmentId={activeAppointmentId}
        onViewPrescription={onViewPrescription}
      />
    </section>
  );
}
