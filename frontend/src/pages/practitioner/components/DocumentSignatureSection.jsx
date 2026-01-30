import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { downloadDocumentSignatureFile, downloadLegalDocumentPreview } from '../../../services/documentSignature.api.js';
import { createCabinetSignatureSession } from '../../../services/cabinetSignature.api.js';
import Modal from '../../../components/Modal.jsx';
import { DocumentSignatureCard } from './DocumentSignatureCard';

/**
 * Section complète affichant tous les documents de signature d'un dossier
 */
export function DocumentSignatureSection({ documentSignatures, caseId, token }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const blobUrlCacheRef = useRef(new Map());
  const [cabinetDoc, setCabinetDoc] = useState(null);
  const [cabinetRole, setCabinetRole] = useState('parent1');
  const [cabinetSession, setCabinetSession] = useState(null);
  const [cabinetQr, setCabinetQr] = useState(null);
  const [cabinetError, setCabinetError] = useState(null);
  const [cabinetLoading, setCabinetLoading] = useState(false);

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

  const openCabinetModal = (document) => {
    setCabinetDoc(document);
    setCabinetRole('parent1');
    setCabinetSession(null);
    setCabinetQr(null);
    setCabinetError(null);
  };

  const closeCabinetModal = () => {
    setCabinetDoc(null);
    setCabinetSession(null);
    setCabinetQr(null);
    setCabinetError(null);
    setCabinetLoading(false);
  };

  const handleCreateCabinetSession = async () => {
    if (!token || !cabinetDoc?.id) {
      setCabinetError('Document indisponible.');
      return;
    }
    setCabinetLoading(true);
    setCabinetError(null);
    try {
      const payload = await createCabinetSignatureSession({
        token,
        documentSignatureId: cabinetDoc.id,
        parentRole: cabinetRole,
      });
      setCabinetSession(payload);
      if (payload?.sign_url) {
        try {
          const qr = await QRCode.toDataURL(payload.sign_url, { width: 180, margin: 1 });
          setCabinetQr(qr);
        } catch (qrErr) {
          setCabinetQr(null);
        }
      }
    } catch (err) {
      setCabinetError(err?.message || 'Creation de session impossible.');
    } finally {
      setCabinetLoading(false);
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
  const orderedTypes = ['authorization', 'consent', 'fees'];
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
              onCabinetSign={() => openCabinetModal(doc)}
            />
          ))}
        </div>
      )}

      {!isExpanded && (
        <div className="text-xs text-slate-500 italic">
          {signedCount} / {sortedDocs.length} signes
        </div>
      )}

      <Modal isOpen={Boolean(cabinetDoc)} onClose={closeCabinetModal}>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Signature en cabinet</h3>
            <p className="text-sm text-slate-500">
              Document : {cabinetDoc?.displayLabel || 'Document'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Choisir le parent</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cabinet-role"
                  value="parent1"
                  checked={cabinetRole === 'parent1'}
                  onChange={() => setCabinetRole('parent1')}
                />
                Parent 1
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cabinet-role"
                  value="parent2"
                  checked={cabinetRole === 'parent2'}
                  onChange={() => setCabinetRole('parent2')}
                />
                Parent 2
              </label>
            </div>
          </div>

          {cabinetError && <div className="alert alert-error">{cabinetError}</div>}

          {!cabinetSession && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateCabinetSession}
              disabled={cabinetLoading}
            >
              {cabinetLoading ? 'Generation...' : 'Generer lien tablette'}
            </button>
          )}

          {cabinetSession && (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">
                Lien tablette :
                <a
                  className="link link-primary break-all ml-2"
                  href={cabinetSession.sign_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cabinetSession.sign_url}
                </a>
              </div>
              {cabinetQr && (
                <img src={cabinetQr} alt="QR code signature" className="w-40 h-40" />
              )}
              {cabinetSession.expires_at && (
                <div className="text-xs text-slate-500">
                  Expiration : {new Date(cabinetSession.expires_at).toLocaleString('fr-FR')}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
