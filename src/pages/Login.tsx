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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [institute, setInstitute] = useState<Partial<InstituteSettings>>({
    maktabName: 'Wali Ul Aser',
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
    // Sanitize phone: remove spaces/dashes
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 7) {
      setLoading(false);
      return; // Basic validation
    }

    try {
      if (isSignUp) {
        await onSignUp(cleanPhone, password, name, role);
      } else {
        await onLogin(cleanPhone, password);
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
        bgcolor: '#000',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(15, 118, 110, 0.15) 0%, rgba(0,0,0,0) 70%)',
        position: 'relative',
        overflow: 'hidden',
        py: 4
      }}
    >
      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Box 
              sx={{ 
                display: 'inline-flex', 
                p: institute.logoUrl ? 0 : 2, 
                borderRadius: '50%', 
                bgcolor: alpha(theme.palette.primary.main, 0.1), 
                color: 'primary.main',
                mb: 3,
                border: `3px double ${alpha(theme.palette.primary.main, 0.3)}`,
                boxShadow: `0 0 40px ${alpha(theme.palette.primary.main, 0.2)}`,
                overflow: 'hidden',
                width: 120,
                height: 120,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {institute.logoUrl ? (
                <Box component="img" src={institute.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <School size={50} strokeWidth={1.5} />
              )}
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, color: 'primary.main', letterSpacing: -1, textTransform: 'uppercase' }}>
              {institute.maktabName}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, opacity: 0.8, color: 'white', fontStyle: 'italic' }}>
              {institute.tagline}
            </Typography>
          </Box>

          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 8, 
              bgcolor: 'rgba(25, 25, 25, 0.7)',
              backdropFilter: 'blur(10px)',
              overflow: 'visible',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
              boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
            }}
          >
            <CardContent sx={{ p: { xs: 4, sm: 6 } }}>
              <Typography variant="h5" sx={{ fontWeight: 900, mb: 4, textAlign: 'center', color: 'primary.main' }}>
                {isSignUp ? 'New Member Join' : 'Welcome Back'}
              </Typography>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <Alert 
                      severity="error" 
                      variant="filled"
                      sx={{ 
                        mb: 4, 
                        borderRadius: 3, 
                        fontWeight: 800, 
                        bgcolor: alpha(theme.palette.error.main, 0.8),
                      }}
                    >
                      {error}
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit}>
                <Stack spacing={3.5}>
                  <AnimatePresence mode="wait">
                    {isSignUp && (
                      <motion.div key="signup-fields" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <Stack spacing={3.5}>
                          <TextField
                            fullWidth
                            label="Your Name"
                            placeholder="Type your name here"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            sx={{
                              '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: 'rgba(0,0,0,0.2)' }
                            }}
                          />
                          <FormControl fullWidth required>
                            <InputLabel>Who are you?</InputLabel>
                            <Select
                              value={role}
                              label="Who are you?"
                              onChange={(e) => setRole(e.target.value as UserRole)}
                              sx={{ borderRadius: 4, bgcolor: 'rgba(0,0,0,0.2)' }}
                            >
                              <MenuItem value="student">Student (Talib-e-Ilm)</MenuItem>
                              <MenuItem value="teacher">Teacher (Mudaris)</MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <TextField
                    fullWidth
                    label="Phone Number"
                    type="tel"
                    placeholder="Enter Phone (e.g. 03001234567)"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: 'rgba(0,0,0,0.2)' }
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Secret Code (Password)"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: 'rgba(0,0,0,0.2)' }
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'primary.main' }}>
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
                      py: 2, 
                      borderRadius: 4, 
                      fontSize: '1.1rem', 
                      fontWeight: 900,
                      boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.4)}`,
                      transition: 'all 0.3s',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 15px 30px ${alpha(theme.palette.primary.main, 0.6)}` }
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={28} color="inherit" />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {isSignUp ? 'Sign Up' : 'Log In Now'}
                        <ArrowRight size={22} />
                      </Box>
                    )}
                  </Button>
                </Stack>
              </form>

              <Divider sx={{ my: 4, borderColor: alpha(theme.palette.divider, 0.1) }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled' }}>OR</Typography>
              </Divider>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  {isSignUp ? 'Have an account?' : 'Need an account?'}{' '}
                  <Button
                    variant="text"
                    onClick={() => setIsSignUp(!isSignUp)}
                    sx={{ fontWeight: 900, fontSize: '1rem', color: 'primary.main', textTransform: 'none' }}
                  >
                    {isSignUp ? 'Login Here' : 'Create One Here'}
                  </Button>
                </Typography>
              </Box>
            </CardContent>
          </Card>
          <Box sx={{ mt: 6, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block' }}>
              © {new Date().getFullYear()} {institute.maktabName}
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}
