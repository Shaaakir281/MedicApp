import React from 'react';
import clsx from 'clsx';

/**
 * StatusDot - Indicateur visuel de statut
 * Petit dot coloré pour indiquer rapidement l'état d'un élément
 */

const statusColors = {
  done: 'bg-emerald-500',
  pending: 'bg-amber-500',
  draft: 'bg-slate-300',
  error: 'bg-rose-500',
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
};

export function StatusDot({ status = 'draft', className }) {
  return (
    <span
      className={clsx(
        'w-2 h-2 rounded-full inline-block',
        statusColors[status] || statusColors.draft,
        className
      )}
    />
  );
}
