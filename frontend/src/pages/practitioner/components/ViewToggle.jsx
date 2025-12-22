import React from 'react';
import clsx from 'clsx';
import { IconCalendar, IconUsers } from './icons';

/**
 * ViewToggle moderne avec icons et états actifs élégants
 */

export const ViewToggle = ({ viewMode, onChange }) => {
  const views = [
    { id: 'agenda', label: 'Agenda', icon: IconCalendar },
    { id: 'patients', label: 'Nouveaux dossiers', icon: IconUsers },
  ];

  return (
    <div className="inline-flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200">
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = viewMode === view.id;

        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onChange?.(view.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200',
              isActive
                ? 'bg-sky-50 text-sky-700 shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            )}
          >
            <Icon className="w-4 h-4" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
};
