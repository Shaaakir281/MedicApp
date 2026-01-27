import { useCallback, useEffect, useState } from 'react';

import { fetchCurrentProcedure } from '../lib/api.js';

export function usePatientProcedure({
  token,
  isAuthenticated,
  procedureSelection,
  setError,
}) {
  const [procedureCase, setProcedureCase] = useState(null);
  const [procedureLoading, setProcedureLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || procedureSelection !== 'circumcision') {
      setProcedureCase(null);
    }
  }, [isAuthenticated, procedureSelection]);

  const loadProcedureCase = useCallback(async () => {
    if (!token || procedureSelection !== 'circumcision') {
      return;
    }
    setProcedureLoading(true);
    try {
      const current = await fetchCurrentProcedure(token);
      setProcedureCase(current);
    } catch (err) {
      setError?.(err.message);
    } finally {
      setProcedureLoading(false);
    }
  }, [token, procedureSelection, setError]);

  useEffect(() => {
    if (isAuthenticated && procedureSelection === 'circumcision') {
      loadProcedureCase();
    } else if (!isAuthenticated || procedureSelection !== 'circumcision') {
      setProcedureCase(null);
    }
  }, [isAuthenticated, procedureSelection, loadProcedureCase]);

  return {
    procedureCase,
    procedureLoading,
    loadProcedureCase,
  };
}
