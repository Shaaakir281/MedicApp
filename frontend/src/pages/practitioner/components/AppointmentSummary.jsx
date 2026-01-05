import React from 'react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : null);

export const AppointmentSummary = ({ procedure, onNavigateDate }) => {
  return (
    <div className="bg-slate-50 border rounded-lg p-4">
      <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-3">
        Rendez-vous
      </h4>
      <div className="grid gap-3 md:grid-cols-2">
        {/* Pré-consultation */}
        <div className="space-y-1">
          <p className="text-xs text-slate-500 font-medium">Pré-consultation</p>
          {procedure?.has_preconsultation ? (
            <button
              type="button"
              className="text-sm text-primary hover:underline font-medium"
              onClick={() => onNavigateDate?.(procedure.next_preconsultation_date)}
            >
              📅 {formatDate(procedure.next_preconsultation_date)}
            </button>
          ) : (
            <p className="text-sm text-slate-400 italic">Non planifiée</p>
          )}
        </div>

        {/* Acte */}
        <div className="space-y-1">
          <p className="text-xs text-slate-500 font-medium">Acte chirurgical</p>
          {procedure?.has_act_planned ? (
            <button
              type="button"
              className="text-sm text-primary hover:underline font-medium"
              onClick={() => onNavigateDate?.(procedure.next_act_date)}
            >
              📅 {formatDate(procedure.next_act_date)}
            </button>
          ) : (
            <p className="text-sm text-slate-400 italic">Non planifié</p>
          )}
        </div>
      </div>
    </div>
  );
};
