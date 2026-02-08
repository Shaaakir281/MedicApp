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

const buildDossierSnapshot = (dossierForm, dossierVm) => {
  if (dossierForm) {
    return {
      childFirstName: dossierForm.childFirstName,
      childLastName: dossierForm.childLastName,
      birthDate: dossierForm.birthDate,
      parent1FirstName: dossierForm.parent1FirstName,
      parent1LastName: dossierForm.parent1LastName,
      parent1Email: dossierForm.parent1Email,
      parent2FirstName: dossierForm.parent2FirstName,
      parent2LastName: dossierForm.parent2LastName,
      parent2Email: dossierForm.parent2Email,
    };
  }
  if (dossierVm) {
    return {
      childFirstName: dossierVm.child?.firstName,
      childLastName: dossierVm.child?.lastName,
      birthDate: dossierVm.child?.birthDate,
      parent1FirstName: dossierVm.guardians?.PARENT_1?.firstName,
      parent1LastName: dossierVm.guardians?.PARENT_1?.lastName,
      parent1Email: dossierVm.guardians?.PARENT_1?.email,
      parent2FirstName: dossierVm.guardians?.PARENT_2?.firstName,
      parent2LastName: dossierVm.guardians?.PARENT_2?.lastName,
      parent2Email: dossierVm.guardians?.PARENT_2?.email,
    };
  }
  return null;
};

const getMissingDossierFields = (snapshot) => {
  if (!snapshot) return null;
  const missing = [];
  if (!snapshot.childFirstName) missing.push("Prénom de l'enfant");
  if (!snapshot.childLastName) missing.push("Nom de l'enfant");
  if (!snapshot.birthDate) missing.push('Date de naissance');
  if (!snapshot.parent1FirstName) missing.push('Prénom Parent 1');
  if (!snapshot.parent1LastName) missing.push('Nom Parent 1');
  if (!snapshot.parent1Email) missing.push('Email Parent 1');
  if (!snapshot.parent2FirstName) missing.push('Prénom Parent 2');
  if (!snapshot.parent2LastName) missing.push('Nom Parent 2');
  if (!snapshot.parent2Email) missing.push('Email Parent 2');
  return missing;
};

const getNextAction = ({ dossierForm, dossierVm, dossierComplete, vm }) => {
  const snapshot = buildDossierSnapshot(dossierForm, dossierVm);
  const missingFields = getMissingDossierFields(snapshot);
  if (missingFields && missingFields.length > 0) {
    const detail =
      missingFields.length > 3
        ? `${missingFields.slice(0, 3).join(', ')} (+${missingFields.length - 3})`
        : missingFields.join(', ');
    return {
      label: 'Compléter le dossier',
      detail: `Manquant: ${detail}`,
      variant: 'error',
    };
  }
  if (!snapshot && dossierComplete === false) {
    return {
      label: 'Compléter le dossier',
      detail: 'Informations manquantes',
      variant: 'error',
    };
  }

  const canCheckContacts = Boolean(dossierVm?.guardians || vm?.guardians);
  if (canCheckContacts) {
    const parent1Verified = Boolean(
      dossierVm?.guardians?.PARENT_1?.phoneVerifiedAt ||
        dossierVm?.guardians?.PARENT_1?.emailVerifiedAt ||
        vm?.guardians?.parent1?.verified,
    );
    const parent2Verified = Boolean(
      dossierVm?.guardians?.PARENT_2?.phoneVerifiedAt ||
        dossierVm?.guardians?.PARENT_2?.emailVerifiedAt ||
        vm?.guardians?.parent2?.verified,
    );
    const unverified = [];
    if (!parent1Verified) unverified.push('Parent 1');
    if (!parent2Verified) unverified.push('Parent 2');
    if (unverified.length) {
      return {
        label: 'Vérifier vos contacts',
        detail: `À vérifier: ${unverified.join(', ')}`,
        variant: 'warning',
      };
    }
  }

  if (!vm?.appointments) {
    return null;
  }

  const upcomingList = vm?.appointments?.upcoming || [];
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const hasUpcoming = upcomingList.some((appt) => {
    if (!appt?.date) return true;
    const parsed = parseISODateLocal(String(appt.date));
    if (!parsed) return true;
    return parsed >= todayStart;
  });

  if (!hasUpcoming) {
    return {
      label: 'Planifier un rendez-vous',
      detail: 'Préconsultation ou acte',
      variant: 'info',
    };
  }

  if (!vm?.legalComplete) {
    return {
      label: 'Compléter les documents',
      detail: 'Checklist à valider',
      variant: 'warning',
    };
  }

  if (vm?.legalComplete && !vm?.signatureComplete) {
    return {
      label: 'Signer les documents',
      detail: 'Signature en attente',
      variant: 'warning',
    };
  }

  return {
    label: 'Dossier complet',
    detail: 'En attente du rendez-vous',
    variant: 'success',
  };
};

export function HeaderSummary({
  vm,
  dossierForm = null,
  dossierVm = null,
  userEmail,
  onLogout,
  dossierComplete = null,
  actionRequired = null,
}) {
  const childName = useMemo(() => {
    const first = dossierForm?.childFirstName || dossierVm?.child?.firstName || vm?.child?.firstName || '';
    const last = dossierForm?.childLastName || dossierVm?.child?.lastName || vm?.child?.lastName || '';
    const joined = [first, last].filter(Boolean).join(' ').trim();
    return joined || '—';
  }, [
    dossierForm?.childFirstName,
    dossierForm?.childLastName,
    dossierVm?.child?.firstName,
    dossierVm?.child?.lastName,
    vm?.child?.firstName,
    vm?.child?.lastName,
  ]);

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

  const nextAction = useMemo(
    () => getNextAction({ dossierForm, dossierVm, dossierComplete, vm }),
    [dossierForm, dossierVm, dossierComplete, vm],
  );

  const actionTone = nextAction?.variant || null;
  const actionClasses = {
    error: 'bg-red-500/20 border-red-200/30 text-red-100',
    warning: 'bg-amber-500/20 border-amber-200/30 text-amber-100',
    info: 'bg-indigo-500/20 border-indigo-200/30 text-indigo-100',
    success: 'bg-emerald-500/20 border-emerald-200/30 text-emerald-100',
  };

  const dossierTone =
    dossierComplete === null
      ? nextAction?.label === 'Compléter le dossier'
        ? 'warn'
        : 'neutral'
      : dossierComplete
        ? 'ok'
        : 'warn';
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
          {nextAction ? (
            <div
              className={`inline-flex items-center gap-2 text-sm border px-3 py-2 rounded-2xl ${
                actionClasses[actionTone] || actionClasses.warning
              }`}
            >
              <span className="font-semibold">{nextAction.label}</span>
              {nextAction.detail && <span className="opacity-95">{nextAction.detail}</span>}
            </div>
          ) : actionRequired ? (
            <div className="inline-flex items-center gap-2 text-sm bg-amber-500/20 border border-amber-200/30 text-amber-100 px-3 py-2 rounded-2xl">
              <span className="font-semibold">{LABELS_FR.patientSpace.header.actionRequired}</span>
              <span className="opacity-95">{actionRequired}</span>
            </div>
          ) : null}
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
