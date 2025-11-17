const STORAGE_KEY_PREFIX = 'medicapp.secure.';
const DEFAULT_SECRET = 'MedicApp::Auth::DefaultSecretKey__ChangeMe!';

const hasBrowserAPIs = typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

const secretSource =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_AUTH_STORAGE_SECRET &&
    import.meta.env.VITE_AUTH_STORAGE_SECRET.trim()) ||
  DEFAULT_SECRET;

const secretBytes = encoder
  ? encoder.encode(secretSource.padEnd(64, '#').slice(0, 64))
  : null;

function xorCipher(bytes) {
  if (!secretBytes) {
    return bytes;
  }
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    result[i] = bytes[i] ^ secretBytes[i % secretBytes.length];
  }
  return result;
}

function encodeValue(payload) {
  if (!encoder || typeof btoa === 'undefined') {
    return payload;
  }
  const bytes = encoder.encode(payload);
  const scrambled = xorCipher(bytes);
  let binary = '';
  for (let i = 0; i < scrambled.length; i += 1) {
    binary += String.fromCharCode(scrambled[i]);
  }
  return btoa(binary);
}

function decodeValue(payload) {
  if (!decoder || typeof atob === 'undefined') {
    return payload;
  }
  let binary;
  try {
    binary = atob(payload);
  } catch (error) {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const descrambled = xorCipher(bytes);
  return decoder.decode(descrambled);
}

export function loadSecureItem(key) {
  if (!hasBrowserAPIs) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!raw) {
      return null;
    }
    const decoded = decodeValue(raw);
    return decoded ? JSON.parse(decoded) : null;
  } catch (error) {
    console.warn('Impossible de charger l’élément sécurisé', error);
    return null;
  }
}

export function saveSecureItem(key, value) {
  if (!hasBrowserAPIs) {
    return;
  }
  if (value == null) {
    window.sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
    return;
  }
  try {
    const encoded = encodeValue(JSON.stringify(value));
    window.sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, encoded);
  } catch (error) {
    console.warn('Impossible d’enregistrer l’élément sécurisé', error);
  }
}

export function clearSecureItem(key) {
  if (!hasBrowserAPIs) {
    return;
  }
  try {
    window.sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
  } catch (error) {
    console.warn('Impossible de supprimer l’élément sécurisé', error);
  }
}
