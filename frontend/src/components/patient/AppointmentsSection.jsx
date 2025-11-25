import React from 'react';

import { AppointmentCard } from './AppointmentCard.jsx';

export const AppointmentsSection = ({
  title,
  appointments = [],
  emptyMessage,
  variant = 'upcoming',
  getPrescriptionUrls,
  onPreview,
  onSendEmail,
  onEdit,
  onCancel,
  cancelingId,
}) => {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {appointments.length === 0 && <p className="text-sm text-slate-500">{emptyMessage}</p>}
      {appointments.map((appt) => {
        const apptId = appt?.appointment_id || appt?.id;
        const prescription = getPrescriptionUrls ? getPrescriptionUrls(appt) : {};
        return (
          <AppointmentCard
            key={apptId || `${appt?.appointment_type || 'appt'}-${appt?.date || 'unknown'}-${appt?.time || 'time'}`}
            appt={appt}
            variant={variant}
            prescription={prescription}
            onPreview={() => onPreview?.(appt)}
            onSendEmail={onSendEmail}
            onEdit={() => onEdit?.(appt)}
            onCancel={() => onCancel?.(appt)}
            isCanceling={Boolean(cancelingId && apptId && cancelingId === apptId)}
          />
        );
      })}
    </div>
  );
};
