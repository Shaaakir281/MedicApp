import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button, Card, InputField, SectionHeading, PasswordStrengthMeter } from '../components/ui';
import { MIN_LENGTH, validatePasswordPolicy } from '../lib/passwordStrength.js';
import { resetPassword } from '../lib/api.js';

const makeSchema = (prefilledToken) =>
  z
    .object({
      token: z.string().min(1, 'Token requis'),
      new_password: z
        .string()
        .min(MIN_LENGTH, `Au moins ${MIN_LENGTH} caracteres`)
        .refine((value) => validatePasswordPolicy(value), {
          message: 'Maj + min + chiffre + caractere special requis',
        }),
      new_password_confirm: z.string().min(MIN_LENGTH, `Au moins ${MIN_LENGTH} caracteres`),
    })
    .refine((data) => data.new_password === data.new_password_confirm, {
      path: ['new_password_confirm'],
      message: 'Les mots de passe doivent correspondre',
    })
    .transform((data) => ({
      token: prefilledToken || data.token,
      new_password: data.new_password,
      new_password_confirm: data.new_password_confirm,
    }));

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const schema = useMemo(() => makeSchema(tokenFromUrl), [tokenFromUrl]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { token: tokenFromUrl, new_password: '', new_password_confirm: '' },
  });

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const passwordValue = watch('new_password');

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setStatus(null);
    try {
      await resetPassword({
        token: values.token,
        new_password: values.new_password,
        new_password_confirm: values.new_password_confirm,
      });
      setStatus({ type: 'success', message: 'Mot de passe mis à jour. Vous pouvez vous reconnecter.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Réinitialisation impossible.' });
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="max-w-lg mx-auto">
      <Card className="space-y-4">
        <SectionHeading
          title="Définir un nouveau mot de passe"
          subtitle="Choisissez un mot de passe sécurisé pour accéder à votre compte."
        />
        <form className="space-y-3" onSubmit={onSubmit} noValidate>
          {!tokenFromUrl && (
            <InputField
              label="Token de réinitialisation"
              type="text"
              autoComplete="off"
              {...register('token')}
              error={errors.token?.message}
              required
            />
          )}
          <InputField
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            showVisibilityCheckbox
            {...register('new_password')}
            error={errors.new_password?.message}
            required
          >
            <PasswordStrengthMeter value={passwordValue} />
          </InputField>
          <InputField
            label="Confirmer le mot de passe"
            type="password"
            autoComplete="new-password"
            showVisibilityCheckbox
            {...register('new_password_confirm')}
            error={errors.new_password_confirm?.message}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Mise à jour...' : 'Valider'}
          </Button>
        </form>
        {status && (
          <div className="space-y-2">
            <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {status.message}
            </p>
            {status.type === 'success' && (
              <Link to="/patient" className="inline-block">
                <Button type="button" variant="secondary">
                  Se connecter
                </Button>
              </Link>
            )}
          </div>
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
