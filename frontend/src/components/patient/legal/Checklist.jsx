import React, { useMemo } from 'react';

export function Checklist({
  cases,
  role,
  checkedKeys,
  onCheck,
  disabled = false,
  submitting = false,
}) {
  const relevantCases = useMemo(() => {
    return (cases || []).filter((item) => (item.requiredRoles || []).includes(role));
  }, [cases, role]);

  if (!relevantCases.length) {
    return <p className="text-sm text-slate-600">Aucune case à cocher pour ce parent.</p>;
  }

  return (
    <ul className="space-y-2">
      {relevantCases.map((item) => {
        const checked = (checkedKeys || []).includes(item.key);
        const inputDisabled = disabled || submitting || checked;
        return (
          <li key={item.key} className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-1"
              checked={checked}
              disabled={inputDisabled}
              onChange={() => onCheck?.(item.key)}
            />
            <span>{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

