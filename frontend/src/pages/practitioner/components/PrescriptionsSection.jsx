import React from 'react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '--');

export const PrescriptionsSection = ({
  appointment,
  appointmentSummaries = [],
  onPreview,
  onEdit,
  onSend,
  sendingId,
  onNavigateDate,
}) => {
  const entries = [
    { type: 'preconsultation', label: 'Ordonnance pre-consultation' },
    { type: 'act', label: 'Ordonnance acte' },
  ];

  const byType = Object.fromEntries(
    (appointmentSummaries || []).map((entry) => [entry.appointment_type, entry]),
  );

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-slate-700">Ordonnances</h4>

      <div className="space-y-2">
        {entries.map((item) => {
          const apptEntry = byType[item.type] || appointment;
          const apptId = apptEntry?.appointment_id || appointment?.appointment_id;
          const signed = Boolean(apptEntry?.prescription_signed_at);
          const date = apptEntry?.date || null;

          return (
            <div key={item.type} className="p-3 border rounded-lg bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium text-slate-800">{item.label}</p>
                  {date && (
                    <p className="text-xs text-slate-500">
                      {formatDate(date)} {apptEntry?.time?.slice(0, 5)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={() => onPreview?.(apptEntry, { mode: signed ? 'view' : 'sign', title: item.label })}
                    disabled={!apptId}
                  >
                    Voir{signed ? '' : ' / signer'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={() => onEdit?.(apptEntry)}
                    disabled={!apptId}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost"
                    onClick={() => onSend?.(apptEntry)}
                    disabled={sendingId === apptId || !apptEntry?.prescription_signed_at}
                  >
                    {sendingId === apptId
                      ? 'Envoi...'
                      : apptEntry?.prescription_signed_at
                      ? 'Envoyer au patient'
                      : 'Signer avant envoi'}
                  </button>
                </div>
              </div>
              {date && (
                <button
                  type="button"
                  className="link link-primary text-xs"
                  onClick={() => onNavigateDate?.(date)}
                >
                  Aller à la date
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
