import React from 'react';

const Badge = ({ color = 'blue', children }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span className={`px-3 py-1 text-xs rounded-full border ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
};

export const DashboardSummary = ({
  child,
  guardians = [],
  legalComplete,
  signatureComplete,
  appointments = [],
  activeAppointmentId,
  onSelectAppointment,
}) => {
  const options = appointments || [];
  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white p-6 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-indigo-200">Dossier enfant</p>
          <h1 className="text-3xl font-bold">{child?.full_name || 'Enfant non renseigné'}</h1>
          <p className="text-indigo-100">
            {child?.birthdate
              ? `Né(e) le ${new Date(child.birthdate).toLocaleDateString('fr-FR')}`
              : 'Date de naissance manquante'}
            {child?.weight_kg ? ` • ${child.weight_kg} kg` : ''}
          </p>
          {child?.notes && <p className="text-indigo-100 text-sm max-w-xl">{child.notes}</p>}
          <div className="flex gap-2 flex-wrap">
            <Badge color={legalComplete ? 'green' : 'amber'}>
              Checklist {legalComplete ? 'complète' : 'à compléter'}
            </Badge>
            <Badge color={signatureComplete ? 'green' : 'amber'}>
              Signature {signatureComplete ? 'disponible' : 'à lancer'}
            </Badge>
            <Badge color="slate">Responsables: {guardians.length || 1}</Badge>
          </div>
        </div>
        <div className="bg-white/10 border border-white/10 rounded-2xl p-4 min-w-[240px] space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-200">Rendez-vous</p>
            <select
              className="select select-bordered select-sm w-full mt-1 text-slate-900"
              value={activeAppointmentId || ''}
              onChange={(e) => onSelectAppointment?.(Number(e.target.value) || null)}
            >
              {options.length === 0 && <option value="">Aucun rendez-vous</option>}
              {options.map((appt) => (
                <option key={appt.id} value={appt.id}>
                  {new Date(appt.date).toLocaleDateString('fr-FR')} •{' '}
                  {appt.appointment_type === 'act' ? 'Acte' : 'Pré-consultation'}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-indigo-200">Responsables légaux</p>
            {(guardians || []).map((g) => (
              <p key={g.label} className="text-sm">
                <span className="font-semibold">{g.name || g.label}</span>
                {g.email ? ` • ${g.email}` : ''}
                {g.phone ? ` • ${g.phone}` : ''}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
