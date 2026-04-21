import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Avatar, IconButton, Chip, CircularProgress, 
  alpha, Stack, useTheme, Snackbar, useMediaQuery
} from '@mui/material';
import { Camera, Save, User, Mail, Phone, MapPin } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, smartUpdateDoc } from '../firebase';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { logger } from '../lib/logger';

export default function Profile() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<Partial<UserProfile>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ 
    open: false, message: '', severity: 'success' 
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setProfileData(userDoc.data() as UserProfile);
        }
      } catch (err) {
        logger.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      logger.db('Updating Profile', `users/${currentUser.uid}`);
      
      // Sanitize data: remove immutable fields
      const { uid, email, role, createdAt, ...sanitizedData } = profileData as any;
      const finalData = {
        ...sanitizedData,
        updatedAt: Date.now()
      };
      
      await smartUpdateDoc(doc(db, 'users', currentUser.uid), finalData);
      setSnackbar({ open: true, message: "Profile updated successfully!", severity: 'success' });
      logger.success('Profile Updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 400;
        if (width > height) {
          if (width > max) {
            height *= max / width;
            width = max;
          }
        } else {
          if (height > max) {
            width *= max / height;
            height = max;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setProfileData({ ...profileData, photoURL: base64 });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', pb: { xs: 4, sm: 6, md: 8 }, px: { xs: 1.5, sm: 2, md: 0 } }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 4, letterSpacing: -1.5 }}>
          Personal Profile
        </Typography>

        <Card sx={{ 
          borderRadius: 2, 
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: 'none',
        }}>
          <Box sx={{ 
            height: 120, 
            bgcolor: 'primary.main', 
            position: 'relative',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
          }}>
            <Box sx={{ 
              position: 'absolute', 
              bottom: isMobile ? -60 : -40, 
              left: isMobile ? '50%' : 24,
              transform: isMobile ? 'translateX(-50%)' : 'none',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'center' : 'flex-end',
              gap: 2,
              width: isMobile ? '100%' : 'auto',
              textAlign: isMobile ? 'center' : 'left'
            }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar 
                  src={profileData.photoURL} 
                  sx={{ 
                    width: 100, 
                    height: 100, 
                    border: '4px solid',
                    borderColor: 'background.paper',
                    bgcolor: 'grey.200'
                  }}
                >
                  {profileData.displayName?.charAt(0)}
                </Avatar>
                <IconButton 
                  size="small"
                  onClick={() => document.getElementById('profile-upload')?.click()}
                  sx={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    right: 0, 
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'background.default' }
                  }}
                >
                  <Camera size={16} />
                </IconButton>
                <input type="file" id="profile-upload" hidden accept="image/*" onChange={handlePhotoUpload} />
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  {profileData.displayName}
                </Typography>
                <Chip 
                  label={profileData.role?.toUpperCase()} 
                  size="small" 
                  sx={{ fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', mt: 0.5, borderRadius: 1 }} 
                />
              </Box>
            </Box>
          </Box>

          <CardContent sx={{ pt: isMobile ? 12 : 8, px: 3, pb: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label={profileData.role === 'student' ? 'Admission No' : 'Staff ID'}
                  value={profileData.studentId || profileData.teacherId || 'N/A'}
                  disabled
                  InputProps={{ 
                    sx: { borderRadius: 1.5, bgcolor: alpha(theme.palette.action.disabledBackground, 0.05) }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Display Name"
                  value={profileData.displayName || ''}
                  onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                  InputProps={{ 
                    startAdornment: <User size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
                    sx: { borderRadius: 1.5 }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={profileData.email || ''}
                  disabled
                  InputProps={{ 
                    startAdornment: <Mail size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
                    sx: { borderRadius: 1.5, bgcolor: alpha(theme.palette.action.disabledBackground, 0.05) }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={profileData.phone || ''}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  InputProps={{ 
                    startAdornment: <Phone size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
                    sx: { borderRadius: 1.5 }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="WhatsApp"
                  value={profileData.whatsapp || ''}
                  onChange={(e) => setProfileData({ ...profileData, whatsapp: e.target.value })}
                  InputProps={{ sx: { borderRadius: 1.5 } }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={2}
                  value={profileData.address || ''}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  InputProps={{ 
                    startAdornment: <MapPin size={18} style={{ marginRight: 8, marginTop: 4, alignSelf: 'flex-start', opacity: 0.5 }} />,
                    sx: { borderRadius: 1.5 }
                  }}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save size={20} />}
                onClick={handleSave}
                disabled={saving}
                sx={{ 
                  borderRadius: 1.5, 
                  fontWeight: 800, 
                  px: 4, 
                  py: 1.2,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' }
                }}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </motion.div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
