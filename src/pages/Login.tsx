import React, { useState, useMemo } from 'react';
import { 
  Box, Button, Card, CardContent, Typography, Container, Alert, 
  TextField, Link, FormControl, InputLabel, Select, MenuItem,
  IconButton, InputAdornment, Stack,
  Paper, Divider, Fade, Zoom, CircularProgress, Grid, GlobalStyles
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  LogIn, UserPlus, Eye, EyeOff, Mail, Lock, User, 
  ShieldCheck, Sparkles, ArrowRight, GraduationCap,
  School, CheckCircle, AlertCircle
} from 'lucide-react';
import { UserRole, InstituteSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useThemeContext } from '../context/ThemeContext';

interface LoginProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onSignUp: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  error?: string | null;
}

export default function Login({ onLogin, onSignUp, error }: LoginProps) {
  const theme = useTheme();
  const { mode } = useThemeContext();
  const isDark = theme.palette.mode === 'dark';
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailCheck, setEmailCheck] = useState<{ exists: boolean, checking: boolean }>({ exists: false, checking: false });
  const [institute, setInstitute] = useState<Partial<InstituteSettings>>({});

  // Real-time email duplicate check
  React.useEffect(() => {
    if (!isSignUp || email.length < 5 || !email.includes('@')) {
      setEmailCheck({ exists: false, checking: false });
      return;
    }

    const checkEmail = async () => {
      setEmailCheck(prev => ({ ...prev, checking: true }));
      try {
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()), limit(1));
        const snap = await getDocs(q);
        setEmailCheck({ exists: !snap.empty, checking: false });
      } catch (e) {
        setEmailCheck(prev => ({ ...prev, checking: false }));
      }
    };

    const timer = setTimeout(checkEmail, 800);
    return () => clearTimeout(timer);
  }, [email, isSignUp]);

  React.useEffect(() => {
    const fetchBranding = async () => {
      const snap = await getDoc(doc(db, 'settings', 'institute'));
      if (snap.exists()) {
        const data = snap.data();
        setInstitute({
          ...data,
          tagline: data.tagline || ''
        });
      }
    };
    fetchBranding();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await onSignUp(email, password, name, role);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100dvh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: isDark 
          ? `radial-gradient(circle at 0% 0%, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 40%),
             radial-gradient(circle at 100% 100%, ${alpha(theme.palette.secondary.main, 0.08)} 0%, transparent 40%),
             #0a0a0a`
          : `radial-gradient(circle at 100% 0%, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 40%),
             radial-gradient(circle at 0% 100%, ${alpha(theme.palette.secondary.main, 0.05)} 0%, transparent 40%),
             #fdfcfb`,
        position: 'relative',
        py: { xs: 4, md: 8 },
        px: 2,
        overflow: 'hidden'
      }}
    >
      {/* Decorative Ornaments (Islamic/Academic Pattern) */}
      <Box sx={{ 
        position: 'absolute', 
        inset: 0, 
        opacity: isDark ? 0.03 : 0.02, 
        zIndex: 0,
        pointerEvents: 'none',
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/p6.png")',
        backgroundRepeat: 'repeat'
      }} />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <Box 
                sx={{ 
                  display: 'inline-flex', 
                  p: 2.5, 
                  borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%', 
                  bgcolor: isDark ? 'background.paper' : '#ffffff',
                  mb: 4,
                  width: { xs: 90, md: 120 },
                  height: { xs: 90, md: 120 },
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isDark 
                    ? '0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
                    : '0 30px 60px rgba(0,0,0,0.1)',
                  border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  position: 'relative',
                  overflow: 'hidden',
                  '&:before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(45deg, transparent, ${alpha(theme.palette.primary.main, 0.1)}, transparent)`,
                    animation: 'shimmer 3s infinite linear'
                  }
                }}
              >
                {institute.logoUrl ? (
                  <Box component="img" src={institute.logoUrl} sx={{ width: '80%', height: '80%', objectFit: 'contain', zIndex: 1 }} />
                ) : (
                  <School size={56} color={theme.palette.primary.main} strokeWidth={1} style={{ zIndex: 1 }} />
                )}
              </Box>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <Typography variant="h5" sx={{ 
                fontWeight: 900, 
                color: theme.palette.primary.main, 
                letterSpacing: 4,
                mb: 1.5,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                opacity: 0.9,
                fontFamily: '"Outfit", sans-serif'
              }}>
                ASSLAMUALIKUM
              </Typography>
              <Typography variant="h2" sx={{ 
                fontWeight: 950, 
                mb: 1.5, 
                color: 'text.primary', 
                letterSpacing: -2, 
                fontSize: { xs: '2.2rem', sm: '3.4rem' },
                fontFamily: '"Cinzel Decorative", serif',
                lineHeight: 1
              }}>
                {institute.instituteName || 'Wali Ul Aser'}
              </Typography>
              <Typography variant="body1" sx={{ 
                fontWeight: 700, 
                color: 'text.secondary', 
                letterSpacing: 1,
                fontSize: { xs: '0.85rem', sm: '1rem' },
                maxWidth: 400,
                mx: 'auto',
                opacity: 0.7,
                fontFamily: '"Outfit", sans-serif'
              }}>
                {institute.tagline || 'Institutional Management & Digital Learning Portal'}
              </Typography>
            </motion.div>
          </Box>

          <Card
            elevation={0}
            sx={{ 
              borderRadius: 8,
              bgcolor: isDark ? alpha(theme.palette.background.paper, 0.6) : alpha('rgba(255,255,255,0.8)', 0.95),
              backdropFilter: 'blur(30px)',
              border: '1px solid',
              borderColor: isDark ? alpha('#ffffff', 0.1) : alpha(theme.palette.primary.main, 0.1),
              boxShadow: isDark 
                ? '0 60px 120px -20px rgba(0, 0, 0, 0.8)'
                : '0 60px 120px -20px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden',
              position: 'relative',
              '&:after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
              }
            }}
          >
            <CardContent sx={{ p: { xs: 4, sm: 7 } }}>
              <Typography variant="h4" sx={{ fontWeight: 950, mb: 5, textAlign: 'center', letterSpacing: -1.5, fontFamily: '"Outfit", sans-serif', textTransform: 'uppercase', fontSize: '1.25rem', opacity: 0.8 }}>
                {isSignUp ? 'Enrollment Portal' : 'Academic Gateway'}
              </Typography>
              
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <Alert 
                      severity="error" 
                      icon={<AlertCircle size={20} />}
                      sx={{ 
                        mb: 4, 
                        borderRadius: 3, 
                        fontWeight: 700, 
                        bgcolor: alpha(theme.palette.error.main, 0.03),
                        color: theme.palette.error.main,
                        border: '1px solid',
                        borderColor: alpha(theme.palette.error.main, 0.1),
                        '& .MuiAlert-icon': { color: theme.palette.error.main }
                      }}
                    >
                      {error}
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <AnimatePresence mode="wait">
                    {isSignUp && (
                      <motion.div 
                        key="signup-fields" 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: "circOut" }}
                      >
                        <Stack spacing={3} sx={{ pb: 3 }}>
                          <TextField
                            fullWidth
                            label="Certified Name"
                            variant="filled"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            InputProps={{ 
                              disableUnderline: true,
                              sx: { borderRadius: 4, fontWeight: 700, bgcolor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.03) } 
                            }}
                          />
                          <FormControl fullWidth required variant="filled">
                            <InputLabel sx={{ fontWeight: 700 }}>Academic Identity</InputLabel>
                            <Select
                              value={role}
                              label="Academic Identity"
                              disableUnderline
                              onChange={(e) => setRole(e.target.value as UserRole)}
                              sx={{ 
                                borderRadius: 4, 
                                fontWeight: 700,
                                bgcolor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.03),
                                '& .MuiSelect-select': { py: 2 }
                              }}
                            >
                               <MenuItem value="student" sx={{ py: 1.5, fontWeight: 700 }}>Registered Student</MenuItem>
                               <MenuItem value="teacher" sx={{ py: 1.5, fontWeight: 700 }}>Staff Faculty</MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Box 
                    component={motion.div}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <TextField
                      fullWidth
                      label="University Email"
                      type="email"
                      variant="filled"
                      required
                      error={emailCheck.exists}
                      helperText={emailCheck.exists ? 'System ID already active for this account.' : ''}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      InputProps={{
                        disableUnderline: true,
                        sx: { borderRadius: 4, fontWeight: 700, bgcolor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.03) },
                        startAdornment: (
                          <InputAdornment position="start">
                            <Mail size={20} style={{ opacity: 0.4 }} />
                          </InputAdornment>
                        ),
                        endAdornment: emailCheck.checking ? (
                          <CircularProgress size={18} thickness={6} />
                        ) : null
                      }}
                    />
                  </Box>

                  <Box 
                    component={motion.div}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <TextField
                      fullWidth
                      label="Secure Cipher"
                      variant="filled"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      InputProps={{
                        disableUnderline: true,
                        sx: { borderRadius: 4, fontWeight: 700, bgcolor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.03) },
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock size={20} style={{ opacity: 0.4 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <IconButton onClick={() => setShowPassword(!showPassword)} size="small" edge="end">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </IconButton>
                        ),
                      }}
                    />
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={loading}
                    component={motion.button}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    sx={{ 
                      py: 2.2, 
                      borderRadius: 10, 
                      fontSize: '1rem', 
                      fontWeight: 950,
                      textTransform: 'none',
                      letterSpacing: 0.5,
                      fontFamily: '"Outfit", sans-serif',
                      background: loading 
                        ? 'divider' 
                        : isDark ? `linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)` : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      boxShadow: isDark 
                        ? '0 15px 35px rgba(0, 0, 0, 0.4)' 
                        : `0 15px 35px ${alpha(theme.palette.primary.main, 0.2)}`,
                      border: 'none',
                      '&:hover': { 
                        boxShadow: isDark 
                          ? '0 20px 45px rgba(0, 0, 0, 0.5)' 
                          : `0 20px 45px ${alpha(theme.palette.primary.main, 0.3)}`,
                        filter: 'brightness(1.1)'
                      }
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" thickness={6} />
                    ) : (
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography sx={{ fontWeight: 950 }}>{isSignUp ? 'Initialize Enrollment' : 'Enter Academy'}</Typography>
                        <ArrowRight size={20} />
                      </Stack>
                    )}
                  </Button>
                </Stack>
              </form>

              <Box sx={{ mt: 5, textAlign: 'center' }}>
                <Typography variant="body1" sx={{ fontWeight: 800, color: 'text.secondary', opacity: 0.6 }}>
                  {isSignUp ? 'Already have an academic profile?' : "Don't have an ID yet?"}
                </Typography>
                <Button
                  onClick={() => setIsSignUp(!isSignUp)}
                  sx={{ 
                    mt: 1,
                    fontWeight: 950, 
                    color: theme.palette.primary.main, 
                    fontSize: '1rem',
                    textTransform: 'none',
                    letterSpacing: -0.5,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                  }}
                >
                  {isSignUp ? 'Access Portal Now' : 'Create System ID'}
                </Button>
              </Box>
            </CardContent>
          </Card>
          
          <Stack sx={{ mt: 6 }} spacing={2} alignItems="center">
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ opacity: 0.4 }}>
              <ShieldCheck size={16} />
              <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>
                Encrypted Academic Exchange
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ opacity: 0.2, fontWeight: 700 }}>
              &copy; {new Date().getFullYear()} Wali Ul Aser Academy. All Rights Reserved.
            </Typography>
          </Stack>
        </motion.div>
      </Container>

      <GlobalStyles styles={{
        '@keyframes shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      }} />
    </Box>
  );
}
