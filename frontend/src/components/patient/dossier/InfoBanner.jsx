import React from 'react';

export function InfoBanner({ warnings = [] }) {
  if (!warnings.length) return null;
  return (
    <div className="alert alert-warning flex flex-col items-start gap-1">
      <span className="font-semibold">Points à compléter :</span>
      <ul className="list-disc list-inside text-sm space-y-1">
        {warnings.map((w, idx) => (
          <li key={`${idx}-${w}`}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
