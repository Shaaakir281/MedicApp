import React, { useState } from 'react';

import { downloadDocumentSignatureFile, downloadLegalDocumentPreview } from '../../../services/documentSignature.api.js';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function SignedDocumentActions({
  token,
  enabled,
  title,
  fullySigned = false,
  filename = 'document-signe.pdf',
  setError,
  setPreviewState,
  hasFinalPdf = false,
  hasSignedPdf = false,
  documentSignatureId = null,
  procedureCaseId = null,
  documentType = null,
  previewType = 'document',
}) {
  const [downloading, setDownloading] = useState(false);
  const canPreviewBase = Boolean(procedureCaseId && documentType);
  const canPreviewSigned = Boolean(hasFinalPdf || hasSignedPdf || fullySigned);
  const canPreview = Boolean(enabled || canPreviewBase || canPreviewSigned);

  const getSignedBlob = async (fileKind) => {
    if (!token) return null;
    if (documentSignatureId) {
      return downloadDocumentSignatureFile({
        token,
        documentSignatureId,
        fileKind,
      });
    }
    return null;
  };

  const handlePreview = async () => {
    if (!token) return;
    setError?.(null);
    setDownloading(true);
    try {
      let blob = null;
      if (canPreviewSigned) {
        if (fullySigned || hasFinalPdf) {
          try {
            blob = await getSignedBlob('final');
          } catch (err) {
            blob = null;
          }
        }
        if (!blob && hasSignedPdf) {
          blob = await getSignedBlob('signed');
        }
      } else if (canPreviewBase) {
        blob = await downloadLegalDocumentPreview({
          token,
          procedureCaseId,
          documentType,
          inline: true,
        });
      }
      if (!blob) {
        setError?.('Document indisponible.');
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreviewState?.({ open: true, url, downloadUrl: url, title: title || 'Document signe', type: previewType });
    } catch (err) {
      setError?.(err?.message || 'Document indisponible.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = async () => {
    if (!token) return;
    setError?.(null);
    setDownloading(true);
    try {
      const blob = await getSignedBlob('final');
      if (!blob) {
        setError?.('Document indisponible.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError?.(err?.message || 'Document indisponible.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        type="button"
        className={`btn btn-xs ${canPreview ? 'btn-outline' : 'btn-disabled'}`}
        onClick={handlePreview}
        disabled={!canPreview || downloading}
      >
        {downloading ? LABELS_FR.common.loading : 'Voir'}
      </button>
      <button
        type="button"
        className={`btn btn-xs ${hasFinalPdf || fullySigned ? 'btn-outline' : 'btn-disabled'}`}
        onClick={handleDownload}
        disabled={(!hasFinalPdf && !fullySigned) || downloading}
        title={!hasFinalPdf ? 'Telechargement disponible apres signature complete' : ''}
      >
        {downloading ? LABELS_FR.common.loading : LABELS_FR.patientSpace.documents.signature.downloadSigned}
      </button>
    </div>
  );
}
