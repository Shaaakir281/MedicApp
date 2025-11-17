import React, { useState } from 'react';
import { Card, InputField, SectionHeading, Button } from '../../../components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Praticien #1', email: 'praticien.demo1@demo.medicapp', password: 'password' },
  { label: 'Praticien #2', email: 'praticien.demo2@demo.medicapp', password: 'password' },
];

export function PractitionerLogin({ onSubmit, loading, error }) {
  const [form, setForm] = useState({ email: DEMO_ACCOUNTS[0].email, password: DEMO_ACCOUNTS[0].password });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <Card className="max-w-md mx-auto space-y-6">
      <SectionHeading
        title="Connexion praticien"
        subtitle="Choisissez un compte de démonstration pour accéder au tableau de bord."
      />
      <div className="flex flex-wrap gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            type="button"
            key={account.email}
            className={`btn btn-xs ${form.email === account.email ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setForm({ email: account.email, password: account.password })}
          >
            {account.label}
          </button>
        ))}
      </div>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <InputField
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="username"
          required
        />
        <InputField
          label="Mot de passe"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          autoComplete="current-password"
          showVisibilityCheckbox
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </Button>
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      </form>
    </Card>
  );
}
