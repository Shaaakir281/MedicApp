import React from 'react';

export const PrescriptionActions = ({
  previewUrl,
  downloadUrl,
  signed,
  onPreview,
  onSendEmail,
}) => {
  const handleSendEmail = () => {
    if (downloadUrl && onSendEmail) {
      onSendEmail(downloadUrl);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className="btn btn-xs btn-outline"
          onClick={onPreview}
          disabled={!previewUrl}
        >
          Voir l&apos;ordonnance
        </button>
        <a
          className={`btn btn-xs btn-ghost ${!downloadUrl ? 'btn-disabled' : ''}`}
          href={downloadUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          Telecharger
        </a>
        <button
          type="button"
          className={`btn btn-xs btn-ghost ${!downloadUrl ? 'btn-disabled' : ''}`}
          onClick={handleSendEmail}
          disabled={!downloadUrl}
        >
          Envoyer par e-mail
        </button>
      </div>
      {!signed && (
        <p className="text-xs text-slate-500 pt-1">
          Ordonnance en cours de signature par le praticien.
        </p>
      )}
    </div>
  );
};
