import React from 'react';

import Calendar from '../Calendar.jsx';
import TimeSlots from '../TimeSlots.jsx';

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
  confirmLabel = 'Confirmer le rendez-vous',
  disabledConfirm = false,
  renderActions,
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
            Consultation prǸ-opǸratoire
          </option>
          <option value="act" disabled={!hasPreconsultation || hasAct}>
            Acte chirurgical
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
            <option value="visio">Visio</option>
            <option value="presentiel">PrǸsentiel</option>
          </select>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Format : prǸsence obligatoire au cabinet.</p>
      )}

      <Calendar
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onSelectDate={onSelectDate}
      />

      {selectedDate && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium">
            CrǸneaux disponibles le {selectedDate.toLocaleDateString('fr-FR')}
          </h3>
          {slotsLoading ? (
            <p className="text-sm text-slate-500">Chargement des crǸneaux...</p>
          ) : (
            <TimeSlots
              availableSlots={availableSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => onSelectSlot?.(slot)}
            />
          )}
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
