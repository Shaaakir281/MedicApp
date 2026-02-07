import React from 'react';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '--');

export const CaseSummary = ({ appointment }) => {
  const { procedure, patient } = appointment || {};

  // Helper function to format parent name
  const formatParentName = (firstName, lastName, fullName) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    if (fullName) {
      return fullName;
    }
    return '-';
  };

  const parent1Display = formatParentName(
    procedure?.parent1_first_name,
    procedure?.parent1_last_name,
    procedure?.parent1_name
  );
  const parent2Display = formatParentName(
    procedure?.parent2_first_name,
    procedure?.parent2_last_name,
    procedure?.parent2_name
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm text-slate-600">
        <span className="badge badge-outline">{appointment?.appointment_type === 'act' ? 'Acte' : 'Pré-consultation'}</span>
        <span className="badge badge-outline">{appointment?.mode === 'visio' ? 'Visio' : 'Presentiel'}</span>
        <span className="badge badge-outline">{appointment?.status === 'validated' ? 'Valide' : 'En attente'}</span>
        <span className="text-slate-700 font-medium">
          {formatDate(appointment?.date)} {appointment?.time?.slice(0, 5)}
        </span>
      </div>

      <div className="space-y-1 text-sm text-slate-700">
        <p>
          <span className="font-semibold">Enfant :</span> {patient?.child_full_name || 'Non renseigne'}
        </p>
        <p>
          <span className="font-semibold">Date de naissance :</span> {formatDate(procedure?.child_birthdate)}
        </p>
        <p>
          <span className="font-semibold">Poids :</span> {procedure?.child_weight_kg ? `${procedure.child_weight_kg} kg` : 'Non renseigne'}
        </p>
        <p>
          <span className="font-semibold">Parents :</span> {parent1Display} / {parent2Display}
        </p>
        <p>
          <span className="font-semibold">Emails :</span> {procedure?.parent1_email || '-'} / {procedure?.parent2_email || '-'}
        </p>
        <p>
          <span className="font-semibold">Telephones :</span> {procedure?.parent1_phone || '-'} / {procedure?.parent2_phone || '-'}
        </p>
      </div>
    </div>
  );
};
