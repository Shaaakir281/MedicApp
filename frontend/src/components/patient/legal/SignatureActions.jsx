import React, { useMemo, useState } from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';
import { startDocumentSignature } from '../../../services/patientDashboard.api.js';
import { downloadDocumentSignatureFile } from '../../../services/documentSignature.api.js';
import { SignedDocumentActions } from './SignedDocumentActions.jsx';

export function SignatureActions({
  doc,
  role,
  token,
  appointmentId,
  procedureCaseId,
  parentVerified,
  parentEmail,
  parentPhone,
  onReloadCase,
  onReloadDashboard,
  setError,
  setSuccessMessage,
  setPreviewState,
  onNavigateDossier,
}) {
  const [signing, setSigning] = useState(false);
  const [downloadingEvidence, setDownloadingEvidence] = useState(false);
  const hasAccess = Boolean(token);

  const parentState = doc?.byParent?.[role] || {
    completedCount: 0,
    total: 0,
    signatureStatus: null,
    signatureLink: null,
    sentAt: null,
    signedAt: null,
  };

  const hasDocFile = Boolean(doc?.finalPdfAvailable || doc?.signedPdfAvailable);
  const hasEvidence = Boolean(doc?.evidencePdfAvailable);

  const checklistComplete = parentState.total > 0 && parentState.completedCount === parentState.total;
  const signatureSupported = Boolean(doc?.signatureSupported);
  const alreadySigned = Boolean(
    parentState.signedAt ||
      String(parentState.signatureStatus || '').toLowerCase() === 'signed',
  );
  const parent1Required = doc?.byParent?.parent1?.total > 0;
  const parent2Required = doc?.byParent?.parent2?.total > 0;
  const parent1Signed = String(doc?.byParent?.parent1?.signatureStatus || '').toLowerCase() === 'signed';
  const parent2Signed = String(doc?.byParent?.parent2?.signatureStatus || '').toLowerCase() === 'signed';
  const fullySigned = (!parent1Required || parent1Signed) && (!parent2Required || parent2Signed);
  const parentContactComplete = Boolean(String(parentEmail || '').trim()) && Boolean(String(parentPhone || '').trim());

  const canSignRemote = Boolean(
    signatureSupported &&
      appointmentId &&
      checklistComplete &&
      parentVerified &&
      parentContactComplete &&
      token &&
      !alreadySigned,
  );

  const disabledReason = useMemo(() => {
    if (!signatureSupported) return LABELS_FR.patientSpace.documents.reasons.featureUnavailable;
    if (!appointmentId) return LABELS_FR.patientSpace.documents.reasons.missingAppointment;
    if (!checklistComplete) return LABELS_FR.patientSpace.documents.reasons.checklistIncomplete;
    if (alreadySigned) return 'Document déjà signé pour ce parent.';
    if (!hasAccess) return 'Session invalide.';
    return null;
  }, [alreadySigned, appointmentId, checklistComplete, hasAccess, signatureSupported]);

  const handleStartSignature = async (mode) => {
    if (!token) return;
    if (!appointmentId) {
      setError?.(LABELS_FR.patientSpace.documents.reasons.missingAppointment);
      return;
    }
    const popupRef = mode === 'remote' ? window.open('', '_blank') : null;
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
      const link = response?.signature_link;
      if (link) {
        if (popupRef && !popupRef.closed) {
          popupRef.location.replace(link);
        } else {
          const opened = window.open(link, '_blank');
          if (!opened) {
            setError?.("Fenetre bloquee par le navigateur. Autorisez les popups puis reessayez.");
          }
        }
        onReloadCase?.();
        onReloadDashboard?.();
      } else {
        if (popupRef && !popupRef.closed) {
          popupRef.close();
        }
        setError?.('Lien de signature indisponible.');
      }
    } catch (err) {
      if (popupRef && !popupRef.closed) {
        popupRef.close();
      }
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
          className={`btn btn-sm ${canSignRemote ? 'btn-outline' : 'btn-disabled'}`}
          onClick={() => handleStartSignature('remote')}
          disabled={!canSignRemote || signing}
        >
          {signing ? 'Ouverture...' : LABELS_FR.patientSpace.documents.signature.signRemote}
        </button>
        {!parentVerified && signatureSupported && token && parentContactComplete && (
          <span className="text-xs text-slate-500">{LABELS_FR.patientSpace.documents.reasons.phoneNotVerified}</span>
        )}
      </div>

      {signatureSupported && token && !parentContactComplete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>Compléter votre dossier pour signer à distance.</p>
          {onNavigateDossier && (
            <button type="button" className="btn btn-xs btn-outline mt-2" onClick={onNavigateDossier}>
              Compléter votre dossier
            </button>
          )}
        </div>
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
          hasFinalPdf={Boolean(doc?.finalPdfAvailable)}
          hasSignedPdf={Boolean(doc?.signedPdfAvailable)}
          previewType="document"
        />
      )}
    </div>
  );
}
