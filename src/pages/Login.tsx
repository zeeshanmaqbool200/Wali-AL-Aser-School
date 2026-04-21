import React, { useState } from 'react';
import { 
  Box, Button, Card, CardContent, Typography, Container, Alert, 
  TextField, Link, FormControl, InputLabel, Select, MenuItem,
  IconButton, InputAdornment, useTheme, alpha, Stack,
  Paper, Divider, Fade, Zoom, CircularProgress, Grid
} from '@mui/material';
import { 
  LogIn, UserPlus, Eye, EyeOff, Mail, Lock, User, 
  ShieldCheck, Sparkles, ArrowRight, GraduationCap,
  School, CheckCircle
} from 'lucide-react';
import { UserRole, InstituteSettings } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [institute, setInstitute] = useState<Partial<InstituteSettings>>({
    maktabName: 'Wali Ul Aser',
    tagline: 'First Step Towards Building Taqwa'
  });

  React.useEffect(() => {
    const fetchBranding = async () => {
      const snap = await getDoc(doc(db, 'settings', 'institute'));
      if (snap.exists()) {
        setInstitute(snap.data());
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
      // Error is handled by AuthContext and passed back as prop
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
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
        py: 4
      }}
    >
      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Box 
              sx={{ 
                display: 'inline-flex', 
                p: institute.logoUrl ? 0 : 2.5, 
                borderRadius: '50%', 
                bgcolor: alpha(theme.palette.primary.main, 0.1), 
                color: 'primary.main',
                mb: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.2)}`,
                overflow: 'hidden',
                width: 100,
                height: 100,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {institute.logoUrl ? (
                <Box component="img" src={institute.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <School size={44} />
              )}
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: -2, mb: 1 }}>
              {institute.maktabName}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
              {institute.tagline}
            </Typography>
          </Box>

          <Card 
            variant="outlined"
            sx={{ 
              borderRadius: 6, 
              bgcolor: 'background.paper',
              overflow: 'visible',
              position: 'relative',
              border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <CardContent sx={{ p: { xs: 4, sm: 6 } }}>
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <Alert 
                      severity="error" 
                      variant="outlined"
                      sx={{ 
                        mb: 4, 
                        borderRadius: 2, 
                        fontWeight: 600, 
                        bgcolor: alpha(theme.palette.error.main, 0.05),
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
                      <motion.div key="signup-fields" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                        <Stack spacing={3}>
                          <TextField
                            fullWidth
                            label="Full Name"
                            placeholder="Zeeshan Ahmad"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                              }
                            }}
                          />
                          <FormControl fullWidth required>
                            <InputLabel>Account Role</InputLabel>
                            <Select
                              value={role}
                              label="Account Role"
                              onChange={(e) => setRole(e.target.value as UserRole)}
                              sx={{ borderRadius: 2 }}
                            >
                              <MenuItem value="student">Talib-e-Ilm</MenuItem>
                              <MenuItem value="teacher">Mudaris</MenuItem>
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
                    placeholder="name@waliulaser.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  {!isSignUp && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Link href="#" variant="body2" sx={{ fontWeight: 600, textDecoration: 'none' }}>
                        Forgot password?
                      </Link>
                    </Box>
                  )}

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={loading}
                    sx={{ 
                      py: 1.5, 
                      borderRadius: 2, 
                      textTransform: 'none', 
                      fontSize: '1rem', 
                      fontWeight: 700,
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isSignUp ? 'Create Account' : 'Sign In'}
                        <ArrowRight size={18} />
                      </Box>
                    )}
                  </Button>
                </Stack>
              </form>

              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <Button
                    variant="text"
                    onClick={() => setIsSignUp(!isSignUp)}
                    sx={{ fontWeight: 700, textTransform: 'none', p: 0, minWidth: 'auto', ml: 0.5 }}
                  >
                    {isSignUp ? 'Sign In' : 'Create Account'}
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
