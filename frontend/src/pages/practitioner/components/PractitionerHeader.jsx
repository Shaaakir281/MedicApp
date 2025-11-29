import React from 'react';

export const PractitionerHeader = ({ userEmail, onLogout }) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Tableau de bord praticien</h1>
        {userEmail && <p className="text-sm text-slate-500">Connecte en tant que {userEmail}</p>}
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={onLogout}>
        Se deconnecter
      </button>
    </header>
  );
};
