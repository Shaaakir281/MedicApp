import React from 'react';

import { SectionHeading } from '../../../components/ui';

export const DrawerHeader = ({ patientName, appointmentDate, onToggleCase, onToggleSchedule, isEditingCase, isEditingSchedule }) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SectionHeading title={`Dossier de ${patientName || 'Patient'}`} subtitle={`Rendez-vous du ${appointmentDate}`} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={onToggleCase}>
          {isEditingCase ? 'Fermer le mode edition' : 'Modifier le dossier'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onToggleSchedule}>
          {isEditingSchedule ? 'Fermer la replanification' : 'Replanifier'}
        </button>
      </div>
    </div>
  );
};
