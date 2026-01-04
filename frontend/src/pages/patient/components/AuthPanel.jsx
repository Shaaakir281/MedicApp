import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';

import { Button, Card, InputField, SectionHeading, PasswordStrengthMeter } from '../../../components/ui';
import { MIN_LENGTH, validatePasswordPolicy } from '../../../lib/passwordStrength.js';

const loginSchema = z.object({
  login_email: z.string().email('Email invalide'),
  login_password: z.string().min(1, 'Mot de passe requis'),
});

const registerSchema = z
  .object({
    register_email: z.string().email('Email invalide'),
    register_password: z
      .string()
      .min(MIN_LENGTH, `Au moins ${MIN_LENGTH} caractères`)
      .refine((value) => validatePasswordPolicy(value), {
        message: 'Maj + min + chiffre + caractère spécial requis',
      }),
    register_password_confirm: z.string().min(MIN_LENGTH, `Au moins ${MIN_LENGTH} caractères`),
  })
  .refine((data) => data.register_password === data.register_password_confirm, {
    path: ['register_password_confirm'],
    message: 'Les mots de passe doivent correspondre',
  });

export function AuthPanel({ onLogin, onRegister, loading, registerFeedback, error }) {
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { login_email: '', login_password: '' },
  });
  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { register_email: '', register_password: '', register_password_confirm: '' },
  });
  const watchedPassword = registerForm.watch('register_password');

  const {
    handleSubmit: handleLoginSubmit,
    register: registerLogin,
    formState: { errors: loginErrors },
    reset: resetLogin,
  } = loginForm;
  const {
    handleSubmit: handleRegisterSubmit,
    register: registerRegister,
    formState: { errors: registerErrors },
    reset: resetRegister,
  } = registerForm;

  const submitLogin = handleLoginSubmit(async (values) => {
    const success = await onLogin({
      email: values.login_email,
      password: values.login_password,
    });
    if (success) {
      resetLogin();
    }
  });

  const submitRegister = handleRegisterSubmit(async (values) => {
    const success = await onRegister({
      email: values.register_email,
      password: values.register_password,
      password_confirm: values.register_password_confirm,
    });
    if (success) {
      resetRegister();
    }
  });

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <Card className="space-y-4">
        <SectionHeading title="Créer un compte patient" />
        <form id="registration-form" className="space-y-3" onSubmit={submitRegister} noValidate>
          <InputField
            label="Email"
            type="email"
            id="register-email"
            autoComplete="email"
            {...registerRegister('register_email')}
            error={registerErrors.register_email?.message}
            required
          />
          <InputField
            label="Mot de passe"
            type="password"
            id="register-password"
            autoComplete="new-password"
            showVisibilityCheckbox
            {...registerRegister('register_password')}
            error={registerErrors.register_password?.message}
            required
          >
            <PasswordStrengthMeter value={watchedPassword} />
          </InputField>
          <InputField
            label="Confirmer le mot de passe"
            type="password"
            id="register-password-confirm"
            autoComplete="new-password"
            showVisibilityCheckbox
            {...registerRegister('register_password_confirm')}
            error={registerErrors.register_password_confirm?.message}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'En cours...' : 'Inscription'}
          </Button>
        </form>
        {registerFeedback && (
          <p
            className={`text-sm ${
              registerFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {registerFeedback.message}
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <SectionHeading title="Se connecter" />
        <form id="login-form" className="space-y-3" onSubmit={submitLogin} noValidate>
          <InputField
            label="Email"
            type="email"
            id="login-email"
            autoComplete="username"
            {...registerLogin('login_email')}
            error={loginErrors.login_email?.message}
            required
          />
          <InputField
            label="Mot de passe"
            type="password"
            id="login-password"
            autoComplete="current-password"
            showVisibilityCheckbox
            {...registerLogin('login_password')}
            error={loginErrors.login_password?.message}
            required
          />
          <div className="text-right">
            <Link to="/mot-de-passe-oublie" className="text-xs text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
            {loading ? 'Connexion...' : 'Connexion'}
          </Button>
        </form>
        <div className="space-y-1 text-xs text-slate-500">
          <p>Après l&apos;inscription, validez votre adresse via le lien reçu par e-mail (vérifiez vos spams).</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>
    </section>
  );
}
