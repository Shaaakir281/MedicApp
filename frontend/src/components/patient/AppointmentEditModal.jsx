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
