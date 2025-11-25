export const formatDateISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseISODateLocal = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  if ([year, month, day].some((v) => Number.isNaN(v))) {
    return null;
  }
  return new Date(year, month - 1, day);
};

export const sortAppointments = (list, { desc = false } = {}) => {
  return [...list].sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) {
      return desc ? -dateDiff : dateDiff;
    }
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    const timeDiff = timeA.localeCompare(timeB);
    return desc ? -timeDiff : timeDiff;
  });
};
