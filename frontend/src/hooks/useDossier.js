import { useCallback, useEffect, useState } from 'react';

import {
  fetchDossier,
  saveDossier,
  sendGuardianVerification,
  verifyGuardianCode,
  sendGuardianEmailVerification,
} from '../services/dossier.api.js';
import { formToPayload, toDossierVM, vmToForm } from '../services/dossier.mapper.js';

export function useDossier({ token }) {
  const [vm, setVm] = useState(null);
  const [formState, setFormState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDossier({ token });
      const nextVm = toDossierVM(data);
      setVm(nextVm);
      const form = vmToForm(nextVm);
      // Restore checkbox state from localStorage
      const savedAck = localStorage.getItem('procedure_info_acknowledged');
      if (savedAck === 'true') {
        form.procedure_info_acknowledged = true;
      }
      setFormState(form);
    } catch (err) {
      setError(err?.message || 'Impossible de charger le dossier.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const updateForm = (field, value) => {
    setFormState((prev) => ({ ...(prev || {}), [field]: value }));
    // Save checkbox state to localStorage
    if (field === 'procedure_info_acknowledged') {
      localStorage.setItem('procedure_info_acknowledged', value ? 'true' : 'false');
    }
  };

  const save = async () => {
    if (!token || !formState) return;
    const requiredFields = [
      ['Prénom enfant', formState.childFirstName],
      ['Nom enfant', formState.childLastName],
      ['Date de naissance', formState.birthDate],
      ['Prénom parent 1', formState.parent1FirstName],
      ['Nom parent 1', formState.parent1LastName],
      ['Prénom parent 2', formState.parent2FirstName],
      ['Nom parent 2', formState.parent2LastName],
    ];
    const missing = requiredFields.filter(([, val]) => !String(val || '').trim()).map(([label]) => label);
    if (missing.length) {
      setError(`Champs requis manquants : ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = formToPayload(formState);
      const data = await saveDossier({ token, payload });
      const nextVm = toDossierVM(data);
      setVm(nextVm);
      const updatedForm = vmToForm(nextVm);
      // Preserve checkbox state after save
      updatedForm.procedure_info_acknowledged = formState.procedure_info_acknowledged;
      setFormState(updatedForm);
      setSuccess('Dossier enregistré.');
      setIsEditing(false); // Switch to read-only mode after save
    } catch (err) {
      setError(err?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const sendOtp = async (role) => {
    const guardianId = vm?.guardians?.[role]?.id;
    if (!guardianId) {
      setError('Identifiant parent manquant.');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const resp = await sendGuardianVerification({
        token,
        guardianId,
        phoneE164: vm.guardians[role].phoneE164 || undefined,
      });
      setVm((prev) => ({
        ...(prev || {}),
        verification: {
          ...(prev?.verification || {}),
          [role]: { step: 'sent', expiresInSec: resp.expires_in_sec, cooldownSec: resp.cooldown_sec },
        },
      }));
    } catch (err) {
      setError(err?.message || "Envoi du code impossible.");
    }
  };

  const verifyOtp = async (role, code) => {
    const guardianId = vm?.guardians?.[role]?.id;
    if (!guardianId) {
      setError('Identifiant parent manquant.');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const resp = await verifyGuardianCode({ token, guardianId, code });
      setVm((prev) => ({
        ...(prev || {}),
        verification: {
          ...(prev?.verification || {}),
          [role]: { step: 'verified', verifiedAt: resp.verified_at || new Date().toISOString() },
        },
        guardians: {
          ...(prev?.guardians || {}),
          [role]: {
            ...(prev?.guardians?.[role] || {}),
            phoneVerifiedAt: resp.verified_at || new Date().toISOString(),
          },
        },
      }));
      setSuccess('Téléphone vérifié.');
    } catch (err) {
      setError(err?.message || 'Vérification impossible.');
    }
  };

  const sendEmailVerification = async (role) => {
    const guardianId = vm?.guardians?.[role]?.id;
    if (!guardianId) {
      setError('Identifiant parent manquant.');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const resp = await sendGuardianEmailVerification({
        token,
        guardianId,
        email: vm.guardians[role].email || undefined,
      });
      // Update vm to mark email as sent (pending verification)
      setVm((prev) => ({
        ...(prev || {}),
        guardians: {
          ...(prev?.guardians || {}),
          [role]: {
            ...(prev?.guardians?.[role] || {}),
            emailSentAt: new Date().toISOString(), // Track when email was sent
          },
        },
      }));
      setSuccess(`Email de vérification envoyé à ${resp.email}`);
    } catch (err) {
      setError(err?.message || "Envoi de l'email impossible.");
    }
  };

  const enableEdit = () => {
    setIsEditing(true);
    setError(null);
    setSuccess(null);
  };

  return {
    vm,
    formState,
    setFormState,
    updateForm,
    loading,
    saving,
    error,
    success,
    load,
    save,
    sendOtp,
    verifyOtp,
    sendEmailVerification,
    setError,
    setSuccess,
    isEditing,
    enableEdit,
  };
}
