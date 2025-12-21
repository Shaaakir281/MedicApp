import React from 'react';

import { InputField } from '../../ui';
import { PhoneInput } from './PhoneInput.jsx';

export function GuardianForm({ title, prefix, formState, onChange, required = false }) {
  return (
    <div className="space-y-3 border rounded-xl p-4 bg-slate-50">
      <p className="font-semibold">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <InputField
          label="Prénom"
          placeholder="Prénom"
          value={formState[`${prefix}FirstName`] || ''}
          onChange={(e) => onChange(`${prefix}FirstName`, e.target.value)}
          required={required}
        />
        <InputField
          label="Nom"
          placeholder="Nom"
          value={formState[`${prefix}LastName`] || ''}
          onChange={(e) => onChange(`${prefix}LastName`, e.target.value)}
          required={required}
        />
      </div>
      <InputField
        label="Email"
        type="email"
        placeholder="parent@email.com"
        value={formState[`${prefix}Email`] || ''}
        onChange={(e) => onChange(`${prefix}Email`, e.target.value)}
        required={required}
      />
      <PhoneInput
        label="Téléphone (E.164)"
        value={formState[`${prefix}Phone`] || ''}
        onChange={(val) => onChange(`${prefix}Phone`, val)}
        required={required}
      />
    </div>
  );
}
