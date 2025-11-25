import React from 'react';

export const ProcedureSummary = ({ procedureCase, onEdit }) => {
  if (!procedureCase) return null;

  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Dossier patient</h2>
          <p className="text-sm text-slate-600">Dossier enregistre. Vous pouvez le modifier si besoin.</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline" onClick={onEdit}>
          Modifier le dossier
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
        <div className="space-y-1">
          <p>
            <span className="font-semibold">Enfant :</span> {procedureCase.child_full_name || 'Non renseigne'}
          </p>
          <p>
            <span className="font-semibold">Date de naissance :</span>{' '}
            {procedureCase.child_birthdate || 'Non renseignee'}
          </p>
          <p>
            <span className="font-semibold">Poids :</span>{' '}
            {procedureCase.child_weight_kg ? `${procedureCase.child_weight_kg} kg` : 'Non renseigne'}
          </p>
        </div>
        <div className="space-y-1">
          <p>
            <span className="font-semibold">Parent 1 :</span> {procedureCase.parent1_name || 'Non renseigne'}
          </p>
          <p>
            <span className="font-semibold">Email parent 1 :</span>{' '}
            {procedureCase.parent1_email || 'Non renseigne'}
          </p>
          <p>
            <span className="font-semibold">Parent 2 :</span> {procedureCase.parent2_name || 'Non renseigne'}
          </p>
        </div>
      </div>
      <div className="p-3 border rounded-lg bg-slate-50">
        <p className="font-semibold text-slate-700">Infos manquantes</p>
        {procedureCase.missing_fields?.length ? (
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
            {procedureCase.missing_fields.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">Aucune info manquante.</p>
        )}
      </div>
    </section>
  );
};
