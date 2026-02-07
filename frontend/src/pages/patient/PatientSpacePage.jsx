import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PdfPreviewModal from '../../components/PdfPreviewModal.jsx';
import Toast from '../../components/Toast.jsx';
import { PatientJourneyHeader } from '../../components/PatientJourneyHeader.jsx';
import { TabAppointments } from '../../components/patient/tabs/TabAppointments.jsx';
import { TabPrescriptions } from '../../components/patient/tabs/TabPrescriptions.jsx';
import { TabLegalDocs } from '../../components/patient/tabs/TabLegalDocs.jsx';
import { FourteenDayRuleModal } from '../../components/patient/FourteenDayRuleModal.jsx';
import { LABELS_FR } from '../../constants/labels.fr.js';
import { useDossier } from '../../hooks/useDossier.js';
import { usePatientJourney } from '../../hooks/usePatientJourney.js';
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
}) {
  const dossier = useDossier({ token });
  const procedureSelection = 'circumcision';
  const [fourteenDayModal, setFourteenDayModal] = useState({
    open: false,
    title: 'Règle des 14 jours',
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
        title: payload.title || 'Règle des 14 jours',
        message: payload.message || '',
      });
    },
  });
  const journey = usePatientJourney({ token });
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

  const childName = useMemo(() => {
    const first =
      dossier.formState?.childFirstName ||
      dossier.vm?.child?.firstName ||
      controller.vm?.child?.firstName ||
      '';
    const last =
      dossier.formState?.childLastName ||
      dossier.vm?.child?.lastName ||
      controller.vm?.child?.lastName ||
      '';
    const joined = [first, last].filter(Boolean).join(' ').trim();
    return joined || '-';
  }, [
    dossier.formState?.childFirstName,
    dossier.formState?.childLastName,
    dossier.vm?.child?.firstName,
    dossier.vm?.child?.lastName,
    controller.vm?.child?.firstName,
    controller.vm?.child?.lastName,
  ]);

  const handleJourneyNavigate = (target) => {
    if (target === 'dossier') {
      handleTabChange(TABS.file);
      return;
    }
    if (target === 'rdv') {
      handleTabChange(TABS.appointments);
      return;
    }
    if (target === 'documents' || target === 'signatures') {
      handleTabChange(TABS.documents);
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
      <PatientJourneyHeader
        childName={childName}
        email={user?.email}
        journeyStatus={journey.journeyStatus}
        onLogout={onLogout}
        onNavigate={handleJourneyNavigate}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          to="/video-rassurance"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <h3 className="text-base font-semibold text-slate-800">Préparer l'intervention</h3>
          <p className="text-sm text-slate-500 mt-2">
            Regardez la vidéo explicative et retrouvez les points clés avant le jour J.
          </p>
        </Link>
        <Link
          to="/guide"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <h3 className="text-base font-semibold text-slate-800">Guide & FAQ</h3>
          <p className="text-sm text-slate-500 mt-2">
            Trouvez rapidement les réponses aux questions les plus frequentes.
          </p>
        </Link>
      </div>

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
      </div>

      {journey.error && <div className="alert alert-warning">{journey.error}</div>}
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
          onNavigateDossier={() => handleTabChange(TABS.file)}
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
