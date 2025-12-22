import React from 'react';
import clsx from 'clsx';
import {
  IconCalendar,
  IconUsers,
  IconBell,
  IconDocument,
  IconCheck,
} from './icons';

/**
 * StatCard moderne avec gradients, icons et hover effects
 * Inspiré du design partagé pour une interface élégante et interactive
 */

const colorConfig = {
  neutral: {
    gradient: 'from-slate-500 to-slate-600',
    icon: IconCalendar,
  },
  primary: {
    gradient: 'from-sky-500 to-blue-600',
    icon: IconCalendar,
  },
  warning: {
    gradient: 'from-amber-500 to-orange-600',
    icon: IconBell,
  },
  danger: {
    gradient: 'from-rose-500 to-pink-600',
    icon: IconDocument,
  },
  success: {
    gradient: 'from-emerald-500 to-teal-600',
    icon: IconCheck,
  },
  purple: {
    gradient: 'from-violet-500 to-purple-600',
    icon: IconUsers,
  },
};

export function StatCard({ title, value, tone = 'neutral', icon: CustomIcon, onClick }) {
  const config = colorConfig[tone] || colorConfig.neutral;
  const IconComponent = CustomIcon || config.icon;

  const Component = onClick ? 'button' : 'div';
  const clickableClasses = onClick
    ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300'
    : '';

  return (
    <Component
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-5 text-left transition-all duration-300',
        'hover:shadow-lg hover:shadow-slate-200/50',
        clickableClasses
      )}
    >
      {/* Gradient background decoratif */}
      <div
        className={clsx(
          'absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 transition-opacity',
          'bg-gradient-to-br opacity-5 group-hover:opacity-10',
          config.gradient
        )}
      />

      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            {title}
          </p>
          <p
            className={clsx(
              'text-3xl font-bold bg-gradient-to-br bg-clip-text text-transparent',
              config.gradient
            )}
          >
            {value ?? '—'}
          </p>
        </div>

        <div
          className={clsx(
            'p-2.5 rounded-xl text-white shadow-lg',
            'bg-gradient-to-br',
            config.gradient
          )}
        >
          <IconComponent className="w-5 h-5" />
        </div>
      </div>
    </Component>
  );
}
