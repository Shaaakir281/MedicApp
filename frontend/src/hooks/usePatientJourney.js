import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchPatientJourney } from '../lib/api.js';

const buildSignatureMessage = (journeyStatus) => {
  if (!journeyStatus?.signatures) return null;

  const signatures = journeyStatus.signatures;
  const delay = signatures.reflection_delay || {};

  if (signatures.complete) return null;

  if (delay && delay.can_sign === false && typeof delay.days_left === 'number') {
    return {
      type: 'waiting',
      text: `Signature possible dans ${delay.days_left} jour${delay.days_left > 1 ? 's' : ''}`,
    };
  }

  if (journeyStatus?.dossier && !journeyStatus.dossier.complete) {
    return {
      type: 'action',
      text: 'Completez le dossier pour signer a distance',
      clickable: true,
    };
  }

  const missingParents = [];
  if (signatures.parent1_signed === false) missingParents.push('Parent 1');
  if (signatures.parent2_signed === false) missingParents.push('Parent 2');

  if (missingParents.length) {
    return {
      type: 'ready',
      text: `${missingParents.join(' et ')} peut signer`,
    };
  }

  return null;
};

export function usePatientJourney({ token }) {
  const query = useQuery({
    queryKey: ['patient', 'journey'],
    queryFn: () => fetchPatientJourney(token),
    enabled: Boolean(token),
  });

  const journeyStatus = query.data?.journey_status || null;
  const signatureMessage = useMemo(() => buildSignatureMessage(journeyStatus), [journeyStatus]);

  return {
    journeyStatus,
    signatureMessage,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}
