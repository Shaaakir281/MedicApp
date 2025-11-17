import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

import { Card, SectionHeading, Button } from '../components/ui';
import { verifyEmailToken } from '../lib/api.js';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState({ type: 'idle', message: 'Vérification en cours...' });

  useEffect(() => {
    if (!token) {
      setStatus({ type: 'error', message: 'Token manquant.' });
      return;
    }
    verifyEmailToken(token)
      .then(() => {
        setStatus({ type: 'success', message: 'Adresse e-mail validée. Connectez-vous.' });
      })
      .catch((error) => {
        setStatus({
          type: 'error',
          message: error?.message || 'Lien expiré ou invalide. Demandez un nouveau lien.',
        });
      });
  }, [token]);

  const isSuccess = status.type === 'success';

  return (
    <div className="max-w-xl mx-auto">
      <Card className="space-y-4">
        <SectionHeading title="Validation de l&apos;e-mail" />
        <p className={`text-sm ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>{status.message}</p>
        {isSuccess && (
          <Link to="/patient" className="inline-block">
            <Button type="button" variant="secondary">
              Se connecter
            </Button>
          </Link>
        )}
        <div className="flex gap-3">
          <Link to="/patient" className="flex-1">
            <Button type="button" className="w-full" variant="secondary">
              Retour patient
            </Button>
          </Link>
          <Link to="/praticien" className="flex-1">
            <Button type="button" className="w-full">
              Accès praticien
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
