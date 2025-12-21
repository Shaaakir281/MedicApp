import React, { useMemo } from 'react';

import { LABELS_FR } from '../../constants/labels.fr.js';
import { parseISODateLocal, sortAppointments } from '../../utils/date.js';

const StatusChip = ({ tone = 'neutral', children }) => {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  return (
    <span className={`px-3 py-1 text-xs rounded-full border ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
};

const formatAppointmentType = (appointmentType) => {
  if (appointmentType === 'act') return LABELS_FR.patientSpace.appointments.typeAct;
  if (appointmentType === 'preconsultation')
    return LABELS_FR.patientSpace.appointments.typePreconsultation;
  return appointmentType || '';
};

const formatAppointmentLabel = (appointment) => {
  if (!appointment?.date) return LABELS_FR.patientSpace.header.noUpcomingAppointment;
  const parsed = parseISODateLocal(appointment.date);
  const date = parsed ? parsed.toLocaleDateString('fr-FR') : String(appointment.date);
  const time = appointment.time ? String(appointment.time).slice(0, 5) : '';
  const type = formatAppointmentType(appointment.appointmentType || appointment.appointment_type);
  return `${date}${time ? ` • ${time}` : ''}${type ? ` • ${type}` : ''}`;
};

export function HeaderSummary({
  vm,
  userEmail,
  onLogout,
  dossierComplete = null,
  actionRequired = null,
}) {
  const childName = useMemo(() => {
    const first = vm?.child?.firstName || '';
    const last = vm?.child?.lastName || '';
    const joined = [first, last].filter(Boolean).join(' ').trim();
    return joined || '—';
  }, [vm?.child?.firstName, vm?.child?.lastName]);

  const nextAppointment = useMemo(() => {
    const list = vm?.appointments?.upcoming || [];
    if (!list.length) return null;
    const sorted = sortAppointments(
      list.map((appt) => ({
        ...appt,
        date: appt.date || appt?.appointment_date,
        time: appt.time || appt?.appointment_time,
      })),
    );
    return sorted[0] || null;
  }, [vm?.appointments?.upcoming]);

  const dossierTone = dossierComplete === null ? 'neutral' : dossierComplete ? 'ok' : 'warn';
  const appointmentsTone = (vm?.appointments?.upcoming || []).length ? 'info' : 'neutral';
  const documentsTone = vm?.legalComplete ? 'ok' : 'warn';
  const signatureTone = vm?.signatureComplete ? 'ok' : 'warn';

  return (
    <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white p-6 shadow-md space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-indigo-200">
            {LABELS_FR.patientSpace.title}
          </p>
          <h1 className="text-3xl font-bold">
            {LABELS_FR.patientSpace.header.child} : {childName}
          </h1>
          <p className="text-indigo-100 text-sm">
            {LABELS_FR.patientSpace.header.nextAppointment} : {formatAppointmentLabel(nextAppointment)}
          </p>
          {actionRequired && (
            <div className="inline-flex items-center gap-2 text-sm bg-amber-500/20 border border-amber-200/30 text-amber-100 px-3 py-2 rounded-2xl">
              <span className="font-semibold">{LABELS_FR.patientSpace.header.actionRequired}</span>
              <span className="opacity-95">{actionRequired}</span>
            </div>
          )}
          <div className="flex gap-2 flex-wrap pt-1">
            <StatusChip tone={dossierTone}>Dossier</StatusChip>
            <StatusChip tone={appointmentsTone}>RDV</StatusChip>
            <StatusChip tone={documentsTone}>Documents</StatusChip>
            <StatusChip tone={signatureTone}>Signatures</StatusChip>
          </div>
        </div>

        <div className="bg-white/10 border border-white/10 rounded-2xl p-4 min-w-[240px] space-y-2">
          <p className="text-xs uppercase tracking-wide text-indigo-200">Compte</p>
          <p className="text-sm text-indigo-50 break-all">{userEmail || '—'}</p>
          <button type="button" className="btn btn-sm w-full" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      </div>
    </section>
  );
}

