import React from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';

export function ParentSelector({ value, onChange, disabled = false, layout = 'buttons' }) {
  const roles = [
    { key: 'parent1', label: LABELS_FR.patientSpace.guardians.parent1 },
    { key: 'parent2', label: LABELS_FR.patientSpace.guardians.parent2 },
  ];

  if (layout === 'select') {
    return (
      <select
        className="select select-bordered select-sm"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
      >
        {roles.map((role) => (
          <option key={role.key} value={role.key}>
            {role.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="join">
      {roles.map((role) => (
        <button
          key={role.key}
          type="button"
          className={`btn btn-xs join-item ${value === role.key ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onChange?.(role.key)}
          disabled={disabled}
        >
          {role.label}
        </button>
      ))}
    </div>
  );
}

