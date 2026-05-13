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
  const [institute, setInstitute] = useState<Partial<InstituteSettings>>({
    instituteName: 'Wali Ul Aser Institute',
    tagline: 'Simple Learning for Everyone'
  });

  React.useEffect(() => {
    const fetchBranding = async () => {
      const snap = await getDoc(doc(db, 'settings', 'institute'));
      if (snap.exists()) {
        const data = snap.data();
        setInstitute({
          ...data,
          tagline: data.tagline || 'Simple Learning for Everyone'
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
        bgcolor: isDark ? '#050505' : '#f8fafc',
        backgroundImage: isDark 
          ? `radial-gradient(circle at 0% 0%, ${alpha('#ffffff', 0.015)} 0%, transparent 50%), 
             radial-gradient(circle at 100% 100%, ${alpha('#ffffff', 0.01)} 0%, transparent 50%)`
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
          top: '20%', 
          left: '10%', 
          width: '40vw', 
          height: '40vw', 
          background: isDark ? alpha('#ffffff', 0.02) : alpha(theme.palette.primary.main, 0.03),
          filter: 'blur(100px)',
          borderRadius: '50%',
          animation: 'float 20s infinite alternate ease-in-out'
        }} />
        <Box sx={{ 
          position: 'absolute', 
          bottom: '10%', 
          right: '5%', 
          width: '30vw', 
          height: '30vw', 
          background: isDark ? alpha('#ffffff', 0.02) : alpha(theme.palette.secondary.main, 0.03),
          filter: 'blur(80px)',
          borderRadius: '50%',
          animation: 'float 15s infinite alternate-reverse ease-in-out'
        }} />
      </Box>

      {/* Subtle Grid Background */}
      <Box sx={{ 
        position: 'absolute', 
        inset: 0,
        opacity: isDark ? 0.15 : 0.4,
        backgroundImage: isDark
          ? 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)'
          : 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(circle at center, black, transparent 80%)',
        zIndex: 0
      }} />

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Box 
                sx={{ 
                  display: 'inline-flex', 
                  p: 1.5, 
                  borderRadius: 4, 
                  bgcolor: isDark ? alpha('#ffffff', 0.03) : '#ffffff',
                  mb: 2.5,
                  width: { xs: 64, md: 80 },
                  height: { xs: 64, md: 80 },
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isDark 
                    ? '0 0 0 1px rgba(255,255,255,0.1), 0 20px 40px rgba(0,0,0,0.8)'
                    : '0 10px 30px rgba(0,0,0,0.05)',
                  backdropFilter: 'blur(10px)',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none'
                }}
              >
                {institute.logoUrl ? (
                  <Box component="img" src={institute.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <GraduationCap size={32} color={isDark ? '#3b82f6' : theme.palette.primary.main} strokeWidth={1.5} />
                )}
              </Box>
            </motion.div>
            
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Typography variant="h3" sx={{ 
                fontWeight: 950, 
                mb: 0.5, 
                color: isDark ? 'white' : 'text.primary', 
                letterSpacing: -1.5, 
                fontSize: { xs: '1.75rem', sm: '2.4rem' },
                fontFamily: 'var(--font-heading)',
                textShadow: isDark ? '0 0 30px rgba(255,255,255,0.1)' : 'none'
              }}>
                {institute.instituteName}
              </Typography>
              <Typography variant="body1" sx={{ 
                fontWeight: 800, 
                color: isDark ? alpha('#ffffff', 0.7) : 'text.secondary', 
                letterSpacing: 1.5,
                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                textTransform: 'uppercase',
                mt: 1
              }}>
                {institute.tagline}
              </Typography>
            </motion.div>
          </Box>

          <Card
            elevation={0}
            sx={{ 
              borderRadius: 4,
              bgcolor: isDark ? 'rgba(10, 10, 10, 0.7)' : 'white',
              backdropFilter: 'blur(30px)',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              boxShadow: isDark 
                ? '0 40px 80px rgba(0, 0, 0, 0.9)'
                : '0 20px 40px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden'
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
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
                              <MenuItem value="student">Student Portal</MenuItem>
                              <MenuItem value="teacher">Teacher Portal</MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    required
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
                    }}
                  />

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
                      boxShadow: isDark ? `0 10px 30px ${alpha('#2563eb', 0.4)}` : `0 10px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                      transition: 'all 0.4s cubic-bezier(0.2, 1, 0.2, 1)',
                      '&:hover': { 
                        transform: 'translateY(-2px)',
                        boxShadow: isDark ? `0 15px 40px ${alpha('#2563eb', 0.6)}` : `0 15px 30px ${alpha(theme.palette.primary.main, 0.4)}`,
                        filter: 'brightness(1.1)'
                      },
                      '&:active': { transform: 'scale(0.97)' }
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {isSignUp ? 'Activate Portal' : 'Access Portal'}
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
