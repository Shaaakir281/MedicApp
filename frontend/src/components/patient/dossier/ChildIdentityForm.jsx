import React from 'react';

import { InputField } from '../../ui';

export function ChildIdentityForm({ formState, onChange, disabled = false }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <InputField
          label="Prénom *"
          placeholder="Prénom"
          value={formState.childFirstName || ''}
          onChange={(e) => onChange('childFirstName', e.target.value)}
          required
          disabled={disabled}
        />
        <InputField
          label="Nom *"
          placeholder="Nom"
          value={formState.childLastName || ''}
          onChange={(e) => onChange('childLastName', e.target.value)}
          required
          disabled={disabled}
        />
      </div>
      <InputField
        label="Date de naissance *"
        type="date"
        value={formState.birthDate || ''}
        onChange={(e) => onChange('birthDate', e.target.value)}
        required
        disabled={disabled}
      />
      <InputField
        label="Poids (kg)"
        type="number"
        step="0.1"
        min="0"
        value={formState.weightKg ?? ''}
        onChange={(e) => onChange('weightKg', e.target.value)}
        placeholder="Ex. 8.2"
        disabled={disabled}
      />
      <label className="form-control w-full">
        <span className="label-text font-medium text-slate-600">Notes médicales</span>
        <textarea
          className="textarea textarea-bordered w-full"
          rows={3}
          placeholder="Allergies, traitements en cours..."
          value={formState.medicalNotes || ''}
          onChange={(e) => onChange('medicalNotes', e.target.value)}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
