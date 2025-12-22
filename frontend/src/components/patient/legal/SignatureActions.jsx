import React, { useMemo, useState } from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';
import { startDocumentSignature } from '../../../services/patientDashboard.api.js';
import { SendLinkPanel } from './SendLinkPanel.jsx';
import { SignedDocumentActions } from './SignedDocumentActions.jsx';

export function SignatureActions({
  doc,
  role,
  token,
  appointmentId,
  procedureCaseId,
  parentVerified,
  parentEmail,
  otherParentEmail,
  overallLegalComplete,
  onReloadCase,
  onReloadDashboard,
  setError,
  setSuccessMessage,
  setPreviewState,
  preconsultationDate,
  canSignAfterDelay,
}) {
  const [signing, setSigning] = useState(false);

  const parentState = doc?.byParent?.[role] || {
    completedCount: 0,
    total: 0,
    signatureStatus: null,
    signatureLink: null,
    sentAt: null,
    signedAt: null,
  };

  const checklistComplete = parentState.total > 0 && parentState.completedCount === parentState.total;
  const signatureSupported = Boolean(doc?.signatureSupported);

  // DEMO MODE: Allow signing even if delay not met (keep warning message)
  // INDEPENDENT DOCUMENTS: Each document can be signed independently
  const canSignCabinet = Boolean(
    signatureSupported &&
      appointmentId &&
      checklistComplete
      // overallLegalComplete removed - documents are independent
      // canSignAfterDelay removed for demo
  );
  const canSignRemote = Boolean(canSignCabinet && parentVerified);

  const disabledReason = useMemo(() => {
    if (!signatureSupported) return LABELS_FR.patientSpace.documents.reasons.featureUnavailable;
    if (!appointmentId) return LABELS_FR.patientSpace.documents.reasons.missingAppointment;
    if (!preconsultationDate) {
      return "Un rendez-vous de pré-consultation est requis avant de pouvoir signer les documents.";
    }
    if (!canSignAfterDelay) {
      const preconsultDate = new Date(preconsultationDate);
      const delayEndDate = new Date(preconsultDate);
      delayEndDate.setDate(delayEndDate.getDate() + 15);
      return `Délai de réflexion de 15 jours requis. Vous pourrez signer à partir du ${delayEndDate.toLocaleDateString('fr-FR')}.`;
    }
    if (!checklistComplete) return LABELS_FR.patientSpace.documents.reasons.checklistIncomplete;
    // Removed: if (!overallLegalComplete) return 'Les 3 documents doivent être validés avant la signature.';
    return null;
  }, [appointmentId, checklistComplete, signatureSupported, preconsultationDate, canSignAfterDelay]);

  const handleStartSignature = async (mode) => {
    if (!token) return;
    if (!appointmentId) {
      setError?.(LABELS_FR.patientSpace.documents.reasons.missingAppointment);
      return;
    }
    setError?.(null);
    setSuccessMessage?.(null);
    setSigning(true);
    try {
      const response = await startDocumentSignature({
        appointmentId,
        procedureCaseId,
        parentRole: role,
        mode,
        token,
        docType: doc?.docType,
      });
      await onReloadCase?.();
      await onReloadDashboard?.();
      const link = response?.signature_link;
      if (link) {
        window.open(link, '_blank', 'noopener');
      } else {
        setError?.('Lien de signature indisponible.');
      }
    } catch (err) {
      setError?.(err?.message || 'Erreur de signature.');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold text-slate-700">{LABELS_FR.patientSpace.documents.signature.title}</p>
        {parentState.signatureStatus && (
          <span className="badge badge-outline text-xs">Statut : {parentState.signatureStatus}</span>
        )}
      </div>

      {disabledReason && <div className="alert alert-warning text-sm">{disabledReason}</div>}

      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          className={`btn btn-sm ${canSignCabinet ? 'btn-primary' : 'btn-disabled'}`}
          onClick={() => handleStartSignature('cabinet')}
          disabled={!canSignCabinet || signing}
        >
          {signing ? 'Ouverture…' : LABELS_FR.patientSpace.documents.signature.signCabinet}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${canSignRemote ? 'btn-outline' : 'btn-disabled'}`}
          onClick={() => handleStartSignature('remote')}
          disabled={!canSignRemote || signing}
        >
          {signing ? 'Ouverture…' : LABELS_FR.patientSpace.documents.signature.signRemote}
        </button>
        {!parentVerified && signatureSupported && (
          <span className="text-xs text-slate-500">{LABELS_FR.patientSpace.documents.reasons.phoneNotVerified}</span>
        )}
      </div>

      <div className="flex gap-3 flex-wrap text-sm">
        {parentState.signatureLink && (
          <a className="link link-primary" href={parentState.signatureLink} target="_blank" rel="noopener noreferrer">
            {LABELS_FR.patientSpace.documents.signature.openLink}
          </a>
        )}
        {doc?.evidencePdfUrl && (
          <a className="link link-primary" href={doc.evidencePdfUrl} target="_blank" rel="noopener noreferrer">
            {LABELS_FR.patientSpace.documents.signature.downloadEvidence}
          </a>
        )}
      </div>

      {signatureSupported && (
        <SignedDocumentActions
          token={token}
          enabled={Boolean(doc?.signedPdfUrl || parentState.signatureLink)}
          title={doc?.title}
          setError={setError}
          setPreviewState={setPreviewState}
          signatureLink={parentState.signatureLink}
          hasFinalPdf={Boolean(doc?.signedPdfUrl)}
        />
      )}

      {signatureSupported && (
        <SendLinkPanel
          token={token}
          primaryLabel={LABELS_FR.patientSpace.guardians[role]}
          primaryEmail={parentEmail}
          secondaryLabel={
            role === 'parent1'
              ? LABELS_FR.patientSpace.guardians.parent2
              : LABELS_FR.patientSpace.guardians.parent1
          }
          secondaryEmail={otherParentEmail}
          onReloadDashboard={onReloadDashboard}
          setError={setError}
          setSuccessMessage={setSuccessMessage}
        />
      )}
    </div>
  );
}

