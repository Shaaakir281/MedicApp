import React, { useEffect, useMemo, useState } from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';
import {
  acknowledgeLegalCheckbox,
  getLegalCatalog,
  getLegalStatus,
} from '../../../services/patientDashboard.api.js';
import { fetchCabinetActiveSessions } from '../../../lib/api.js';
import { buildPatientDashboardVM } from '../../../services/patientDashboard.mapper.js';
import { AppointmentContextSelector } from '../sections/AppointmentContextSelector.jsx';
import { TabLegalDocsByParent } from './TabLegalDocsByParent.jsx';

export function TabLegalDocs({
  token,
  procedureCase,
  dashboard,
  cabinetStatus,
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
  onNavigateDossier,
}) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeParentRole, setActiveParentRole] = useState('parent1');
  const [activeCabinetStatus, setActiveCabinetStatus] = useState(cabinetStatus || null);

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

  useEffect(() => {
    if (!signatureAppointmentId || !token) {
      setActiveCabinetStatus(null);
      return;
    }
    let cancelled = false;
    fetchCabinetActiveSessions(token, signatureAppointmentId)
      .then((payload) => {
        if (!cancelled) setActiveCabinetStatus(payload);
      })
      .catch(() => {
        if (!cancelled) setActiveCabinetStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [signatureAppointmentId, token]);

  const documentAppointmentOptions = useMemo(() => {
    return (appointmentOptions || []).filter((appt) => appt?.appointment_type === 'act');
  }, [appointmentOptions]);

  const vmWithDocs = useMemo(() => {
    return buildPatientDashboardVM({
      procedureCase,
      dashboard,
      legalCatalog: catalog,
      legalStatus: legalStatus || null,
    });
  }, [catalog, dashboard, legalStatus, procedureCase]);

  const parentVerifiedByRole = useMemo(
    () => ({
      parent1: Boolean(
        dashboard?.contact_verification?.parent1_verified &&
          procedureCase?.parent1_phone_verified_at,
      ),
      parent2: Boolean(
        dashboard?.contact_verification?.parent2_verified &&
          procedureCase?.parent2_phone_verified_at,
      ),
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
          <div className="text-sm">
            <p className="font-semibold">Avant de signer les documents</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Commencez par un rendez-vous de consultation d'information.</li>
              <li>
                La signature n'est disponible qu'après un <strong>délai de réflexion de 15 jours</strong>
                suivant ce rendez-vous.
              </li>
              <li>Les 2 parents doivent signer chaque document.</li>
            </ul>
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
            <li>Les 2 parents doivent signer chaque document.</li>
            <li>
              La signature n'est possible qu'après un délai de réflexion de <strong>15 jours</strong>
              suivant la consultation d'information.
            </li>
            <li>
              Pour signer à distance, chaque parent doit compléter son dossier (email + téléphone).
            </li>
          </ul>
          {onNavigateDossier && (
            <button type="button" className="btn btn-xs btn-outline mt-3" onClick={onNavigateDossier}>
              Compléter votre dossier
            </button>
          )}
        </div>
      </div>

      <AppointmentContextSelector
        appointmentOptions={documentAppointmentOptions}
        activeAppointmentId={signatureAppointmentId}
        onChangeAppointmentId={setActiveAppointmentId}
      />

      {catalogError && <div className="alert alert-warning">{catalogError}</div>}
      {loading && <div className="loading loading-spinner loading-sm" />}

      <div className="tabs tabs-boxed">
        <button
          type="button"
          className={`tab ${activeParentRole === 'parent1' ? 'tab-active' : ''}`}
          onClick={() => setActiveParentRole('parent1')}
        >
          Parent 1
        </button>
        <button
          type="button"
          className={`tab ${activeParentRole === 'parent2' ? 'tab-active' : ''}`}
          onClick={() => setActiveParentRole('parent2')}
        >
          Parent 2
        </button>
      </div>

      <TabLegalDocsByParent
        parentRole={activeParentRole}
        legalDocuments={vmWithDocs.legalDocuments || []}
        token={token}
        cabinetStatus={activeCabinetStatus || cabinetStatus}
        appointmentId={signatureAppointmentId}
        procedureCaseId={procedureCase?.id}
        parentVerifiedByRole={parentVerifiedByRole}
        parentEmailByRole={parentEmailByRole}
        parentContactByRole={{
          parent1: vmWithDocs?.guardians?.parent1 || {},
          parent2: vmWithDocs?.guardians?.parent2 || {},
        }}
        onAcknowledgeCase={handleAcknowledgeCase}
        submitting={submitting}
        setError={setError}
        setSuccessMessage={setSuccessMessage}
        onReloadCase={onReloadCase}
        onReloadDashboard={onReloadDashboard}
        setPreviewState={setPreviewState}
        onNavigateDossier={onNavigateDossier}
      />
    </div>
  );
}
