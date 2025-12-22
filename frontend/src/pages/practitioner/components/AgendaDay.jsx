import React from 'react';
import clsx from 'clsx';
import { Badge } from '../../../components/ui/Badge';
import { StatusDot } from '../../../components/ui/StatusDot';
import { IconChevronRight } from './icons';
import { DocumentSignatureSection } from './DocumentSignatureSection';
import { practitionerSendSignature } from '../../../services/documentSignature.api';
import { mapPractitionerProcedureCase } from '../../../services/patientDashboard.mapper';

const dossierChecks = (procedure, appointment) => {
  if (!procedure) return [];

  const patient = appointment?.patient || {};

  // Calculer le statut des 3 documents
  const docSignatures = procedure.documentSignatures || [];
  const authDoc = docSignatures.find((d) => d.documentType === 'authorization' || d.documentType === 'surgical_authorization_minor');
  const consentDoc = docSignatures.find((d) => d.documentType === 'consent' || d.documentType === 'informed_consent');
  const feesDoc = docSignatures.find((d) => d.documentType === 'fees' || d.documentType === 'fees_consent_quote');

  const authStatus = authDoc?.status === 'completed';
  const consentStatus = consentDoc?.status === 'completed';
  const feesStatus = feesDoc?.status === 'completed';

  return [
    { label: 'Identite', ok: Boolean(patient.child_full_name && procedure.child_birthdate), tone: 'ok' },
    { label: 'Poids', ok: Boolean(procedure.child_weight_kg), tone: 'ok' },
    { label: 'Autorite parentale', ok: procedure.parental_authority_ack, tone: 'ok' },
    { label: 'Autorisation', ok: authStatus, tone: authStatus ? 'ok' : 'warn' },
    { label: 'Consentement', ok: consentStatus, tone: consentStatus ? 'ok' : 'warn' },
    { label: 'Frais', ok: feesStatus, tone: feesStatus ? 'ok' : 'warn' },
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
  onRefreshAppointments,
  token,
}) {
  const handleSendSignature = async (caseId, documentType) => {
    if (!token) {
      console.error('Token manquant pour envoyer signature');
      return;
    }
    await practitionerSendSignature(token, caseId, documentType);
  };
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
            className="group border rounded-2xl p-5 bg-white shadow-sm flex flex-col gap-4 transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300"
          >
            {/* Header avec heure et infos patient */}
            <div className="flex items-start gap-4">
              {/* Heure en grand */}
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{appointment.time?.slice(0, 5)}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  {appointment.mode === 'visio' ? 'Visio' : 'Presentiel'}
                </p>
              </div>

              {/* Séparateur vertical */}
              <div className="h-12 w-px bg-slate-200" />

              {/* Infos patient */}
              <div className="flex-1">
                <button
                  type="button"
                  className="font-semibold text-slate-900 hover:text-sky-600 transition-colors flex items-center gap-1 group/patient"
                  onClick={() => onSelectPatient?.(appointment)}
                >
                  {appointment.patient?.child_full_name || 'Patient inconnu'}
                  <IconChevronRight className="w-4 h-4 opacity-0 group-hover/patient:opacity-100 transition-opacity" />
                </button>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant={appointment.appointment_type === 'act' ? 'purple' : 'info'} size="xs">
                    {appointment.appointment_type === 'act' ? 'Acte' : 'Pré-consultation'}
                  </Badge>
                  <Badge
                    variant={appointment.status === 'validated' ? 'success' : 'warning'}
                    size="xs"
                  >
                    {appointment.status === 'validated' ? 'Validé' : 'En attente'}
                  </Badge>
                </div>
              </div>

              {/* Email */}
              {appointment.patient?.email && (
                <p className="text-xs text-slate-400 hidden md:block">{appointment.patient.email}</p>
              )}
            </div>
            {detailed && appointment.notes && (
              <p className="text-sm text-slate-500">Notes : {appointment.notes}</p>
            )}
            <div className="flex flex-col gap-3 pt-2">
              <DossierStatus procedure={appointment.procedure ? mapPractitionerProcedureCase(appointment.procedure) : null} reminder={appointment} appointment={appointment} />
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
              {appointment.procedure && (
                <DocumentSignatureSection
                  documentSignatures={mapPractitionerProcedureCase(appointment.procedure).documentSignatures || []}
                  caseId={appointment.procedure.case_id}
                  onSend={handleSendSignature}
                  onRefresh={onRefreshAppointments}
                />
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

  // Mapper les tones vers variants
  const toneToVariant = {
    ok: 'success',
    warn: 'warning',
    danger: 'danger',
    muted: 'neutral',
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 text-xs items-center">
        <Badge variant="neutral" size="xs">
          Dossier : {completedCount}/{requiredCount}
        </Badge>
        {indicators.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1">
            <StatusDot status={item.ok ? 'done' : item.tone} />
            <Badge variant={item.ok ? 'success' : toneToVariant[item.tone]} size="xs">
              {item.label}
            </Badge>
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="text-[11px] text-rose-600">
          A completer : {missing.map((item) => item.label.toLowerCase()).join(', ')}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
        {reminder.reminder_sent_at ? (
          <Badge variant="info" size="xs">
            Rappel envoyé {reminder.reminder_opened_at ? 'et confirmé' : '(en attente)'}
          </Badge>
        ) : (
          <Badge variant="warning" size="xs">
            Rappel non envoyé
          </Badge>
        )}
        {reminder.prescription_sent_at && (
          <Badge variant="info" size="xs">
            Ordonnance envoyée
          </Badge>
        )}
        {reminder.prescription_download_count > 0 && (
          <Badge variant="neutral" size="xs">
            {reminder.prescription_download_count} téléchargement(s)
          </Badge>
        )}
      </div>
    </div>
  );
}
