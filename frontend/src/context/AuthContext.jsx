import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  configureAuthSession,
  loginUser,
  refreshAccessToken as requestAccessTokenRefresh,
  registerUser,
} from '../lib/api.js';
import { clearSecureItem, loadSecureItem, saveSecureItem } from '../lib/secureStorage.js';

const STORAGE_KEY = 'auth.session';

const AuthContext = createContext(null);

const parseJwtPayload = (token) => {
  if (!token) {
    return null;
  }
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload));
  } catch (error) {
    console.warn('Impossible de décoder le token JWT', error);
    return null;
  }
};

function initializeSession() {
  if (typeof window === 'undefined') {
    return null;
  }
  return loadSecureItem(STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => initializeSession());
  const [loading, setLoading] = useState(false);

  const refreshTimerRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const refreshCallbackRef = useRef(() => Promise.resolve(null));

  const token = authState?.accessToken ?? null;
  const refreshToken = authState?.refreshToken ?? null;
  const user = authState?.user ?? null;
  const expiresAt = authState?.expiresAt ?? null;

  const persistState = useCallback((state) => {
    if (state && state.refreshToken) {
      saveSecureItem(STORAGE_KEY, state);
    } else {
      clearSecureItem(STORAGE_KEY);
    }
  }, []);

  const setAuthStateAndPersist = useCallback(
    (updater) => {
      let resolved = null;
      setAuthState((prev) => {
        const nextState = typeof updater === 'function' ? updater(prev) : updater;
        resolved = nextState ?? null;
        persistState(resolved);
        return resolved;
      });
      return resolved;
    },
    [persistState],
  );

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleRefreshTimer = useCallback(
    (targetExpiry) => {
      clearRefreshTimer();
      if (!targetExpiry || !refreshToken) {
        return;
      }
      const now = Date.now();
      const leadTime = 60_000;
      const delay = Math.max(5_000, targetExpiry - now - leadTime);
      refreshTimerRef.current = setTimeout(() => {
        refreshCallbackRef.current()?.catch(() => {});
      }, delay);
    },
    [clearRefreshTimer, refreshToken],
  );

  const buildSession = useCallback((accessToken, nextRefreshToken, fallbackUser) => {
    if (!accessToken || !nextRefreshToken) {
      return null;
    }
    const payload = parseJwtPayload(accessToken) || {};
    const expiresOn = typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    const baseUser =
      fallbackUser ||
      (payload.sub
        ? {
            id: Number(payload.sub),
            email: payload.email || null,
          }
        : null);
    const emailVerified =
      typeof payload.email_verified === 'boolean'
        ? payload.email_verified
        : baseUser?.email_verified;
    const normalizedUser = baseUser
      ? {
          ...baseUser,
          email_verified: typeof emailVerified === 'boolean' ? emailVerified : true,
        }
      : null;
    return {
      accessToken,
      refreshToken: nextRefreshToken,
      user: normalizedUser,
      expiresAt: expiresOn,
    };
  }, []);

  const updateSession = useCallback(
    (updater) => {
      const nextSession = setAuthStateAndPersist(updater);
      if (!nextSession) {
        clearRefreshTimer();
      } else if (nextSession.expiresAt) {
        scheduleRefreshTimer(nextSession.expiresAt);
      }
      return nextSession;
    },
    [setAuthStateAndPersist, clearRefreshTimer, scheduleRefreshTimer],
  );

  const logout = useCallback(() => {
    refreshPromiseRef.current = null;
    updateSession(null);
  }, [updateSession]);

  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) {
      throw new Error('Aucun refresh token disponible');
    }
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    const operation = (async () => {
      const data = await requestAccessTokenRefresh(refreshToken);
      updateSession((prev) =>
        buildSession(data.access_token, prev?.refreshToken || refreshToken, prev?.user || user),
      );
      return data.access_token;
    })()
      .catch((error) => {
        logout();
        throw error;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });
    refreshPromiseRef.current = operation;
    return operation;
  }, [buildSession, logout, refreshToken, updateSession, user]);

  useEffect(() => {
    refreshCallbackRef.current = () => refreshAccessToken();
  }, [refreshAccessToken]);

  useEffect(() => {
    if (!token || !refreshToken) {
      clearRefreshTimer();
      return;
    }
    if (!expiresAt || expiresAt - Date.now() <= 45_000) {
      refreshAccessToken().catch(() => {});
      return;
    }
    scheduleRefreshTimer(expiresAt);
  }, [token, refreshToken, expiresAt, scheduleRefreshTimer, refreshAccessToken, clearRefreshTimer]);

  useEffect(() => {
    configureAuthSession({
      getAccessToken: () => token,
      getRefreshToken: () => refreshToken,
      refreshAccessToken,
      handleAuthError: logout,
    });
  }, [logout, refreshAccessToken, refreshToken, token]);

  const handleLogin = useCallback(
    async (credentials) => {
      setLoading(true);
      try {
        const data = await loginUser(credentials);
        const payload = parseJwtPayload(data.access_token) || {};
        const currentUser = {
          id: payload.sub ? Number(payload.sub) : null,
          email: payload.email || credentials.email,
          email_verified: true,
        };
        updateSession(buildSession(data.access_token, data.refresh_token, currentUser));
        return currentUser;
      } finally {
        setLoading(false);
      }
    },
    [buildSession, updateSession],
  );

  const handleRegister = useCallback(async (payload) => {
    setLoading(true);
    try {
      return await registerUser(payload);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      user,
      loading,
      login: handleLogin,
      register: handleRegister,
      logout,
      refresh: refreshAccessToken,
      isAuthenticated: Boolean(token && user),
    }),
    [token, refreshToken, user, loading, handleLogin, handleRegister, logout, refreshAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
