import React, { useEffect, useMemo, useState } from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';
import {
  acknowledgeLegalCheckbox,
  getLegalCatalog,
  getLegalStatus,
} from '../../../services/patientDashboard.api.js';
import { buildPatientDashboardVM } from '../../../services/patientDashboard.mapper.js';
import { LegalDocumentCard } from '../legal/LegalDocumentCard.jsx';
import { AppointmentContextSelector } from '../sections/AppointmentContextSelector.jsx';

export function TabLegalDocs({
  token,
  procedureCase,
  dashboard,
  legalStatus,
  setLegalStatus,
  signatureAppointmentId,
  appointmentOptions,
  activeAppointmentId,
  setActiveAppointmentId,
  onReloadCase,
  onReloadDashboard,
  setError,
  setSuccessMessage,
  setPreviewState,
}) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!signatureAppointmentId || !token) {
      setCatalog(null);
      setCatalogError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setCatalogError(null);
    Promise.all([
      getLegalCatalog({ appointmentId: signatureAppointmentId, token }),
      getLegalStatus({ appointmentId: signatureAppointmentId, token }),
    ])
      .then(([catalogPayload, statusPayload]) => {
        if (cancelled) return;
        setCatalog(catalogPayload);
        setLegalStatus?.(statusPayload);
      })
      .catch((err) => {
        if (cancelled) return;
        setCatalogError(err?.message || 'Impossible de charger les documents.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setLegalStatus, signatureAppointmentId, token]);

  const overallLegalComplete = Boolean(legalStatus?.complete);

  const vmWithDocs = useMemo(() => {
    return buildPatientDashboardVM({
      procedureCase,
      dashboard,
      legalCatalog: catalog,
      legalStatus: legalStatus || dashboard?.legal_status || null,
    });
  }, [catalog, dashboard, legalStatus, procedureCase]);

  const parentVerifiedByRole = useMemo(
    () => ({
      parent1:
        dashboard?.contact_verification?.parent1_verified ?? Boolean(procedureCase?.parent1_phone_verified_at),
      parent2:
        dashboard?.contact_verification?.parent2_verified ?? Boolean(procedureCase?.parent2_phone_verified_at),
    }),
    [dashboard, procedureCase],
  );

  const parentEmailByRole = useMemo(
    () => ({
      parent1: procedureCase?.parent1_email || '',
      parent2: procedureCase?.parent2_email || '',
    }),
    [procedureCase],
  );

  const handleAcknowledgeCase = async ({ docType, role, caseKey }) => {
    if (!signatureAppointmentId || !token) return;
    setSubmitting(true);
    setCatalogError(null);
    try {
      const nextStatus = await acknowledgeLegalCheckbox({
        appointmentId: signatureAppointmentId,
        signerRole: role,
        documentType: docType,
        caseKey,
        token,
      });
      setLegalStatus?.(nextStatus);
      await onReloadDashboard?.();
    } catch (err) {
      setCatalogError(err?.message || 'Échec de sauvegarde de la case.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!signatureAppointmentId) {
    return <div className="alert alert-info">{LABELS_FR.patientSpace.documents.reasons.missingAppointment}</div>;
  }

  return (
    <div className="space-y-6">
      <AppointmentContextSelector
        appointmentOptions={appointmentOptions}
        activeAppointmentId={activeAppointmentId}
        onChangeAppointmentId={setActiveAppointmentId}
      />

      {catalogError && <div className="alert alert-warning">{catalogError}</div>}
      {loading && <div className="loading loading-spinner loading-sm" />}

      <div className="grid gap-4">
        {(vmWithDocs.legalDocuments || []).map((doc) => (
          <LegalDocumentCard
            key={doc.docType}
            doc={doc}
            token={token}
            appointmentId={signatureAppointmentId}
            overallLegalComplete={overallLegalComplete}
            parentVerifiedByRole={parentVerifiedByRole}
            parentEmailByRole={parentEmailByRole}
            onAcknowledgeCase={handleAcknowledgeCase}
            submitting={submitting}
            setError={setError}
            setSuccessMessage={setSuccessMessage}
            onReloadCase={onReloadCase}
            onReloadDashboard={onReloadDashboard}
            setPreviewState={setPreviewState}
          />
        ))}
      </div>
    </div>
  );
}

