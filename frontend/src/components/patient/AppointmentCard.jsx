import React from 'react';

import { PrescriptionActions } from './PrescriptionActions.jsx';

export const AppointmentCard = ({
  appt,
  prescription,
  variant = 'upcoming',
  onPreview,
  onSendEmail,
  onEdit,
  onCancel,
  isCanceling,
}) => {
  const label = appt?.appointment_type === 'act' ? 'Acte' : 'Pre-consultation';
  const dateDisplay = appt?.date ? new Date(appt.date).toLocaleDateString('fr-FR') : '--';
  const timeDisplay = appt?.time ? appt.time.slice(0, 5) : '';
  const badgeClass =
    variant === 'past' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-800';
  const containerClass =
    variant === 'past' ? 'border rounded-lg p-3 space-y-1 bg-slate-50' : 'border rounded-lg p-3 space-y-1';

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2 text-sm">
        <span className={`px-2 py-0.5 rounded-full text-xs ${badgeClass}`}>{label}</span>
        <span className="text-slate-700 font-medium">
          {dateDisplay} {timeDisplay}
        </span>
      </div>

      <PrescriptionActions
        previewUrl={prescription?.previewUrl}
        downloadUrl={prescription?.downloadUrl}
        signed={prescription?.signed}
        onPreview={onPreview}
        onSendEmail={onSendEmail}
      />

      <div className="flex flex-wrap gap-2 pt-1 border-t border-dashed border-slate-200 mt-2">
        <button type="button" className="btn btn-xs btn-ghost" onClick={onEdit}>
          Modifier
        </button>
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={onCancel}
          disabled={isCanceling}
        >
          {isCanceling ? 'Annulation...' : 'Annuler'}
        </button>
      </div>
    </div>
  );
};
