import React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { StatusDot } from '../../../components/ui/StatusDot';
import { IconDocument } from './icons';

/**
 * Affiche un document de signature avec son statut et ses actions
 */
export function DocumentSignatureCard({ document, onPreview }) {
  const statusVariant = {
    completed: 'success',
    partial: 'warning',
    pending: 'neutral',
  }[document.status];

  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconDocument className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{document.displayLabel}</span>
        </div>
        <Badge variant={statusVariant} size="xs">
          {document.status === 'completed' ? 'Signé' : document.status === 'partial' ? 'Partiel' : 'En attente'}
        </Badge>
      </div>

      {/* Signatures Status */}
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <StatusDot status={document.parent1SignedAt ? 'done' : 'pending'} />
        <span>{document.parent1SignedAt ? 'Parent 1 signé' : 'Parent 1 en attente'}</span>
        <span className="text-slate-300">•</span>
        <StatusDot status={document.parent2SignedAt ? 'done' : 'pending'} />
        <span>{document.parent2SignedAt ? 'Parent 2 signé' : 'Parent 2 en attente'}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-xs btn-outline"
          onClick={onPreview}
          disabled={!onPreview}
        >
          Voir
        </button>
      </div>
    </div>
  );
}
