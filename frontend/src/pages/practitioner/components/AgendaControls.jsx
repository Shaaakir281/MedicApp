import React from 'react';
import { Card, SectionHeading, Button } from '../../../components/ui';
import { DocumentVerificationPanel } from './DocumentVerificationPanel';

export function AgendaControls({
  startDate,
  endDate,
  viewLength,
  viewOptions,
  onChangeStart,
  onChangeLength,
  onRefresh,
  loading,
  token,
}) {
  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
            <div className="flex-1">
              <SectionHeading title="Agenda" subtitle="Filtrez les créneaux à afficher" />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label htmlFor="agenda-start" className="label text-xs font-semibold text-slate-500">
                  Date de départ
                </label>
                <input
                  id="agenda-start"
                  type="date"
                  className="input input-bordered"
                  value={startDate}
                  onChange={(event) => onChangeStart(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="agenda-length" className="label text-xs font-semibold text-slate-500">
                  Période
                </label>
                <select
                  id="agenda-length"
                  className="select select-bordered"
                  value={viewLength}
                  onChange={(event) => onChangeLength(Number(event.target.value))}
                >
                  {viewOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 1 ? '1 jour' : `${option} jours`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={onRefresh} disabled={loading}>
              Actualiser
            </Button>
          </div>
        </div>
      </Card>

      {/* Panel de vérification documents */}
      <DocumentVerificationPanel token={token} />
    </div>
  );
}
