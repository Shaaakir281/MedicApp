const STORAGE_KEY_PREFIX = 'medicapp.secure.';
const DEFAULT_SECRET = 'MedicApp::Auth::DefaultSecretKey__ChangeMe!';
const MIN_SECRET_LENGTH = 24;

const hasBrowserAPIs = typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

const rawSecret =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  typeof import.meta.env.VITE_AUTH_STORAGE_SECRET === 'string' &&
  import.meta.env.VITE_AUTH_STORAGE_SECRET.trim()
    ? import.meta.env.VITE_AUTH_STORAGE_SECRET.trim()
    : null;

const secretSource =
  rawSecret && rawSecret !== DEFAULT_SECRET && rawSecret.length >= MIN_SECRET_LENGTH
    ? rawSecret
    : null;

const secretBytes = secretSource && encoder ? encoder.encode(secretSource.padEnd(64, '#').slice(0, 64)) : null;
const persistenceEnabled = Boolean(hasBrowserAPIs && secretBytes);
let warnedMissingSecret = false;

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

function ensurePersistence() {
  if (!persistenceEnabled && !warnedMissingSecret && hasBrowserAPIs) {
    console.warn(
      'Secure auth storage is disabled. Set VITE_AUTH_STORAGE_SECRET (24+ chars, not the default) to persist sessions.',
    );
    warnedMissingSecret = true;
  }
  return persistenceEnabled;
}

export function loadSecureItem(key) {
  if (!hasBrowserAPIs || !ensurePersistence()) {
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
    console.warn('Unable to load secure item', error);
    return null;
  }
}

export function saveSecureItem(key, value) {
  if (!hasBrowserAPIs || !ensurePersistence()) {
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
    console.warn('Unable to save secure item', error);
  }
}

export function clearSecureItem(key) {
  if (!hasBrowserAPIs) {
    return;
  }
  try {
    window.sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
  } catch (error) {
    console.warn('Unable to clear secure item', error);
  }
}
