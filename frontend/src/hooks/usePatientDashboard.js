import { useCallback, useEffect, useState } from 'react';

import { fetchPatientDashboard } from '../lib/api.js';

export function usePatientDashboard({ token, appointmentId }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!appointmentId || !token) {
      setDashboard(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchPatientDashboard(appointmentId, token);
      setDashboard(payload);
    } catch (err) {
      setError(err?.message || 'Impossible de charger le tableau de bord patient.');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { dashboard, loading, error, reload, setDashboard };
}
