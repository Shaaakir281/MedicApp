import React from 'react';

import { ProcedureSummary } from '../ProcedureSummary.jsx';
import { StepsCard } from '../StepsCard.jsx';
import { ContactVerificationPanel } from '../sections/ContactVerificationPanel.jsx';
import { LABELS_FR } from '../../../constants/labels.fr.js';
import { ProcedureForm } from '../../../pages/patient/components/ProcedureForm.jsx';

export function TabDossier({
  procedure,
  childAgeDisplay,
  token,
  dashboard,
  onReloadCase,
  onReloadDashboard,
  setError,
  setSuccessMessage,
}) {
  const { procedureCase } = procedure;

  return (
    <div className="space-y-6">
      {!procedure.stepsAcknowledged && (
        <StepsCard
          stepsChecked={procedure.stepsChecked}
          stepsSubmitting={procedure.stepsSubmitting}
          onCheck={procedure.setStepsChecked}
          onContinue={procedure.acknowledgeSteps}
        />
      )}

      <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">{LABELS_FR.patientSpace.tabs.file}</h2>
            <p className="text-sm text-slate-600">Identité, poids, notes et responsables légaux.</p>
          </div>
        </div>

        {!procedure.isEditingCase && procedureCase && (
          <ProcedureSummary
            procedureCase={procedureCase}
            onEdit={() => procedure.setIsEditingCase(true)}
          />
        )}
        {procedure.isEditingCase && (
          <ProcedureForm
            childAgeDisplay={childAgeDisplay}
            loading={procedure.procedureLoading}
            onSubmit={procedure.handleProcedureSubmit}
          />
        )}
      </section>

      <ContactVerificationPanel
        token={token}
        procedureCase={procedureCase}
        dashboard={dashboard}
        onReloadCase={onReloadCase}
        onReloadDashboard={onReloadDashboard}
        setError={setError}
        setSuccessMessage={setSuccessMessage}
      />
    </div>
  );
}
