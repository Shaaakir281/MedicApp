import React from 'react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '--');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('fr-FR') : '--');

export const CaseStatus = ({
  appointment,
  procedure,
  onNavigateDate,
  onInitiateConsent,
  onRemindConsent,
  consentActionLoading,
}) => {
  const openDate = procedure?.signature_open_at ? new Date(procedure.signature_open_at) : null;
  const today = new Date();
  const daysUntilOpen =
    openDate && openDate > today ? Math.ceil((openDate - today) / (1000 * 60 * 60 * 24)) : 0;
  const caseId = procedure?.case_id;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <h4 className="font-semibold text-slate-700">Statut dossier</h4>
        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
          <li>Autorite parentale : {procedure?.parental_authority_ack ? 'OK' : 'Manquante'}</li>
          <li>Consentement : {procedure?.has_consent ? 'OK' : 'A recuperer'}</li>
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

      <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600 space-y-1 md:col-span-2">
        <strong>Consentement</strong>
        <p>
          Ouverture signature : {procedure?.signature_open_at ? formatDate(procedure.signature_open_at) : 'Inconnue'}
        </p>
        <p>
          Parent 1 : {procedure?.parent1_consent_status || 'pending'}{' '}
          {procedure?.parent1_consent_signed_at ? `(${formatDateTime(procedure.parent1_consent_signed_at)})` : ''}
        </p>
        <p>
          Parent 2 : {procedure?.parent2_consent_status || 'pending'}{' '}
          {procedure?.parent2_consent_signed_at ? `(${formatDateTime(procedure.parent2_consent_signed_at)})` : ''}
        </p>
        <p>Preuve : {procedure?.consent_evidence_pdf_url ? 'Disponible' : 'Non disponible'}</p>
        {openDate && openDate > today ? (
          <p className="text-amber-600">
            Delai legal : ouverture dans {daysUntilOpen} jour{daysUntilOpen > 1 ? 's' : ''} (droit de
            retractation).
          </p>
        ) : null}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!onInitiateConsent || consentActionLoading || (openDate && openDate > today)}
            onClick={() => onInitiateConsent?.(caseId)}
          >
            {consentActionLoading ? 'Envoi...' : 'Envoyer (email + SMS)'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={!onRemindConsent || consentActionLoading}
            onClick={() => onRemindConsent?.(caseId)}
          >
            {consentActionLoading ? 'Envoi...' : 'Relancer'}
          </button>
        </div>
      </div>

      {procedure?.notes && (
        <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600 md:col-span-2">
          <strong>Notes :</strong> {procedure.notes}
        </div>
      )}

      <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600 space-y-1">
        <strong>Rappel rendez-vous</strong>
        <p>Envoye : {formatDate(appointment.reminder_sent_at)}</p>
        <p>
          Ouvert : {appointment.reminder_opened_at ? formatDateTime(appointment.reminder_opened_at) : 'Non lu'}
        </p>
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
        <p>Telechargements : {appointment.prescription_download_count || 0}</p>
      </div>
    </div>
  );
};
