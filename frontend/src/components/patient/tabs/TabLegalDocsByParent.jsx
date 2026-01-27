import React from 'react';

import { LegalDocumentCard } from '../legal/LegalDocumentCard.jsx';

export function TabLegalDocsByParent({
  parentRole,
  legalDocuments,
  token,
  cabinetStatus,
  appointmentId,
  procedureCaseId,
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
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-blue-700">
            <strong>Mode demonstration :</strong> Ceci est une demo. En production, le remplissage
            des documents sera autorise 14 jours apres la consultation pre-operatoire.
          </p>
        </div>
      </div>

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
            cabinetStatus={cabinetStatus}
            appointmentId={appointmentId}
            procedureCaseId={procedureCaseId}
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
