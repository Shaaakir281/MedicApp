import React, { useMemo } from 'react';

import { InputField } from '../../ui';

const COUNTRY_OPTIONS = [
  { code: 'FR', name: 'France', dialCode: '+33', trunkZero: true },
  { code: 'BE', name: 'Belgique', dialCode: '+32', trunkZero: true },
  { code: 'CH', name: 'Suisse', dialCode: '+41', trunkZero: true },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352', trunkZero: true },
  { code: 'ES', name: 'Espagne', dialCode: '+34', trunkZero: true },
  { code: 'DE', name: 'Allemagne', dialCode: '+49', trunkZero: true },
  { code: 'IT', name: 'Italie', dialCode: '+39', trunkZero: true },
];

function findOptionByValue(value) {
  if (!value) return COUNTRY_OPTIONS[0];
  const match = COUNTRY_OPTIONS.find((opt) => value.startsWith(opt.dialCode));
  return match || COUNTRY_OPTIONS[0];
}

export function PhoneInput({ label, value, onChange, required = false, disabled = false }) {
  const selected = useMemo(() => findOptionByValue(value || ''), [value]);
  const nationalDigits = useMemo(() => {
    const current = String(value || '');
    if (current.startsWith(selected.dialCode)) {
      return current.slice(selected.dialCode.length);
    }
    return current.replace(/^\+/, '');
  }, [value, selected]);

  const displayNational = nationalDigits
    ? nationalDigits.startsWith('0')
      ? nationalDigits
      : `0${nationalDigits}`
    : '';

  const handleCountryChange = (e) => {
    const dialCode = e.target.value;
    const trunkZero = COUNTRY_OPTIONS.find((opt) => opt.dialCode === dialCode)?.trunkZero;
    const digitsNoTrunk =
      trunkZero && displayNational.startsWith('0') ? displayNational.slice(1) : displayNational;
    onChange(`${dialCode}${digitsNoTrunk || ''}`);
  };

  const handleNumberChange = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    const digitsNoTrunk = selected.trunkZero && digits.startsWith('0') ? digits.slice(1) : digits;
    onChange(`${selected.dialCode}${digitsNoTrunk}`);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <select
          className="select select-bordered select-sm"
          value={selected.dialCode}
          onChange={handleCountryChange}
          disabled={disabled}
        >
          {COUNTRY_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.dialCode}>
              {opt.name} ({opt.dialCode})
            </option>
          ))}
        </select>
        <InputField
          label=""
          type="tel"
          placeholder="06 12 34 56 78"
          value={displayNational}
          onChange={handleNumberChange}
          required={required}
          className="flex-1"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
