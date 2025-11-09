import React, { forwardRef } from 'react';
import clsx from 'clsx';

export const InputField = forwardRef(
  ({ label, hint, error, className, children, ...props }, ref) => (
    <label className="form-control w-full">
      {label && <span className="label-text font-medium text-slate-600">{label}</span>}
      <input
        ref={ref}
        className={clsx(
          'input input-bordered w-full',
          error && 'input-error border-red-400 focus:border-red-500 focus:ring-red-500',
          className,
        )}
        {...props}
      />
      {(hint || error) && (
        <span className={clsx('label-text-alt mt-1 text-xs', error ? 'text-red-500' : 'text-slate-400')}>
          {error || hint}
        </span>
      )}
      {children}
    </label>
  ),
);

InputField.displayName = 'InputField';
