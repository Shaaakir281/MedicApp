import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Button, Card, SectionHeading } from '../components/ui';
import { verifyGuardianEmailToken } from '../lib/api.js';

const STATUS_META = {
  idle: {
    badge: 'En cours',
    title: "Verification de l'email parent",
    helper: 'Nous confirmons votre adresse e-mail. Merci de patienter.',
  },
  success: {
    badge: 'Valide',
    title: 'Email parent verifie',
    helper: 'Verification effectuee. Vous pouvez revenir sur votre dossier patient.',
  },
  error: {
    badge: 'Erreur',
    title: 'Lien invalide',
    helper: 'Ce lien est expire ou incorrect. Demandez un nouveau lien.',
  },
};

const TONE_STYLES = {
  idle: {
    badge: 'badge badge-info',
    panel: 'border-sky-200 bg-sky-50',
    icon: 'text-sky-600 bg-white',
  },
  success: {
    badge: 'badge badge-success',
    panel: 'border-green-200 bg-green-50',
    icon: 'text-green-700 bg-white',
  },
  error: {
    badge: 'badge badge-error',
    panel: 'border-rose-200 bg-rose-50',
    icon: 'text-rose-600 bg-white',
  },
};

function StatusIcon({ tone }) {
  const iconClass = `h-10 w-10 rounded-full flex items-center justify-center ${TONE_STYLES[tone].icon}`;
  if (tone === 'success') {
    return (
      <div className={iconClass}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.415 0l-3.2-3.2a1 1 0 011.414-1.414l2.493 2.493 6.493-6.493a1 1 0 011.415 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }
  if (tone === 'error') {
    return (
      <div className={iconClass}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.707-10.707a1 1 0 00-1.414-1.414L10 7.586 8.707 6.293a1 1 0 00-1.414 1.414L8.586 9l-1.293 1.293a1 1 0 001.414 1.414L10 10.414l1.293 1.293a1 1 0 001.414-1.414L11.414 9l1.293-1.293z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }
  return (
    <div className={iconClass}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9 9a1 1 0 102 0V7a1 1 0 10-2 0v2zm1 5a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

export default function VerifyGuardianEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const guardianId = searchParams.get('guardian_id') || '';
  const [status, setStatus] = useState({ type: 'idle', message: 'Verification en cours...' });
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (hasRequestedRef.current) return;
    if (!token || !guardianId) {
      setStatus({ type: 'error', message: 'Lien incomplet.' });
      return;
    }
    hasRequestedRef.current = true;
    verifyGuardianEmailToken({ guardianId, token })
      .then(() => {
        setStatus({ type: 'success', message: 'Adresse email validee.' });
      })
      .catch((error) => {
        const message = String(error?.message || '').toLowerCase();
        if (message.includes('deja utilise')) {
          setStatus({ type: 'success', message: 'Adresse email deja verifiee.' });
          return;
        }
        setStatus({ type: 'error', message: error?.message || 'Lien expire ou invalide.' });
      });
  }, [guardianId, token]);

  const statusTone = useMemo(() => {
    if (status.type === 'success') return 'success';
    if (status.type === 'error') return 'error';
    return 'idle';
  }, [status.type]);

  const meta = STATUS_META[statusTone];
  const styles = TONE_STYLES[statusTone];

  return (
    <div className="max-w-xl mx-auto">
      <Card className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <SectionHeading title={meta.title} subtitle={meta.helper} />
          <span className={styles.badge}>{meta.badge}</span>
        </div>

        <div className={`flex gap-4 rounded-2xl border p-4 ${styles.panel}`}>
          <StatusIcon tone={statusTone} />
          <div className="space-y-1">
            <p className="text-sm text-slate-700">{status.message}</p>
            <p className="text-xs text-slate-500">
              Vous pouvez fermer cet ecran une fois la validation terminee.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/patient" className="flex-1">
            <Button type="button" className="w-full" variant="secondary">
              Retour patient
            </Button>
          </Link>
          <Link to="/guide?topic=signature-distance" className="flex-1">
            <Button type="button" className="w-full">
              En savoir plus
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
