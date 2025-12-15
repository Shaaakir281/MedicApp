import React from 'react';

export const ConsentSection = ({
  procedureCase,
  onPreview, // fallback preview (consent non signé)
  onPreviewSigned,
  onDownloadSigned,
  consentAvailable = false,
  consentLoading = false,
  parent1Verified = false,
  parent2Verified = false,
  onSendLink,
  customEmail,
  setCustomEmail,
  sendInProgress = false,
  lastRecipient = null,
  onSign,
  signatureLoading = { parent1: false, parent2: false },
  legalComplete = true,
}) => {
  if (!procedureCase) return null;

  const openDate = procedureCase.signature_open_at ? new Date(procedureCase.signature_open_at) : null;
  const today = new Date();
  // Tests : autoriser la signature même si le délai n'est pas atteint
  const signatureOpen = true;
  const daysUntilOpen =
    openDate && openDate > today ? Math.ceil((openDate - today) / (1000 * 60 * 60 * 24)) : 0;

  const parentStatus = (label) => {
    const status = procedureCase[`${label}_consent_status`] || 'pending';
    const signedAt = procedureCase[`${label}_consent_signed_at`];
    const link = procedureCase[`${label}_signature_link`];
    const verified = label === 'parent1' ? parent1Verified : parent2Verified;
    return { status, signedAt, link, verified };
  };

  const parent1 = parentStatus('parent1');
  const parent2 = parentStatus('parent2');

  const renderParentRow = (label, data, displayName) => {
    const canSign = signatureOpen && data.verified && legalComplete;
    return (
      <div className="flex items-center justify-between border rounded-lg p-3">
        <div className="space-y-1">
          <p className="font-semibold">{displayName}</p>
          <p className="text-sm text-slate-600">
            Statut : {data.status} {data.signedAt ? `(${new Date(data.signedAt).toLocaleString('fr-FR')})` : ''}
          </p>
          <p className="text-xs text-slate-500">
            Numero verifie : {data.verified ? 'Oui' : 'Non'} {data.verified ? '' : '(obligatoire pour signer)'}
          </p>
          {!data.link && (
            <p className="text-xs text-slate-500">
              Lien de signature non disponible pour le moment (il sera genere au clic).
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            type="button"
            className={`btn btn-sm ${canSign ? 'btn-primary' : 'btn-disabled'}`}
            onClick={() => onSign?.(label, { inPerson: true })}
            disabled={!canSign || signatureLoading[label]}
          >
            {signatureLoading[label] ? 'Ouverture...' : 'Signer en cabinet'}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${canSign ? 'btn-outline' : 'btn-disabled'}`}
            onClick={() => onSign?.(label, { inPerson: false })}
            disabled={!canSign || signatureLoading[label]}
          >
            {signatureLoading[label] ? 'Ouverture...' : 'Signer a distance (OTP SMS)'}
          </button>
          {!signatureOpen && <span className="badge badge-warning">Signature dans {daysUntilOpen} j</span>}
        </div>
      </div>
    );
  };

  return (
    <section className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Consentement</h2>
          <p className="text-sm text-slate-600">Consultez le consentement et signez en ligne.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-outline btn-sm"
            onClick={() => (consentAvailable ? onPreviewSigned?.() : onPreview?.(null))}
            disabled={consentLoading || (!consentAvailable && !onPreview)}
          >
            {consentLoading ? 'Chargement...' : 'Voir'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => (consentAvailable ? onDownloadSigned?.() : onPreview?.(null))}
            disabled={consentLoading || (!consentAvailable && !onPreview)}
          >
            {consentLoading ? 'Chargement...' : 'Telecharger'}
          </button>
        </div>
      </div>

      {!legalComplete && (
        <div className="alert alert-warning text-sm">
          Validez toutes les cases des trois documents avant de lancer la signature.
        </div>
      )}

      {!signatureOpen && (
        <div className="alert alert-warning">
          Signature autorisee dans {daysUntilOpen} jour{daysUntilOpen > 1 ? 's' : ''} (delai legal).
        </div>
      )}

      <div className="grid gap-3">
        {renderParentRow('parent1', parent1, 'Parent 1')}
        {renderParentRow('parent2', parent2, 'Parent 2')}
      </div>

      <div className="space-y-2">
        <p className="font-semibold text-slate-700">Envoyer le lien</p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => onSendLink?.(procedureCase?.parent1_email)}
            disabled={!procedureCase?.parent1_email || sendInProgress}
          >
            Parent 1 ({procedureCase?.parent1_email || 'absent'})
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => onSendLink?.(procedureCase?.parent2_email)}
            disabled={!procedureCase?.parent2_email || sendInProgress}
          >
            Parent 2 ({procedureCase?.parent2_email || 'absent'})
          </button>
          <input
            type="email"
            className="input input-bordered input-sm"
            placeholder="Autre email"
            value={customEmail}
            onChange={(e) => setCustomEmail?.(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => customEmail && onSendLink?.(customEmail)}
            disabled={sendInProgress || !customEmail}
          >
            {sendInProgress ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
        {lastRecipient && <p className="text-xs text-slate-500">Lien envoye a {lastRecipient}</p>}
      </div>

      {procedureCase.consent_evidence_pdf_url && (
        <div className="text-sm text-slate-600">
          <a
            className="link link-primary"
            href={procedureCase.consent_evidence_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Telecharger le fichier de preuve
          </a>
        </div>
      )}
    </section>
  );
};
