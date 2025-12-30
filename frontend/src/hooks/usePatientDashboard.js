import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchCabinetActiveSessions, fetchPatientDashboard } from '../lib/api.js';

export function usePatientDashboard({ token, appointmentId }) {
  const [dashboard, setDashboard] = useState(null);
  const [cabinetStatus, setCabinetStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);
  const pendingRef = useRef(false);
  const reloadRef = useRef(() => {});

  const reload = useCallback(async () => {
    if (!appointmentId || !token) {
      setDashboard(null);
      setCabinetStatus(null);
      return;
    }
    if (loadingRef.current) {
      pendingRef.current = true;
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchPatientDashboard(appointmentId, token);
      setDashboard(payload);
      try {
        const cabinetPayload = await fetchCabinetActiveSessions(token, appointmentId);
        setCabinetStatus(cabinetPayload);
      } catch (cabinetErr) {
        setCabinetStatus(null);
      }
    } catch (err) {
      setError(err?.message || 'Impossible de charger le tableau de bord patient.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        reloadRef.current();
      }
    }
  }, [appointmentId, token]);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    if (!appointmentId || !token) {
      reload();
      return undefined;
    }
    reload();
    const interval = setInterval(() => {
      reload();
    }, 10000);
    return () => clearInterval(interval);
  }, [appointmentId, token, reload]);

  return { dashboard, cabinetStatus, loading, error, reload, setDashboard };
}
