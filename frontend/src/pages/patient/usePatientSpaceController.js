import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { usePatientAppointments } from '../../hooks/usePatientAppointments.js';
import { usePatientDashboard } from '../../hooks/usePatientDashboard.js';
import { usePatientProcedure } from '../../hooks/usePatientProcedure.js';
import { defaultProcedureValues, patientProcedureSchema } from '../../lib/forms';
import { buildPatientDashboardVM } from '../../services/patientDashboard.mapper.js';
import { formatChildAge } from '../../utils/child.js';
import { parseISODateLocal, sortAppointments } from '../../utils/date.js';
import { LABELS_FR } from '../../constants/labels.fr.js';
import { getAppointmentBookingMissingFields, isAppointmentBookingComplete } from '../../utils/appointmentValidation.js';

const previewInitialState = { open: false, url: null, downloadUrl: null, title: null, type: null };

export function usePatientSpaceController({
  token,
  procedureSelection,
  dossierForm = null,
  dossierVm = null,
  onShow14DayModal = null,
}) {
  const formMethods = useForm({
    resolver: zodResolver(patientProcedureSchema),
    defaultValues: defaultProcedureValues,
  });
  const { reset, watch } = formMethods;

  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [previewState, setPreviewState] = useState(previewInitialState);
  const [legalStatus, setLegalStatus] = useState(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState(null);

  const procedure = usePatientProcedure({
    token,
    isAuthenticated: true,
    procedureSelection,
    resetForm: reset,
    setError,
    setSuccessMessage,
  });

  const dashboardQuery = usePatientDashboard({
    token,
    appointmentId: activeAppointmentId,
  });

  const appointments = usePatientAppointments({
    token,
    isAuthenticated: true,
    procedureSelection,
    procedureCase: procedure.procedureCase,
    loadProcedureCase: procedure.loadProcedureCase,
    setError,
    setSuccessMessage,
    onReloadDashboard: dashboardQuery.reload,
    onShow14DayModal,
  });

  const appointmentOptions = useMemo(
    () => sortAppointments(procedure.procedureCase?.appointments || []),
    [procedure.procedureCase],
  );

  useEffect(() => {
    if (procedure.procedureCase?.appointments?.length) {
      const sorted = sortAppointments(procedure.procedureCase.appointments);
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const next = sorted.find((appt) => {
        const parsed = appt?.date ? parseISODateLocal(appt.date) : null;
        return parsed ? parsed >= todayStart : false;
      });
      const chosen = next || sorted[0];
      setActiveAppointmentId(chosen?.id || chosen?.appointment_id || null);
    } else {
      setActiveAppointmentId(null);
    }
  }, [procedure.procedureCase]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  const signatureAppointmentId = useMemo(() => {
    if (!procedure.procedureCase?.appointments?.length) return null;
    const actAppt = procedure.procedureCase.appointments.find((appt) => appt.appointment_type === 'act');
    if (actAppt) return actAppt.id;
    return activeAppointmentId || procedure.procedureCase.appointments[0]?.id || null;
  }, [activeAppointmentId, procedure.procedureCase]);

  useEffect(() => {
    const dashboardAppointmentId = dashboardQuery.dashboard?.appointment_id;
    if (!dashboardAppointmentId) return;
    if (signatureAppointmentId && dashboardAppointmentId !== signatureAppointmentId) return;
    if (dashboardQuery.dashboard?.legal_status) {
      setLegalStatus(dashboardQuery.dashboard.legal_status);
    }
  }, [dashboardQuery.dashboard, signatureAppointmentId]);

  const vm = useMemo(
    () =>
      buildPatientDashboardVM({
        procedureCase: procedure.procedureCase,
        dashboard: dashboardQuery.dashboard,
        legalCatalog: null,
        legalStatus,
      }),
    [procedure.procedureCase, dashboardQuery.dashboard, legalStatus],
  );

  const procedureCase = procedure.procedureCase;
  const appointmentSnapshot = useMemo(() => {
    if (dossierForm) {
      return {
        childFirstName: dossierForm.childFirstName,
        childLastName: dossierForm.childLastName,
        birthDate: dossierForm.birthDate,
        parent1FirstName: dossierForm.parent1FirstName,
        parent1LastName: dossierForm.parent1LastName,
        parent1Email: dossierForm.parent1Email,
      };
    }
    if (dossierVm) {
      return {
        childFirstName: dossierVm.child?.firstName,
        childLastName: dossierVm.child?.lastName,
        birthDate: dossierVm.child?.birthDate,
        parent1FirstName: dossierVm.guardians?.PARENT_1?.firstName,
        parent1LastName: dossierVm.guardians?.PARENT_1?.lastName,
        parent1Email: dossierVm.guardians?.PARENT_1?.email,
      };
    }
    if (procedureCase) {
      return {
        childFullName: procedureCase.child_full_name,
        childFirstName: procedureCase.child_first_name,
        childLastName: procedureCase.child_last_name,
        birthDate: procedureCase.child_birthdate,
        parent1Name: procedureCase.parent1_name,
        parent1FirstName: procedureCase.parent1_first_name,
        parent1LastName: procedureCase.parent1_last_name,
        parent1Email: procedureCase.parent1_email,
      };
    }
    return null;
  }, [dossierForm, dossierVm, procedureCase]);
  const appointmentMissingFields = useMemo(
    () => (appointmentSnapshot ? getAppointmentBookingMissingFields(appointmentSnapshot) : []),
    [appointmentSnapshot],
  );
  const canSchedule = Boolean(
    procedureCase && appointmentSnapshot && isAppointmentBookingComplete(appointmentSnapshot),
  );
  const appointmentNeedsSave = Boolean(!procedureCase && appointmentSnapshot && appointmentMissingFields.length === 0);
  const showScheduling = canSchedule && (!appointments.bothAppointmentsBooked || appointments.editingAppointmentId);

  const childBirthdateString = watch('child_birthdate') || procedure.procedureCase?.child_birthdate || null;
  const childAgeDisplay = useMemo(
    () => formatChildAge(childBirthdateString),
    [childBirthdateString],
  );

  const dossierComplete = procedure.procedureCase ? Boolean(procedure.procedureCase.dossier_completed) : null;

  const actionRequired = useMemo(() => {
    if (!procedure.procedureCase) return null;
    if (!vm.legalComplete) return LABELS_FR.patientSpace.documents.reasons.checklistIncomplete;
    if (vm.legalComplete && !vm.signatureComplete) {
      if (!vm.guardians.parent2.verified) {
        return 'Parent 2 : vérifiez le téléphone pour signer à distance (ou signer en cabinet).';
      }
      if (!vm.guardians.parent1.verified) {
        return 'Parent 1 : vérifiez le téléphone pour signer à distance (ou signer en cabinet).';
      }
      return 'Signature à finaliser.';
    }
    return null;
  }, [procedure.procedureCase, vm.legalComplete, vm.signatureComplete, vm.guardians.parent1.verified, vm.guardians.parent2.verified]);

  const handleClosePreview = () => {
    if (previewState?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(previewState.url);
    }
    setPreviewState(previewInitialState);
  };

  const previewDownloadUrl = previewState.downloadUrl || previewState.url || null;
  const previewDownloadLabel =
    previewState.type === 'consent' ? 'Télécharger le consentement' : 'Télécharger le PDF';

  return {
    formMethods,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    previewState,
    setPreviewState,
    previewDownloadUrl,
    previewDownloadLabel,
    handleClosePreview,
    legalStatus,
    setLegalStatus,
    activeAppointmentId,
    setActiveAppointmentId,
    appointmentOptions,
    dashboard: dashboardQuery.dashboard,
    cabinetStatus: dashboardQuery.cabinetStatus,
    dashboardLoading: dashboardQuery.loading,
    dashboardError: dashboardQuery.error,
    reloadDashboard: dashboardQuery.reload,
    vm,
    dossierComplete,
    actionRequired,
    signatureAppointmentId,
    showScheduling,
    appointmentMissingFields,
    appointmentNeedsSave,
    childAgeDisplay,
    procedure,
    appointments,
  };
}
