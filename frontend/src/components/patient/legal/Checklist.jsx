import React, { useMemo } from 'react';

export function Checklist({
  cases,
  role,
  checkedKeys,
  onCheck,
  signatureStatus = null,
  disabled = false,
  submitting = false,
}) {
  const relevantCases = useMemo(() => {
    return (cases || []).filter((item) => (item.requiredRoles || []).includes(role));
  }, [cases, role]);
  const signatureLocked = ['sent', 'signed'].includes(String(signatureStatus || '').toLowerCase());

  if (!relevantCases.length) {
    return <p className="text-sm text-slate-600">Aucune case à cocher pour ce parent.</p>;
  }

  return (
    <ul className="space-y-2">
      {relevantCases.map((item) => {
        const checked = (checkedKeys || []).includes(item.key);
        const inputDisabled = disabled || submitting || (checked && signatureLocked);
        const lockTitle =
          checked && signatureLocked ? 'Impossible de decocher: signature deja envoyee' : '';
        return (
          <li key={item.key} className="text-sm text-slate-700">
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3" title={lockTitle}>
              <input
                type="checkbox"
                className="checkbox checkbox-sm mt-1"
                checked={checked}
                disabled={inputDisabled}
                onChange={() => onCheck?.(item.key)}
              />
              <div className="flex-1">
                <span className="text-sm">{item.label}</span>
                {checked && signatureLocked && (
                  <span className="ml-2 badge badge-xs badge-info">Verrouille</span>
                )}
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
