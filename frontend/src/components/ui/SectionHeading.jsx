import React from 'react';
import clsx from 'clsx';

export function SectionHeading({ title, subtitle, className }) {
  return (
    <div className={clsx('space-y-1', className)}>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
