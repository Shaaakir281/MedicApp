import React, { createContext, useContext, useMemo, useState } from 'react';
import { loginUser, registerUser } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('authUser');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const persist = (nextToken, nextUser) => {
    if (nextToken) {
      localStorage.setItem('authToken', nextToken);
    } else {
      localStorage.removeItem('authToken');
    }
    if (nextUser) {
      localStorage.setItem('authUser', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('authUser');
    }
  };

  const handleLogin = async (credentials) => {
    setLoading(true);
    try {
      const data = await loginUser(credentials);
      const payload = JSON.parse(atob(data.access_token.split('.')[1]));
      const currentUser = { id: Number(payload.sub), email: credentials.email };
      setToken(data.access_token);
      setUser(currentUser);
      persist(data.access_token, currentUser);
      return currentUser;
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (payload) => {
    setLoading(true);
    try {
      const userData = await registerUser(payload);
      return userData;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    persist(null, null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login: handleLogin,
      register: handleRegister,
      logout,
      isAuthenticated: Boolean(token),
    }),
    [token, user, loading],
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
