import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { LegalChecklist } from '../components/LegalChecklist.jsx';
import { getCabinetSession, startSignature } from '../lib/api.js';

const roleLabel = (role) => {
  if (role === 'parent1') return 'Parent 1';
  if (role === 'parent2') return 'Parent 2';
  return role || 'Signataire';
};

const TabletSession = () => {
  const { sessionCode } = useParams();
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [legalStatus, setLegalStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!sessionCode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCabinetSession(sessionCode)
      .then((payload) => {
        if (cancelled) return;
        setSessionInfo(payload);
        setLegalStatus(payload?.legal_status || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Session introuvable ou expirée.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionCode]);

  const handleStartSignature = async () => {
    if (!sessionInfo?.appointment_id || !sessionInfo?.signer_role) return;
    setSigning(true);
    setError(null);
    try {
      const response = await startSignature(null, {
        appointmentId: sessionInfo.appointment_id,
        signerRole: sessionInfo.signer_role,
        mode: 'cabinet',
        sessionCode,
      });
      const link = response?.signature_link;
      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
      } else {
        setError("Lien de signature indisponible.");
      }
    } catch (err) {
      setError(err?.message || 'Echec du démarrage de la signature.');
    } finally {
      setSigning(false);
    }
  };

  const readyToSign = Boolean(legalStatus?.complete);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="loading loading-spinner loading-md" />
          <p className="text-slate-600">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <p className="text-red-600">{error}</p>
        <button type="button" className="btn" onClick={() => navigate('/')}>
          Retour
        </button>
      </div>
    );
  }

  if (!sessionInfo) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Signature en cabinet</h1>
          <p className="text-sm text-slate-600">
            Session pour {roleLabel(sessionInfo.signer_role)} —{' '}
            {sessionInfo.child_full_name || 'Patient'}
          </p>
        </div>
        <div className="text-sm text-slate-600">
          <p>Code session : <span className="font-mono">{sessionCode}</span></p>
          <p>Expiration : {sessionInfo.expires_at ? new Date(sessionInfo.expires_at).toLocaleTimeString('fr-FR') : '—'}</p>
        </div>
      </header>

      <div className="border rounded-xl p-4 bg-white shadow-sm">
        <LegalChecklist
          appointmentId={sessionInfo.appointment_id}
          sessionCode={sessionCode}
          fixedRole={sessionInfo.signer_role}
          onStatusChange={setLegalStatus}
        />
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          className={`btn ${readyToSign ? 'btn-primary' : 'btn-disabled'}`}
          onClick={handleStartSignature}
          disabled={!readyToSign || signing}
        >
          {signing ? 'Ouverture...' : 'Signer maintenant'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
          Terminer
        </button>
      </div>
    </div>
  );
};

export default TabletSession;
