import React from 'react';

/**
 * Badge compact affichant le statut global des documents de signature.
 * Remplace la checklist détaillée pour un affichage plus concis.
 */
export const DocumentStatusBadge = ({ documentSignatures = [] }) => {
  const totalDocs = documentSignatures.length;
  const completedDocs = documentSignatures.filter(doc => doc.status === 'completed').length;
  const partialDocs = documentSignatures.filter(doc => doc.status === 'partial').length;

  // Déterminer la couleur du badge
  let bgColor = 'bg-slate-100';
  let textColor = 'text-slate-600';
  let icon = '📄';

  if (totalDocs === 0) {
    bgColor = 'bg-slate-100';
    textColor = 'text-slate-500';
    icon = '📄';
  } else if (completedDocs === totalDocs) {
    // Tous signés
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
    icon = '✅';
  } else if (partialDocs > 0 || completedDocs > 0) {
    // Partiellement signé
    bgColor = 'bg-orange-100';
    textColor = 'text-orange-700';
    icon = '🟡';
  } else {
    // Aucun signé
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
    icon = '🔴';
  }

  // Texte détaillé pour survol
  const getTooltipText = () => {
    if (totalDocs === 0) return 'Aucun document requis';

    const docs = documentSignatures.map(doc => {
      const label = doc.displayLabel || doc.documentType;
      if (doc.status === 'completed') return `✓ ${label}`;
      if (doc.status === 'partial') return `⚠ ${label} (partiel)`;
      return `✗ ${label}`;
    });

    return docs.join('\n');
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgColor} ${textColor} text-sm font-medium`}
      title={getTooltipText()}
    >
      <span>{icon}</span>
      <span>
        Documents : {completedDocs}/{totalDocs} signés
      </span>
    </div>
  );
};
