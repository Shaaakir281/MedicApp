import { useEffect, useState, useMemo, useRef } from 'react';

import { fetchPrescriptionHistory } from '../lib/api.js';

export function usePrescriptionHistory({ token, appointmentsOverview = [] }) {
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyRefreshIndex, setHistoryRefreshIndex] = useState(0);

  // Stabiliser appointmentIds avec une comparaison par valeur (pas par référence)
  const appointmentIds = useMemo(() => {
    const overview = appointmentsOverview || [];
    return Array.from(new Set(overview.map((entry) => entry.appointment_id).filter(Boolean)));
  }, [JSON.stringify(appointmentsOverview)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Garder une référence stable des IDs pour éviter les re-fetches inutiles
  const prevIdsRef = useRef('');
  const currentIdsString = JSON.stringify(appointmentIds.sort());

  useEffect(() => {
    // Skip si les IDs n'ont pas changé
    if (prevIdsRef.current === currentIdsString && historyRefreshIndex === 0) {
      return;
    }
    prevIdsRef.current = currentIdsString;

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
  }, [token, currentIdsString, historyRefreshIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
