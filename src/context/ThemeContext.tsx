import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider, alpha, GlobalStyles, darken, lighten } from '@mui/material';
import { useAuth } from './AuthContext';
import localforage from 'localforage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (val: boolean) => void;
  compactLayout: boolean;
  setCompactLayout: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ThemeMode>('light');

  // Initialize theme from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await localforage.getItem<ThemeMode>('theme-mode');
        if (saved) {
          setMode(saved);
        }
      } catch (err) {
        console.error('Failed to load theme from storage', err);
      }
    };
    loadTheme();
  }, []);

  const initialUiPrefs = useMemo(() => user?.uiPrefs || {
    highContrast: false,
    reduceMotion: false,
    compactLayout: false,
    accentColor: '#0f766e'
  }, [user?.uiPrefs]);

  const [accentColor, setAccentColor] = useState(initialUiPrefs.accentColor);
  const [highContrast, setHighContrast] = useState(initialUiPrefs.highContrast);
  const [reduceMotion, setReduceMotion] = useState(initialUiPrefs.reduceMotion);
  const [compactLayout, setCompactLayout] = useState(initialUiPrefs.compactLayout);

  useEffect(() => {
    setAccentColor(initialUiPrefs.accentColor);
    setHighContrast(initialUiPrefs.highContrast);
    setReduceMotion(initialUiPrefs.reduceMotion);
    setCompactLayout(initialUiPrefs.compactLayout);
  }, [initialUiPrefs]);

  useEffect(() => {
    const saveTheme = async () => {
      try {
        await localforage.setItem('theme-mode', mode);
      } catch (err) {
        console.error('Failed to save theme to storage', err);
      }
    };
    saveTheme();
  }, [mode]);

    const theme = useMemo(() => {
      const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      // High Contrast Adjustments
      const primaryMain = highContrast 
        ? (isDark ? '#5eead4' : '#042f2e') 
        : accentColor;
      
      return createTheme({
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary: {
            main: primaryMain,
            light: lighten(primaryMain, 0.2),
            dark: darken(primaryMain, 0.2),
            contrastText: isDark ? '#000000' : '#ffffff',
          },
          secondary: {
            main: isDark ? '#121212' : '#f5f5f5',
            contrastText: isDark ? '#ffffff' : '#000000',
          },
          background: {
            default: isDark ? '#000000' : '#ffffff',
            paper: isDark ? '#121212' : '#ffffff',
          },
          text: {
            primary: isDark ? '#ffffff' : '#000000',
            secondary: isDark ? '#8e8e93' : '#737373',
          },
          divider: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)',
        },
        spacing: compactLayout ? 4 : 8,
        typography: {
          fontFamily: '"Inter", "Noto Nastaliq Urdu", sans-serif',
          h1: { fontFamily: '"Cinzel", serif', fontWeight: 800, letterSpacing: '-0.05em' },
          h2: { fontFamily: '"Cinzel", serif', fontWeight: 800, letterSpacing: '-0.04em' },
          h3: { fontFamily: '"Cinzel", serif', fontWeight: 700, letterSpacing: '-0.03em' },
          h4: { fontFamily: '"Cinzel", serif', fontWeight: 700, letterSpacing: '-0.02em' },
          h5: { fontWeight: 600 },
          h6: { fontWeight: 600 },
          subtitle1: { fontWeight: 500, letterSpacing: '-0.01em' },
          subtitle2: { fontWeight: 500, letterSpacing: '-0.01em' },
          body1: { lineHeight: 1.6, fontSize: '1rem' },
          body2: { lineHeight: 1.5, fontSize: '0.875rem' },
          button: { textTransform: 'none', fontWeight: 700, letterSpacing: '0.02em' },
        },
        shape: {
          borderRadius: 0.5,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 1,
                padding: '12px 24px',
                boxShadow: 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: 'none',
                  opacity: 0.9,
                },
                '&:active': {
                  transform: 'scale(0.96)',
                },
              },
              containedPrimary: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
              outlined: {
                borderWidth: '1.5px',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                '&:hover': {
                  borderWidth: '1.5px',
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 1,
                background: isDark ? '#121212' : '#ffffff',
                boxShadow: 'none',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                transition: 'all 0.3s ease',
                overflow: 'hidden',
                '&:hover': {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 1,
                boxShadow: 'none',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                backgroundImage: 'none',
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  '& fieldset': {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                    transition: 'border-color 0.2s ease',
                  },
                  '&:hover fieldset': {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                  },
                  '&.Mui-focused fieldset': {
                    borderWidth: '1.5px',
                  },
                },
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                boxShadow: 'none',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                borderRadius: '50%',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  transform: 'scale(1.05)',
                },
                '&.close-button': {
                  background: isDark ? '#ffffff' : '#000000',
                  color: isDark ? '#000000' : '#ffffff',
                  border: 'none',
                  '&:hover': {
                    background: isDark ? alpha('#ffffff', 0.9) : alpha('#000000', 0.9),
                  }
                }
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 0.5,
                fontWeight: 700,
                fontSize: '0.75rem',
              },
            },
          },
          MuiTabs: {
            styleOverrides: {
              indicator: {
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9375rem',
              },
            },
          },
        },
      });
    }, [mode, highContrast, compactLayout, accentColor]);

  return (
    <ThemeContext.Provider value={{ 
      mode, setMode, 
      accentColor, setAccentColor, 
      highContrast, setHighContrast, 
      reduceMotion, setReduceMotion, 
      compactLayout, setCompactLayout 
    }}>
      <ThemeProvider theme={theme}>
        {reduceMotion && (
          <GlobalStyles
            styles={{
              '*': {
                transition: 'none !important',
                animation: 'none !important',
              },
            }}
          />
        )}
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProviderWrapper');
  }
  return context;
}
