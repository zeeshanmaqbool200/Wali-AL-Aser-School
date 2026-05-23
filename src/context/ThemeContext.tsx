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
  navPreference: 'bottom' | 'side';
  setNavPreference: (val: 'bottom' | 'side') => void;
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
  const [navPreference, setNavPreference] = useState<'bottom' | 'side'>('bottom');
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
            if (data.navPreference) setNavPreference(data.navPreference as 'bottom' | 'side');
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
      navPreference: 'bottom'
    };
  }, [user?.uiPrefs]);

  const [highContrast, setHighContrast] = useState(initialUiPrefs.highContrast);
  const [reduceMotion, setReduceMotion] = useState(initialUiPrefs.reduceMotion);
  const [compactLayout, setCompactLayout] = useState(initialUiPrefs.compactLayout);

  useEffect(() => {
    setHighContrast(initialUiPrefs.highContrast);
    setReduceMotion(initialUiPrefs.reduceMotion);
    setCompactLayout(initialUiPrefs.compactLayout);
    if (initialUiPrefs.navPreference) setNavPreference(initialUiPrefs.navPreference as 'bottom' | 'side');
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
        : (instituteColors.accent2 || '#0284c7');

      const baseFontSize = isMobileSub ? 14 : 16;
      const radius = 0.5; // Subtle 1% feel, roughly 4px
      
      return createTheme({
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary: {
            main: primaryMain,
            light: lighten(primaryMain, 0.2),
            dark: darken(primaryMain, 0.2),
            contrastText: '#ffffff',
          },
          secondary: {
            main: secondaryMain,
            light: lighten(secondaryMain, 0.2),
            dark: darken(secondaryMain, 0.2),
            contrastText: '#ffffff',
          },
          background: {
            default: isDark ? '#050505' : '#f8fafc',
            paper: isDark ? '#0c0c0c' : '#ffffff',
          },
          text: {
            primary: isDark ? '#f8fafc' : '#0f172a',
            secondary: isDark ? '#94a3b8' : '#64748b',
          },
          divider: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        },
        shadows: isDark 
          ? [
              'none', '0 2px 4px rgba(0,0,0,0.4)', '0 4px 8px rgba(0,0,0,0.5)', 
              '0 8px 16px rgba(0,0,0,0.6)', '0 12px 24px rgba(0,0,0,0.7)', 
              '0 16px 32px rgba(0,0,0,0.8)', ...Array(19).fill('none')
            ] as any
          : [
              'none', '0 1px 3px rgba(0,0,0,0.01)', '0 4px 12px rgba(0,0,0,0.02)', 
              '0 8px 24px rgba(0,0,0,0.03)', '0 12px 32px rgba(0,0,0,0.04)', 
              '0 16px 48px rgba(0,0,0,0.05)', ...Array(19).fill('none')
            ] as any,
        // Custom colors available via theme.accent1/accent2
        ...( {
          accent1: instituteColors.accent1,
          accent2: instituteColors.accent2
        } as any),
        spacing: compactLayout ? 6 : 8,
        typography: {
          fontSize: baseFontSize,
          fontFamily: '"Inter", "Outfit", sans-serif',
          h1: { fontWeight: 900, letterSpacing: '-0.04em' },
          h2: { fontWeight: 900, letterSpacing: '-0.04em' },
          h3: { fontWeight: 800, letterSpacing: '-0.03em' },
          h4: { fontWeight: 800, letterSpacing: '-0.03em' },
          h5: { fontWeight: 700, letterSpacing: '-0.02em' },
          h6: { fontWeight: 700, letterSpacing: '-0.01em' },
          subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
          subtitle2: { fontWeight: 600, letterSpacing: '-0.01em' },
          body1: { lineHeight: 1.6, fontSize: `${baseFontSize / 16}rem`, letterSpacing: '-0.011em' },
          body2: { lineHeight: 1.5, fontSize: `${(baseFontSize * 14 / 16) / 16}rem`, letterSpacing: '-0.01em' },
          button: { textTransform: 'none', fontWeight: 800, letterSpacing: '0.01em' },
          caption: { letterSpacing: '0.03em', fontWeight: 600 }
        },
        shape: {
          borderRadius: 4, // 4px fixed for that 1% look
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 6, // Slightly more for buttons
                padding: '8px 20px', 
                minHeight: 38, 
                boxShadow: 'none',
                fontSize: isMobileSub ? '0.75rem' : '0.9rem',
                transition: 'all 0.2s ease-in-out',
                '@media (max-width: 600px)': {
                  minHeight: 32,
                  padding: '4px 12px',
                },
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.08)',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 8, 
                background: isDark ? alpha('#0f172a', 0.4) : '#ffffff',
                backdropFilter: isDark ? 'blur(10px)' : 'none',
                boxShadow: isDark 
                  ? '0 4px 20px rgba(0,0,0,0.4)' 
                  : '0 2px 10px rgba(0,0,0,0.01)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
                transition: 'all 0.2s ease-in-out',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark 
                    ? '0 10px 30px rgba(0,0,0,0.5)' 
                    : '0 4px 16px rgba(0,0,0,0.03)',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: radius,
                backgroundImage: 'none',
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1, 
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.9)',
                  '& fieldset': {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
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
                borderRadius: 1,
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
      navPreference,
      setNavPreference,
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
