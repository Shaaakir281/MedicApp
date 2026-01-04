import React, { useEffect, useRef, useState } from 'react';
import { downloadDocumentSignatureFile, downloadLegalDocumentPreview } from '../../../services/documentSignature.api.js';
import { DocumentSignatureCard } from './DocumentSignatureCard';

/**
 * Section complète affichant tous les documents de signature d'un dossier
 */
export function DocumentSignatureSection({ documentSignatures, caseId, token }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const blobUrlCacheRef = useRef(new Map());

  const isDocSigned = (document) =>
    Boolean(document.status === 'completed' || (document.parent1SignedAt && document.parent2SignedAt));

  useEffect(() => {
    return () => {
      blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlCacheRef.current.clear();
    };
  }, []);

  const handlePreview = async (document) => {
    if (!token || !caseId) return;
    try {
      const cacheKey = `${document.id ?? document.documentType}-${document.status ?? 'pending'}`;
      const cachedUrl = blobUrlCacheRef.current.get(cacheKey);
      if (cachedUrl) {
        window.open(cachedUrl, '_blank', 'noopener');
        return;
      }

      let blob = null;
      const isFullySigned = isDocSigned(document);
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
      blobUrlCacheRef.current.set(cacheKey, url);
      setTimeout(() => {
        const existingUrl = blobUrlCacheRef.current.get(cacheKey);
        if (existingUrl === url) {
          URL.revokeObjectURL(url);
          blobUrlCacheRef.current.delete(cacheKey);
        }
      }, 300000);
      window.open(url, '_blank', 'noopener');
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
  const signedCount = sortedDocs.filter(isDocSigned).length;

  if (sortedDocs.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-slate-50 text-sm text-slate-500">
        Aucun document de signature disponible pour ce dossier.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Documents ({sortedDocs.length})
        </div>
        <button
          type="button"
          className="btn btn-xs btn-ghost gap-1"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? 'Masquer' : 'Afficher'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {sortedDocs.map((doc) => (
            <DocumentSignatureCard
              key={doc.id ?? doc.documentType}
              document={doc}
              onPreview={() => handlePreview(doc)}
            />
          ))}
        </div>
      )}

      {!isExpanded && (
        <div className="text-xs text-slate-500 italic">
          {signedCount} / {sortedDocs.length} signes
        </div>
      )}
    </div>
  );
}
