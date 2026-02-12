import React from 'react';

import Modal from '../Modal.jsx';
import { SchedulingPanel } from './SchedulingPanel.jsx';

export const AppointmentEditModal = ({
  isOpen,
  onClose,
  appointmentType,
  appointmentMode,
  hasPreconsultation,
  hasAct,
  currentMonth,
  selectedDate,
  minDate,
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
  errorMessage = null,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Modifier mon rendez-vous</h2>
        <SchedulingPanel
          appointmentType={appointmentType}
          appointmentMode={appointmentMode}
          hasPreconsultation={hasPreconsultation}
          hasAct={hasAct}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          minDate={minDate}
          availableSlots={availableSlots}
          selectedSlot={selectedSlot}
          slotsLoading={slotsLoading}
          onChangeType={onChangeType}
          onChangeMode={onChangeMode}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          onSelectDate={onSelectDate}
          onSelectSlot={onSelectSlot}
          onConfirm={onConfirm}
          confirmLabel="Confirmer les modifications"
          actionNotice={
            errorMessage ? (
              <div className="pt-2">
                <div className="alert alert-warning">
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">Rendez-vous indisponible</p>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              </div>
            ) : null
          }
          renderActions={({ onConfirm: confirm, isConfirmDisabled }) => (
            <div className="flex gap-3">
              <button type="button" className="btn" onClick={onClose}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isConfirmDisabled}
                onClick={confirm}
              >
                Confirmer les modifications
              </button>
            </div>
          )}
        />
      </div>
    </Modal>
  );
};
