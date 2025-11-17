import React from 'react';
import clsx from 'clsx';
import { scorePassword, describePolicy } from '../../lib/passwordStrength.js';

export function PasswordStrengthMeter({ value }) {
  const { score, meetsPolicy } = scorePassword(value || '');
  const color =
    score < 0.45 ? 'bg-red-400' : score < 0.7 ? 'bg-amber-400' : 'bg-lime-500';
  const percent = Math.round(score * 100);

  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-600">Force du mot de passe</div>
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className={clsx('h-full transition-all duration-200', color)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[12px] text-slate-500">
        <span>{describePolicy()}</span>
        {meetsPolicy && <span className="text-green-600">OK</span>}
      </div>
    </div>
  );
}
