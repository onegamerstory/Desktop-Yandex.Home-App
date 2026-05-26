import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first, then default to 'dark'
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
      const initialTheme = stored === 'light' || stored === 'dark' ? stored : 'dark';
      // Apply theme immediately on initialization
      if (initialTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      document.documentElement.setAttribute('data-theme', initialTheme);
      if (initialTheme === 'light') {
        document.body.style.backgroundColor = '#f5f5f5';
        document.body.style.color = '#1e293b';
      } else {
        document.body.style.backgroundColor = '#0f172a';
        document.body.style.color = '#f8fafc';
      }
      return initialTheme;
    }
    return 'dark';
  });

  useEffect(() => {
    // Apply theme to document root for Tailwind dark mode
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Also set data-theme attribute for CSS custom properties if needed
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update body background color
    if (theme === 'light') {
      document.body.style.backgroundColor = '#f5f5f5';
      document.body.style.color = '#1e293b';
    } else {
      document.body.style.backgroundColor = '#0f172a';
      document.body.style.color = '#f8fafc';
    }
    
    // Save to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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

