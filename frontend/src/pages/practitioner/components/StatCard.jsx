import React from 'react';
import clsx from 'clsx';

const toneClasses = {
  neutral: 'border-slate-200',
  primary: 'border-blue-200 bg-blue-50',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-red-200 bg-red-50',
  success: 'border-emerald-200 bg-emerald-50',
};

export function StatCard({ title, value, tone = 'neutral' }) {
  return (
    <div className={clsx('rounded-2xl border p-5 shadow-sm', toneClasses[tone])}>
      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{title}</div>
      <div className="text-3xl font-semibold text-slate-900 mt-2">{value ?? '—'}</div>
    </div>
  );
}
