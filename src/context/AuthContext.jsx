import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  apiRequest,
  clearStoredSessionToken,
  setStoredSessionToken,
} from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest('/api/auth/me');
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
    const onUnauth = () => setUser(null);
    const onStorage = (e) => {
      if (e.key === 'aisquare_session_token' && !e.newValue) {
        clearStoredSessionToken();
        setUser(null);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('aisquare:unauthenticated', onUnauth);
      window.addEventListener('storage', onStorage);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('aisquare:unauthenticated', onUnauth);
        window.removeEventListener('storage', onStorage);
      }
    };
  }, [refreshSession]);

  const loginEmployee = async (identifier, password) => {
    const data = await apiRequest('/api/auth/employee/login', {
      method: 'POST',
      body: { identifier, password },
    });
    if (data.sessionToken) {
      setStoredSessionToken(data.sessionToken);
    }
    setUser(data.user);
    return data.user;
  };

  const loginAdmin = async (identifier, password) => {
    const data = await apiRequest('/api/auth/admin/login', {
      method: 'POST',
      body: { identifier, password },
    });
    if (data.sessionToken) {
      setStoredSessionToken(data.sessionToken);
    }
    setUser(data.user);
    return data.user;
  };

  const bootstrapInitialAdmin = async (payload) => {
    const data = await apiRequest('/api/auth/bootstrap-admin', {
      method: 'POST',
      body: payload,
    });
    if (data.sessionToken) {
      setStoredSessionToken(data.sessionToken);
    }
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      clearStoredSessionToken();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshSession,
        loginEmployee,
        loginAdmin,
        bootstrapInitialAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
