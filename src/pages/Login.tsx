import React, { useState } from 'react';
import { 
  Box, Button, Card, CardContent, Typography, Container, Alert, 
  TextField, Link, FormControl, InputLabel, Select, MenuItem,
  IconButton, InputAdornment, Stack,
  Paper, Divider, Fade, Zoom, CircularProgress, Grid
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

interface LoginProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onSignUp: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  error?: string | null;
}

export default function Login({ onLogin, onSignUp, error }: LoginProps) {
  const theme = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
        // Here we could pass phone if we wanted to store it during initial signup
        // if we update onSignUp to accept it, but for now we'll keep it simple
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
        bgcolor: '#020617',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(13, 148, 136, 0.05) 0%, transparent 80%)',
        position: 'relative',
        py: { xs: 4, md: 6 },
        px: 2
      }}
    >
      {/* Subtle Grid Background */}
      <Box sx={{ 
        position: 'absolute', 
        inset: 0,
        opacity: 0.1,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse at center, black, transparent 80%)'
      }} />

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Box 
                sx={{ 
                  display: 'inline-flex', 
                  p: 0, 
                  borderRadius: 4, 
                  bgcolor: 'transparent',
                  mb: 3,
                  width: { xs: 64, md: 80 },
                  height: { xs: 64, md: 80 },
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: 'drop-shadow(0 0 20px rgba(13, 148, 136, 0.4))'
                }}
              >
                {institute.logoUrl ? (
                  <Box component="img" src={institute.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <School size={isSignUp ? 40 : 50} color="#0d9488" strokeWidth={1.5} />
                )}
              </Box>
            </motion.div>
            <Typography variant="h3" sx={{ 
              fontWeight: 950, 
              mb: 1.5, 
              color: 'white', 
              letterSpacing: -1.5, 
              fontSize: { xs: '1.75rem', sm: '2.5rem' },
              fontFamily: 'var(--font-heading)'
            }}>
              {institute.instituteName}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>
              {institute.tagline}
            </Typography>
          </Box>

          <Box
            sx={{ 
              maxWidth: 380,
              mx: 'auto',
              bgcolor: 'transparent',
            }}
          >
            <AnimatePresence mode="wait">
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Alert 
                    severity="error" 
                    variant="outlined"
                    sx={{ 
                      mb: 3, 
                      borderRadius: 3, 
                      fontWeight: 700, 
                      bgcolor: alpha(theme.palette.error.main, 0.05),
                      borderColor: alpha(theme.palette.error.main, 0.2),
                      color: 'error.light'
                    }}
                  >
                    {error}
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <AnimatePresence mode="wait">
                  {isSignUp && (
                    <motion.div key="signup-fields" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <Stack spacing={2.5}>
                        <TextField
                          fullWidth
                          label="Preferred Name"
                          placeholder="Your full name"
                          required
                          variant="filled"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          sx={{
                            '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } },
                            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
                            '& .MuiInputBase-input': { color: 'white' }
                          }}
                        />
                        <FormControl fullWidth required variant="filled">
                          <InputLabel sx={{ color: 'rgba(255,255,255,0.4)' }}>Account Type</InputLabel>
                          <Select
                            value={role}
                            label="Account Type"
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            sx={{ 
                              borderRadius: 3, 
                              bgcolor: 'rgba(255,255,255,0.03)',
                              color: 'white',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                            }}
                          >
                            <MenuItem value="student">Student Account</MenuItem>
                            <MenuItem value="teacher">Teacher Account</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </motion.div>
                  )}
                </AnimatePresence>

                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  variant="filled"
                  placeholder="Enter your email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  sx={{
                    '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
                    '& .MuiInputBase-input': { color: 'white' }
                  }}
                />

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  variant="filled"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{
                    '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
                    '& .MuiInputBase-input': { color: 'white' }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(255,255,255,0.3)' }}>
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
                    borderRadius: 3, 
                    fontSize: '1rem', 
                    fontWeight: 800,
                    bgcolor: 'primary.main',
                    color: 'white',
                    mt: 2,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: 'primary.dark', boxShadow: 'none' }
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    isSignUp ? 'Create Account' : 'Sign In'
                  )}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.3)' }}>
                {isSignUp ? 'Already a member?' : 'New to Idarah?'}{' '}
                <Button
                  variant="text"
                  onClick={() => setIsSignUp(!isSignUp)}
                  sx={{ fontWeight: 800, color: 'primary.light', textTransform: 'none', px: 1 }}
                >
                  {isSignUp ? 'Log in' : 'Join now'}
                </Button>
              </Typography>
            </Box>
          </Box>
          <Box sx={{ mt: 5, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
              © {new Date().getFullYear()} {institute.instituteName?.toUpperCase()}
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}
