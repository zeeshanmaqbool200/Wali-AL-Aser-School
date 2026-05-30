import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Box, Paper, Typography, Avatar, Container, CircularProgress, 
  Divider, Stack, Button, useTheme, alpha, Grid 
} from '@mui/material';
import { 
  CheckCircle, ShieldCheck, User, Calendar, 
  MapPin, Phone, GraduationCap, ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, InstituteSettings } from '../types';

export default function PublicVerify() {
  const { uid } = useParams();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<InstituteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!uid) return;
      try {
        setLoading(true);
        // Fetch user data
        const studentDoc = await getDoc(doc(db, 'users', uid));
        if (studentDoc.exists()) {
          setUser(studentDoc.data() as UserProfile);
        } else {
          setError('Student record not found.');
        }

        // Fetch institute settings for branding
        const settingsDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as InstituteSettings);
        }
      } catch (err: any) {
        console.error('Verification error:', err);
        setError('Unable to verify record at this time.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [uid]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={40} thickness={4} />
          <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.5 }}>Verifying Credentials...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
          <Box sx={{ mb: 2, color: 'error.main' }}>
            <ShieldCheck size={64} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Verification Failed</Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>{error || 'The requested record could not be found in our database.'}</Typography>
          <Button component={Link} to="/" variant="contained" startIcon={<ArrowLeft size={18} />}>
            Back to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="sm">
        {/* Verification Success Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
           <Paper sx={{ 
             display: 'inline-flex', 
             alignItems: 'center', 
             gap: 1.5, 
             px: 3, 
             py: 1, 
             borderRadius: 10,
             bgcolor: alpha(theme.palette.success.main, 0.1),
             color: 'success.main',
             border: '1px solid',
             borderColor: alpha(theme.palette.success.main, 0.2),
             mb: 2
           }}>
             <CheckCircle size={20} />
             <Typography variant="subtitle2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Digitally Verified Record</Typography>
           </Paper>
        </Box>

        <Paper sx={{ 
          borderRadius: 6, 
          overflow: 'hidden', 
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)',
          border: '1px solid',
          borderColor: 'divider'
        }}>
          {/* Header Branding */}
          <Box sx={{ p: 4, bgcolor: '#0f172a', color: 'white', position: 'relative' }}>
            <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar 
                src={settings?.logoUrl} 
                variant="rounded"
                sx={{ width: 45, height: 45, bgcolor: 'primary.main' }}
              >
                <ShieldCheck size={28} />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 950, lineHeight: 1, mb: 0.5 }}>{settings?.instituteName || 'MAKTAB'}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Official Student Verification</Typography>
              </Box>
            </Box>
            <Box sx={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '40%', bgcolor: alpha('#fff', 0.05), skewX: '-20deg', transform: 'translateX(30%)' }} />
          </Box>

          <Box sx={{ p: 4 }}>
            <Stack spacing={4}>
              {/* Profile Overview */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Avatar 
                  src={user.photoURL} 
                  sx={{ 
                    width: 100, 
                    height: 100, 
                    borderRadius: 3, 
                    border: '4px solid white',
                    boxShadow: theme.shadows[4]
                  }}
                >
                  <User size={50} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 950, color: 'text.primary' }}>{user.displayName}</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1 }}>{user.role === 'student' ? (user.classLevel || 'Student') : user.role}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>ID: {user.studentId || user.admissionNo || 'N/A'}</Typography>
                </Box>
              </Box>

              <Divider />

              {/* Information Grid */}
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <VerifyDetail label="Father Name" value={user.fatherName} icon={<User size={16} />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <VerifyDetail label="Gender" value={user.gender} icon={<User size={16} />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <VerifyDetail label="Date of Birth" value={user.dob} icon={<Calendar size={16} />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <VerifyDetail label="Admission Date" value={user.admissionDate} icon={<Calendar size={16} />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                   <VerifyDetail label="Status" value={user.status || 'Active'} icon={<ShieldCheck size={16} />} isStatus />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <VerifyDetail label="Institute Address" value={settings?.address} icon={<MapPin size={16} />} />
                </Grid>
              </Grid>

              <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }}>
                 <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ShieldCheck size={14} /> SECURITY NOTICE
                 </Typography>
                 <Typography variant="body2" sx={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.6 }}>
                   This is an official verification record. The information presented here is directly retrieved from our secure database as of {new Date().toLocaleDateString()}.
                 </Typography>
              </Box>

              <Button 
                component={Link} 
                to="/login" 
                variant="outlined" 
                fullWidth 
                endIcon={<ExternalLink size={18} />}
                sx={{ borderRadius: 3, py: 1.5, fontWeight: 900 }}
              >
                Go to Portal Login
              </Button>
            </Stack>
          </Box>
        </Paper>

        <Typography variant="caption" align="center" sx={{ display: 'block', mt: 4, opacity: 0.5, fontWeight: 700 }}>
          &copy; {new Date().getFullYear()} {settings?.instituteName || 'Portal'}. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}

function VerifyDetail({ label, value, icon, isStatus }: { label: string, value?: string, icon: React.ReactNode, isStatus?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 0.5 }}>
        {icon} {label}
      </Typography>
      {isStatus ? (
        <Paper sx={{ 
          display: 'inline-flex', 
          px: 1.5, 
          py: 0.2, 
          borderRadius: 1, 
          bgcolor: value === 'Active' ? 'success.light' : 'warning.light',
          color: 'white',
          boxShadow: 'none'
        }}>
          <Typography variant="caption" sx={{ fontWeight: 900 }}>{value || 'Active'}</Typography>
        </Paper>
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>{value || 'N/A'}</Typography>
      )}
    </Box>
  );
}
