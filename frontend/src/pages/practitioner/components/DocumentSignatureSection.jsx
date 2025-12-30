import React, { useState } from 'react';
import { downloadDocumentSignatureFile, downloadLegalDocumentPreview } from '../../../services/documentSignature.api.js';
import { DocumentSignatureCard } from './DocumentSignatureCard';

/**
 * Section complète affichant tous les documents de signature d'un dossier
 */
export function DocumentSignatureSection({ documentSignatures, caseId, token, onSend, onRefresh }) {
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

  const handlePreview = async (document) => {
    if (!token || !caseId) return;
    try {
      let blob = null;
      const isFullySigned = Boolean(
        document.status === 'completed' || (document.parent1SignedAt && document.parent2SignedAt),
      );
      if (isFullySigned) {
        try {
          blob = await downloadDocumentSignatureFile({
            token,
            documentSignatureId: document.id,
            fileKind: 'final',
            inline: true,
          });
        } catch (err) {
          blob = null;
        }
      }
      if (!blob) {
        blob = await downloadLegalDocumentPreview({
          token,
          procedureCaseId: caseId,
          documentType: normalizeDocType(document.documentType),
          inline: true,
        });
      }
      if (!blob) {
        alert('Document indisponible.');
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) {
      console.error('Erreur ouverture document:', error);
      alert('Document indisponible.');
    }
  };

  const normalizeDocType = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'surgical_authorization_minor') return 'authorization';
    if (normalized === 'informed_consent') return 'consent';
    if (normalized === 'fees_consent_quote') return 'fees';
    return normalized;
  };

  const baseDocuments = [
    {
      documentType: 'authorization',
      displayLabel: 'Autorisation parentale',
      status: 'pending',
      parent1SignedAt: null,
      parent2SignedAt: null,
      finalPdfAvailable: false,
    },
    {
      documentType: 'consent',
      displayLabel: 'Consentement eclaire',
      status: 'pending',
      parent1SignedAt: null,
      parent2SignedAt: null,
      finalPdfAvailable: false,
    },
    {
      documentType: 'fees',
      displayLabel: 'Frais et honoraires',
      status: 'pending',
      parent1SignedAt: null,
      parent2SignedAt: null,
      finalPdfAvailable: false,
    },
  ];

  const docsByType = new Map(
    (documentSignatures || []).map((doc) => [normalizeDocType(doc.documentType), doc]),
  );
  const mergedDocs = baseDocuments.map((doc) => docsByType.get(doc.documentType) || doc);

  // Ordre d'affichage
  const orderedTypes = ['authorization', 'consent', 'fees', 'surgical_authorization_minor', 'informed_consent', 'fees_consent_quote'];
  const sortedDocs = [...mergedDocs].sort(
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
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Documents</div>
      {sortedDocs.map((doc) => (
        <DocumentSignatureCard
          key={doc.id ?? doc.documentType}
          document={doc}
          onSend={() => handleSend(doc)}
          onPreview={() => handlePreview(doc)}
          isSending={sendingDocType === doc.documentType}
        />
      ))}
    </div>
  );
}
