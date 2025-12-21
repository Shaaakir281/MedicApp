import React from 'react';

import { LABELS_FR } from '../../../constants/labels.fr.js';

export function ProgressBar({ completedCount = 0, total = 0 }) {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.min(Math.max(0, completedCount), safeTotal);
  const percent = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{LABELS_FR.patientSpace.documents.progressCases(safeCompleted, safeTotal)}</span>
        <span>{percent}%</span>
      </div>
      <progress className="progress progress-primary w-full" value={safeCompleted} max={safeTotal || 1} />
    </div>
  );
}

