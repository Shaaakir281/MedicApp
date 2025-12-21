import React, { useMemo, useState } from 'react';
import { FormProvider } from 'react-hook-form';

import PdfPreviewModal from '../../components/PdfPreviewModal.jsx';
import Toast from '../../components/Toast.jsx';
import { HeaderSummary } from '../../components/patient/HeaderSummary.jsx';
import { TabAppointments } from '../../components/patient/tabs/TabAppointments.jsx';
import { TabDossier } from '../../components/patient/tabs/TabDossier.jsx';
import { TabLegalDocs } from '../../components/patient/tabs/TabLegalDocs.jsx';
import { LABELS_FR } from '../../constants/labels.fr.js';
import { PatientTabDossier as PatientTabDossierNew } from './PatientTabDossier.jsx';
import { usePatientSpaceController } from './usePatientSpaceController.js';

const TABS = {
  file: 'file',
  appointments: 'appointments',
  documents: 'documents',
};

export function PatientSpacePage({
  token,
  user,
  onLogout,
  procedureSelection,
  onChangeProcedure,
}) {
  const enableNewDossier = String(import.meta.env.VITE_FEATURE_NEW_DOSSIER || '').toLowerCase() === 'true';
  const controller = usePatientSpaceController({ token, procedureSelection });
  const [activeTab, setActiveTab] = useState(TABS.file);

  const previewActions = useMemo(() => {
    if (!controller.previewDownloadUrl) return null;
    return [
      <a
        key="download"
        className="btn btn-primary btn-sm"
        href={controller.previewDownloadUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {controller.previewDownloadLabel}
      </a>,
    ];
  }, [controller.previewDownloadLabel, controller.previewDownloadUrl]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <HeaderSummary
        vm={controller.vm}
        userEmail={user?.email}
        onLogout={onLogout}
        dossierComplete={controller.dossierComplete}
        actionRequired={controller.actionRequired}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tabs tabs-boxed">
          <button
            type="button"
            className={`tab ${activeTab === TABS.file ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(TABS.file)}
          >
            {LABELS_FR.patientSpace.tabs.file}
          </button>
          <button
            type="button"
            className={`tab ${activeTab === TABS.appointments ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(TABS.appointments)}
          >
            {LABELS_FR.patientSpace.tabs.appointments}
          </button>
          <button
            type="button"
            className={`tab ${activeTab === TABS.documents ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(TABS.documents)}
          >
            {LABELS_FR.patientSpace.tabs.documents}
          </button>
        </div>

        <button type="button" className="btn btn-outline btn-sm" onClick={onChangeProcedure}>
          Changer de parcours
        </button>
      </div>

      {controller.dashboardError && <div className="alert alert-warning">{controller.dashboardError}</div>}
      {controller.error && <div className="alert alert-error">{controller.error}</div>}

      {activeTab === TABS.file && (
        <>
          {enableNewDossier ? (
            <PatientTabDossierNew token={token} />
          ) : (
            <FormProvider {...controller.formMethods}>
              <TabDossier
                procedure={controller.procedure}
                childAgeDisplay={controller.childAgeDisplay}
                token={token}
                dashboard={controller.dashboard}
                onReloadCase={controller.procedure.loadProcedureCase}
                onReloadDashboard={controller.reloadDashboard}
                setError={controller.setError}
                setSuccessMessage={controller.setSuccessMessage}
              />
            </FormProvider>
          )}
        </>
      )}

      {activeTab === TABS.appointments && (
        <TabAppointments
          dashboardLoading={controller.dashboardLoading}
          dashboardUpcoming={controller.dashboard?.appointments?.upcoming || controller.appointments.upcomingAppointments}
          dashboardHistory={controller.dashboard?.appointments?.history || controller.appointments.pastAppointments}
          activeAppointmentId={controller.signatureAppointmentId}
          setActiveAppointmentId={controller.setActiveAppointmentId}
          appointments={controller.appointments}
          showScheduling={controller.showScheduling}
          setError={controller.setError}
          setPreviewState={controller.setPreviewState}
        />
      )}

      {activeTab === TABS.documents && (
        <TabLegalDocs
          token={token}
          procedureCase={controller.procedure.procedureCase}
          dashboard={controller.dashboard}
          legalStatus={controller.legalStatus}
          setLegalStatus={controller.setLegalStatus}
          legalComplete={controller.vm.legalComplete}
          signatureAppointmentId={controller.signatureAppointmentId}
          appointmentOptions={controller.appointmentOptions}
          activeAppointmentId={controller.activeAppointmentId}
          setActiveAppointmentId={controller.setActiveAppointmentId}
          onReloadCase={controller.procedure.loadProcedureCase}
          onReloadDashboard={controller.reloadDashboard}
          setError={controller.setError}
          setSuccessMessage={controller.setSuccessMessage}
          setPreviewState={controller.setPreviewState}
        />
      )}

      <Toast
        message={controller.successMessage}
        isVisible={Boolean(controller.successMessage)}
        onClose={() => controller.setSuccessMessage(null)}
      />
      <PdfPreviewModal
        isOpen={controller.previewState.open}
        onClose={controller.handleClosePreview}
        title={controller.previewState.title || 'Document'}
        url={controller.previewState.url}
        actions={previewActions}
      />
    </div>
  );
}
