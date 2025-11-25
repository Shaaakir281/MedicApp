import React from 'react';

export const ProcedureChoice = ({ onSelectCircumcision, onSelectOther }) => {
  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
      <h2 className="text-2xl font-semibold">Choisir le type de prise en charge</h2>
      <p className="text-sm text-slate-600">
        Selectionnez le type d&apos;acte afin d&apos;afficher les informations correspondantes.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" className="btn btn-primary" onClick={onSelectCircumcision}>
          Circoncision rituelle
        </button>
        <button type="button" className="btn" onClick={onSelectOther}>
          Autre acte
        </button>
      </div>
    </section>
  );
};
