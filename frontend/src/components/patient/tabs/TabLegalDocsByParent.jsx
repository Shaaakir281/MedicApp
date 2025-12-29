import React from 'react';

import { LegalDocumentCard } from '../legal/LegalDocumentCard.jsx';

export function TabLegalDocsByParent({
  parentRole,
  legalDocuments,
  token,
  appointmentId,
  procedureCaseId,
  overallLegalComplete,
  parentVerifiedByRole,
  parentEmailByRole,
  onAcknowledgeCase,
  submitting = false,
  setError,
  setSuccessMessage,
  onReloadCase,
  onReloadDashboard,
  setPreviewState,
}) {
  const parentLabel = parentRole === 'parent2' ? 'Parent 2' : 'Parent 1';
  const parentEmail = parentEmailByRole?.[parentRole] || 'Email non renseigne';
  const parentVerified = Boolean(parentVerifiedByRole?.[parentRole]);

  if (!legalDocuments?.length) {
    return <p className="text-sm text-slate-600">Aucun document disponible.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-800">Documents pour {parentLabel}</h3>
          <span className={`badge badge-sm ${parentVerified ? 'badge-success' : 'badge-ghost'}`}>
            {parentVerified ? 'Contact verifie' : 'Contact a verifier'}
          </span>
        </div>
        <p className="text-sm text-slate-600 mt-1">{parentEmail}</p>
      </div>

      <div className="grid gap-4">
        {legalDocuments.map((doc) => (
          <LegalDocumentCard
            key={doc.docType}
            doc={doc}
            token={token}
            appointmentId={appointmentId}
            procedureCaseId={procedureCaseId}
            overallLegalComplete={overallLegalComplete}
            parentVerifiedByRole={parentVerifiedByRole}
            parentEmailByRole={parentEmailByRole}
            onAcknowledgeCase={onAcknowledgeCase}
            submitting={submitting}
            fixedRole={parentRole}
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
