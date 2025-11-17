const MIN_LENGTH = 12;

const policyRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export function validatePasswordPolicy(password) {
  return policyRegex.test(password);
}

export function describePolicy() {
  return '12+ caracteres avec majuscules, minuscules, chiffre et caractere special (ex: ! @ # ? $ %).';
}

export function scorePassword(password) {
  if (!password) {
    return { label: 'vide', score: 0, meetsPolicy: false };
  }
  const lengthScore = Math.min(1, password.length / MIN_LENGTH);
  const varietyScore = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
    password.length >= 16,
  ].filter(Boolean).length;
  const normalized = Math.min(1, (lengthScore + varietyScore / 5) / 2);
  let label = 'faible';
  if (normalized >= 0.7) {
    label = 'fort';
  } else if (normalized >= 0.45) {
    label = 'moyen';
  }
  return { label, score: normalized, meetsPolicy: validatePasswordPolicy(password) };
}

export { MIN_LENGTH };
