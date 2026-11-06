import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { COLOR_SCHEMES, COLOR_SCHEME_IDS } from '../constants/colorSchemes';
import type { ColorSchemeId } from '../constants/colorSchemes';

export type Theme = 'light' | 'dark' | ColorSchemeId;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme';
const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark' || (
    value !== null && Object.prototype.hasOwnProperty.call(COLOR_SCHEMES, value)
  );

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', theme !== 'light');
  root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');

  for (const schemeId of COLOR_SCHEME_IDS) {
    for (const variable of Object.keys(COLOR_SCHEMES[schemeId].variables)) {
      root.style.removeProperty(variable);
    }
  }

  if (theme !== 'light' && theme !== 'dark') {
    for (const [variable, value] of Object.entries(COLOR_SCHEMES[theme].variables)) {
      root.style.setProperty(variable, value);
    }
    root.setAttribute('data-color-scheme', theme);
  } else {
    root.removeAttribute('data-color-scheme');
  }
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const initialTheme = isTheme(stored) ? stored : 'dark';
      applyTheme(initialTheme);
      return initialTheme;
    }
    return 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
