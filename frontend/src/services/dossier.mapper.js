const GUARDIAN_ROLES = ['PARENT_1', 'PARENT_2'];

function buildGuardianDefaults() {
  return GUARDIAN_ROLES.reduce((acc, role) => {
    acc[role] = {
      id: null,
      role,
      firstName: '',
      lastName: '',
      email: '',
      phoneE164: '',
      phoneVerifiedAt: null,
      emailVerifiedAt: null,
      emailSentAt: null,
    };
    return acc;
  }, {});
}

function buildVerificationDefaults() {
  return GUARDIAN_ROLES.reduce((acc, role) => {
    acc[role] = { step: 'idle' };
    return acc;
  }, {});
}

function sanitizeName(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const normalized = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized === 'prenom' || normalized === 'nom') return '';
  return trimmed;
}

function isPlaceholderName(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  const normalized = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalized === 'prenom' || normalized === 'nom';
}

function getTodayLocalISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function optionalString(value) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}

export function toDossierVM(apiResponse) {
  const guardiansMap = buildGuardianDefaults();
  const verification = buildVerificationDefaults();
  const rawChild = apiResponse?.child || {};
  const rawFirstName = rawChild.first_name || '';
  const rawLastName = rawChild.last_name || '';
  const rawBirthDate = rawChild.birth_date || null;
  const hideBirthDate =
    rawBirthDate &&
    rawBirthDate === getTodayLocalISO() &&
    isPlaceholderName(rawFirstName) &&
    isPlaceholderName(rawLastName);

  (apiResponse?.guardians || []).forEach((g) => {
    const role = g.role || 'PARENT_1';
    guardiansMap[role] = {
      id: g.id || null,
      role,
      firstName: g.first_name || '',
      lastName: g.last_name || '',
      email: g.email || '',
      phoneE164: g.phone_e164 || '',
      phoneVerifiedAt: g.phone_verified_at || null,
      emailVerifiedAt: g.email_verified_at || null,
      emailSentAt: g.email_sent_at || null,
    };
    if (g.phone_verified_at) {
      verification[role] = { step: 'verified', verifiedAt: g.phone_verified_at };
    }
  });

  return {
    child: {
      id: apiResponse?.child?.id || null,
      firstName: rawFirstName,
      lastName: rawLastName,
      birthDate: hideBirthDate ? null : rawBirthDate,
      weightKg: apiResponse?.child?.weight_kg ?? '',
      medicalNotes: apiResponse?.child?.medical_notes || '',
    },
    guardians: guardiansMap,
    verification,
    warnings: apiResponse?.warnings || [],
  };
}

export function vmToForm(vm) {
  return {
    childFirstName: sanitizeName(vm?.child?.firstName),
    childLastName: sanitizeName(vm?.child?.lastName),
    birthDate: vm?.child?.birthDate || null,
    weightKg: vm?.child?.weightKg ?? '',
    medicalNotes: vm?.child?.medicalNotes || '',
    parent1FirstName: sanitizeName(vm?.guardians?.PARENT_1?.firstName),
    parent1LastName: sanitizeName(vm?.guardians?.PARENT_1?.lastName),
    parent1Email: vm?.guardians?.PARENT_1?.email || '',
    parent1Phone: vm?.guardians?.PARENT_1?.phoneE164 || '',
    parent2FirstName: sanitizeName(vm?.guardians?.PARENT_2?.firstName),
    parent2LastName: sanitizeName(vm?.guardians?.PARENT_2?.lastName),
    parent2Email: vm?.guardians?.PARENT_2?.email || '',
    parent2Phone: vm?.guardians?.PARENT_2?.phoneE164 || '',
  };
}

export function formToPayload(formState) {
  const weightValue =
    formState.weightKg === '' || formState.weightKg === null || typeof formState.weightKg === 'undefined'
      ? null
      : parseFloat(formState.weightKg);

  const child = {
    first_name: (formState.childFirstName || '').trim(),
    last_name: (formState.childLastName || '').trim(),
    birth_date: formState.birthDate || null,
    weight_kg: Number.isNaN(weightValue) ? null : weightValue,
    medical_notes: formState.medicalNotes || '',
  };

  const guardians = [
    {
      role: 'PARENT_1',
      first_name: (formState.parent1FirstName || '').trim(),
      last_name: (formState.parent1LastName || '').trim(),
      email: formState.parent1Email || null,
      phone_e164: formState.parent1Phone || null,
    },
  ];

  const parent2FirstName = (formState.parent2FirstName || '').trim();
  const parent2LastName = (formState.parent2LastName || '').trim();
  if (parent2FirstName && parent2LastName) {
    guardians.push({
      role: 'PARENT_2',
      first_name: parent2FirstName,
      last_name: parent2LastName,
      email: optionalString(formState.parent2Email),
      phone_e164: optionalString(formState.parent2Phone),
    });
  }

  return { child, guardians };
}
