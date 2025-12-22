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

  // Calculer le délai de 15 jours après la pré-consultation
  const preconsultationDate = useMemo(() => {
    const preconsult = procedureCase?.appointments?.find((a) => a.appointment_type === 'preconsultation');
    return preconsult?.date || null;
  }, [procedureCase]);

  const canSignAfterDelay = useMemo(() => {
    if (!preconsultationDate) return false;
    const preconsultDate = new Date(preconsultationDate);
    const now = new Date();
    const daysSincePreconsult = Math.floor((now - preconsultDate) / (1000 * 60 * 60 * 24));
    return daysSincePreconsult >= 15;
  }, [preconsultationDate]);

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
    return (
      <div className="space-y-4">
        <div className="alert alert-info">
          <div>
            <h3 className="font-semibold mb-2">Parcours de signature des documents</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Prenez un rendez-vous de pré-consultation dans l'onglet "Rendez-vous"</li>
              <li>Lors de la pré-consultation, le praticien vous informera sur la procédure</li>
              <li>Après un délai de réflexion de 15 jours, vous pourrez accéder à cet onglet pour signer les documents</li>
              <li>Les 2 parents doivent signer tous les documents</li>
              <li>Une fois tous les documents signés, vous pourrez prendre le rendez-vous pour l'acte</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="alert alert-info">
        <div className="text-sm">
          <p className="font-semibold">Informations importantes :</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Les 2 parents doivent signer chaque document</li>
            <li>Délai de réflexion de 15 jours après la pré-consultation requis</li>
          </ul>
        </div>
      </div>

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
            procedureCaseId={procedureCase?.id}
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
            preconsultationDate={preconsultationDate}
            canSignAfterDelay={canSignAfterDelay}
          />
        ))}
      </div>
    </div>
  );
}

