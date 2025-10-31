import React from 'react';

const TimeSlots = ({ availableSlots = [], selectedSlot, onSelectSlot }) => {
  if (!availableSlots.length) {
    return <p className="text-sm text-slate-500">Aucun créneau disponible pour cette date.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {availableSlots.map((time) => {
        const isSelected = selectedSlot === time;
        return (
          <button
            key={time}
            type="button"
            className={`px-4 py-2 rounded-md border transition-colors ${
              isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 hover:bg-blue-50'
            }`}
            onClick={() => onSelectSlot(time)}
          >
            {time}
          </button>
        );
      })}
    </div>
  );
};

export default TimeSlots;
