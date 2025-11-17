import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';

import { Card, InputField, Button, SectionHeading } from '../components/ui';
import { requestPasswordReset } from '../lib/api.js';

const schema = z.object({
  email: z.string().email('Email invalide'),
});

export default function ForgotPassword() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = handleSubmit(async ({ email }) => {
    setLoading(true);
    setStatus(null);
    try {
      await requestPasswordReset(email);
      setStatus({
        type: 'success',
        message:
          "Si un compte existe, un e-mail de réinitialisation a été envoyé. Vérifiez votre boîte de réception et les spams.",
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Impossible d’envoyer l’e-mail.' });
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="max-w-lg mx-auto">
      <Card className="space-y-4">
        <SectionHeading title="Mot de passe oublié" subtitle="Recevez un lien de réinitialisation." />
        <form className="space-y-3" onSubmit={onSubmit} noValidate>
          <InputField
            label="Email"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
          </Button>
        </form>
        {status && (
          <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {status.message}
          </p>
        )}
        <div className="flex gap-3 text-sm">
          <Link to="/patient" className="text-primary hover:underline">
            Retour patient
          </Link>
          <Link to="/praticien" className="text-primary hover:underline">
            Retour praticien
          </Link>
        </div>
      </Card>
    </div>
  );
}
