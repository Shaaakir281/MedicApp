import React from 'react';

import Calendar from '../Calendar.jsx';
import TimeSlots from '../TimeSlots.jsx';
import { LABELS_FR } from '../../constants/labels.fr.js';

export const SchedulingPanel = ({
  title,
  appointmentType,
  appointmentMode,
  hasPreconsultation,
  hasAct,
  currentMonth,
  selectedDate,
  availableSlots,
  selectedSlot,
  slotsLoading,
  onChangeType,
  onChangeMode,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onSelectSlot,
  onConfirm,
  minDate,
  confirmLabel = 'Confirmer le rendez-vous',
  disabledConfirm = false,
  renderActions,
  actionNotice,
}) => {
  const isConfirmDisabled = disabledConfirm || !selectedSlot;

  return (
    <div className="space-y-4">
      {title ? <h2 className="text-2xl font-semibold">{title}</h2> : null}

      <div className="flex items-center space-x-3">
        <label htmlFor="appointmentType" className="font-medium">
          Type de rendez-vous :
        </label>
        <select
          id="appointmentType"
          className="select select-bordered"
          value={appointmentType}
          onChange={(event) => onChangeType?.(event.target.value)}
        >
          <option value="preconsultation" disabled={hasPreconsultation}>
            {LABELS_FR.patientSpace.appointments.typePreconsultation}
          </option>
          <option value="act" disabled={!hasPreconsultation || hasAct}>
            {LABELS_FR.patientSpace.appointments.typeAct}
          </option>
        </select>
      </div>

      {appointmentType === 'preconsultation' ? (
        <div className="flex items-center space-x-3">
          <label htmlFor="appointmentMode" className="font-medium">
            Format :
          </label>
          <select
            id="appointmentMode"
            className="select select-bordered"
            value={appointmentMode}
            onChange={(event) => onChangeMode?.(event.target.value)}
          >
            <option value="visio">{LABELS_FR.patientSpace.appointments.modeVisio}</option>
            <option value="presentiel">{LABELS_FR.patientSpace.appointments.modeInPerson}</option>
          </select>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Format : présence obligatoire au cabinet.</p>
      )}

      <Calendar
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onSelectDate={onSelectDate}
        minDate={minDate}
      />

      {selectedDate && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium">
            Créneaux disponibles le {selectedDate.toLocaleDateString('fr-FR')}
          </h3>
          {slotsLoading ? (
            <p className="text-sm text-slate-500">Chargement des créneaux…</p>
          ) : (
            <TimeSlots
              availableSlots={availableSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => onSelectSlot?.(slot)}
            />
          )}
          {actionNotice ? <div className="pt-2">{actionNotice}</div> : null}
          {renderActions ? (
            renderActions({ onConfirm, isConfirmDisabled })
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={isConfirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

