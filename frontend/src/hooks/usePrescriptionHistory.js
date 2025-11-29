import { useEffect, useState } from 'react';

import { fetchPrescriptionHistory } from '../lib/api.js';

export function usePrescriptionHistory({ token, appointmentsOverview = [] }) {
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyRefreshIndex, setHistoryRefreshIndex] = useState(0);

  useEffect(() => {
    const overview = appointmentsOverview || [];
    const appointmentIds = Array.from(new Set(overview.map((entry) => entry.appointment_id).filter(Boolean)));
    if (!token || appointmentIds.length === 0) {
      setPrescriptionHistory([]);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    Promise.all(
      appointmentIds.map((id) =>
        fetchPrescriptionHistory(token, id).catch((err) => {
          throw new Error(err.message || 'Historique indisponible');
        }),
      ),
    )
      .then((allHistories) => {
        if (cancelled) return;
        setPrescriptionHistory(allHistories.flat());
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(err.message || "Impossible de charger l'historique.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, appointmentsOverview, historyRefreshIndex]);

  const triggerHistoryRefresh = () => {
    setHistoryRefreshIndex((prev) => prev + 1);
  };

  return {
    prescriptionHistory,
    historyLoading,
    historyError,
    triggerHistoryRefresh,
  };
}
