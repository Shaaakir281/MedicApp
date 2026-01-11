import React from 'react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '--');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('fr-FR') : '--');

export const CaseStatus = ({
  appointment,
  procedure,
  onNavigateDate,
}) => {
  const docSignatures = procedure?.documentSignatures || procedure?.document_signatures || [];
  const totalDocs = docSignatures.length;
  const signedDocs = docSignatures.filter((doc) => {
    const status = doc?.overallStatus || doc?.overall_status || doc?.status || '';
    return String(status).toLowerCase() === 'completed';
  }).length;

  const documentsLabel = totalDocs
    ? `${signedDocs}/${totalDocs} signes`
    : 'Aucun document';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <h4 className="font-semibold text-slate-700">Statut dossier</h4>
        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
          <li>Autorite parentale : {procedure?.parental_authority_ack ? 'OK' : 'Manquante'}</li>
          <li>Documents : {documentsLabel}</li>
          <li>Ordonnance : {procedure?.has_ordonnance ? 'OK' : 'Non generee'}</li>
          <li>
            Pre-consultation :{' '}
            {procedure?.has_preconsultation
              ? (
                <button
                  type="button"
                  className="link link-primary"
                  onClick={() => onNavigateDate?.(procedure.next_preconsultation_date)}
                >
                  Planifiee le {formatDate(procedure.next_preconsultation_date)}
                </button>
              )
              : 'Non planifiee'}
          </li>
          <li>
            Acte :{' '}
            {procedure?.has_act_planned ? (
              <button
                type="button"
                className="link link-primary"
                onClick={() => onNavigateDate?.(procedure.next_act_date)}
              >
                Planifie le {formatDate(procedure.next_act_date)}
              </button>
            ) : (
              'Non planifie'
            )}
          </li>
        </ul>
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold text-slate-700">A surveiller</h4>
        {procedure?.missing_items?.length ? (
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
            {procedure.missing_items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Aucun element manquant.</p>
        )}
      </div>

      {procedure?.notes && (
        <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600 md:col-span-2">
          <strong>Notes :</strong> {procedure.notes}
        </div>
      )}

      <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600 space-y-1">
        <strong>Rappel rendez-vous</strong>
        <p>Envoye : {formatDate(appointment.reminder_sent_at) || 'Non envoye'}</p>
      </div>
      <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600 space-y-1">
        <strong>Ordonnance</strong>
        <p>
          Statut :{' '}
          {appointment.prescription_signed_at
            ? `Signee le ${formatDateTime(appointment.prescription_signed_at)}`
            : 'Non signee'}
        </p>
        <p>Envoyee : {formatDate(appointment.prescription_sent_at)}</p>
      </div>
    </div>
  );
};
