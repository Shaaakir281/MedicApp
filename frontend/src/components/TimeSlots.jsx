import React from 'react';

/**
 * Generate a list of 30‑minute time slots between two times (inclusive).
 * Returns an array of strings in HH:mm format.
 */
const generateSlots = (start = '09:00', end = '17:30') => {
  const pad = (n) => n.toString().padStart(2, '0');
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  const slots = [];
  let hour = startHour;
  let minute = startMin;
  while (hour < endHour || (hour === endHour && minute <= endMin)) {
    slots.push(`${pad(hour)}:${pad(minute)}`);
    minute += 30;
    if (minute >= 60) {
      minute = minute % 60;
      hour += 1;
    }
  }
  return slots;
};

/**
 * TimeSlots component renders a list of 30‑minute slots for a given date.
 * Props:
 *  - date: Date object representing the selected day
 *  - appointmentsSeed: array of { date: 'YYYY-MM-DD', time: 'HH:mm' } reserved globally
 *  - reservedSession: array of similar objects reserved in this session
 *  - selectedSlot: currently selected time string or null
 *  - onSelectSlot: function to call with time string when a slot is clicked
 */
const TimeSlots = ({ date, appointmentsSeed, reservedSession, selectedSlot, onSelectSlot }) => {
  const formattedDate = date.toISOString().split('T')[0];
  // Precompute reserved times for this date
  const reservedTimes = new Set();
  appointmentsSeed.forEach((slot) => {
    if (slot.date === formattedDate) reservedTimes.add(slot.time);
  });
  reservedSession.forEach((slot) => {
    if (slot.date === formattedDate) reservedTimes.add(slot.time);
  });
  const slots = generateSlots();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {slots.map((time) => {
        const isReserved = reservedTimes.has(time);
        const isSelected = selectedSlot === time;
        return (
          <button
            key={time}
            className={`px-4 py-2 rounded-md border ${
              isReserved
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : isSelected
                ? 'bg-blue-500 text-white'
                : 'bg-white text-slate-700 hover:bg-blue-50'
            }`}
            disabled={isReserved}
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