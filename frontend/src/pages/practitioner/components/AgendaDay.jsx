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

const toneColors = {
  ok: 'border-emerald-200 text-emerald-700 bg-emerald-50',
  warn: 'border-amber-200 text-amber-700 bg-amber-50',
  danger: 'border-rose-200 text-rose-700 bg-rose-50',
  muted: 'border-slate-200 text-slate-600 bg-slate-50',
};

const consentStatus = (procedure) => {
  if (!procedure) return { label: 'Consentement', ok: false, tone: 'warn' };
  const signed = Boolean(procedure.has_consent);
  const signableAt = procedure.consent_signable_at ? new Date(procedure.consent_signable_at) : null;
  const now = new Date();
  if (signed) {
    return { label: 'Consentement', ok: true, tone: 'ok' };
  }
  if (signableAt && now < signableAt) {
    return { label: 'Consentement (delai)', ok: false, tone: 'muted' };
  }
  if (signableAt && now.getTime() - signableAt.getTime() > 14 * 24 * 3600 * 1000) {
    return { label: 'Consentement en retard', ok: false, tone: 'danger' };
  }
  return { label: 'Consentement', ok: false, tone: 'warn' };
};

const dossierChecks = (procedure, appointment) => {
  if (!procedure) return [];
  const patient = appointment?.patient || {};
  const consent = consentStatus(procedure);
  return [
    { label: 'Identite', ok: Boolean(patient.child_full_name && procedure.child_birthdate), tone: 'ok' },
    { label: 'Poids', ok: Boolean(procedure.child_weight_kg), tone: 'ok' },
    { label: 'Autorite parentale', ok: procedure.parental_authority_ack, tone: 'ok' },
    consent,
    {
      label: appointment?.appointment_type === 'act' ? 'Ordonnance acte' : 'Ordonnance pre-consultation',
      ok: procedure.has_ordonnance,
      tone: 'ok',
    },
    { label: 'Rdv pre-consultation', ok: procedure.has_preconsultation, tone: 'ok' },
    { label: 'Rdv acte', ok: procedure.has_act_planned, tone: 'ok' },
  ];
};

export function AgendaDay({
  day,
  detailed = false,
  onSign,
  onSendPrescription,
  onSelectPatient,
  onDownloadConsent,
  previewingId,
  signingId,
  sendingId,
  showPast = true,
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
          Aucun rendez-vous planifie.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold capitalize">{dateLabel}</div>
      <div className="space-y-3">
        {day.appointments
          .filter((appt) => (showPast ? true : new Date(`${appt.date}T00:00:00`) >= new Date()))
          .map((appointment) => (
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
                {appointment.appointment_type === 'act' ? 'Acte' : 'Pre-consultation'}
              </span>
              <span className={clsx('badge', statusBadges[appointment.status] || 'badge-ghost')}>
                {appointment.status === 'validated' ? 'Valide' : 'En attente'}
              </span>
            </div>
            <div className="text-sm text-slate-600 flex flex-wrap gap-4 items-center">
              <span className="text-2xl font-semibold text-slate-900">
                {appointment.time?.slice(0, 5)}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-xs uppercase tracking-wide">
                {appointment.mode === 'visio' ? 'Visio' : 'Presentiel'}
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
            <div className="flex flex-col gap-3 pt-2">
              <DossierStatus procedure={appointment.procedure} reminder={appointment} appointment={appointment} />
              <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Ordonnances</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={() => onSign?.(appointment)}
                    disabled={
                      signingId === appointment.appointment_id || previewingId === appointment.appointment_id
                    }
                  >
                    {signingId === appointment.appointment_id || previewingId === appointment.appointment_id
                      ? 'Preparation...'
                      : 'Voir / signer'}
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
                </div>
              </div>
              {appointment.procedure?.consent_download_url && (
                <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Consentement</div>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={() => onDownloadConsent?.(appointment)}
                  >
                    Ouvrir le consentement
                  </button>
                </div>
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
  const indicators = dossierChecks(procedure, reminder);
  const missing = indicators.filter((item) => !item.ok);
  const completedCount = indicators.filter((item) => item.ok).length;
  const requiredCount = indicators.length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 text-xs items-center">
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
          Dossier : {completedCount}/{requiredCount}
        </span>
        {indicators.map((item) => (
          <span
            key={item.label}
            className={clsx(
              'px-2 py-0.5 rounded-full border text-[11px]',
              item.ok ? toneColors.ok : toneColors[item.tone] || toneColors.warn,
            )}
          >
            {item.label}
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="text-[11px] text-rose-600">
          A completer : {missing.map((item) => item.label.toLowerCase()).join(', ')}
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
        {reminder.reminder_sent_at ? (
          <span className="badge badge-outline badge-sm">
            Rappel envoye {reminder.reminder_opened_at ? 'et confirme' : '(en attente de lecture)'}
          </span>
        ) : (
          <span className="badge badge-outline badge-sm badge-warning">Rappel non envoye</span>
        )}
        {reminder.prescription_sent_at && <span className="badge badge-outline badge-sm">Ordonnance envoyee</span>}
        {reminder.prescription_download_count > 0 && (
          <span className="badge badge-ghost badge-sm">
            {reminder.prescription_download_count} telechargement(s)
          </span>
        )}
      </div>
    </div>
  );
}
