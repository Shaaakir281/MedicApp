import React, { useState } from 'react';

import { downloadSignedConsentBlob } from '../../../services/patientDashboard.api.js';
import { LABELS_FR } from '../../../constants/labels.fr.js';

export function SignedDocumentActions({
  token,
  enabled,
  title,
  filename = 'document-signe.pdf',
  setError,
  setPreviewState,
}) {
  const [downloading, setDownloading] = useState(false);

  const handlePreview = async () => {
    if (!token) return;
    setError?.(null);
    setDownloading(true);
    try {
      const blob = await downloadSignedConsentBlob({ token });
      const url = URL.createObjectURL(blob);
      setPreviewState?.({ open: true, url, downloadUrl: url, title: title || 'Document signé', type: 'consent' });
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
      const blob = await downloadSignedConsentBlob({ token });
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
        className={`btn btn-xs ${enabled ? 'btn-outline' : 'btn-disabled'}`}
        onClick={handlePreview}
        disabled={!enabled || downloading}
      >
        {downloading ? LABELS_FR.common.loading : 'Voir'}
      </button>
      <button
        type="button"
        className={`btn btn-xs ${enabled ? 'btn-outline' : 'btn-disabled'}`}
        onClick={handleDownload}
        disabled={!enabled || downloading}
      >
        {downloading ? LABELS_FR.common.loading : LABELS_FR.patientSpace.documents.signature.downloadSigned}
      </button>
    </div>
  );
}

