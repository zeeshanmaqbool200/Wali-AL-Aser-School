import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider, alpha, GlobalStyles, darken, lighten } from '@mui/material';
import { useAuth } from './AuthContext';
import localforage from 'localforage';

type ThemeMode = 'light' | 'dark' | 'system';
type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (val: boolean) => void;
  compactLayout: boolean;
  setCompactLayout: (val: boolean) => void;
  instituteColors: {
    primary: string;
    accent1: string;
    accent2: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ThemeMode>('system');
  const [instituteColors, setInstituteColors] = useState({ 
    primary: '#0d9488', 
    accent1: '#0d9488',
    accent2: '#0284c7' 
  });

  // Initialize theme from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await localforage.getItem<ThemeMode>('theme-mode');
        if (savedMode) setMode(savedMode);
      } catch (err) {
        console.error('Failed to load theme from storage', err);
      }
    };
    loadTheme();
  }, []);

  // Listen for Institutional Branding
  useEffect(() => {
    import('../firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, onSnapshot }) => {
        const unsubscribe = onSnapshot(doc(db, 'settings', 'institute'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setInstituteColors({
              primary: data.primaryBrandColor || data.primaryColor || '#0d9488',
              accent1: data.accentColors?.[0] || data.primaryBrandColor || data.primaryColor || '#0d9488',
              accent2: data.accentColors?.[1] || data.secondaryColor || '#0284c7'
            });
          }
        });
        return () => unsubscribe();
      });
    });
  }, []);

  // Listen for system theme changes if mode is 'system'
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'system') {
        // Force refresh
        setMode('system'); 
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode]);

  const initialUiPrefs = useMemo(() => {
    return user?.uiPrefs || {
      highContrast: false,
      reduceMotion: false,
      compactLayout: false,
    };
  }, [user?.uiPrefs]);

  const [highContrast, setHighContrast] = useState(initialUiPrefs.highContrast);
  const [reduceMotion, setReduceMotion] = useState(initialUiPrefs.reduceMotion);
  const [compactLayout, setCompactLayout] = useState(initialUiPrefs.compactLayout);

  useEffect(() => {
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
      const isMobileSub = window.matchMedia('(max-width: 600px)').matches;
      
      // High Contrast Adjustments
      const primaryMain = highContrast 
        ? (isDark ? '#5eead4' : '#042f2e') 
        : instituteColors.primary;

      const secondaryMain = highContrast
        ? (isDark ? '#cbd5e1' : '#334155')
        : (instituteColors.accent1 || instituteColors.primary);

      const baseFontSize = isMobileSub ? 14 : 16;
      
      return createTheme({
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary: {
            main: primaryMain,
            light: lighten(primaryMain, 0.1),
            dark: darken(primaryMain, 0.1),
            contrastText: '#ffffff',
          },
          secondary: {
            main: secondaryMain,
            light: lighten(secondaryMain, 0.1),
            dark: darken(secondaryMain, 0.1),
            contrastText: '#ffffff',
          },
          background: {
            default: isDark ? '#070707' : '#f8fafc',
            paper: isDark ? '#0f0f0f' : '#ffffff',
          },
          text: {
            primary: isDark ? '#ffffff' : '#0f172a',
            secondary: isDark ? '#a1a1aa' : '#64748b',
          },
          divider: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)',
        },
        // Custom colors available via theme.accent1/accent2
        ...( {
          accent1: instituteColors.accent1,
          accent2: instituteColors.accent2
        } as any),
        spacing: compactLayout ? 4 : 8,
        typography: {
          fontSize: baseFontSize,
          fontFamily: '"Inter", "SF Pro Display", -apple-system, blinkmacsystemfont, "Segoe UI", roboto, sans-serif',
          h1: { fontFamily: '"Cinzel Decorative", serif', fontWeight: 1000, letterSpacing: '-0.02em' },
          h2: { fontFamily: '"Cinzel Decorative", serif', fontWeight: 1000, letterSpacing: '-0.02em' },
          h3: { fontFamily: '"Cinzel Decorative", serif', fontWeight: 900, letterSpacing: '-0.02em' },
          h4: { fontFamily: '"Cinzel Decorative", serif', fontWeight: 900, letterSpacing: '-0.02em' },
          h5: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
          h6: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
          subtitle1: { fontWeight: 500, letterSpacing: '-0.01em' },
          subtitle2: { fontWeight: 500, letterSpacing: '-0.01em' },
          body1: { lineHeight: 1.6, fontSize: `${baseFontSize / 16}rem`, letterSpacing: '-0.011em' },
          body2: { lineHeight: 1.5, fontSize: `${(baseFontSize * 14 / 16) / 16}rem`, letterSpacing: '-0.01em' },
          button: { textTransform: 'none', fontWeight: 700, letterSpacing: '0.01em' },
          caption: { letterSpacing: '0.02em' }
        },
        shape: {
          borderRadius: 0.25,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 0.5,
                padding: '8px 16px', // Standardized padding
                minHeight: 40, // Touch target optimization
                boxShadow: 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '@media (max-width: 600px)': {
                  minHeight: 36, // Scaled compact for mobile
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                },
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  opacity: 0.9,
                },
                '&:active': {
                  transform: 'scale(0.98)',
                },
              },
              containedPrimary: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
                borderRadius: 0.5,
                background: isDark ? '#050505' : '#ffffff',
                boxShadow: isDark 
                  ? '0 4px 12px rgba(0,0,0,0.4)' 
                  : '0 4px 12px rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)'}`,
                transition: 'all 0.3s ease',
                overflow: 'hidden',
                '&:hover': {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                  boxShadow: isDark 
                    ? '0 8px 24px rgba(0,0,0,0.6)' 
                    : '0 8px 24px rgba(0,0,0,0.04)',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 0.5,
                boxShadow: isDark 
                  ? '0 2px 10px rgba(0,0,0,0.3)' 
                  : '0 2px 10px rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                backgroundImage: 'none',
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0.5,
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
                borderRadius: 0.25,
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
    }, [mode, highContrast, compactLayout, instituteColors.primary, instituteColors.accent1, instituteColors.accent2]);

  return (
    <ThemeContext.Provider value={{ 
      mode, 
      setMode, 
      highContrast, 
      setHighContrast,
      reduceMotion,
      setReduceMotion,
      compactLayout,
      setCompactLayout,
      instituteColors
    }}>
      <ThemeProvider theme={theme}>
        <GlobalStyles
          styles={{
            '@keyframes pulse-green': {
              '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.4)' },
              '70%': { transform: 'scale(1.1)', boxShadow: '0 0 0 10px rgba(46, 125, 50, 0)' },
              '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)' },
            },
            '::selection': {
              backgroundColor: alpha(instituteColors.primary, 0.3),
              color: 'inherit'
            },
            '*': reduceMotion ? {
              transition: 'none !important',
              animation: 'none !important',
            } : {},
          }}
        />
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
