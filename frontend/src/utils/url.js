import { API_BASE_URL } from '../lib/api.js';

const { origin: API_BASE_ORIGIN, base: NORMALIZED_API_BASE } = (() => {
  if (!API_BASE_URL) {
    return { origin: '', base: '' };
  }
  try {
    const parsed = new URL(API_BASE_URL);
    const pathname = parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname;
    return {
      origin: parsed.origin,
      base: `${parsed.origin}${pathname}`,
    };
  } catch {
    const sanitized = API_BASE_URL.replace(/\/$/, '');
    return { origin: sanitized, base: sanitized };
  }
})();

export const buildDocumentUrl = (rawUrl, extraQuery = {}) => {
  if (!rawUrl) {
    return null;
  }
  try {
    const fallbackOrigin = API_BASE_ORIGIN || 'http://localhost';
    const parsed = rawUrl.startsWith('http') ? new URL(rawUrl) : new URL(rawUrl, fallbackOrigin);
    const params = new URLSearchParams(parsed.search);
    Object.entries(extraQuery).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    const base = NORMALIZED_API_BASE || parsed.origin;
    return `${base}${parsed.pathname}${query}`;
  } catch {
    return rawUrl;
  }
};
