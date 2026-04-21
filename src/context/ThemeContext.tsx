import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider, alpha, GlobalStyles, darken, lighten } from '@mui/material';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode');
    return (saved as ThemeMode) || 'light';
  });

  const uiPrefs = useMemo(() => user?.uiPrefs || {
    highContrast: false,
    reduceMotion: false,
    compactLayout: false,
    accentColor: '#0f766e'
  }, [user?.uiPrefs]);

  const [accentColor, setAccentColor] = useState(uiPrefs.accentColor || '#0f766e');

  useEffect(() => {
    setAccentColor(uiPrefs.accentColor || '#0f766e');
  }, [uiPrefs.accentColor]);

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  const theme = useMemo(() => {
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // High Contrast Adjustments
    const primaryMain = uiPrefs.highContrast
      ? (isDark ? '#5eead4' : '#042f2e')
      : (accentColor || '#0f766e');

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
      spacing: uiPrefs.compactLayout ? 4 : 8,
      typography: {
        fontFamily: '"Inter", sans-serif',
        h1: { fontWeight: 800, letterSpacing: '-0.05em' },
        h2: { fontWeight: 800, letterSpacing: '-0.04em' },
        h3: { fontWeight: 700, letterSpacing: '-0.03em' },
        h4: { fontWeight: 700, letterSpacing: '-0.02em' },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        subtitle1: { fontWeight: 500, letterSpacing: '-0.01em' },
        subtitle2: { fontWeight: 500, letterSpacing: '-0.01em' },
        body1: { lineHeight: 1.6, fontSize: '1rem' },
        body2: { lineHeight: 1.5, fontSize: '0.875rem' },
        button: { textTransform: 'none', fontWeight: 700, letterSpacing: '0.02em' },
      },
      shape: {
        borderRadius: 4,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 4,
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
              borderRadius: 6,
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
              borderRadius: 4,
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
                borderRadius: 4,
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
              borderRadius: 2,
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
  }, [mode, uiPrefs]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, accentColor, setAccentColor }}>
      <ThemeProvider theme={theme}>
        {uiPrefs.reduceMotion && (
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
