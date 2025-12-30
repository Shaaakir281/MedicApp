import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { LegalDocumentCard } from '../components/patient/legal/LegalDocumentCard.jsx';
import { buildPatientDashboardVM } from '../services/patientDashboard.mapper.js';
import {
  acknowledgeLegalCheckbox,
  getLegalCatalog,
  getLegalStatus,
} from '../services/patientDashboard.api.js';
import { getCabinetSession } from '../lib/api.js';

const roleLabel = (role) => {
  if (role === 'parent1') return 'Parent 1';
  if (role === 'parent2') return 'Parent 2';
  return role || 'Signataire';
};

export default function TabletSession() {
  const { sessionCode } = useParams();
  const navigate = useNavigate();

  const [sessionInfo, setSessionInfo] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [legalStatus, setLegalStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionCode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getCabinetSession(sessionCode),
      getLegalCatalog({ sessionCode }),
      getLegalStatus({ sessionCode }),
    ])
      .then(([sessionPayload, catalogPayload, statusPayload]) => {
        if (cancelled) return;
        setSessionInfo(sessionPayload);
        setCatalog(catalogPayload);
        setLegalStatus(statusPayload || sessionPayload?.legal_status || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Session introuvable ou expirée.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionCode]);

  const docsVm = useMemo(() => {
    const procedureCase = {
      document_signatures: sessionInfo?.document_signatures || [],
    };
    return buildPatientDashboardVM({
      procedureCase,
      dashboard: null,
      legalCatalog: catalog,
      legalStatus,
    }).legalDocuments;
  }, [catalog, legalStatus, sessionInfo]);

  const handleAcknowledgeCase = async ({ docType, role, caseKey }) => {
    if (!sessionInfo?.appointment_id || !sessionCode) return;
    setSubmitting(true);
    setError(null);
    try {
      const nextStatus = await acknowledgeLegalCheckbox({
        appointmentId: sessionInfo.appointment_id,
        signerRole: role,
        documentType: docType,
        caseKey,
        sessionCode,
        token: null,
      });
      setLegalStatus(nextStatus);
    } catch (err) {
      setError(err?.message || 'Échec de sauvegarde de la case.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner loading-md" />
          <p className="text-slate-600">Chargement de la session…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <p className="text-red-600">{error}</p>
        <button type="button" className="btn" onClick={() => navigate('/')}>
          Retour
        </button>
      </div>
    );
  }

  if (!sessionInfo) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Signature en cabinet</h1>
          <p className="text-sm text-slate-600">
            Session pour {roleLabel(sessionInfo.signer_role)} • {sessionInfo.child_full_name || 'Patient'}
          </p>
        </div>
        <div className="text-sm text-slate-600">
          <p>
            Code session : <span className="font-mono">{sessionCode}</span>
          </p>
          <p>
            Expiration :{' '}
            {sessionInfo.expires_at
              ? new Date(sessionInfo.expires_at).toLocaleTimeString('fr-FR')
              : '—'}
          </p>
        </div>
      </header>

      {docsVm?.length ? (
        <div className="grid gap-4">
          {docsVm.map((doc) => (
            <LegalDocumentCard
              key={doc.docType}
              doc={doc}
              token={null}
              sessionCode={sessionCode}
              appointmentId={sessionInfo.appointment_id}
              procedureCaseId={sessionInfo.case_id}
              overallLegalComplete={Boolean(legalStatus?.complete)}
              parentVerifiedByRole={{}}
              parentEmailByRole={{}}
              onAcknowledgeCase={handleAcknowledgeCase}
              submitting={submitting}
              fixedRole={sessionInfo.signer_role}
              showSignatureActions={true}
              setError={setError}
            />
          ))}
        </div>
      ) : (
        <div className="alert alert-info">Documents indisponibles.</div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
          Terminer
        </button>
      </div>
    </div>
  );
}
