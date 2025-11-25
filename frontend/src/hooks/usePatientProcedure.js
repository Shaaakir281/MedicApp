import { useCallback, useEffect, useState } from 'react';

import {
  acknowledgeProcedureSteps,
  fetchCurrentProcedure,
  fetchProcedureInfo,
  saveProcedure,
  sendConsentLink,
} from '../lib/api.js';
import { defaultProcedureValues } from '../lib/forms';

const mapProcedureToFormValues = (procedure) => ({
  child_full_name: procedure?.child_full_name ?? '',
  child_birthdate: procedure?.child_birthdate ?? '',
  child_weight_kg:
    typeof procedure?.child_weight_kg === 'number' ? String(procedure.child_weight_kg) : '',
  parent1_name: procedure?.parent1_name ?? '',
  parent1_email: procedure?.parent1_email ?? '',
  parent2_name: procedure?.parent2_name ?? '',
  parent2_email: procedure?.parent2_email ?? '',
  parental_authority_ack: Boolean(procedure?.parental_authority_ack),
  notes: procedure?.notes ?? '',
});

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
        setError?.("Veuillez sǸlectionner la circoncision et vous connecter avant d'enregistrer le dossier.");
        return;
      }
      setError?.(null);
      setProcedureLoading(true);
      try {
        const payload = {
          procedure_type: 'circumcision',
          ...values,
        };
        const caseData = await saveProcedure(token, payload);
        setProcedureCase(caseData);
        resetForm(mapProcedureToFormValues(caseData));
        setSuccessMessage?.('Dossier mis �� jour. Un consentement prǸ-rempli est disponible au tǸlǸchargement.');
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
      setSuccessMessage?.('Lien de consentement envoyǸ par e-mail.');
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
