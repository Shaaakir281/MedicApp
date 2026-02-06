import React, { useMemo } from 'react';
import clsx from 'clsx';
import { AgendaControls } from './AgendaControls.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 18; // exclusive

const buildSlots = () =>
  Array.from({ length: SLOT_END_HOUR - SLOT_START_HOUR }, (_, idx) => {
    const hour = SLOT_START_HOUR + idx;
    return `${String(hour).padStart(2, '0')}:00`;
  });

const BASE_SLOTS = buildSlots();

const formatDateLabel = (isoDate) =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${isoDate}T00:00:00`));

const toMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map((value) => Number(value));
  if (Number.isNaN(h)) return null;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
};

const computeAvailableSlots = (day) => {
  const booked = new Set(
    (day.appointments || [])
      .map((appt) => appt.time?.slice(0, 5))
      .filter(Boolean),
  );
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  return BASE_SLOTS.filter((slot) => {
    if (booked.has(slot)) return false;
    if (day.date !== todayIso) return true;
    const slotMinutes = toMinutes(slot);
    return slotMinutes === null ? true : slotMinutes >= nowMinutes;
  });
};

export const MaintenanceView = ({
  displayedDays,
  viewLength,
  startDate,
  endDate,
  viewOptions,
  onChangeStart,
  onChangeLength,
  onRefresh,
  loadingData,
  token,
}) => {
  const availability = useMemo(
    () =>
      (displayedDays || []).map((day) => {
        const freeSlots = computeAvailableSlots(day);
        return {
          date: day.date,
          label: formatDateLabel(day.date),
          freeSlots,
          bookedCount: day.appointments?.length || 0,
        };
      }),
    [displayedDays],
  );

  return (
    <div className="space-y-6">
      <AgendaControls
        startDate={startDate}
        endDate={endDate}
        viewLength={viewLength}
        viewOptions={viewOptions}
        onChangeStart={onChangeStart}
        onChangeLength={onChangeLength}
        onRefresh={onRefresh}
        loading={loadingData}
        token={token}
      />

      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Disponibilites agenda</h3>
            <p className="text-sm text-slate-500">
              Vue rapide des creneaux libres et occupes.
            </p>
          </div>
          <Badge variant="info" size="sm">
            {viewLength} jour{viewLength > 1 ? 's' : ''}
          </Badge>
        </div>

        {loadingData && (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
            Chargement des disponibilites...
          </div>
        )}

        {!loadingData && availability.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-500">
            Aucun agenda disponible sur la periode.
          </div>
        )}

        {!loadingData && availability.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {availability.map((day) => (
              <div key={day.date} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold capitalize text-slate-800">{day.label}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="xs">
                      {day.bookedCount} RDV
                    </Badge>
                    <Badge variant={day.freeSlots.length ? 'success' : 'danger'} size="xs">
                      {day.freeSlots.length} libres
                    </Badge>
                  </div>
                </div>

                <div
                  className={clsx(
                    'mt-3 flex flex-wrap gap-1',
                    day.freeSlots.length === 0 && 'text-slate-400',
                  )}
                >
                  {day.freeSlots.length === 0 ? (
                    <span className="text-xs">Aucun creneau libre</span>
                  ) : (
                    day.freeSlots.map((slot) => (
                      <span
                        key={slot}
                        className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                      >
                        {slot}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
