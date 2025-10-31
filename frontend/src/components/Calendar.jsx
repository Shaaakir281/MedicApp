import React from 'react';

/**
 * Simple calendar component showing a month view. It allows navigation between
 * months and selection of a date. The consumer controls the current month and
 * selected date via props.
 *
 * Props:
 *  - currentMonth: Date object representing the first day of the current month
 *  - selectedDate: Date or null
 *  - onPrevMonth: () => void
 *  - onNextMonth: () => void
 *  - onSelectDate: (Date) => void
 */
const Calendar = ({ currentMonth, selectedDate, onPrevMonth, onNextMonth, onSelectDate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleString('fr-FR', { month: 'long' });
  // Compute days in the month and starting weekday (0 = Sunday)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();
  // Create array of dates for the calendar grid (6 weeks max)
  const dates = [];
  for (let i = 0; i < startDay; i++) {
    dates.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(new Date(year, month, d));
  }
  // Ensure grid has 42 cells (6 rows * 7 columns)
  while (dates.length < 42) {
    dates.push(null);
  }
  // Helper to check if two dates represent the same calendar day
  const isSameDay = (d1, d2) => {
    return (
      d1 &&
      d2 &&
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };
  return (
    <div className="border rounded-lg p-4 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <button
          className="btn btn-sm"
          onClick={onPrevMonth}
          disabled={currentMonth <= minMonth}
        >
          &lt;
        </button>
        <div className="font-bold">
          {monthName.charAt(0).toUpperCase() + monthName.slice(1)} {year}
        </div>
        <button className="btn btn-sm" onClick={onNextMonth}>&gt;</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm mb-1">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="font-medium text-slate-600">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date, idx) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = date && isSameDay(date, new Date());
          const isPast = date && date < today;
          return (
            <button
              key={idx}
              className={`w-full aspect-square rounded-md flex items-center justify-center ${
                date
                  ? isPast
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : isSelected
                    ? 'bg-blue-500 text-white'
                    : isToday
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-blue-50'
                  : 'bg-transparent'
              }`}
              onClick={() => date && !isPast && onSelectDate(date)}
              disabled={!date || isPast}
            >
              {date ? date.getDate() : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
