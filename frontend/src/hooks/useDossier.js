import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchDossier,
  saveDossier,
  sendGuardianVerification,
  verifyGuardianCode,
  sendGuardianEmailVerification,
} from '../services/dossier.api.js';
import { formToPayload, toDossierVM, vmToForm } from '../services/dossier.mapper.js';

const GUARDIAN_ROLES = ['PARENT_1', 'PARENT_2'];

const hasValue = (value) => Boolean(String(value || '').trim());

const isFormComplete = (form) =>
  Boolean(
    form &&
      hasValue(form.childFirstName) &&
      hasValue(form.childLastName) &&
      hasValue(form.birthDate) &&
      hasValue(form.parent1FirstName) &&
      hasValue(form.parent1LastName) &&
      hasValue(form.parent1Email),
  );

const mergeVerificationState = (prevState, nextState) => {
  const prevStep = prevState?.step || 'idle';
  const nextStep = nextState?.step || 'idle';
  if (nextStep === 'verified') return nextState;
  if (prevStep === 'verified') return prevState;
  if (prevStep === 'sent' && nextStep === 'idle') return prevState;
  return nextState || prevState || { step: 'idle' };
};

const mergeVerification = (prevVerification, nextVerification) => {
  const merged = { ...(nextVerification || {}) };
  GUARDIAN_ROLES.forEach((role) => {
    merged[role] = mergeVerificationState(prevVerification?.[role], nextVerification?.[role]);
  });
  return merged;
};

const mergeGuardian = (prevGuardian, nextGuardian) => {
  if (!prevGuardian) return nextGuardian;
  if (!nextGuardian) return prevGuardian;
  return {
    ...nextGuardian,
    phoneVerifiedAt: nextGuardian.phoneVerifiedAt || prevGuardian.phoneVerifiedAt,
    emailVerifiedAt: nextGuardian.emailVerifiedAt || prevGuardian.emailVerifiedAt,
    emailSentAt: nextGuardian.emailSentAt || prevGuardian.emailSentAt,
    phoneE164: nextGuardian.phoneE164 || prevGuardian.phoneE164,
    email: nextGuardian.email || prevGuardian.email,
  };
};

const mergeGuardians = (prevGuardians, nextGuardians) => {
  const merged = { ...(nextGuardians || {}) };
  GUARDIAN_ROLES.forEach((role) => {
    merged[role] = mergeGuardian(prevGuardians?.[role], nextGuardians?.[role]);
  });
  return merged;
};

const mergeVm = (prevVm, nextVm) => {
  if (!prevVm) return nextVm;
  return {
    ...nextVm,
    guardians: mergeGuardians(prevVm.guardians, nextVm.guardians),
    verification: mergeVerification(prevVm.verification, nextVm.verification),
  };
};

const preserveAcknowledgement = (prevForm, nextForm) => {
  if (!prevForm || typeof prevForm.procedure_info_acknowledged !== 'boolean') {
    return nextForm;
  }
  return {
    ...nextForm,
    procedure_info_acknowledged: prevForm.procedure_info_acknowledged,
  };
};

export function useDossier({ token }) {
  const [vm, setVm] = useState(null);
  const [formState, setFormState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const isEditingRef = useRef(isEditing);
  const vmRef = useRef(vm);
  const autoEditRef = useRef(false);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    vmRef.current = vm;
  }, [vm]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDossier({ token });
      const nextVm = toDossierVM(data);
      const mergedVm = mergeVm(vmRef.current, nextVm);
      setVm(mergedVm);
      const nextForm = vmToForm(mergedVm);
      setFormState((prev) => {
        if (isEditingRef.current && prev) {
          return prev;
        }
        return preserveAcknowledgement(prev, nextForm);
      });
      if (!autoEditRef.current) {
        setIsEditing(!isFormComplete(nextForm));
        autoEditRef.current = true;
      }
    } catch (err) {
      setError(err?.message || 'Impossible de charger le dossier.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return undefined;
    const interval = setInterval(() => {
      load();
    }, 30000);
    return () => clearInterval(interval);
  }, [token, load]);

  const updateForm = (field, value) => {
    setFormState((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const autoSaveForVerification = async () => {
    if (!token || !formState) return null;
    const requiredFields = [
      ['Prenom enfant', formState.childFirstName],
      ['Nom enfant', formState.childLastName],
      ['Date de naissance', formState.birthDate],
      ['Prenom parent 1', formState.parent1FirstName],
      ['Nom parent 1', formState.parent1LastName],
      ['Email parent 1', formState.parent1Email],
    ];
    const missing = requiredFields.filter(([, val]) => !String(val || '').trim()).map(([label]) => label);
    if (missing.length) {
      setError(`Pour verifier l'email, completez d'abord : ${missing.join(', ')}`);
      return null;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = formToPayload(formState);
      const data = await saveDossier({ token, payload });
      const nextVm = toDossierVM(data);
      setVm(nextVm);
      vmRef.current = nextVm;
      const updatedForm = vmToForm(nextVm);
      updatedForm.procedure_info_acknowledged = formState.procedure_info_acknowledged;
      setFormState(updatedForm);
      return nextVm;
    } catch (err) {
      setError(err?.message || 'Enregistrement impossible.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!token || !formState) return;
    const requiredFields = [
      ['Prenom enfant', formState.childFirstName],
      ['Nom enfant', formState.childLastName],
      ['Date de naissance', formState.birthDate],
      ['Prenom parent 1', formState.parent1FirstName],
      ['Nom parent 1', formState.parent1LastName],
      ['Email parent 1', formState.parent1Email],
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
      setSuccess('Dossier enregistre.');
      setIsEditing(false);
      isEditingRef.current = false;
    } catch (err) {
      setError(err?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const sendOtp = async (role) => {
    let guardianId = vm?.guardians?.[role]?.id;
    if (!guardianId) {
      const nextVm = await autoSaveForVerification();
      guardianId = nextVm?.guardians?.[role]?.id;
    }
    if (!guardianId) {
      setError('Identifiant parent manquant.');
      return;
    }
    const phoneField = role === 'PARENT_2' ? 'parent2Phone' : 'parent1Phone';
    const phoneE164 = String(formState?.[phoneField] || vm?.guardians?.[role]?.phoneE164 || '').trim();
    if (!phoneE164 || !/^\+\d{10,15}$/.test(phoneE164)) {
      setError('Numéro de téléphone invalide. Format requis: +33612345678');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const resp = await sendGuardianVerification({
        token,
        guardianId,
        phoneE164,
      });
      setVm((prev) => {
        const nextVm = {
          ...(prev || {}),
          verification: {
            ...(prev?.verification || {}),
            [role]: {
              step: 'sent',
              sentAt: new Date().toISOString(),
              expiresInSec: resp.expires_in_sec,
              cooldownSec: resp.cooldown_sec,
            },
          },
          guardians: {
            ...(prev?.guardians || {}),
            [role]: {
              ...(prev?.guardians?.[role] || {}),
              phoneE164,
            },
          },
        };
        vmRef.current = nextVm;
        return nextVm;
      });
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
      setVm((prev) => {
        const verifiedAt = resp.verified_at || new Date().toISOString();
        const nextVm = {
          ...(prev || {}),
          verification: {
            ...(prev?.verification || {}),
            [role]: { step: 'verified', verifiedAt },
          },
          guardians: {
            ...(prev?.guardians || {}),
            [role]: {
              ...(prev?.guardians?.[role] || {}),
              phoneVerifiedAt: verifiedAt,
            },
          },
        };
        vmRef.current = nextVm;
        return nextVm;
      });
      setSuccess('Téléphone vérifié.');
    } catch (err) {
      setError(err?.message || 'Vérification impossible.');
    }
  };

  const sendEmailVerification = async (role) => {
    let guardianId = vm?.guardians?.[role]?.id;
    if (!guardianId) {
      const nextVm = await autoSaveForVerification();
      guardianId = nextVm?.guardians?.[role]?.id;
    }
    if (!guardianId) {
      return;
    }
    const emailField = role === 'PARENT_2' ? 'parent2Email' : 'parent1Email';
    const email = String(formState?.[emailField] || vm?.guardians?.[role]?.email || '').trim();
    if (!email) {
      setError("Adresse email manquante.");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const resp = await sendGuardianEmailVerification({
        token,
        guardianId,
        email,
      });
      // Update vm to mark email as sent (pending verification)
      setVm((prev) => {
        const nextVm = {
          ...(prev || {}),
          guardians: {
            ...(prev?.guardians || {}),
            [role]: {
              ...(prev?.guardians?.[role] || {}),
              email,
              emailSentAt: new Date().toISOString(), // Track when email was sent
            },
          },
        };
        vmRef.current = nextVm;
        return nextVm;
      });
      setSuccess(`Email de verification envoye a ${resp.email}`);
    } catch (err) {
      setError(err?.message || "Envoi de l'email impossible.");
    }
  };

  const enableEdit = () => {
    setIsEditing(true);
    isEditingRef.current = true;
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

