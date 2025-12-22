import React, { useState } from 'react';
import { DocumentSignatureCard } from './DocumentSignatureCard';

/**
 * Section complète affichant tous les documents de signature d'un dossier
 */
export function DocumentSignatureSection({ documentSignatures, caseId, onSend, onRefresh }) {
  const [sendingDocType, setSendingDocType] = useState(null);

  const handleSend = async (document) => {
    setSendingDocType(document.documentType);
    try {
      await onSend(caseId, document.documentType);
      onRefresh?.();
    } catch (error) {
      console.error('Erreur envoi signature:', error);
      alert('Erreur lors de l\'envoi de la demande de signature');
    } finally {
      setSendingDocType(null);
    }
  };

  const handleDownload = (document) => {
    if (document.downloadUrl) {
      window.open(document.downloadUrl, '_blank');
    }
  };

  // Ordre d'affichage
  const orderedTypes = ['authorization', 'consent', 'fees', 'surgical_authorization_minor', 'informed_consent', 'fees_consent_quote'];
  const sortedDocs = [...documentSignatures].sort(
    (a, b) => orderedTypes.indexOf(a.documentType) - orderedTypes.indexOf(b.documentType)
  );

  if (sortedDocs.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-slate-50 text-sm text-slate-500">
        Aucun document de signature disponible pour ce dossier.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Documents de signature
      </div>
      {sortedDocs.map((doc) => (
        <DocumentSignatureCard
          key={doc.id}
          document={doc}
          onSend={() => handleSend(doc)}
          onDownload={() => handleDownload(doc)}
          isSending={sendingDocType === doc.documentType}
        />
      ))}
    </div>
  );
}
