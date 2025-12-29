import React, { useMemo, useState } from 'react';

import { Checklist } from './Checklist.jsx';
import { ParentSelector } from './ParentSelector.jsx';
import { ProgressBar } from './ProgressBar.jsx';
import { SignatureActions } from './SignatureActions.jsx';

export function LegalDocumentCard({
  doc,
  token,
  appointmentId,
  procedureCaseId,
  overallLegalComplete,
  parentVerifiedByRole,
  parentEmailByRole,
  onAcknowledgeCase,
  submitting = false,
  fixedRole = null,
  showSignatureActions = true,
  setError,
  setSuccessMessage,
  onReloadCase,
  onReloadDashboard,
  setPreviewState,
}) {
  const [roleState, setRoleState] = useState('parent1');
  const [isChecklistExpanded, setIsChecklistExpanded] = useState(true);
  const role = fixedRole || roleState;

  const parentState = doc?.byParent?.[role] || { checkedKeys: [], completedCount: 0, total: 0 };
  const isComplete = parentState.total > 0 && parentState.completedCount === parentState.total;

  const badgeClass = isComplete ? 'badge-success' : 'badge-warning';
  const badgeLabel = isComplete ? 'Complet' : 'À compléter';

  const checkedKeys = parentState.checkedKeys || [];

  const relevantCasesCount = useMemo(() => {
    return (doc?.cases || []).filter((item) => (item.requiredRoles || []).includes(role)).length;
  }, [doc?.cases, role]);

  return (
    <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-900">{doc?.title}</p>
            <p className="text-xs text-slate-500">Version {doc?.version}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${badgeClass} badge-sm`}>{badgeLabel}</span>
            {!fixedRole && <ParentSelector value={role} onChange={setRoleState} disabled={submitting} />}
          </div>
        </div>

        <ProgressBar completedCount={parentState.completedCount} total={parentState.total || relevantCasesCount} />
      </div>

      <div className="px-5 pb-5 space-y-5">
        {/* Accordion header for checklist */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsChecklistExpanded(!isChecklistExpanded)}
            className="flex items-center justify-between w-full font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <span>Checklist</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 transition-transform ${isChecklistExpanded ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Collapsible checklist content */}
          {isChecklistExpanded && (
            <Checklist
              cases={doc?.cases || []}
              role={role}
              checkedKeys={checkedKeys}
              signatureStatus={parentState.signatureStatus}
              onCheck={(caseKey) => onAcknowledgeCase?.({ docType: doc.docType, role, caseKey })}
              submitting={submitting}
            />
          )}
        </div>

        {/* Signature actions - always visible */}
        {showSignatureActions && (
          <SignatureActions
            doc={doc}
            role={role}
            token={token}
            appointmentId={appointmentId}
            procedureCaseId={procedureCaseId}
            parentVerified={Boolean(parentVerifiedByRole?.[role])}
            parentEmail={parentEmailByRole?.[role] || ''}
            otherParentEmail={
              role === 'parent1' ? parentEmailByRole?.parent2 : parentEmailByRole?.parent1
            }
            overallLegalComplete={overallLegalComplete}
            onReloadCase={onReloadCase}
            onReloadDashboard={onReloadDashboard}
            setError={setError}
            setSuccessMessage={setSuccessMessage}
            setPreviewState={setPreviewState}
          />
        )}
      </div>
    </div>
  );
}
