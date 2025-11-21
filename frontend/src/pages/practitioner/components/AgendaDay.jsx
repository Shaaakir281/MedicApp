import React from 'react';
import clsx from 'clsx';

const typeBadges = {
  preconsultation: 'bg-blue-100 text-blue-800',
  act: 'bg-purple-100 text-purple-800',
  general: 'bg-slate-100 text-slate-800',
};

const statusBadges = {
  pending: 'badge-warning',
  validated: 'badge-success',
};

export function AgendaDay({
  day,
  detailed = false,
  onPreview,
  onSign,
  onSendPrescription,
  onSelectPatient,
  onEditPrescription,
  onDownloadConsent,
  previewingId,
  signingId,
  sendingId,
}) {
  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${day.date}T00:00:00`));

  if (!day.appointments.length) {
    return (
      <div className="space-y-2">
        <div className="text-lg font-semibold capitalize">{dateLabel}</div>
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-slate-500">
          Aucun rendez-vous planifié.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold capitalize">{dateLabel}</div>
      <div className="space-y-3">
        {day.appointments.map((appointment) => (
          <div
            key={appointment.appointment_id}
            className="border rounded-2xl p-4 bg-white shadow-sm flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                className="font-semibold text-slate-900 hover:underline"
                onClick={() => onSelectPatient?.(appointment)}
              >
                {appointment.patient?.child_full_name || 'Patient inconnu'}
              </button>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  typeBadges[appointment.appointment_type] || typeBadges.general,
                )}
              >
                {appointment.appointment_type === 'act' ? 'Acte' : 'Pré-consultation'}
              </span>
              <span className={clsx('badge', statusBadges[appointment.status] || 'badge-ghost')}>
                {appointment.status === 'validated' ? 'Validé' : 'En attente'}
              </span>
            </div>
            <div className="text-sm text-slate-600 flex flex-wrap gap-4 items-center">
              <span className="text-2xl font-semibold text-slate-900">
                {appointment.time?.slice(0, 5)}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-xs uppercase tracking-wide">
                {appointment.mode === 'visio' ? 'Visio' : 'Présentiel'}
              </span>
              {appointment.patient?.email && (
                <span>
                  Email : <strong>{appointment.patient.email}</strong>
                </span>
              )}
            </div>
            {detailed && appointment.notes && (
              <p className="text-sm text-slate-500">Notes : {appointment.notes}</p>
            )}
            <DossierStatus procedure={appointment.procedure} reminder={appointment} />
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => onPreview?.(appointment)}
                disabled={previewingId === appointment.appointment_id}
              >
                {previewingId === appointment.appointment_id ? 'Préparation...' : 'Prévisualiser'}
              </button>
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => onSign?.(appointment)}
                disabled={signingId === appointment.appointment_id || Boolean(appointment.prescription_signed_at)}
              >
                {appointment.prescription_signed_at
                  ? 'Déjà signée'
                  : signingId === appointment.appointment_id
                  ? 'Signature...'
                  : 'Signer l’ordonnance'}
              </button>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => onSendPrescription?.(appointment)}
                disabled={sendingId === appointment.appointment_id || !appointment.prescription_signed_at}
              >
                {sendingId === appointment.appointment_id
                  ? 'Envoi...'
                  : appointment.prescription_signed_at
                  ? 'Envoyer au patient'
                  : 'Signer avant envoi'}
              </button>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => onEditPrescription?.(appointment)}
              >
                Modifier
              </button>
              {appointment.procedure?.consent_download_url && (
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={() => onDownloadConsent?.(appointment)}
                >
                  Consentements
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DossierStatus({ procedure, reminder }) {
  if (!procedure) return null;
  const indicators = [
    { label: 'Autorité parentale', ok: procedure.parental_authority_ack },
    { label: 'Consentement', ok: procedure.has_consent },
    { label: 'Checklist', ok: procedure.has_checklist },
    { label: 'Ordonnance', ok: procedure.has_ordonnance },
    { label: 'Pré-consultation', ok: procedure.has_preconsultation },
    { label: 'Acte', ok: procedure.has_act_planned },
  ];
  const missing = indicators.filter((item) => !item.ok);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 text-xs">
        {indicators.map((item) => (
          <span
            key={item.label}
            className={clsx(
              'px-2 py-0.5 rounded-full border text-[11px]',
              item.ok ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-rose-200 text-rose-700 bg-rose-50',
            )}
          >
            {item.label}
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="text-[11px] text-rose-600">
          À compléter : {missing.map((item) => item.label.toLowerCase()).join(', ')}
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
        {reminder.reminder_sent_at ? (
          <span className="badge badge-outline badge-sm">
            Rappel envoyé {reminder.reminder_opened_at ? 'et confirmé' : '(en attente de lecture)'}
          </span>
        ) : (
          <span className="badge badge-outline badge-sm badge-warning">Rappel non envoyé</span>
        )}
        {reminder.prescription_sent_at && <span className="badge badge-outline badge-sm">Ordonnance envoyée</span>}
        {reminder.prescription_download_count > 0 && (
          <span className="badge badge-ghost badge-sm">
            {reminder.prescription_download_count} téléchargement(s)
          </span>
        )}
      </div>
    </div>
  );
}
