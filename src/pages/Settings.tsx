import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Avatar, Divider, Switch, FormControlLabel, 
  IconButton, Chip, CircularProgress, Alert, Paper,
  useTheme, Tab, Tabs, List, ListItem, ListItemText,
  alpha, Stack, Tooltip, Fade, Zoom, ListItemIcon, Snackbar
} from '@mui/material';
import { 
  Settings as SettingsIcon, User, Shield, Palette, 
  Bell, Globe, Save, Camera, Trash2, Plus, 
  CheckCircle, Smartphone, Mail, Lock,
  CreditCard, HelpCircle, LogOut, ChevronRight,
  Monitor, Moon, Sun, Languages, Database,
  Key, Eye, EyeOff, Smartphone as MobileIcon,
  Cloud, Zap, HardDrive, RefreshCw, AlertTriangle, Layout,
  Download, FileJson, Terminal
} from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, getDocs, deleteDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, InstituteSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useHardwarePermissions } from '../services/hardwareService';
import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { logger } from '../lib/logger';
import { Mic } from 'lucide-react';

export default function Settings() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode, setMode, setAccentColor } = useThemeContext()!;
  const { permissions } = useHardwarePermissions();
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState('appearance');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState<Partial<UserProfile>>({});
  const [instituteData, setInstituteData] = useState<Partial<InstituteSettings>>({});
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: true,
    push: true,
    feeReminders: true,
    attendance: false,
    announcements: true,
    inAppToasts: true
  });
  const [uiPrefs, setUiPrefs] = useState({
    highContrast: false,
    reduceMotion: false,
    compactLayout: false,
    accentColor: '#0f766e'
  });

  const [passwordDialog, setPasswordDialog] = useState({ open: false, current: '', new: '', confirm: '', loading: false });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const isAdmin = currentUser?.role === 'superadmin';

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      logger.info('Settings Page Initializing...');
      
      try {
        // Fetch User Profile
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfileData(data);
          if (data.notificationPrefs) {
            setNotificationPrefs(prev => ({ ...prev, ...data.notificationPrefs }));
          }
          if (data.uiPrefs) {
            setUiPrefs(prev => ({ ...prev, ...data.uiPrefs }));
          }
        }

        // Fetch Institute Settings
        const settingsDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (settingsDoc.exists()) {
          setInstituteData(settingsDoc.data() as InstituteSettings);
        } else if (isAdmin) {
          // Initialize default settings if not exists
          const defaultSettings: InstituteSettings = {
            id: 'institute',
            name: 'IDARAH WALI UL ASER',
            maktabName: 'MAKTAB WALI UL ASER',
            tagline: 'First Step Towards Building Taqwa',
            address: 'Banpora Chattergam 191113, Kashmir',
            phone: '+91 7006123456',
            email: 'idarahwaliulaser@gmail.com',
            logoUrl: 'https://idarahwaliulaser.netlify.app/favicon.ico',
            bannerUrl: '',
            receiptLeftImageUrl: '',
            receiptRightImageUrl: '',
            primaryColor: '#0d9488',
            secondaryColor: '#0f766e',
            website: 'idarahwaliulaser.netlify.app',
            receiptPrefix: 'WUA',
            mission: 'Mission of Sayyed Mustafa Hamadani RA. Bringing Innovative and authentic Islamic knowledge and holding new competitions to boost interests of Gen-Z and Gen-X students.',
            founded: '2005',
            greeting: 'Asslamualikum',
            team: {
              chairman: 'Shabir Ahmad',
              financeManager: 'Bashir Ahmad',
              supervisor: 'Irfan Hussain',
              organizer: 'Mudasir Ahmad',
              secretary: 'Showkat Ahmad',
              mediaConsultant: 'Yawar Abbas',
              socialMediaManager: 'Bilal A',
              mediaIncharge: 'Yawar Abbas'
            }
          };
          setInstituteData(defaultSettings);
        }

        setLoading(false);
        logger.success('Settings Data Loaded');
      } catch (err) {
        logger.error('Failed to load settings', err);
        setError("Failed to load settings");
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, isAdmin]);

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      logger.db('Updating User Profile', `users/${currentUser.uid}`);
      
      // Sanitize data: remove immutable or restricted fields
      const { uid, email, role, createdAt, ...updateData } = profileData as any;
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...updateData,
        uiPrefs: uiPrefs,
        notificationPrefs: notificationPrefs
      });
      setSnackbar({ open: true, message: "Profile updated successfully!", severity: 'success' });
      logger.success('Profile Updated Successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInstitute = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      logger.db('Updating Institute Settings', 'settings/institute');
      await setDoc(doc(db, 'settings', 'institute'), instituteData, { merge: true });
      setSnackbar({ open: true, message: "Institute settings updated successfully!", severity: 'success' });
      logger.success('Institute Settings Updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/institute');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'logo' | 'banner' | 'receiptLeft' | 'receiptRight') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Allow up to 5MB raw file, we will compress it anyway
    if (file.size > 5 * 1024 * 1024) {
      setSnackbar({ open: true, message: "Image too large! Please select an image under 5MB.", severity: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Banners and receipt corners might need different max sizes but 800px-1200px is usually enough for web-compressed assets
        const MAX_SIZE = type === 'banner' ? 1200 : 400; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill white background for JPEGs (transparency fix)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }

        // Compress to JPEG with 0.8 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        if (type === 'profile') {
          setProfileData({ ...profileData, photoURL: compressedBase64 });
        } else if (type === 'logo') {
          setInstituteData({ ...instituteData, logoUrl: compressedBase64 });
        } else if (type === 'banner') {
          setInstituteData({ ...instituteData, bannerUrl: compressedBase64 });
        } else if (type === 'receiptLeft') {
          setInstituteData({ ...instituteData, receiptLeftImageUrl: compressedBase64 });
        } else if (type === 'receiptRight') {
          setInstituteData({ ...instituteData, receiptRightImageUrl: compressedBase64 });
        }
        
        setSnackbar({ open: true, message: `${type} processed successfully!`, severity: 'success' });
        logger.success(`${type} photo compressed to ${Math.round(compressedBase64.length / 1024)}KB`);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdatePassword = async () => {
    if (!auth.currentUser) return;
    if (passwordDialog.new !== passwordDialog.confirm) {
      setSnackbar({ open: true, message: "Passwords do not match!", severity: 'error' });
      return;
    }

    setPasswordDialog(prev => ({ ...prev, loading: true }));
    try {
      logger.auth('Attempting Password Update');
      // Re-authenticate if necessary (for security)
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, passwordDialog.current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      await updatePassword(auth.currentUser, passwordDialog.new);
      setSnackbar({ open: true, message: "Password updated successfully!", severity: 'success' });
      setPasswordDialog({ open: false, current: '', new: '', confirm: '', loading: false });
      logger.success('Password Updated Successfully');
    } catch (err: any) {
      logger.error('Password Update Failed', err);
      setSnackbar({ open: true, message: err.message || "Failed to update password. Check your current password.", severity: 'error' });
    } finally {
      setPasswordDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handleGenerateBackup = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      logger.info('Generating system backup...');
      const collections = ['attendance', 'receipts', 'notifications', 'notes', 'users', 'courses'];
      const backupData: any = {};
      
      for (const colName of collections) {
        const q = query(collection(db, colName));
        const snapshot = await getDocs(q);
        backupData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wua_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      logger.success('Backup generated successfully');
      setSnackbar({ open: true, message: "Backup generated and downloaded!", severity: 'success' });
    } catch (err) {
      logger.error('Backup generation failed', err);
      setSnackbar({ open: true, message: "Failed to generate backup", severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (currentUser?.role !== 'superadmin') return;
    setResetConfirmOpen(true);
  };

  const confirmResetData = async () => {
    if (currentUser?.role !== 'superadmin') return;
    
    setLoading(true);
    setResetConfirmOpen(false);
    try {
      logger.db('DANGER: Resetting All Application Data', 'bulk_reset');
      const collections = ['attendance', 'receipts', 'notifications', 'notes'];
      for (const colName of collections) {
        const q = query(collection(db, colName));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      setSuccess(true);
      setSnackbar({ open: true, message: "All data has been reset successfully!", severity: 'success' });
      logger.success('All Application Data Reset Complete');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'bulk_reset');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      logger.db('Updating Notification Preferences', `users/${currentUser.uid}`);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        notificationPrefs: notificationPrefs
      });
      setSnackbar({ open: true, message: "Notification preferences saved!", severity: 'success' });
      logger.success('Notification Preferences Updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin && tabValue === 'branding') {
      setTabValue('appearance');
    }
  }, [isAdmin, tabValue]);

  if (loading && !profileData.uid) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  const menuItems = [
    { id: 'profile', label: 'Personal Profile', icon: <User size={20} />, role: 'all' },
    { id: 'branding', label: 'Maktab Branding', icon: <Globe size={20} />, role: 'admin' },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={20} />, role: 'all' },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={20} />, role: 'all' },
    { id: 'security', label: 'Security & Privacy', icon: <Shield size={20} />, role: 'all' },
    { id: 'system', label: 'System & Data', icon: <Database size={20} />, role: 'admin' },
  ].filter(item => item.role === 'all' || (item.role === 'admin' && isAdmin));

  return (
    <Box sx={{ pb: { xs: 4, sm: 6, md: 8 }, px: { xs: 1.5, sm: 2, md: 0 } }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: -2, mb: 1 }}>Settings</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
            Manage your personal profile and Maktab preferences
          </Typography>
        </Box>
      </motion.div>

      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Alert 
              severity="success" 
              icon={<CheckCircle size={20} />}
              sx={{ mb: 3, borderRadius: 4, fontWeight: 700, border: '1px solid', borderColor: 'success.light' }}
            >
              Settings updated successfully!
            </Alert>
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Alert 
              severity="error" 
              icon={<AlertTriangle size={20} />}
              sx={{ mb: 3, borderRadius: 4, fontWeight: 700, border: '1px solid', borderColor: 'error.light' }}
            >
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Grid container spacing={isMobile ? 2 : 4}>
        <Grid size={{ xs: 12, md: 4, lg: 3 }}>
          {isMobile ? (
            <Box sx={{ mb: 3, overflowX: 'auto', pb: 2, px: 1 }}>
              <Tabs 
                value={tabValue} 
                onChange={(_, v) => setTabValue(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ 
                  '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0' },
                  '& .MuiTab-root': { minHeight: 60, fontWeight: 800, textTransform: 'none', color: 'text.secondary' },
                  '& .Mui-selected': { color: 'primary.main' }
                }}
              >
                {menuItems.map((item) => (
                  <Tab 
                    key={item.id} 
                    value={item.id}
                    label={item.label} 
                    icon={item.icon} 
                    iconPosition="start" 
                  />
                ))}
              </Tabs>
            </Box>
          ) : (
            <Card variant="outlined" sx={{ 
              borderRadius: 2, 
              overflow: 'hidden', 
              bgcolor: 'background.paper',
            }}>
              <List disablePadding>
                {menuItems.map((item) => (
                  <ListItem 
                    key={item.id}
                    component="div"
                    onClick={() => setTabValue(item.id)}
                    sx={{ 
                      py: 3, 
                      px: 4,
                      cursor: 'pointer',
                      borderLeft: '6px solid',
                      borderColor: tabValue === item.id ? 'primary.main' : 'transparent',
                      bgcolor: tabValue === item.id ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': { 
                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                        '& .MuiListItemIcon-root': { transform: 'translateX(4px)' }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ 
                      minWidth: 44, 
                      color: tabValue === item.id ? 'primary.main' : 'text.secondary',
                      transition: 'all 0.3s ease'
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.label}
                      primaryTypographyProps={{ 
                        variant: 'body1', 
                        sx: { fontWeight: tabValue === item.id ? 900 : 700, color: tabValue === item.id ? 'primary.main' : 'text.primary' } 
                      }} 
                    />
                    {tabValue === item.id && <ChevronRight size={18} color={theme.palette.primary.main} />}
                  </ListItem>
                ))}
              </List>
            </Card>
          )}
          
          {!isMobile && (
            <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.error.main, 0.05), borderRadius: 1, border: '1px dashed', borderColor: 'error.light' }}>
              <Button 
                fullWidth 
                color="error" 
                startIcon={<LogOut size={18} />}
                onClick={logout}
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                Sign Out
              </Button>
            </Box>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 8, lg: 9 }}>
          <AnimatePresence mode="wait">
            {tabValue === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4 }}>Personal Profile</Typography>
                    
                    <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 3, flexDirection: { xs: 'column', sm: 'row' }, textAlign: { xs: 'center', sm: 'left' } }}>
                      <Box sx={{ position: 'relative' }}>
                        <Avatar 
                          src={profileData.photoURL} 
                          sx={{ width: 100, height: 100, border: '4px solid', borderColor: 'background.paper', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} 
                        />
                        <IconButton 
                          size="small"
                          onClick={() => document.getElementById('profile-photo-input')?.click()}
                          sx={{ 
                            position: 'absolute', bottom: 0, right: 0, 
                            bgcolor: 'primary.main', color: 'white',
                            '&:hover': { bgcolor: 'primary.dark' }
                          }}
                        >
                          <Camera size={16} />
                        </IconButton>
                        <input
                          type="file"
                          id="profile-photo-input"
                          hidden
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'profile')}
                        />
                      </Box>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{profileData.displayName}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{profileData.email}</Typography>
                        <Chip 
                          label={profileData.role?.toUpperCase()} 
                          size="small" 
                          color="primary" 
                          sx={{ mt: 1, fontWeight: 800, borderRadius: 1 }} 
                        />
                      </Box>
                    </Box>

                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="Full Name"
                          value={profileData.displayName || ''}
                          onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="Phone Number"
                          value={profileData.phone || ''}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="WhatsApp Number"
                          value={profileData.whatsapp || ''}
                          onChange={(e) => setProfileData({ ...profileData, whatsapp: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid size={12}>
                        <TextField
                          fullWidth
                          label="Address"
                          multiline
                          rows={3}
                          value={profileData.address || ''}
                          onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="contained" 
                        startIcon={<Save size={18} />} 
                        onClick={handleSaveProfile}
                        sx={{ borderRadius: 3, fontWeight: 800, px: 4, py: 1.5, textTransform: 'none' }}
                      >
                        Save Profile
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {tabValue === 'branding' && isAdmin && (
              <motion.div key="institute" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4 }}>Maktab Branding & Identity</Typography>
                    <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ position: 'relative' }}>
                        <Avatar 
                          src={instituteData.logoUrl} 
                          variant="rounded"
                          sx={{ width: 80, height: 80, borderRadius: 1, border: '2px solid', borderColor: 'divider' }} 
                        />
                        <IconButton 
                          size="small"
                          onClick={() => document.getElementById('logo-photo-input')?.click()}
                          sx={{ 
                            position: 'absolute', bottom: -10, right: -10, 
                            bgcolor: 'primary.main', color: 'white',
                            '&:hover': { bgcolor: 'primary.dark' }
                          }}
                        >
                          <Camera size={14} />
                        </IconButton>
                        <input
                          type="file"
                          id="logo-photo-input"
                          hidden
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'logo')}
                        />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Institute Logo</Typography>
                        <Typography variant="caption" color="text.secondary">Recommended size: 200x200px (PNG/JPG)</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ position: 'relative' }}>
                        <Box 
                          sx={{ 
                            width: 150, 
                            height: 80, 
                            borderRadius: 1, 
                            border: '2px solid', 
                            borderColor: 'divider',
                            bgcolor: 'grey.100',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                          }} 
                        >
                          {instituteData.bannerUrl ? (
                            <Box component="img" src={instituteData.bannerUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Typography variant="caption" color="text.secondary">No Banner</Typography>
                          )}
                        </Box>
                        <IconButton 
                          size="small"
                          onClick={() => document.getElementById('banner-photo-input')?.click()}
                          sx={{ 
                            position: 'absolute', bottom: -10, right: -10, 
                            bgcolor: 'primary.main', color: 'white',
                            '&:hover': { bgcolor: 'primary.dark' }
                          }}
                        >
                          <Camera size={14} />
                        </IconButton>
                        <input
                          type="file"
                          id="banner-photo-input"
                          hidden
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'banner')}
                        />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>General Banner</Typography>
                        <Typography variant="caption" color="text.secondary">Wide image for dashboard/headers</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ position: 'relative' }}>
                          <Avatar 
                            src={instituteData.receiptLeftImageUrl} 
                            variant="rounded"
                            sx={{ width: 60, height: 60, borderRadius: 1, border: '2px solid', borderColor: 'divider' }} 
                          />
                          <IconButton 
                            size="small"
                            onClick={() => document.getElementById('receipt-left-input')?.click()}
                            sx={{ 
                              position: 'absolute', bottom: -8, right: -8, 
                              bgcolor: 'primary.main', color: 'white',
                              '&:hover': { bgcolor: 'primary.dark' }
                            }}
                          >
                            <Camera size={12} />
                          </IconButton>
                          <input
                            type="file"
                            id="receipt-left-input"
                            hidden
                            accept="image/*"
                            onChange={(e) => handlePhotoUpload(e, 'receiptLeft')}
                          />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 800, display: 'block' }}>Receipt Top Left</Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ position: 'relative' }}>
                          <Avatar 
                            src={instituteData.receiptRightImageUrl} 
                            variant="rounded"
                            sx={{ width: 60, height: 60, borderRadius: 1, border: '2px solid', borderColor: 'divider' }} 
                          />
                          <IconButton 
                            size="small"
                            onClick={() => document.getElementById('receipt-right-input')?.click()}
                            sx={{ 
                              position: 'absolute', bottom: -8, right: -8, 
                              bgcolor: 'primary.main', color: 'white',
                              '&:hover': { bgcolor: 'primary.dark' }
                            }}
                          >
                            <Camera size={12} />
                          </IconButton>
                          <input
                            type="file"
                            id="receipt-right-input"
                            hidden
                            accept="image/*"
                            onChange={(e) => handlePhotoUpload(e, 'receiptRight')}
                          />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 800, display: 'block' }}>Receipt Top Right</Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 8 }}>
                        <TextField
                          fullWidth
                          label="Maktab Name"
                          value={instituteData.maktabName || ''}
                          onChange={(e) => setInstituteData({ ...instituteData, maktabName: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          label="Official Website"
                          value={instituteData.website || ''}
                          onChange={(e) => setInstituteData({ ...instituteData, website: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Official Contact Email"
                          value={instituteData.email || ''}
                          onChange={(e) => setInstituteData({ ...instituteData, email: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Official Contact Phone"
                          value={instituteData.phone || ''}
                          onChange={(e) => setInstituteData({ ...instituteData, phone: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                        />
                      </Grid>
                      <Grid size={12}>
                        <TextField
                          fullWidth
                          label="Maktab Address"
                          multiline
                          rows={3}
                          value={instituteData.address || ''}
                          onChange={(e) => setInstituteData({ ...instituteData, address: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                        />
                      </Grid>
                      
                      <Grid size={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Visual Identity</Typography>
                        <Grid container spacing={4}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Box sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.4) : 'grey.50' }}>
                              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 800 }}>Primary Brand Color</Typography>
                              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                <Box 
                                  sx={{ 
                                    width: 60, height: 60, borderRadius: 3, 
                                    bgcolor: instituteData.primaryColor || '#1976d2',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    '& input': { position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }
                                  }}
                                >
                                  <input 
                                    type="color" 
                                    value={instituteData.primaryColor || '#1976d2'} 
                                    onChange={(e) => setInstituteData({ ...instituteData, primaryColor: e.target.value })}
                                  />
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem' }}>
                                    {instituteData.primaryColor?.toUpperCase()}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Click to change</Typography>
                                </Box>
                              </Box>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Box sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.4) : 'grey.50' }}>
                              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 800 }}>Secondary Brand Color</Typography>
                              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                <Box 
                                  sx={{ 
                                    width: 60, height: 60, borderRadius: 3, 
                                    bgcolor: instituteData.secondaryColor || '#9c27b0',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    '& input': { position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }
                                  }}
                                >
                                  <input 
                                    type="color" 
                                    value={instituteData.secondaryColor || '#9c27b0'} 
                                    onChange={(e) => setInstituteData({ ...instituteData, secondaryColor: e.target.value })}
                                  />
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem' }}>
                                    {instituteData.secondaryColor?.toUpperCase()}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Click to change</Typography>
                                </Box>
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 5, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="contained" 
                        startIcon={<Save size={18} />} 
                        onClick={handleSaveInstitute} 
                        sx={{ borderRadius: 1.5, fontWeight: 800, px: 5, py: 1.5, boxShadow: 'none' }}
                      >
                        Save Branding
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {tabValue === 'appearance' && (
              <motion.div key="appearance" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 2, 
                  bgcolor: 'background.paper',
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, letterSpacing: -0.5 }}>Appearance & Theme</Typography>
                    <Stack spacing={4}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Accent Color</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
                          Choose a color that matches your preference. This will be used for buttons, icons, and highlights.
                        </Typography>
                        <Grid container spacing={2}>
                          {[
                            { name: 'Teal', color: '#0f766e' },
                            { name: 'Indigo', color: '#6366f1' },
                            { name: 'Rose', color: '#f43f5e' },
                            { name: 'Amber', color: '#f59e0b' },
                            { name: 'Violet', color: '#8b5cf6' },
                            { name: 'Blue', color: '#3b82f6' },
                            { name: 'Emerald', color: '#10b981' },
                            { name: 'Slate', color: '#64748b' }
                          ].map((c) => (
                            <Grid size={{ xs: 3, sm: 1.5 }} key={c.color}>
                              <Box 
                                onClick={() => {
                                  setUiPrefs({ ...uiPrefs, accentColor: c.color });
                                  setAccentColor(c.color);
                                }}
                                sx={{ 
                                  width: 44,
                                  height: 44,
                                  borderRadius: '50%', 
                                  border: '2px solid', 
                                  borderColor: uiPrefs.accentColor === c.color ? c.color : 'transparent',
                                  bgcolor: c.color,
                                  cursor: 'pointer',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: uiPrefs.accentColor === c.color ? `0 0 15px ${alpha(c.color, 0.4)}` : 'none',
                                  '&:hover': { 
                                    transform: 'scale(1.1)',
                                    boxShadow: `0 0 20px ${alpha(c.color, 0.3)}`
                                  }
                                }}
                              >
                                {uiPrefs.accentColor === c.color && <CheckCircle size={20} color="white" />}
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Theme Mode</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {[
                            { label: 'Light', icon: <Sun size={18} />, value: 'light' },
                            { label: 'Dark', icon: <Moon size={18} />, value: 'dark' },
                            { label: 'System', icon: <Monitor size={18} />, value: 'system' }
                          ].map((m) => (
                            <Button
                              key={m.value}
                              onClick={() => setMode(m.value as any)}
                              variant={mode === m.value ? 'contained' : 'outlined'}
                              startIcon={m.icon}
                              sx={{
                                borderRadius: 1,
                                px: 3,
                                py: 1,
                                fontWeight: 800,
                                textTransform: 'none',
                                bgcolor: mode === m.value ? 'primary.main' : 'transparent',
                                color: mode === m.value ? 'primary.contrastText' : 'text.secondary',
                                borderColor: mode === m.value ? 'primary.main' : alpha(theme.palette.divider, 0.1),
                                '&:hover': {
                                  bgcolor: mode === m.value ? alpha(theme.palette.primary.main, 0.9) : alpha(theme.palette.primary.main, 0.05),
                                  borderColor: 'primary.main',
                                }
                              }}
                            >
                              {m.label}
                            </Button>
                          ))}
                        </Box>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Interface Preferences</Typography>
                        <Stack spacing={2}>
                          {[
                            { 
                              key: 'inAppToasts', 
                              label: 'In-App Toasts', 
                              desc: 'Show animated popups while using the app', 
                              icon: <Layout size={20} />,
                              checked: notificationPrefs.inAppToasts,
                              onChange: (val: boolean) => setNotificationPrefs({ ...notificationPrefs, inAppToasts: val })
                            },
                            { 
                              key: 'reduceMotion', 
                              label: 'Reduce Motion', 
                              desc: 'Minimize animations for better performance', 
                              icon: <Zap size={20} />,
                              checked: uiPrefs.reduceMotion,
                              onChange: (val: boolean) => setUiPrefs({ ...uiPrefs, reduceMotion: val })
                            },
                            { 
                              key: 'highContrast', 
                              label: 'High Contrast', 
                              desc: 'Increase visibility of UI elements', 
                              icon: <Eye size={20} />,
                              checked: uiPrefs.highContrast,
                              onChange: (val: boolean) => setUiPrefs({ ...uiPrefs, highContrast: val })
                            }
                          ].map((item) => (
                            <Box 
                              key={item.key}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                p: 2,
                                borderRadius: 1,
                                border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                                bgcolor: alpha(theme.palette.background.paper, 0.5),
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.background.paper, 0.8),
                                  borderColor: alpha(theme.palette.divider, 0.1),
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                                <Box sx={{ 
                                  p: 1.2, 
                                  borderRadius: 1, 
                                  bgcolor: alpha(theme.palette.primary.main, 0.1), 
                                  color: 'primary.main',
                                  display: 'flex'
                                }}>
                                  {item.icon}
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>{item.label}</Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{item.desc}</Typography>
                                </Box>
                              </Box>
                              <Switch 
                                checked={item.checked}
                                onChange={(e) => item.onChange(e.target.checked)}
                                color="primary"
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: theme.palette.primary.main,
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    backgroundColor: theme.palette.primary.main,
                                  },
                                }}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Accessibility</Typography>
                        <Stack spacing={2}>
                          {[
                            { 
                              key: 'reduceMotion', 
                              label: 'Reduce Motion', 
                              desc: 'Minimize animations for better performance', 
                              icon: <Zap size={20} />,
                              checked: uiPrefs.reduceMotion,
                              onChange: (val: boolean) => setUiPrefs({ ...uiPrefs, reduceMotion: val })
                            },
                            { 
                              key: 'highContrast', 
                              label: 'High Contrast', 
                              desc: 'Increase visibility of UI elements', 
                              icon: <Eye size={20} />,
                              checked: uiPrefs.highContrast,
                              onChange: (val: boolean) => setUiPrefs({ ...uiPrefs, highContrast: val })
                            }
                          ].map((item) => (
                            <Box 
                              key={item.key}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                p: 2,
                                borderRadius: 2,
                                border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                                bgcolor: alpha(theme.palette.background.paper, 0.5),
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                                  {item.icon}
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.label}</Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{item.desc}</Typography>
                                </Box>
                              </Box>
                              <Switch checked={item.checked} onChange={(e) => item.onChange(e.target.checked)} />
                            </Box>
                          ))}
                        </Stack>
                      </Box>

                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button 
                          variant="contained" 
                          startIcon={<Save size={18} />} 
                          onClick={handleSaveProfile}
                          sx={{ 
                            borderRadius: 3, 
                            fontWeight: 800, 
                            px: 5, 
                            py: 1.5,
                            textTransform: 'none',
                          }}
                        >
                          Save Appearance
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            {tabValue === 'notifications' && (
              <motion.div key="notifications" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>Notification Preferences</Typography>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        startIcon={<Bell size={16} />}
                        onClick={() => {
                          if ('Notification' in window) {
                            Notification.requestPermission().then(permission => {
                              setSnackbar({ open: true, message: `Notification permission: ${permission}`, severity: permission === 'granted' ? 'success' : 'error' });
                            });
                          }
                        }}
                        sx={{ borderRadius: 2, fontWeight: 800 }}
                      >
                        Request Permission
                      </Button>
                    </Box>

                    <Stack spacing={2}>
                      {[
                        { key: 'email', label: 'Email Notifications', desc: 'Receive updates via your registered email', icon: <Mail size={20} /> },
                        { key: 'push', label: 'Push Notifications', desc: 'Get real-time alerts on your mobile/laptop', icon: <Zap size={20} /> },
                        { key: 'feeReminders', label: 'Fee Reminders', desc: 'Get notified about upcoming fee deadlines', icon: <CreditCard size={20} /> },
                        { key: 'attendance', label: 'Attendance Alerts', desc: 'Notifications about daily attendance status', icon: <CheckCircle size={20} /> },
                        { key: 'announcements', label: 'Maktab Announcements', desc: 'Important news from the administration', icon: <Bell size={20} /> }
                      ].map((item, i) => (
                        <ListItem key={i} sx={{ py: 2, px: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
                          <ListItemIcon sx={{ color: 'primary.main' }}>{item.icon}</ListItemIcon>
                          <ListItemText 
                            primary={item.label}
                            primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 800 } }}
                            secondary={item.desc}
                            secondaryTypographyProps={{ variant: 'caption', sx: { fontWeight: 500 } }}
                          />
                          <Switch 
                            color="primary" 
                            checked={(notificationPrefs as any)[item.key]} 
                            onChange={(e) => setNotificationPrefs({ ...notificationPrefs, [item.key]: e.target.checked })}
                          />
                        </ListItem>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 5, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="contained" 
                        startIcon={<Save size={18} />} 
                        onClick={handleSaveNotifications}
                        sx={{ borderRadius: 3, fontWeight: 800, px: 4 }}
                      >
                        Save Preferences
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            {tabValue === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card sx={{ 
                  borderRadius: 6, 
                  border: 'none',
                  bgcolor: 'background.paper',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
                    : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, letterSpacing: -0.5 }}>Security & Authentication</Typography>
                    <Stack spacing={3}>
                      <Box sx={{ 
                        p: 3, 
                        borderRadius: 5, 
                        bgcolor: 'background.default',
                        boxShadow: theme.palette.mode === 'dark'
                          ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                          : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2 }}>Account Password</Typography>
                        <Typography variant="body2" sx={{ mb: 3, fontWeight: 500, color: 'text.secondary' }}>
                          Regularly updating your password helps keep your account secure.
                        </Typography>
                        <Button 
                          variant="contained" 
                          startIcon={<Lock size={18} />}
                          onClick={() => setPasswordDialog({ ...passwordDialog, open: true })}
                          sx={{ 
                            borderRadius: 3, 
                            fontWeight: 800, 
                            px: 4,
                            boxShadow: theme.palette.mode === 'dark'
                              ? '6px 6px 12px #060a12, -6px -6px 12px #182442'
                              : '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
                          }}
                        >
                          Change Password
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {tabValue === 'system' && isAdmin && (
              <motion.div key="system" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card sx={{ 
                  borderRadius: 6, 
                  border: 'none',
                  bgcolor: 'background.paper',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
                    : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, letterSpacing: -0.5 }}>System & Data Management</Typography>
                    <Stack spacing={3}>
                      <Box sx={{ 
                        p: 3, 
                        borderRadius: 5, 
                        bgcolor: alpha(theme.palette.error.main, 0.03),
                        boxShadow: theme.palette.mode === 'dark'
                          ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                          : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2, color: 'error.main' }}>Danger Zone: Reset Application Data</Typography>
                        <Typography variant="body2" sx={{ mb: 3, fontWeight: 500, color: 'text.secondary' }}>
                          This will permanently delete all attendance records, fee payments, notifications, and study materials. 
                          User accounts will remain intact. This action cannot be undone.
                        </Typography>
                        <Button 
                          variant="contained" 
                          color="error" 
                          startIcon={<Trash2 size={18} />}
                          onClick={handleResetData}
                          disabled={currentUser?.role !== 'superadmin'}
                          sx={{ 
                            borderRadius: 3, 
                            fontWeight: 800, 
                            px: 4,
                            boxShadow: currentUser?.role === 'superadmin' ? (theme.palette.mode === 'dark'
                              ? '6px 6px 12px #060a12, -6px -6px 12px #182442'
                              : '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff') : 'none',
                          }}
                        >
                          Reset All Data
                        </Button>
                        {currentUser?.role !== 'superadmin' && (
                          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, fontWeight: 600 }}>
                            Only Super Admins can perform this action.
                          </Typography>
                        )}
                      </Box>
                      
                      <Box sx={{ 
                        p: 3, 
                        borderRadius: 5, 
                        bgcolor: 'background.default',
                        boxShadow: theme.palette.mode === 'dark'
                          ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                          : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2 }}>Database Backup</Typography>
                        <Typography variant="body2" sx={{ mb: 3, fontWeight: 500, color: 'text.secondary' }}>
                          Download a JSON backup of your current database state.
                        </Typography>
                        <Button 
                          variant="outlined" 
                          startIcon={<Download size={18} />} 
                          onClick={handleGenerateBackup}
                          sx={{ 
                            borderRadius: 3, 
                            fontWeight: 800,
                            boxShadow: theme.palette.mode === 'dark'
                              ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                              : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                          }}
                        >
                          Generate Backup
                        </Button>
                      </Box>

                      <Box sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.info.main, 0.03) }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2, color: 'info.dark' }}>System Activity Logs</Typography>
                        <Typography variant="body2" sx={{ mb: 3, fontWeight: 500 }}>
                          Review detailed system events, database operations, and authentication logs.
                        </Typography>
                        <Button 
                          variant="contained" 
                          color="info"
                          startIcon={<Terminal size={18} />} 
                          onClick={() => navigate('/admin/logs')}
                          sx={{ borderRadius: 3, fontWeight: 800, px: 4 }}
                        >
                          View System Logs
                        </Button>
                      </Box>

                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="error"
                          startIcon={<LogOut size={20} />}
                          onClick={logout}
                          sx={{ 
                            borderRadius: 4, 
                            py: 2, 
                            fontWeight: 900,
                            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.2)'
                          }}
                        >
                          Sign Out of Account
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </Grid>
      </Grid>

      {/* Password Change Dialog */}
      <Dialog 
        open={passwordDialog.open} 
        onClose={() => !passwordDialog.loading && setPasswordDialog({ ...passwordDialog, open: false })}
        PaperProps={{ 
          sx: { 
            borderRadius: 6, 
            width: '100%', 
            maxWidth: 400,
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '20px 20px 60px #060a12, -20px -20px 60px #182442'
              : '20px 20px 60px #d1d9e6, -20px -20px 60px #ffffff',
            border: 'none'
          } 
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Change Password</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Current Password"
              type={showPassword ? 'text' : 'password'}
              value={passwordDialog.current}
              onChange={(e) => setPasswordDialog({ ...passwordDialog, current: e.target.value })}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </IconButton>
                ),
                sx: { borderRadius: 3 }
              }}
            />
            <TextField
              fullWidth
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              value={passwordDialog.new}
              onChange={(e) => setPasswordDialog({ ...passwordDialog, new: e.target.value })}
              InputProps={{ sx: { borderRadius: 3 } }}
            />
            <TextField
              fullWidth
              label="Confirm New Password"
              type={showPassword ? 'text' : 'password'}
              value={passwordDialog.confirm}
              onChange={(e) => setPasswordDialog({ ...passwordDialog, confirm: e.target.value })}
              InputProps={{ sx: { borderRadius: 3 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setPasswordDialog({ ...passwordDialog, open: false })} disabled={passwordDialog.loading} sx={{ fontWeight: 800, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpdatePassword} 
            disabled={passwordDialog.loading || !passwordDialog.current || !passwordDialog.new}
            sx={{ 
              borderRadius: 3, 
              fontWeight: 800, 
              px: 3,
              boxShadow: theme.palette.mode === 'dark'
                ? '6px 6px 12px #060a12, -6px -6px 12px #182442'
                : '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
            }}
          >
            {passwordDialog.loading ? <CircularProgress size={24} /> : 'Update Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Data Confirmation Dialog */}
      <Dialog 
        open={resetConfirmOpen} 
        onClose={() => setResetConfirmOpen(false)} 
        PaperProps={{ 
          sx: { 
            borderRadius: 6, 
            p: 1,
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '20px 20px 60px #060a12, -20px -20px 60px #182442'
              : '20px 20px 60px #d1d9e6, -20px -20px 60px #ffffff',
            border: 'none'
          } 
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, color: 'error.main', letterSpacing: -0.5 }}>DANGER: Reset All Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Are you sure you want to delete all application data (Attendance, Receipts, Notifications, Notes)? 
            <Box component="span" sx={{ display: 'block', mt: 1, fontWeight: 800, color: 'error.main' }}>
              This action is permanent and cannot be undone.
            </Box>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setResetConfirmOpen(false)} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            onClick={confirmResetData} 
            color="error" 
            variant="contained" 
            sx={{ 
              borderRadius: 3, 
              fontWeight: 800,
              boxShadow: theme.palette.mode === 'dark'
                ? '6px 6px 12px #060a12, -6px -6px 12px #182442'
                : '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
            }}
          >
            Yes, Reset Everything
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          sx={{ width: '100%', borderRadius: 3, fontWeight: 700 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
