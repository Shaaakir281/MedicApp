import React, { useMemo, useState } from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';
import { downloadConsentAuditTrailBlob, startDocumentSignature } from '../../../services/patientDashboard.api.js';
import { downloadDocumentSignatureFile } from '../../../services/documentSignature.api.js';
import { SendLinkPanel } from './SendLinkPanel.jsx';
import { SignedDocumentActions } from './SignedDocumentActions.jsx';

export function SignatureActions({
  doc,
  role,
  token,
  sessionCode,
  cabinetStatus,
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
}) {
  const [signing, setSigning] = useState(false);
  const [downloadingEvidence, setDownloadingEvidence] = useState(false);
  const hasAccess = Boolean(token || sessionCode);

  const parentState = doc?.byParent?.[role] || {
    completedCount: 0,
    total: 0,
    signatureStatus: null,
    signatureLink: null,
    sentAt: null,
    signedAt: null,
  };

  const hasDocFile = Boolean(
    doc?.finalPdfAvailable || doc?.signedPdfAvailable || doc?.legacySignedAvailable,
  );
  const hasEvidence = Boolean(doc?.evidencePdfAvailable || doc?.legacyEvidenceAvailable);

  const checklistComplete = parentState.total > 0 && parentState.completedCount === parentState.total;
  const signatureSupported = Boolean(doc?.signatureSupported);
  const alreadySigned = Boolean(
    parentState.signedAt ||
      String(parentState.signatureStatus || '').toLowerCase() === 'signed',
  );
  const cabinetEnabled = Boolean(
    sessionCode ||
      (cabinetStatus && (role === 'parent1' ? cabinetStatus.parent1_active : cabinetStatus.parent2_active)),
  );
  const parent1Required = doc?.byParent?.parent1?.total > 0;
  const parent2Required = doc?.byParent?.parent2?.total > 0;
  const parent1Signed = String(doc?.byParent?.parent1?.signatureStatus || '').toLowerCase() === 'signed';
  const parent2Signed = String(doc?.byParent?.parent2?.signatureStatus || '').toLowerCase() === 'signed';
  const fullySigned = (!parent1Required || parent1Signed) && (!parent2Required || parent2Signed);

  // INDEPENDENT DOCUMENTS: Each document can be signed independently
  // Act-only: no preconsultation delay enforced
  const canSignCabinet = Boolean(
    signatureSupported &&
      appointmentId &&
      checklistComplete &&
      hasAccess &&
      cabinetEnabled &&
      !alreadySigned
      // overallLegalComplete removed - documents are independent
      // canSignAfterDelay removed for demo
  );
  const canSignRemote = Boolean(
    signatureSupported && appointmentId && checklistComplete && parentVerified && token && !alreadySigned,
  );

  const disabledReason = useMemo(() => {
    if (!signatureSupported) return LABELS_FR.patientSpace.documents.reasons.featureUnavailable;
    if (!appointmentId) return LABELS_FR.patientSpace.documents.reasons.missingAppointment;
    if (!checklistComplete) return LABELS_FR.patientSpace.documents.reasons.checklistIncomplete;
    if (alreadySigned) return 'Document deja signe pour ce parent.';
    if (!hasAccess) return 'Session invalide.';
    // Removed: if (!overallLegalComplete) return 'Les 3 documents doivent etre valides avant la signature.';
    return null;
  }, [alreadySigned, appointmentId, checklistComplete, hasAccess, signatureSupported]);

  const cabinetDisabledReason = useMemo(() => {
    if (sessionCode) return null;
    if (!cabinetEnabled && token) {
      return 'Signature en cabinet non activee par le praticien.';
    }
    return null;
  }, [cabinetEnabled, sessionCode, token]);

  const handleStartSignature = async (mode) => {
    if (!token && !sessionCode) return;
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
        sessionCode,
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

  const handleEvidenceDownload = async () => {
    if (!token || !hasEvidence || downloadingEvidence) return;
    setError?.(null);
    setDownloadingEvidence(true);
    try {
      let blob = null;
      if (doc?.documentSignatureId && doc?.evidencePdfAvailable) {
        blob = await downloadDocumentSignatureFile({
          token,
          documentSignatureId: doc.documentSignatureId,
          fileKind: 'evidence',
        });
      } else if (doc?.legacyEvidenceAvailable) {
        blob = await downloadConsentAuditTrailBlob({ token });
      }
      if (!blob) {
        setError?.('Document indisponible.');
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setError?.(err?.message || 'Document indisponible.');
    } finally {
      setDownloadingEvidence(false);
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
        {!parentVerified && signatureSupported && token && (
          <span className="text-xs text-slate-500">{LABELS_FR.patientSpace.documents.reasons.phoneNotVerified}</span>
        )}
      </div>

      {cabinetDisabledReason && (
        <div className="text-xs text-slate-500">{cabinetDisabledReason}</div>
      )}

      <div className="flex gap-3 flex-wrap text-sm">
        {hasEvidence && token && (
          <button
            type="button"
            className="link link-primary"
            onClick={handleEvidenceDownload}
            disabled={downloadingEvidence}
          >
            {downloadingEvidence ? LABELS_FR.common.loading : LABELS_FR.patientSpace.documents.signature.downloadEvidence}
          </button>
        )}
      </div>

      {signatureSupported && token && (
        <SignedDocumentActions
          token={token}
          enabled={Boolean(hasDocFile)}
          title={doc?.title}
          fullySigned={fullySigned}
          setError={setError}
          setPreviewState={setPreviewState}
          documentSignatureId={doc?.documentSignatureId}
          procedureCaseId={procedureCaseId}
          documentType={doc?.docType}
          hasFinalPdf={Boolean(doc?.finalPdfAvailable || doc?.legacySignedAvailable)}
          hasSignedPdf={Boolean(doc?.signedPdfAvailable)}
          previewType="document"
        />
      )}

      {signatureSupported && token && (
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
