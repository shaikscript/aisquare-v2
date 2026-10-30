import React, { createContext, useCallback, useContext, useState } from 'react';

const THEME_STORAGE_KEY = 'aisquare_portal_theme';
let inMemoryPortalTheme = null;

function readInitialTheme() {
  if (inMemoryPortalTheme) return inMemoryPortalTheme;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage?.getItem(THEME_STORAGE_KEY);
      if (saved === 'cosmic' || saved === 'light') {
        inMemoryPortalTheme = saved;
        return saved;
      }
    } catch {
      // Ignore iframe storage restrictions
    }
  }
  return 'cosmic';
}

const ThemeContext = createContext({
  portalTheme: 'cosmic',
  togglePortalTheme: () => {},
  setPortalTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [portalTheme, setPortalThemeState] = useState(readInitialTheme);

  const setPortalTheme = useCallback((next) => {
    const resolved = next === 'light' ? 'light' : 'cosmic';
    inMemoryPortalTheme = resolved;
    setPortalThemeState(resolved);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(THEME_STORAGE_KEY, resolved);
      } catch {
        // Ignore iframe storage restrictions
      }
    }
  }, []);

  const togglePortalTheme = useCallback(() => {
    setPortalThemeState((prev) => {
      const next = prev === 'cosmic' ? 'light' : 'cosmic';
      inMemoryPortalTheme = next;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage?.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Ignore iframe storage restrictions
        }
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ portalTheme, setPortalTheme, togglePortalTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function usePortalTheme() {
  return useContext(ThemeContext);
}
