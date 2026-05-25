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
  School, CheckCircle
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
        bgcolor: isDark ? '#0f172a' : '#f8fafc',
        backgroundImage: isDark 
          ? `radial-gradient(circle at 0% 0%, ${alpha('#3b82f6', 0.05)} 0%, transparent 50%), 
             radial-gradient(circle at 100% 100%, ${alpha('#1e40af', 0.03)} 0%, transparent 50%)`
          : `radial-gradient(circle at 0% 0%, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 50%)`,
        position: 'relative',
        py: { xs: 4, md: 6 },
        px: 2,
        overflow: 'hidden'
      }}
    >
      {/* Dynamic Background Elements */}
      <Box sx={{ 
        position: 'absolute', 
        width: '100%', 
        height: '100%', 
        top: 0, 
        left: 0, 
        pointerEvents: 'none',
        zIndex: 0 
      }}>
        <Box sx={{ 
          position: 'absolute', 
          top: '-10%', 
          left: '-5%', 
          width: '50vw', 
          height: '50vw', 
          background: isDark ? alpha('#3b82f6', 0.05) : alpha(theme.palette.primary.main, 0.03),
          filter: 'blur(120px)',
          borderRadius: '50%',
        }} />
      </Box>

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Box 
                sx={{ 
                  display: 'inline-flex', 
                  p: 2, 
                  borderRadius: 5, 
                  bgcolor: isDark ? 'background.paper' : '#ffffff',
                  mb: 3,
                  width: { xs: 80, md: 100 },
                  height: { xs: 80, md: 100 },
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isDark 
                    ? '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)'
                    : '0 20px 40px rgba(0,0,0,0.05)',
                  border: isDark ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}
              >
                {institute.logoUrl ? (
                  <Box component="img" src={institute.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <School size={48} color={theme.palette.primary.main} strokeWidth={1.5} />
                )}
              </Box>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Typography variant="h3" sx={{ 
                fontWeight: 950, 
                mb: 1, 
                color: 'text.primary', 
                letterSpacing: -2, 
                fontSize: { xs: '2rem', sm: '2.8rem' },
                fontFamily: 'var(--font-heading)'
              }}>
                {institute.instituteName || 'Wali Ul Aser'}
              </Typography>
              <Typography variant="body1" sx={{ 
                fontWeight: 800, 
                color: 'primary.main', 
                letterSpacing: 2,
                fontSize: { xs: '0.75rem', sm: '0.9rem' },
                textTransform: 'uppercase',
                opacity: 0.8
              }}>
                {institute.tagline || 'Education & Management Portal'}
              </Typography>
            </motion.div>
          </Box>

          <Card
            elevation={0}
            sx={{ 
              borderRadius: 6,
              bgcolor: isDark ? alpha(theme.palette.background.paper, 0.4) : 'white',
              backdropFilter: 'blur(20px)',
              border: '1px solid',
              borderColor: isDark ? alpha('#ffffff', 0.1) : 'divider',
              boxShadow: isDark 
                ? '0 50px 100px rgba(0, 0, 0, 0.5)'
                : '0 30px 60px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden'
            }}
          >
            <CardContent sx={{ p: { xs: 4, sm: 6 } }}>
              <Typography variant="h5" sx={{ fontWeight: 950, mb: 4, textAlign: 'center', letterSpacing: -1 }}>
                {isSignUp ? 'Create Workspace Account' : 'Welcome Back'}
              </Typography>
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Alert 
                      severity="error" 
                      variant="outlined"
                      sx={{ 
                        mb: 3, 
                        borderRadius: 2, 
                        fontWeight: 700, 
                        bgcolor: alpha(theme.palette.error.main, 0.05),
                        borderColor: alpha(theme.palette.error.main, 0.2),
                        color: theme.palette.error.main
                      }}
                    >
                      {error}
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <AnimatePresence mode="wait">
                    {isSignUp && (
                      <motion.div key="signup-fields" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                        <Stack spacing={2} sx={{ mb: 2 }}>
                          <TextField
                            fullWidth
                            label="Full Name"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            sx={{
                              '& .MuiOutlinedInput-root': { 
                                borderRadius: 2.5, 
                                bgcolor: isDark ? alpha('#ffffff', 0.03) : alpha('#000000', 0.02),
                              }
                            }}
                          />
                          <FormControl fullWidth required>
                            <InputLabel>Account Type</InputLabel>
                            <Select
                              value={role}
                              label="Account Type"
                              onChange={(e) => setRole(e.target.value as UserRole)}
                              sx={{ 
                                borderRadius: 2.5, 
                                bgcolor: isDark ? alpha('#ffffff', 0.03) : alpha('#000000', 0.02),
                              }}
                            >
                               <MenuItem value="student">Student Identity</MenuItem>
                              <MenuItem value="teacher">Staff Identity</MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Box>
                    <TextField
                      fullWidth
                      label="Email Address"
                      type="email"
                      required
                      error={emailCheck.exists}
                      helperText={emailCheck.exists ? 'This email is already associated with an account' : ''}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': { 
                          borderRadius: 2.5, 
                          bgcolor: isDark ? alpha('#ffffff', 0.03) : alpha('#000000', 0.02),
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Mail size={18} color={isDark ? alpha('#ffffff', 0.3) : alpha('#000000', 0.3)} />
                          </InputAdornment>
                        ),
                        endAdornment: emailCheck.checking ? (
                          <InputAdornment position="end">
                            <CircularProgress size={16} />
                          </InputAdornment>
                        ) : null
                      }}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: 2.5, 
                        bgcolor: isDark ? alpha('#ffffff', 0.03) : alpha('#000000', 0.02),
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={18} color={isDark ? alpha('#ffffff', 0.3) : alpha('#000000', 0.3)} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} size="small" sx={{ color: isDark ? alpha('#ffffff', 0.3) : alpha('#000000', 0.3) }}>
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={loading}
                    sx={{ 
                      py: 1.8, 
                      borderRadius: 2.5, 
                      fontSize: '1rem', 
                      fontWeight: 900,
                      textTransform: 'none',
                      background: loading 
                        ? 'divider' 
                        : isDark ? `linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)` : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      color: 'white',
                      boxShadow: isDark ? `0 4px 12px ${alpha('#2563eb', 0.2)}` : `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                      transition: 'all 0.4s cubic-bezier(0.2, 1, 0.2, 1)',
                      '&:hover': { 
                        transform: 'translateY(-2px)',
                        boxShadow: isDark ? `0 6px 15px ${alpha('#2563eb', 0.3)}` : `0 6px 15px ${alpha(theme.palette.primary.main, 0.2)}`,
                        filter: 'brightness(1.1)'
                      },
                      '&:active': { transform: 'scale(0.97)' }
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {isSignUp ? 'Activate Account' : 'Access Wali Ul Aser'}
                        <ArrowRight size={20} />
                      </Box>
                    )}
                  </Button>
                </Stack>
              </form>

              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: isDark ? alpha('#ffffff', 0.3) : 'text.secondary' }}>
                  {isSignUp ? 'Returning back?' : "New here?"}{' '}
                  <Button
                    variant="text"
                    onClick={() => setIsSignUp(!isSignUp)}
                    sx={{ 
                      fontWeight: 900, 
                      color: isDark ? '#60a5fa' : theme.palette.primary.main, 
                      textTransform: 'none', 
                      px: 1,
                      '&:hover': { bgcolor: alpha(isDark ? '#60a5fa' : theme.palette.primary.main, 0.05) }
                    }}
                  >
                    {isSignUp ? 'Sign In' : 'Create Account'}
                  </Button>
                </Typography>
              </Box>
            </CardContent>
          </Card>
          
          <Box sx={{ mt: 5, textAlign: 'center' }}>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <ShieldCheck size={14} color={isDark ? alpha('#ffffff', 0.2) : alpha('#000000', 0.2)} />
              <Typography variant="caption" sx={{ fontWeight: 800, color: isDark ? alpha('#ffffff', 0.2) : alpha('#000000', 0.25), letterSpacing: 1, textTransform: 'uppercase' }}>
                Secured Institutional Environment
              </Typography>
            </Stack>
          </Box>
        </motion.div>
      </Container>

      <GlobalStyles styles={{
        '@keyframes float': {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '100%': { transform: 'translate(20px, 20px) scale(1.1)' }
        }
      }} />
    </Box>
  );
}
