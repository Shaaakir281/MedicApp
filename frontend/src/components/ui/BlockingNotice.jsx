import React from 'react';

export function BlockingNotice({ title = 'Action bloquee', message, items = [] }) {
  if (!message && (!items || items.length === 0)) return null;

  return (
    <div className="alert alert-warning">
      <div className="text-xs space-y-1">
        <p className="font-semibold">{title}</p>
        {message && <p>{message}</p>}
        {items?.length > 0 && (
          <p>
            {items.join(', ')}.
          </p>
        )}
      </div>
    </div>
  );
}
