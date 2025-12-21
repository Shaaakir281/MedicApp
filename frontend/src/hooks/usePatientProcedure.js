import { useCallback, useEffect, useState } from 'react';

import {
  acknowledgeProcedureSteps,
  fetchCurrentProcedure,
  fetchProcedureInfo,
  saveProcedure,
  sendConsentLink,
} from '../lib/api.js';
import { defaultProcedureValues } from '../lib/forms';

const splitChildFullName = (fullName) => {
  const cleaned = String(fullName || '').trim();
  if (!cleaned) return { firstName: '', lastName: '' };
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) };
};

const joinChildName = (firstName, lastName) => {
  return [String(firstName || '').trim(), String(lastName || '').trim()]
    .filter(Boolean)
    .join(' ');
};

const mapProcedureToFormValues = (procedure) => {
  const { firstName, lastName } = splitChildFullName(procedure?.child_full_name);
  return {
    child_first_name: firstName,
    child_last_name: lastName,
    child_birthdate: procedure?.child_birthdate ?? '',
    child_weight_kg:
      typeof procedure?.child_weight_kg === 'number' ? String(procedure.child_weight_kg) : '',
    parent1_name: procedure?.parent1_name ?? '',
    parent1_email: procedure?.parent1_email ?? '',
    parent2_name: procedure?.parent2_name ?? '',
    parent2_email: procedure?.parent2_email ?? '',
    parent1_phone: procedure?.parent1_phone ?? '',
    parent2_phone: procedure?.parent2_phone ?? '',
    parent1_sms_optin: Boolean(procedure?.parent1_sms_optin),
    parent2_sms_optin: Boolean(procedure?.parent2_sms_optin),
    parental_authority_ack: Boolean(procedure?.parental_authority_ack),
    notes: procedure?.notes ?? '',
  };
};

export function usePatientProcedure({
  token,
  isAuthenticated,
  procedureSelection,
  resetForm,
  setError,
  setSuccessMessage,
}) {
  const [procedureInfo, setProcedureInfo] = useState(null);
  const [procedureCase, setProcedureCase] = useState(null);
  const [procedureLoading, setProcedureLoading] = useState(false);
  const [sendingConsentEmail, setSendingConsentEmail] = useState(false);
  const [isEditingCase, setIsEditingCase] = useState(false);
  const [stepsChecked, setStepsChecked] = useState(false);
  const [stepsAcknowledged, setStepsAcknowledged] = useState(false);
  const [stepsSubmitting, setStepsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || procedureSelection !== 'circumcision') {
      setProcedureInfo(null);
      setProcedureCase(null);
      setIsEditingCase(false);
      setStepsAcknowledged(false);
      setStepsChecked(false);
      resetForm(defaultProcedureValues);
    }
  }, [isAuthenticated, procedureSelection, resetForm]);

  useEffect(() => {
    if (!isAuthenticated || procedureSelection !== 'circumcision') {
      return undefined;
    }
    let cancelled = false;
    fetchProcedureInfo()
      .then((info) => {
        if (!cancelled) {
          setProcedureInfo(info);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, procedureSelection]);

  useEffect(() => {
    if (procedureSelection === 'circumcision' && procedureCase) {
      const ack = Boolean(procedureCase.steps_acknowledged);
      setStepsAcknowledged(ack);
      setStepsChecked(ack);
    } else if (procedureSelection !== 'circumcision') {
      setStepsAcknowledged(false);
      setStepsChecked(false);
    }
  }, [procedureCase, procedureSelection]);

  const loadProcedureCase = useCallback(async () => {
    if (!token || procedureSelection !== 'circumcision') {
      return;
    }
    setProcedureLoading(true);
    try {
      const current = await fetchCurrentProcedure(token);
      setProcedureCase(current);
      if (current) {
        resetForm(mapProcedureToFormValues(current));
        setIsEditingCase(false);
      } else {
        resetForm(defaultProcedureValues);
        setIsEditingCase(true);
      }
    } catch (err) {
      setError?.(err.message);
    } finally {
      setProcedureLoading(false);
    }
  }, [token, procedureSelection, resetForm, setError]);

  useEffect(() => {
    if (isAuthenticated && procedureSelection === 'circumcision') {
      loadProcedureCase();
    } else if (!isAuthenticated || procedureSelection !== 'circumcision') {
      setProcedureCase(null);
      resetForm(defaultProcedureValues);
    }
  }, [isAuthenticated, procedureSelection, loadProcedureCase, resetForm]);

  const handleProcedureSubmit = useCallback(
    async (values) => {
      if (!token || procedureSelection !== 'circumcision') {
        setError?.(
          "Veuillez sélectionner la circoncision et vous connecter avant d'enregistrer le dossier.",
        );
        return;
      }
      setError?.(null);
      setProcedureLoading(true);
      try {
        const { child_first_name: firstName, child_last_name: lastName, ...rest } = values;
        const payload = {
          procedure_type: 'circumcision',
          ...rest,
          child_full_name: joinChildName(firstName, lastName),
        };
        const caseData = await saveProcedure(token, payload);
        setProcedureCase(caseData);
        resetForm(mapProcedureToFormValues(caseData));
        setSuccessMessage?.(
          'Dossier mis à jour. Un consentement pré-rempli est disponible au téléchargement.',
        );
        setIsEditingCase(false);
      } catch (err) {
        setError?.(err.message);
      } finally {
        setProcedureLoading(false);
      }
    },
    [token, procedureSelection, resetForm, setError, setSuccessMessage],
  );

  const handleSendConsentEmail = useCallback(async () => {
    if (!token || sendingConsentEmail) {
      return;
    }
    setError?.(null);
    setSendingConsentEmail(true);
    try {
      await sendConsentLink(token);
      setSuccessMessage?.('Lien de consentement envoyé par e-mail.');
    } catch (err) {
      setError?.(err.message);
    } finally {
      setSendingConsentEmail(false);
    }
  }, [token, sendingConsentEmail, setError, setSuccessMessage]);

  const acknowledgeSteps = useCallback(async () => {
    setStepsSubmitting(true);
    try {
      if (token) {
        await acknowledgeProcedureSteps(token);
      }
      setStepsAcknowledged(true);
      setStepsChecked(true);
    } catch (err) {
      setError?.(err.message);
    } finally {
      setStepsSubmitting(false);
    }
  }, [token, setError]);

  return {
    procedureInfo,
    procedureCase,
    procedureLoading,
    sendingConsentEmail,
    isEditingCase,
    setIsEditingCase,
    stepsChecked,
    stepsAcknowledged,
    stepsSubmitting,
    setStepsChecked,
    loadProcedureCase,
    handleProcedureSubmit,
    handleSendConsentEmail,
    acknowledgeSteps,
  };
}

