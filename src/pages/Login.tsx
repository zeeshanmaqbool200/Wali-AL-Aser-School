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
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: '#0a0a0a',
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(15, 118, 110, 0.05) 0%, transparent 40%),
          radial-gradient(circle at 90% 80%, rgba(15, 118, 110, 0.05) 0%, transparent 40%)
        `,
        position: 'relative',
        overflow: 'hidden',
        py: 4
      }}
    >
      {/* Abstract Background Element */}
      <Box sx={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        width: '120vw',
        height: '120vh',
        opacity: 0.03,
        pointerEvents: 'none',
        background: 'repeating-linear-gradient(45deg, #0f766e 0px, #0f766e 1px, transparent 1px, transparent 40px)'
      }} />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Box 
              sx={{ 
                display: 'inline-flex', 
                p: 0, 
                borderRadius: 4, 
                bgcolor: 'transparent',
                mb: 4,
                width: 80,
                height: 80,
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 0 15px rgba(15, 118, 110, 0.3))'
              }}
            >
              {institute.logoUrl ? (
                <Box component="img" src={institute.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <School size={60} color="#0f766e" strokeWidth={1} />
              )}
            </Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 900, mb: 1.5, 
              color: 'white', 
              letterSpacing: -1.5, 
              fontSize: { xs: '1.75rem', sm: '2.5rem' }
            }}>
              {institute.instituteName}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.5)', maxWidth: 400, mx: 'auto' }}>
              {institute.tagline}
            </Typography>
          </Box>

          <Box
            sx={{ 
              maxWidth: 400,
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
          <Box sx={{ mt: 8, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
              © {new Date().getFullYear()} {institute.instituteName?.toUpperCase()}
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}
