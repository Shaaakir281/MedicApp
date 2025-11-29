import React from 'react';

export const ViewToggle = ({ viewMode, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`btn btn-sm ${viewMode === 'agenda' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange?.('agenda')}
      >
        Agenda
      </button>
      <button
        type="button"
        className={`btn btn-sm ${viewMode === 'patients' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange?.('patients')}
      >
        Nouveaux dossiers
      </button>
    </div>
  );
};
