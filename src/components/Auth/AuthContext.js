import React, { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

const SESSION_KEY = 'adminSession';
const SESSION_HOURS = 24;
// SHA256 of PIN "101199" – not reversible, safe to have in code
const CORRECT_PIN_SHA256 = '0f2b6444bfba44f43a4c7a0f7399a03e7c02a8351237ca39b635f2f66f6daeb5';

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { expiresAt } = JSON.parse(raw);
    if (!expiresAt || expiresAt < Math.floor(Date.now() / 1000)) return null;
    return { token: 'ok', expiresAt };
  } catch {
    return null;
  }
}

function setStoredSession(expiresAt) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'ok', expiresAt }));
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const PLACEHOLDER_USER = { displayName: 'Admin', uid: 'admin' };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStoredSession();
    setUser(session ? PLACEHOLDER_USER : null);
    setLoading(false);
  }, []);

  const loginWithPin = (pin) => {
    const entered = String(pin).trim();
    const hash = CryptoJS.SHA256(entered).toString();
    if (hash !== CORRECT_PIN_SHA256) throw new Error('Invalid PIN');
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
    setStoredSession(expiresAt);
    setUser(PLACEHOLDER_USER);
  };

  const logout = () => {
    clearStoredSession();
    try {
      ['gmailConfig', 'gmailAccessToken', 'gmailUser'].forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, loginWithPin }}>
      {children}
    </AuthContext.Provider>
  );
};

export function getSessionToken() {
  const session = getStoredSession();
  return session?.token ?? null;
}
