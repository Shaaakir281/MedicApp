import React, { useMemo } from 'react';

import { parseISODateLocal } from '../../../utils/date.js';

const appointmentTypeLabel = (type) => {
  if (type === 'act') return 'Acte';
  if (type === 'preconsultation') return 'Pré-consultation';
  return type || 'Rendez-vous';
};

export function AppointmentContextSelector({
  appointmentOptions,
  activeAppointmentId,
  onChangeAppointmentId,
}) {
  const options = useMemo(() => {
    return (appointmentOptions || []).map((appt) => {
      const parsed = appt?.date ? parseISODateLocal(appt.date) : null;
      const dateLabel = parsed ? parsed.toLocaleDateString('fr-FR') : String(appt?.date || '');
      return {
        id: appt.id,
        label: `${dateLabel} • ${appointmentTypeLabel(appt.appointment_type)}`,
      };
    });
  }, [appointmentOptions]);

  if (!options.length) return null;

  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-2">
      <p className="font-semibold">Rendez-vous concerné</p>
      <select
        className="select select-bordered max-w-md"
        value={activeAppointmentId || ''}
        onChange={(e) => onChangeAppointmentId?.(Number(e.target.value) || null)}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </section>
  );
}

