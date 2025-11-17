import React, { forwardRef, useState } from 'react';
import clsx from 'clsx';

const EyeIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={clsx('h-4 w-4', className)}
  >
    <path
      d="M2.5 12c1.8-4.2 5.8-7 9.5-7s7.7 2.8 9.5 7c-1.8 4.2-5.8 7-9.5 7S4.3 16.2 2.5 12Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const EyeOffIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={clsx('h-4 w-4', className)}
  >
    <path
      d="M2.5 12c1.8-4.2 5.8-7 9.5-7 2.4 0 4.6.8 6.4 2.2M20.6 15.7C18.7 18.6 15.6 20.5 12 20.5c-3.7 0-7.7-2.8-9.5-7 1.2-2.8 3.2-4.9 5.5-6.2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.5 12a3.5 3.5 0 0 1-5.5 2.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="4"
      y1="4"
      x2="20"
      y2="20"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const InputField = forwardRef(
  (
    {
      label,
      hint,
      error,
      className,
      children,
      showVisibilityToggle = false,
      showVisibilityCheckbox = false,
      type = 'text',
      ...props
    },
    ref,
  ) => {
    const [isVisible, setIsVisible] = useState(false);
    const isPasswordField = type === 'password' && (showVisibilityToggle || showVisibilityCheckbox);
    const useIconToggle = isPasswordField && showVisibilityToggle && !showVisibilityCheckbox;
    const inputType = isPasswordField && isVisible ? 'text' : type;

    return (
      <label className="form-control w-full space-y-1">
        {label && <span className="label-text font-medium text-slate-600">{label}</span>}
        <div className="relative">
          <input
            ref={ref}
            type={inputType}
            className={clsx(
              'input input-bordered w-full',
              useIconToggle && 'pr-12',
              error && 'input-error border-red-400 focus:border-red-500 focus:ring-red-500',
              className,
            )}
            {...props}
          />
          {useIconToggle && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => setIsVisible((prev) => !prev)}
              aria-label={isVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={isVisible}
            >
              {isVisible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}
        </div>
        {(hint || error) && (
          <span className={clsx('label-text-alt text-xs', error ? 'text-red-500' : 'text-slate-400')}>
            {error || hint}
          </span>
        )}
        {showVisibilityCheckbox && isPasswordField && (
          <label className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={isVisible}
              onChange={() => setIsVisible((prev) => !prev)}
            />
            <span>{isVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}</span>
          </label>
        )}
        {children}
      </label>
    );
  },
);

InputField.displayName = 'InputField';
