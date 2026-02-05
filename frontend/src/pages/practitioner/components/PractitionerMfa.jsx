import React, { useEffect, useState } from 'react';
import { Card, InputField, SectionHeading, Button } from '../../../components/ui';

export function PractitionerMfa({
  email,
  phone,
  onSend,
  onVerify,
  onCancel,
  loading,
  error,
  message,
}) {
  const [code, setCode] = useState('');
  const [phoneValue, setPhoneValue] = useState(phone || '');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    setPhoneValue(phone || '');
  }, [phone]);

  const normalizePhone = (raw) => {
    const cleaned = String(raw || '').trim().replace(/[\s().-]/g, '');
    if (!cleaned) return { value: '', error: '' };

    let normalized = cleaned;
    if (cleaned.startsWith('+')) {
      normalized = cleaned;
    } else if (cleaned.startsWith('00')) {
      normalized = `+${cleaned.slice(2)}`;
    } else if (cleaned.startsWith('0')) {
      normalized = `+33${cleaned.slice(1)}`;
    } else if (cleaned.startsWith('33')) {
      normalized = `+${cleaned}`;
    }

    if (!/^\+\d{8,15}$/.test(normalized)) {
      return { value: normalized, error: 'Format invalide. Exemple : +33600000000' };
    }

    return { value: normalized, error: '' };
  };

  const handleSend = async () => {
    const trimmed = phoneValue.trim();
    const { value, error } = normalizePhone(trimmed);
    if (error) {
      setPhoneError(error);
      return;
    }
    setPhoneError('');
    await onSend(value || undefined);
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    await onVerify(trimmed);
  };

  return (
    <Card className="max-w-md mx-auto space-y-6">
      <SectionHeading
        title="Verification MFA"
        subtitle="Un code de securite est requis pour acceder a l'espace praticien."
      />
      <div className="text-sm text-slate-600 space-y-1">
        <p>Compte : {email || '-'}</p>
        {message && <p className="text-emerald-600">{message}</p>}
      </div>
      <div className="space-y-3">
        <InputField
          label="Numero de telephone"
          type="tel"
          name="mfa_phone"
          value={phoneValue}
          onChange={(event) => setPhoneValue(event.target.value)}
          placeholder="+33600000000"
        />
        {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
        <Button type="button" className="w-full" onClick={handleSend} disabled={loading}>
          {loading ? 'Envoi...' : phoneValue ? 'Renvoyer le code' : 'Envoyer le code'}
        </Button>
      </div>
      <form className="space-y-4" onSubmit={handleVerify} noValidate>
        <InputField
          label="Code MFA"
          type="text"
          name="mfa_code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456"
          maxLength={6}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Verification...' : 'Valider'}
        </Button>
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onCancel}>
          Retour a la connexion
        </button>
      </form>
    </Card>
  );
}
