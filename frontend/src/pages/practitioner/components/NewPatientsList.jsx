import React from 'react';

export function NewPatientsList({ patients, loading, error, onSelect }) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Impossible de charger les nouveaux dossiers : {error.message ?? 'erreur inconnue'}.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
        Chargement des dossiers recents...
      </div>
    );
  }

  if (!patients?.length) {
    return <p className="text-sm text-slate-500">Aucun nouveau dossier sur la periode.</p>;
  }

  return (
    <div className="space-y-3">
      {patients.map((patient) => (
        <button
          key={patient.case_id}
          type="button"
          className="w-full text-left border rounded-2xl p-4 bg-white shadow-sm flex flex-col gap-1 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          onClick={() => onSelect?.(patient)}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-slate-900 font-semibold">{patient.child_full_name}</p>
              <p className="text-xs text-slate-500">
                Cree le {new Date(patient.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <p className="text-xs text-slate-500 truncate">{patient.patient_email}</p>
          </div>
          <div className="text-xs text-slate-600 flex flex-wrap gap-4">
            <span>
              Pre-consultation :{' '}
              {patient.next_preconsultation_date
                ? new Date(patient.next_preconsultation_date).toLocaleDateString('fr-FR')
                : 'Non planifiee'}
            </span>
            <span>
              Acte :{' '}
              {patient.next_act_date
                ? new Date(patient.next_act_date).toLocaleDateString('fr-FR')
                : 'Non planifie'}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
