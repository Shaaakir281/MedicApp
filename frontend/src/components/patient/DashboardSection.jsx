import React, { useState } from 'react';

export const DashboardSection = ({
  title,
  subtitle,
  badge,
  defaultOpen = true,
  children,
  actions = null,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-semibold text-slate-900">{title}</span>
            {badge && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <span className="text-slate-500 text-xl leading-none">{open ? '−' : '+'}</span>
        </div>
      </button>
      {open && <div className="px-5 pb-5 pt-2">{children}</div>}
    </div>
  );
};
