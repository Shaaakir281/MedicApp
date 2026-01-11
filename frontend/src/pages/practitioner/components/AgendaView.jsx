import React from 'react';

import { AgendaControls, AgendaDay } from './index.js';

export const AgendaView = ({
  displayedDays,
  viewLength,
  startDate,
  endDate,
  viewOptions,
  onChangeStart,
  onChangeLength,
  onRefresh,
  loadingData,
  onSign,
  onSendPrescription,
  onSelectPatient,
  onEditPrescription,
  previewingId,
  signingId,
  sendingId,
  token,
}) => {
  return (
    <>
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

      <section className="space-y-8">
        {loadingData && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
            Chargement de l&apos;agenda...
          </div>
        )}
        {!loadingData &&
          displayedDays.map((day) => (
            <AgendaDay
              key={day.date}
              day={day}
              detailed={viewLength === 1}
              onSign={(appointment) => onSign?.(appointment)}
              onSendPrescription={onSendPrescription}
              onSelectPatient={onSelectPatient}
              onEditPrescription={onEditPrescription}
              previewingId={previewingId}
              signingId={signingId}
              sendingId={sendingId}
              token={token}
              onRefreshAppointments={onRefresh}
            />
          ))}
      </section>
    </>
  );
};
