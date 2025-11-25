export const formatChildAge = (birthdateString) => {
  if (!birthdateString) {
    return null;
  }
  const birthdate = new Date(birthdateString);
  if (Number.isNaN(birthdate.getTime())) {
    return null;
  }
  const totalMonths = Math.floor((Date.now() - birthdate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
  if (totalMonths < 0) {
    return null;
  }
  if (totalMonths < 12) {
    return `${totalMonths} mois`;
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (months === 0) {
    return `${years} an${years > 1 ? 's' : ''}`;
  }
  return `${years} an${years > 1 ? 's' : ''} ${months} mois`;
};
