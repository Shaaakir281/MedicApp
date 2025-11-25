import React from 'react';

export const PatientHeader = ({ userEmail, onLogout }) => {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-3xl font-bold">Espace patient</h1>
      <div className="text-sm text-slate-600 flex items-center space-x-4">
        <span>Connecte en tant que {userEmail}</span>
        <button type="button" className="btn btn-sm" onClick={onLogout}>
          Se deconnecter
        </button>
      </div>
    </header>
  );
};
