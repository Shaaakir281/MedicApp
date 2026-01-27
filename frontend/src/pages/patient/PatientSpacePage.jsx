import React, { useMemo, useState } from 'react';
import PdfPreviewModal from '../../components/PdfPreviewModal.jsx';
import Toast from '../../components/Toast.jsx';
import { HeaderSummary } from '../../components/patient/HeaderSummary.jsx';
import { TabAppointments } from '../../components/patient/tabs/TabAppointments.jsx';
import { TabPrescriptions } from '../../components/patient/tabs/TabPrescriptions.jsx';
import { TabLegalDocs } from '../../components/patient/tabs/TabLegalDocs.jsx';
import { FourteenDayRuleModal } from '../../components/patient/FourteenDayRuleModal.jsx';
import { LABELS_FR } from '../../constants/labels.fr.js';
import { useDossier } from '../../hooks/useDossier.js';
import { PatientTabDossierView } from './PatientTabDossier.jsx';
import { usePatientSpaceController } from './usePatientSpaceController.js';

const TABS = {
  file: 'file',
  appointments: 'appointments',
  prescriptions: 'prescriptions',
  documents: 'documents',
};

export function PatientSpacePage({
  token,
  user,
  onLogout,
  procedureSelection,
  onChangeProcedure,
}) {
  const dossier = useDossier({ token });
  const [fourteenDayModal, setFourteenDayModal] = useState({
    open: false,
    title: 'Regle des 14 jours',
    message: '',
  });
  const controller = usePatientSpaceController({
    token,
    procedureSelection,
    dossierForm: dossier.formState,
    dossierVm: dossier.vm,
    onShow14DayModal: (payload) => {
      if (!payload) return;
      setFourteenDayModal({
        open: true,
        title: payload.title || 'Regle des 14 jours',
        message: payload.message || '',
      });
    },
  });
  const [activeTab, setActiveTab] = useState(TABS.file);
  const [pendingPrescriptionId, setPendingPrescriptionId] = useState(null);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    if (nextTab !== TABS.prescriptions) {
      setPendingPrescriptionId(null);
    }
    if (nextTab === TABS.appointments) {
      dossier.load?.();
      controller.procedure.loadProcedureCase?.();
      controller.reloadDashboard?.();
    }
  };

  const handleViewPrescription = (appt) => {
    const apptId = appt?.appointment_id || appt?.id;
    if (apptId) {
      controller.setActiveAppointmentId?.(apptId);
      setPendingPrescriptionId(apptId);
    }
    setActiveTab(TABS.prescriptions);
  };

  const handleDownloadPrescription = (appt) => {
    const { downloadUrl } = controller.appointments.getPrescriptionUrls(appt);
    if (!downloadUrl) {
      controller.setError?.("L'ordonnance n'est pas disponible pour ce rendez-vous.");
      return;
    }
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  };

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
        dossierForm={dossier.formState}
        dossierVm={dossier.vm}
        userEmail={user?.email}
        onLogout={onLogout}
        dossierComplete={controller.dossierComplete}
        actionRequired={controller.actionRequired}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tabs tabs-boxed flex-wrap gap-1">
          <button
            type="button"
            className={`tab ${activeTab === TABS.file ? 'tab-active' : ''} text-sm whitespace-normal leading-[1.1] h-auto px-3 py-2`}
            onClick={() => handleTabChange(TABS.file)}
          >
            {LABELS_FR.patientSpace.tabs.file}
          </button>
          <button
            type="button"
            className={`tab ${activeTab === TABS.appointments ? 'tab-active' : ''} text-sm whitespace-normal leading-[1.1] h-auto px-3 py-2`}
            onClick={() => handleTabChange(TABS.appointments)}
          >
            {LABELS_FR.patientSpace.tabs.appointments}
          </button>
          <button
            type="button"
            className={`tab ${activeTab === TABS.prescriptions ? 'tab-active' : ''} text-sm whitespace-normal leading-[1.1] h-auto px-3 py-2`}
            onClick={() => handleTabChange(TABS.prescriptions)}
          >
            {LABELS_FR.patientSpace.tabs.prescriptions}
          </button>
          <button
            type="button"
            className={`tab ${activeTab === TABS.documents ? 'tab-active' : ''} text-sm whitespace-normal leading-[1.1] h-auto px-3 py-2`}
            onClick={() => handleTabChange(TABS.documents)}
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
        <PatientTabDossierView dossier={dossier} currentUser={user} />
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
          appointmentMissingFields={controller.appointmentMissingFields}
          appointmentNeedsSave={controller.appointmentNeedsSave}
          setError={controller.setError}
          setPreviewState={controller.setPreviewState}
          onViewPrescription={handleViewPrescription}
        />
      )}

      {activeTab === TABS.prescriptions && (
        <TabPrescriptions
          appointments={controller.procedure.procedureCase?.appointments || []}
          onDownload={handleDownloadPrescription}
          highlightAppointmentId={pendingPrescriptionId}
        />
      )}

      {activeTab === TABS.documents && (
        <TabLegalDocs
          token={token}
          procedureCase={controller.procedure.procedureCase}
          dashboard={controller.dashboard}
          cabinetStatus={controller.cabinetStatus}
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
      <FourteenDayRuleModal
        isOpen={fourteenDayModal.open}
        onClose={() => setFourteenDayModal((prev) => ({ ...prev, open: false }))}
        title={fourteenDayModal.title}
        message={fourteenDayModal.message}
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
