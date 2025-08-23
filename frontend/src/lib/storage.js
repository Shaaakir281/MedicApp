/**
 * Utility functions to persist and retrieve data from sessionStorage.
 * Data is stored as JSON strings. If parsing fails, defaults are returned.
 */

export const loadDraft = () => {
  try {
    const stored = sessionStorage.getItem('medscript_rdv_draft');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const saveDraft = (draft) => {
  try {
    sessionStorage.setItem('medscript_rdv_draft', JSON.stringify(draft));
  } catch {
    // Ignore storage errors (e.g. quota exceeded)
  }
};

export const loadReserved = () => {
  try {
    const stored = sessionStorage.getItem('medscript_reserved_session');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const addReservedSlot = (slot) => {
  try {
    const current = loadReserved();
    sessionStorage.setItem(
      'medscript_reserved_session',
      JSON.stringify([...current, slot]),
    );
  } catch {
    // Ignore storage errors
  }
};