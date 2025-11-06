import React, { useState } from 'react';

const PasswordField = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete = 'current-password',
  disabled = false,
}) => {
  const [visible, setVisible] = useState(false);
  const inputType = visible ? 'text' : 'password';

  return (
    <label className="form-control w-full">
      {label && <span className="label-text mb-1">{label}</span>}
      <div className="relative">
        <input
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className="input input-bordered w-full pr-24"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="btn btn-ghost btn-xs absolute inset-y-0 right-3 my-auto"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {visible ? 'Masquer' : 'Afficher'}
        </button>
      </div>
    </label>
  );
};

export default PasswordField;

