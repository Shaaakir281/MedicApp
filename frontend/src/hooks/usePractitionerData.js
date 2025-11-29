import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchNewPatients, fetchPractitionerAgenda, fetchPractitionerStats } from '../lib/api.js';

const AUTO_REFRESH_INTERVAL_MS = 60_000;

const toDate = (isoDate) => new Date(`${isoDate}T00:00:00`);
const toISODate = (dateObj) => dateObj.toISOString().split('T')[0];

export const addDays = (isoDate, delta) => {
  const base = toDate(isoDate);
  base.setDate(base.getDate() + delta);
  return toISODate(base);
};

const getDefaultStartDate = () => toISODate(new Date());

export function usePractitionerData({ token, viewMode }) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(() => getDefaultStartDate());
  const [viewLength, setViewLength] = useState(7);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const endDate = useMemo(() => addDays(startDate, viewLength - 1), [startDate, viewLength]);

  const agendaQuery = useQuery({
    queryKey: ['practitionerAgenda', startDate, endDate, refreshIndex],
    queryFn: () => fetchPractitionerAgenda({ start: startDate, end: endDate }, token),
    enabled: Boolean(token),
    refetchInterval: token && viewMode === 'agenda' ? AUTO_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const statsQuery = useQuery({
    queryKey: ['practitionerStats', startDate, refreshIndex],
    queryFn: () => fetchPractitionerStats(startDate, token),
    enabled: Boolean(token),
    refetchInterval: token ? AUTO_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const newPatientsQuery = useQuery({
    queryKey: ['practitionerNewPatients', viewMode, refreshIndex],
    queryFn: () => fetchNewPatients({ days: 7 }, token),
    enabled: Boolean(token && viewMode === 'patients'),
    refetchInterval: token && viewMode === 'patients' ? AUTO_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const handleRefresh = () => {
    setRefreshIndex((prev) => prev + 1);
    queryClient.invalidateQueries({ queryKey: ['practitionerAgenda'] });
    queryClient.invalidateQueries({ queryKey: ['practitionerStats'] });
  };

  const displayedDays = useMemo(() => {
    const days = agendaQuery.data?.days ?? [];
    return viewLength === 1 ? days.slice(0, 1) : days;
  }, [agendaQuery.data?.days, viewLength]);

  const loadingData = agendaQuery.isLoading || statsQuery.isLoading;

  return {
    startDate,
    setStartDate,
    viewLength,
    setViewLength,
    endDate,
    refreshIndex,
    agendaQuery,
    statsQuery,
    newPatientsQuery,
    displayedDays,
    loadingData,
    handleRefresh,
  };
}
