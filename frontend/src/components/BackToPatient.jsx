import React from 'react';
import { Link } from 'react-router-dom';

export function BackToPatient({ to = '/patient', label = "Retour à l'espace patient" }) {
  return (
    <div className="mb-4">
      <Link
        to={to}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        aria-label={label}
      >
        <span className="text-lg leading-none">{'\u2190'}</span>
        <span>{label}</span>
      </Link>
    </div>
  );
}
