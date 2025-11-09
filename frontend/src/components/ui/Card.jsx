import React from 'react';
import clsx from 'clsx';

export function Card({ children, className, padding = 'p-6', ...props }) {
  return (
    <div
      className={clsx(
        'bg-white border border-slate-200 rounded-2xl shadow-sm',
        padding,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
