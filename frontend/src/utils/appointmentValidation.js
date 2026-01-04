const hasValue = (value) => Boolean(String(value || '').trim());

const hasChildName = (state) =>
  hasValue(state?.childFullName) ||
  (hasValue(state?.childFirstName) && hasValue(state?.childLastName));

const hasParent1Name = (state) =>
  hasValue(state?.parent1Name) ||
  (hasValue(state?.parent1FirstName) && hasValue(state?.parent1LastName));

export const getAppointmentBookingMissingFields = (state = {}) => {
  const missing = [];
  if (!hasChildName(state)) missing.push("Prenom/Nom enfant");
  if (!hasValue(state?.birthDate)) missing.push("Date de naissance");
  if (!hasParent1Name(state)) missing.push("Prenom/Nom parent 1");
  if (!hasValue(state?.parent1Email)) missing.push("Email parent 1");
  return missing;
};

export const isAppointmentBookingComplete = (state = {}) =>
  getAppointmentBookingMissingFields(state).length === 0;

export const isRemoteSigningAllowed = (vm) => {
  const parent1PhoneVerified = Boolean(vm?.guardians?.PARENT_1?.phoneVerifiedAt);
  const parent1EmailVerified = Boolean(vm?.guardians?.PARENT_1?.emailVerifiedAt);
  return parent1PhoneVerified || parent1EmailVerified;
};
