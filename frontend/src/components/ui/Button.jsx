import React from 'react';
import clsx from 'clsx';

const styles = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  outline: 'btn btn-outline',
  ghost: 'btn btn-ghost',
};

export function Button({ variant = 'primary', className, children, ...props }) {
  return (
    <button type="button" className={clsx('btn', styles[variant], className)} {...props}>
      {children}
    </button>
  );
}
