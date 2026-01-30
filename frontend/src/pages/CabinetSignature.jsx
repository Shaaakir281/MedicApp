import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import SignaturePad from '../components/SignaturePad.jsx';
import {
  fetchCabinetSignatureStatus,
  uploadCabinetSignature,
} from '../services/cabinetSignature.api.js';

const formatRole = (value) => {
  if (value === 'parent1') return 'Parent 1';
  if (value === 'parent2') return 'Parent 2';
  return value || 'Signataire';
};

const formatDocument = (value) => {
  if (value === 'authorization') return 'Autorisation parentale';
  if (value === 'consent') return 'Consentement eclaire';
  if (value === 'fees') return 'Frais et honoraires';
  return value || 'Document';
};

const getDeviceId = () => {
  const key = 'cabinet-device-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const generated = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  localStorage.setItem(key, generated);
  return generated;
};

export default function CabinetSignature() {
  const { token } = useParams();
  const [signatureBase64, setSignatureBase64] = useState(null);
  const [consentConfirmed, setConsentConfirmed] = useState(true);
  const [localError, setLocalError] = useState(null);
  const [padWidth, setPadWidth] = useState(() => {
    if (typeof window === 'undefined') return 520;
    return Math.min(520, window.innerWidth - 32);
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setPadWidth(Math.min(520, window.innerWidth - 32));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const statusQuery = useQuery({
    queryKey: ['cabinet-signature', token],
    queryFn: () => fetchCabinetSignatureStatus(token),
    enabled: Boolean(token),
  });

  const uploadMutation = useMutation({
    mutationFn: (payload) => uploadCabinetSignature(payload),
    onSuccess: () => {
      setLocalError(null);
      statusQuery.refetch();
    },
    onError: (err) => {
      setLocalError(err?.message || 'Signature impossible.');
    },
  });

  const sessionInfo = statusQuery.data;
  const isValid = Boolean(sessionInfo?.valid);
  const isCompleted = Boolean(sessionInfo?.completed_at);

  const submitDisabled = !signatureBase64 || !consentConfirmed || uploadMutation.isLoading;

  const handleSubmit = () => {
    if (!signatureBase64) {
      setLocalError('Veuillez signer dans le cadre.');
      return;
    }
    if (!consentConfirmed) {
      setLocalError('Veuillez confirmer votre consentement.');
      return;
    }
    uploadMutation.mutate({
      token,
      signatureBase64,
      consentConfirmed,
      deviceId: getDeviceId(),
    });
  };

  if (statusQuery.isLoading) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        <span className="loading loading-spinner loading-md" />
        <p className="text-slate-600">Chargement de la session…</p>
      </div>
    );
  }

  if (statusQuery.error) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        <div className="alert alert-error">{statusQuery.error.message}</div>
      </div>
    );
  }

  if (!sessionInfo) {
    return null;
  }

  if (!isValid || isCompleted) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <div className="alert alert-info">
          Cette session est expirée ou déjà utilisée.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Signature en cabinet</h1>
        <p className="text-sm text-slate-600">
          {formatDocument(sessionInfo.document_type)} • {formatRole(sessionInfo.parent_role)}
        </p>
        {sessionInfo.patient_name && (
          <p className="text-sm text-slate-500">Patient : {sessionInfo.patient_name}</p>
        )}
        {sessionInfo.expires_at && (
          <p className="text-xs text-slate-500">
            Expiration : {new Date(sessionInfo.expires_at).toLocaleString('fr-FR')}
          </p>
        )}
      </div>

      <SignaturePad
        width={padWidth}
        height={220}
        onSignatureCapture={(value) => {
          setSignatureBase64(value);
          setLocalError(null);
        }}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={consentConfirmed}
          onChange={(e) => setConsentConfirmed(e.target.checked)}
        />
        Je confirme que cette signature est la mienne.
      </label>

      {localError && <div className="alert alert-error">{localError}</div>}
      {uploadMutation.isSuccess && (
        <div className="alert alert-success">Signature enregistrée ✓</div>
      )}

      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={handleSubmit}
        disabled={submitDisabled}
      >
        {uploadMutation.isLoading ? 'Enregistrement…' : 'Valider ma signature'}
      </button>
    </div>
  );
}
