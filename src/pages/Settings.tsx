import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Avatar, Divider, Switch, FormControlLabel, 
  IconButton, Chip, CircularProgress, Alert, Paper,
  Tab, Tabs, List, ListItem, ListItemText,
  Stack, Tooltip, Fade, Zoom, ListItemIcon, Snackbar
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Settings as SettingsIcon, User, Shield, Palette, 
  Bell, Globe, Save, Camera, Trash2, Plus, 
  CheckCircle, Smartphone, Mail, Lock, X,
  CreditCard, HelpCircle, LogOut, ChevronRight,
  Monitor, Moon, Sun, Languages, Database,
  Key, Eye, EyeOff, Smartphone as MobileIcon,
  Cloud, Zap, HardDrive, RefreshCw, AlertTriangle, Layout,
  Download, FileJson, Terminal, Mic
} from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, getDocs, deleteDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, InstituteSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useHardwarePermissions } from '../services/hardwareService';
import { motion, AnimatePresence } from 'motion/react';
import { useMediaQuery, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { logger } from '../lib/logger';

export default function Settings() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { 
    mode, setMode, 
    setAccentColor,
    setHighContrast,
    setReduceMotion,
    setCompactLayout
  } = useThemeContext()!;
  const { permissions } = useHardwarePermissions();
  const [searchParams] = useSearchParams();

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isManagerRole = currentUser?.role === 'manager' || (currentUser?.role === 'superadmin' && !isSuperAdmin);
  const isTeacherRole = currentUser?.role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(searchParams.get('tab') || 'appearance');
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

  const [passwordDialog, setPasswordDialog] = useState({
    open: false,
    current: '',
    new: '',
    confirm: '',
    loading: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setTabValue(tab);
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        setLoading(true);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfileData(data);
          if (data.notificationPrefs) setNotificationPrefs(data.notificationPrefs);
          if (data.uiPrefs) setUiPrefs(prev => ({ ...prev, ...data.uiPrefs }));
        }

        const instDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (instDoc.exists()) {
          setInstituteData(instDoc.data() as InstituteSettings);
        }
      } catch (err) {
        logger.error('Error fetching settings', err as Error);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const handleSaveSettings = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...profileData,
        notificationPrefs,
        uiPrefs,
        updatedAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInstitute = async () => {
    try {
      setLoading(true);
      
      // Safety check for Firestore 1MB limit
      const dataToSave = {
        ...instituteData,
        updatedAt: new Date().toISOString()
      };
      const dataSize = JSON.stringify(dataToSave).length;
      
      if (dataSize > 1048576) {
        throw new Error(`Data is too large (${(dataSize / 1024 / 1024).toFixed(2)} MB). Please use smaller or fewer branding images. Firestore limit is 1MB.`);
      }

      await setDoc(doc(db, 'settings', 'institute'), dataToSave, { merge: true });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/institute');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        notificationPrefs,
        updatedAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentUser || !auth.currentUser) return;
    if (passwordDialog.new !== passwordDialog.confirm) {
      setSnackbar({ open: true, message: 'Passwords do not match', severity: 'error' });
      return;
    }
    try {
      setPasswordDialog({ ...passwordDialog, loading: true });
      const credential = EmailAuthProvider.credential(currentUser.email, passwordDialog.current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordDialog.new);
      setSnackbar({ open: true, message: 'Password updated successfully', severity: 'success' });
      setPasswordDialog({ open: false, current: '', new: '', confirm: '', loading: false });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || 'Failed to update password', severity: 'error' });
    } finally {
      setPasswordDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handleResetData = () => {
    setResetConfirmOpen(true);
  };

  const confirmResetData = async () => {
    try {
      setLoading(true);
      const collections = ['attendance', 'feeReceipts', 'notifications', 'studyMaterials'];
      for (const coll of collections) {
        const q = query(collection(db, coll));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      setSnackbar({ open: true, message: 'Application data reset successfully', severity: 'success' });
      setResetConfirmOpen(false);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to reset data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBackup = async () => {
    try {
      const backup: any = {};
      const collections = ['users', 'attendance', 'feeReceipts', 'notifications', 'studyMaterials', 'institute'];
      for (const coll of collections) {
        const snapshot = await getDocs(collection(db, coll));
        backup[coll] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `institute_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to generate backup', severity: 'error' });
    }
  };

  const handleImageUpload = (field: 'logoUrl' | 'bannerUrl' | 'receiptLeftImageUrl' | 'receiptRightImageUrl') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size before processing
    if (file.size > 2 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'Image is too large. Please select a file under 2MB.', severity: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Stricter limits to keep document size under 1MB
        let max = 600; 
        if (field === 'bannerUrl') max = 1000;
        if (field.includes('receipt')) max = 400; // Receipt corner images don't need to be huge
        
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
        
        // Fill white background for JPEGs (to handle transparent PNGs)
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        // Use JPEG with 0.7 quality to significantly reduce base64 size
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setInstituteData(prev => ({ ...prev, [field]: base64 }));
        
        // Check if the resulting total data might be too large
        const estimate = JSON.stringify({ ...instituteData, [field]: base64 }).length;
        if (estimate > 900000) { // Keep safety margin for 1MB limit
          setSnackbar({ open: true, message: 'Warning: Institute data is reaching Firestore limits. Try smaller images.', severity: 'error' });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (field: 'logoUrl' | 'bannerUrl' | 'receiptLeftImageUrl' | 'receiptRightImageUrl') => {
    setInstituteData(prev => ({ ...prev, [field]: '' }));
  };

  const menuItems = [
    { id: 'appearance', label: 'Theme & Appearance', icon: <Palette size={20} />, role: 'all' },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={20} />, role: 'all' },
    { id: 'security', label: 'Security & Privacy', icon: <Shield size={20} />, role: 'all' },
    { id: 'hardware', label: 'Device & Permissions', icon: <Camera size={20} />, role: 'all' },
    { id: 'branding', label: 'Institute Branding', icon: <Globe size={20} />, role: 'superadmin' },
    { id: 'system', label: 'System & Data', icon: <Database size={20} />, role: 'superadmin' },
  ].filter(item => {
    if (item.role === 'all') return true;
    if (item.role === 'admin') return isAdmin;
    if (item.role === 'superadmin') return isSuperAdmin;
    return false;
  });

  if (loading && !profileData.uid) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: isMobile ? 12 : 8, px: isSmallMobile ? 1 : 0 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: isMobile ? 4 : 6, textAlign: 'center' }}>
          <Typography 
            variant={isMobile ? "h4" : "h3"} 
            sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 1 }}
          >
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
            {isMobile ? 'Manage account & Institute' : 'Manage your personal profile and institute preferences'}
          </Typography>
        </Box>
      </motion.div>

      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Alert 
              severity="success" 
              icon={<CheckCircle size={20} />}
              sx={{ mb: 3, borderRadius: 1.5, fontWeight: 700, border: '1px solid', borderColor: 'success.light' }}
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
              sx={{ mb: 3, borderRadius: 1.5, fontWeight: 700, border: '1px solid', borderColor: 'error.light' }}
            >
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Grid container spacing={isMobile ? 3 : 4}>
        <Grid size={{ xs: 12, md: 4, lg: 3 }}>
          {isMobile ? (
            <Box 
              sx={{ 
                mb: 4, 
                position: 'sticky', 
                top: 0, 
                zIndex: 10,
                bgcolor: 'background.default',
                mx: -2,
                px: 2,
                py: 1,
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                backdropFilter: 'blur(10px)'
              }}
            >
              <Tabs 
                value={tabValue} 
                onChange={(_, v) => setTabValue(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ 
                  '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0' },
                  '& .MuiTab-root': { 
                    minHeight: 56, 
                    fontWeight: 900, 
                    textTransform: 'none', 
                    color: 'text.secondary',
                    fontSize: '0.85rem',
                    px: 3
                  },
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
            <Card variant="outlined" sx={{ borderRadius: 1.5, position: 'sticky', top: 24, bgcolor: 'background.paper' }}>
              <List sx={{ p: 1 }}>
                {menuItems.map((item) => (
                  <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
                    <IconButton
                      onClick={() => setTabValue(item.id)}
                      sx={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        borderRadius: 1,
                        py: 1.5,
                        px: 2,
                        bgcolor: tabValue === item.id ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        color: tabValue === item.id ? 'primary.main' : 'text.secondary',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>{item.icon}</ListItemIcon>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{item.label}</Typography>
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 8, lg: 9 }}>
          <AnimatePresence mode="wait">
            {tabValue === 'branding' && isSuperAdmin && (
              <motion.div key="branding" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, letterSpacing: -0.5 }}>Institute Branding</Typography>
                    <Grid container spacing={4}>
                      <Grid size={{ xs: 12 }}>
                        <Stack spacing={3}>
                          <TextField
                            fullWidth
                            label="Institute Name"
                            value={instituteData.instituteName || ''}
                            onChange={(e) => setInstituteData({ ...instituteData, instituteName: e.target.value })}
                            InputProps={{ sx: { borderRadius: 1 } }}
                          />
                          
                          <Grid container spacing={3}>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>Institute Logo</Typography>
                              <Box sx={{ 
                                position: 'relative', 
                                border: '2px dashed', 
                                borderColor: 'divider',
                                borderRadius: 1.5,
                                height: 160,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                              }}>
                                {instituteData.logoUrl ? (
                                  <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={instituteData.logoUrl} alt="Logo" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleRemoveImage('logoUrl')}
                                      sx={{ 
                                        position: 'absolute', 
                                        top: 8, 
                                        right: 8, 
                                        bgcolor: 'error.main', 
                                        color: 'white',
                                        '&:hover': { bgcolor: 'error.dark' },
                                        zIndex: 10
                                      }}
                                    >
                                      <X size={14} />
                                    </IconButton>
                                  </Box>
                                ) : (
                                  <Camera size={32} color={theme.palette.text.disabled} />
                                )}
                                <Box sx={{ 
                                  position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', opacity: 0, 
                                  transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  '&:hover': { opacity: 1 }, cursor: 'pointer'
                                }} component="label">
                                  <input type="file" hidden accept="image/*" onChange={handleImageUpload('logoUrl')} />
                                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 900 }}>CHANGE LOGO</Typography>
                                </Box>
                              </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>Institute Banner</Typography>
                              <Box sx={{ 
                                position: 'relative', 
                                border: '2px dashed', 
                                borderColor: 'divider',
                                borderRadius: 1.5,
                                height: 160,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                              }}>
                                {instituteData.bannerUrl ? (
                                  <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <img src={instituteData.bannerUrl} alt="Banner" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleRemoveImage('bannerUrl')}
                                      sx={{ 
                                        position: 'absolute', 
                                        top: 8, 
                                        right: 8, 
                                        bgcolor: 'error.main', 
                                        color: 'white',
                                        '&:hover': { bgcolor: 'error.dark' },
                                        zIndex: 10
                                      }}
                                    >
                                      <X size={14} />
                                    </IconButton>
                                  </Box>
                                ) : (
                                  <Layout size={32} color={theme.palette.text.disabled} />
                                )}
                                <Box sx={{ 
                                  position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', opacity: 0, 
                                  transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  '&:hover': { opacity: 1 }, cursor: 'pointer'
                                }} component="label">
                                  <input type="file" hidden accept="image/*" onChange={handleImageUpload('bannerUrl')} />
                                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 900 }}>CHANGE BANNER</Typography>
                                </Box>
                              </Box>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>Receipt Left Image</Typography>
                              <Box sx={{ 
                                position: 'relative', 
                                border: '2px dashed', 
                                borderColor: 'divider',
                                borderRadius: 1.5,
                                height: 160,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                              }}>
                                {instituteData.receiptLeftImageUrl ? (
                                  <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={instituteData.receiptLeftImageUrl} alt="Left" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleRemoveImage('receiptLeftImageUrl')}
                                      sx={{ 
                                        position: 'absolute', top: 8, right: 8, bgcolor: 'error.main', color: 'white',
                                        '&:hover': { bgcolor: 'error.dark' }, zIndex: 10
                                      }}
                                    >
                                      <X size={14} />
                                    </IconButton>
                                  </Box>
                                ) : (
                                  <Monitor size={32} color={theme.palette.text.disabled} />
                                )}
                                <Box sx={{ 
                                  position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', opacity: 0, 
                                  transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  '&:hover': { opacity: 1 }, cursor: 'pointer'
                                }} component="label">
                                  <input type="file" hidden accept="image/*" onChange={handleImageUpload('receiptLeftImageUrl')} />
                                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 900 }}>UPLOAD LEFT</Typography>
                                </Box>
                              </Box>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>Receipt Right Image</Typography>
                              <Box sx={{ 
                                position: 'relative', 
                                border: '2px dashed', 
                                borderColor: 'divider',
                                borderRadius: 1.5,
                                height: 160,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                              }}>
                                {instituteData.receiptRightImageUrl ? (
                                  <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={instituteData.receiptRightImageUrl} alt="Right" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleRemoveImage('receiptRightImageUrl')}
                                      sx={{ 
                                        position: 'absolute', top: 8, right: 8, bgcolor: 'error.main', color: 'white',
                                        '&:hover': { bgcolor: 'error.dark' }, zIndex: 10
                                      }}
                                    >
                                      <X size={14} />
                                    </IconButton>
                                  </Box>
                                ) : (
                                  <Monitor size={32} color={theme.palette.text.disabled} />
                                )}
                                <Box sx={{ 
                                  position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', opacity: 0, 
                                  transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  '&:hover': { opacity: 1 }, cursor: 'pointer'
                                }} component="label">
                                  <input type="file" hidden accept="image/*" onChange={handleImageUpload('receiptRightImageUrl')} />
                                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 900 }}>UPLOAD RIGHT</Typography>
                                </Box>
                              </Box>
                            </Grid>
                          </Grid>
                        </Stack>
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                         <Box sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.4) : 'grey.50' }}>
                           <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 800 }}>Primary Brand Color</Typography>
                           <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                             <Box 
                               sx={{ 
                                 width: 60, height: 60, borderRadius: 1.5, 
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
                                 {instituteData.primaryColor?.toUpperCase() || '#1976D2'}
                               </Typography>
                               <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Click to change</Typography>
                             </Box>
                           </Box>
                         </Box>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                         <Box sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.4) : 'grey.50' }}>
                           <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 800 }}>Secondary Brand Color</Typography>
                           <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                             <Box 
                               sx={{ 
                                 width: 60, height: 60, borderRadius: 1.5, 
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
                                 {instituteData.secondaryColor?.toUpperCase() || '#9C27B0'}
                               </Typography>
                               <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Click to change</Typography>
                             </Box>
                           </Box>
                         </Box>
                      </Grid>
                    </Grid>
                    
                    <Box sx={{ mt: 5, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="contained" 
                        startIcon={<Save size={18} />} 
                        onClick={handleSaveInstitute} 
                        sx={{ borderRadius: 2, fontWeight: 800, px: 5, py: 1.5 }}
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
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, letterSpacing: -0.5 }}>Theme & Appearance</Typography>
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
                          {/* Custom Color Picker */}
                          <Grid size={{ xs: 3, sm: 1.5 }}>
                            <Box 
                              sx={{ 
                                width: 44,
                                height: 44,
                                borderRadius: '50%', 
                                border: '2px solid', 
                                borderColor: ![
                                  '#0f766e', '#6366f1', '#f43f5e', '#f59e0b', 
                                  '#8b5cf6', '#3b82f6', '#10b981', '#64748b'
                                ].includes(uiPrefs.accentColor) ? uiPrefs.accentColor : 'transparent',
                                bgcolor: uiPrefs.accentColor,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: ![
                                  '#0f766e', '#6366f1', '#f43f5e', '#f59e0b', 
                                  '#8b5cf6', '#3b82f6', '#10b981', '#64748b'
                                ].includes(uiPrefs.accentColor) ? `0 0 15px ${alpha(uiPrefs.accentColor, 0.4)}` : 'none',
                                '&:hover': { 
                                  transform: 'scale(1.1)'
                                }
                              }}
                            >
                              <input 
                                type="color" 
                                value={uiPrefs.accentColor} 
                                onChange={(e) => {
                                  const color = e.target.value;
                                  setUiPrefs({ ...uiPrefs, accentColor: color });
                                  setAccentColor(color);
                                }}
                                style={{ 
                                  position: 'absolute', 
                                  top: -10, 
                                  left: -10, 
                                  width: '150%', 
                                  height: '150%', 
                                  cursor: 'pointer',
                                  border: 'none',
                                  padding: 0
                                }}
                              />
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Theme Mode</Typography>
                        <Box sx={{ 
                          display: 'grid', 
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, 
                          gap: 2 
                        }}>
                          {[
                            { label: 'Light Mode', icon: <Sun size={24} />, value: 'light', desc: 'Classic bright look' },
                            { label: 'Dark Mode', icon: <Moon size={24} />, value: 'dark', desc: 'Easy on the eyes' },
                            { label: 'System', icon: <Monitor size={24} />, value: 'system', desc: 'Match your device' }
                          ].map((m) => (
                            <Box
                              key={m.value}
                              onClick={() => setMode(m.value as any)}
                              sx={{
                                p: 3,
                                borderRadius: 1.5,
                                cursor: 'pointer',
                                border: '2px solid',
                                transition: 'all 0.2s',
                                borderColor: mode === m.value ? 'primary.main' : alpha(theme.palette.divider, 0.1),
                                bgcolor: mode === m.value ? alpha(theme.palette.primary.main, 0.05) : 'background.default',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                gap: 1.5,
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  transform: 'translateY(-2px)'
                                }
                              }}
                            >
                              <Box sx={{ 
                                color: mode === m.value ? 'primary.main' : 'text.secondary',
                                mb: 0.5
                              }}>
                                {m.icon}
                              </Box>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 900, color: mode === m.value ? 'primary.main' : 'text.primary' }}>
                                  {m.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  {m.desc}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Interface & Accessibility</Typography>
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
                              onChange: (val: boolean) => {
                                setUiPrefs({ ...uiPrefs, reduceMotion: val });
                                setReduceMotion(val);
                              }
                            },
                            { 
                              key: 'highContrast', 
                              label: 'High Contrast', 
                              desc: 'Increase visibility of UI elements', 
                              icon: <Eye size={20} />,
                              checked: uiPrefs.highContrast,
                              onChange: (val: boolean) => {
                                setUiPrefs({ ...uiPrefs, highContrast: val });
                                setHighContrast(val);
                              }
                            },
                            { 
                              key: 'compactLayout', 
                              label: 'Compact Layout', 
                              desc: 'Reduce padding and margins for more content', 
                              icon: <Monitor size={20} />,
                              checked: uiPrefs.compactLayout,
                              onChange: (val: boolean) => {
                                setUiPrefs({ ...uiPrefs, compactLayout: val });
                                setCompactLayout(val);
                              }
                            }
                          ].map((item) => (
                            <Box 
                              key={item.key}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                p: 2,
                                borderRadius: 1.5,
                                border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                                bgcolor: alpha(theme.palette.background.paper, 0.5),
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
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.label}</Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{item.desc}</Typography>
                                </Box>
                              </Box>
                              <Switch 
                                checked={item.checked}
                                onChange={(e) => item.onChange(e.target.checked)}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </Box>

                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button 
                          variant="contained" 
                          startIcon={<Save size={18} />} 
                          onClick={handleSaveSettings}
                          sx={{ borderRadius: 1.5, fontWeight: 800, px: 5, py: 1.5 }}
                        >
                          Save Appearance
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            {tabValue === 'hardware' && (
              <motion.div key="hardware" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ borderRadius: 1.5, bgcolor: 'background.paper' }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, letterSpacing: -0.5 }}>Device & Permissions</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
                      The following hardware permissions are required for certain features like scanning QR codes or taking student photographs.
                    </Typography>
                    <Stack spacing={3}>
                      {Object.entries(permissions)
                        .filter(([name]) => name !== 'microphone')
                        .map(([name, status]) => (
                        <Box 
                          key={name}
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            p: 3,
                            borderRadius: 1.5,
                            bgcolor: 'background.default',
                            border: `1px solid ${alpha(theme.palette.divider, 0.05)}`
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                              {name === 'camera' ? <Camera size={22} /> : <Bell size={22} />}
                            </Box>
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 900, textTransform: 'capitalize' }}>{name}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Status: {status}</Typography>
                            </Box>
                          </Box>
                          <Chip 
                            label={status === 'granted' ? 'Allowed' : status === 'denied' ? 'Blocked' : 'Unknown'} 
                            color={status === 'granted' ? 'success' : 'error'}
                            variant={status === 'granted' ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 800, borderRadius: 2 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 5, p: 3, borderRadius: 1.5, bgcolor: alpha(theme.palette.info.main, 0.03), border: '1px solid', borderColor: alpha(theme.palette.info.main, 0.1) }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, color: 'info.dark' }}>Need to change permissions?</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                        If a permission is blocked, you can usually change it in your browser settings or by clicking the lock icon in the address bar.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {tabValue === 'notifications' && (
              <motion.div key="notifications" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
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
                            sx={{ borderRadius: 1.5, fontWeight: 800 }}
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
                            { key: 'announcements', label: 'Institute Announcements', desc: 'Important news from the administration', icon: <Bell size={20} /> }
                          ].map((item, i) => (
                            <Box 
                              key={i} 
                              sx={{ 
                                p: 2.5, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                border: '1px solid', 
                                borderColor: alpha(theme.palette.divider, 0.08), 
                                borderRadius: 2.5,
                                bgcolor: alpha(theme.palette.background.default, 0.4),
                                transition: '0.2s',
                                '&:hover': { bgcolor: alpha(theme.palette.background.default, 0.8), transform: 'translateY(-2px)' }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                                  {item.icon}
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.label}</Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{item.desc}</Typography>
                                </Box>
                              </Box>
                              <Switch 
                                color="primary" 
                                checked={(notificationPrefs as any)[item.key]} 
                                onChange={(e) => setNotificationPrefs({ ...notificationPrefs, [item.key]: e.target.checked })}
                                sx={{ 
                                  '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'primary.main' }
                                }}
                              />
                            </Box>
                          ))}
                        </Stack>
                        <Box sx={{ mt: 5, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button 
                            variant="contained" 
                            startIcon={<Save size={18} />} 
                            onClick={handleSaveNotifications}
                            sx={{ borderRadius: 2, fontWeight: 800, px: 5, py: 1.5 }}
                          >
                            Save Preferences
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, lg: 5 }}>
                    <Card sx={{ borderRadius: 4, height: '100%', bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'grey.50', border: 'none' }}>
                      <CardContent sx={{ p: 4 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Platform Previews</Typography>
                        
                        <Box sx={{ mb: 4, bgcolor: 'background.paper', p: 0.5, borderRadius: 3, display: 'flex', gap: 0.5 }}>
                          {['Android', 'iOS', 'Desktop'].map((platform) => (
                            <Button
                              key={platform}
                              fullWidth
                              size="small"
                              variant={(window as any)._notifPreview === platform ? 'contained' : 'text'}
                              onClick={() => {
                                (window as any)._notifPreview = platform;
                                setTabValue('notifications'); // force re-render
                              }}
                              sx={{ 
                                borderRadius: 2.5, 
                                fontWeight: 800, 
                                py: 1,
                                bgcolor: (window as any)._notifPreview === platform ? 'primary.main' : 'transparent',
                                color: (window as any)._notifPreview === platform ? 'white' : 'text.secondary'
                              }}
                            >
                              {platform}
                            </Button>
                          ))}
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          {((window as any)._notifPreview || 'Android') === 'Android' && (
                            <Box sx={{ 
                              width: '100%', 
                              maxWidth: 300, 
                              p: 2, 
                              bgcolor: '#1a1a1a', 
                              borderRadius: 4, 
                              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                              color: 'white',
                              fontFamily: 'sans-serif'
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, opacity: 0.8 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>10:45</Typography>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <div style={{ width: 12, height: 12, borderRadius: '2px', border: '1px solid white' }} />
                                  <div style={{ width: 12, height: 12, borderRadius: '2px', border: '1px solid white' }} />
                                </Box>
                              </Box>
                              <Box sx={{ bgcolor: '#333', p: 1.5, borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main, fontSize: '0.8rem' }}>M</Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', lineHeight: 1 }}>Institute LMS</Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mt: 0.5 }}>Fee Reminder</Typography>
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.7 }}>Please submit your monthly fees by tomorrow...</Typography>
                                </Box>
                              </Box>
                            </Box>
                          )}

                          {((window as any)._notifPreview || 'Android') === 'iOS' && (
                            <Box sx={{ 
                              width: '100%', 
                              maxWidth: 300, 
                              p: 2.5, 
                              bgcolor: 'rgba(255,255,255,0.8)', 
                              backdropFilter: 'blur(10px)',
                              borderRadius: 5, 
                              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                              color: '#000',
                              border: '1px solid rgba(255,255,255,0.5)'
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                <Avatar sx={{ width: 24, height: 24, bgcolor: theme.palette.primary.main, fontSize: '0.6rem' }}>M</Avatar>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, flex: 1, opacity: 0.6 }}>INSTITUTE LMS</Typography>
                                <Typography sx={{ fontSize: '0.7rem', opacity: 0.5 }}>now</Typography>
                              </Box>
                              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, mb: 0.3 }}>Class Timing Updated</Typography>
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 400, opacity: 0.8, lineHeight: 1.3 }}>Your Farsi class has been moved to 5:00 PM today.</Typography>
                            </Box>
                          )}

                          {((window as any)._notifPreview || 'Android') === 'Desktop' && (
                            <Box sx={{ 
                              width: '100%', 
                              maxWidth: 320, 
                              p: 2, 
                              bgcolor: theme.palette.mode === 'dark' ? '#2d2d2d' : 'white', 
                              borderRadius: 1.5, 
                              boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
                              border: `1px solid ${theme.palette.divider}`,
                              display: 'flex',
                              gap: 2
                            }}>
                              <Avatar sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: theme.palette.primary.main }}>M</Avatar>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>Important Announcement</Typography>
                                  <X size={14} style={{ opacity: 0.4 }} />
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.4, mb: 2 }}>The exam schedule for term 2 has been published.</Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Button size="small" variant="contained" sx={{ px: 2, height: 24, fontSize: '0.65rem', borderRadius: 1 }}>View</Button>
                                  <Button size="small" variant="outlined" sx={{ px: 2, height: 24, fontSize: '0.65rem', borderRadius: 1 }}>Dismiss</Button>
                                </Box>
                              </Box>
                            </Box>
                          )}
                        </Box>

                        <Box sx={{ mt: 6, p: 3, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.03), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 1, color: 'primary.main', textTransform: 'uppercase' }}>Pro Tip</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', display: 'block', lineHeight: 1.5 }}>
                            Real-time notifications help ensure you never miss an updated class time or a payment deadline. Keep them enabled for the best experience.
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </motion.div>
            )}
            
            {tabValue === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card sx={{ 
                  borderRadius: 1.5, 
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
                        borderRadius: 1.5, 
                        bgcolor: 'background.default',
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>Account Password</Typography>
                        <Typography variant="body2" sx={{ mb: 3, fontWeight: 500, color: 'text.secondary' }}>
                          Update your password periodically to maintain account security.
                        </Typography>
                        
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Current Password"
                              type={showPassword ? 'text' : 'password'}
                              value={passwordDialog.current}
                              onChange={(e) => setPasswordDialog({ ...passwordDialog, current: e.target.value })}
                              InputProps={{
                                endAdornment: (
                                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </IconButton>
                                ),
                                sx: { borderRadius: 1 }
                              }}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="New Password"
                              type={showPassword ? 'text' : 'password'}
                              value={passwordDialog.new}
                              onChange={(e) => setPasswordDialog({ ...passwordDialog, new: e.target.value })}
                              InputProps={{ sx: { borderRadius: 1 } }}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Confirm New Password"
                              type={showPassword ? 'text' : 'password'}
                              value={passwordDialog.confirm}
                              onChange={(e) => setPasswordDialog({ ...passwordDialog, confirm: e.target.value })}
                              InputProps={{ sx: { borderRadius: 1 } }}
                            />
                          </Grid>
                        </Grid>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button 
                            variant="contained" 
                            startIcon={passwordDialog.loading ? <CircularProgress size={16} color="inherit" /> : <Lock size={18} />}
                            onClick={handleUpdatePassword}
                            disabled={passwordDialog.loading || !passwordDialog.current || !passwordDialog.new}
                            sx={{ 
                              borderRadius: 1, 
                              fontWeight: 800, 
                              px: 4,
                            }}
                          >
                            Update Password
                          </Button>
                        </Box>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {tabValue === 'system' && isSuperAdmin && (
              <motion.div key="system" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card sx={{ 
                  borderRadius: 1.5, 
                  border: 'none',
                  bgcolor: 'background.paper',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
                    : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 4, letterSpacing: -0.5 }}>System & Data Management</Typography>
                    <Stack spacing={3}>
                      {/* Jafari Hijri Date Adjustment moved here */}
                      <Box sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.4) : 'grey.50', mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Languages size={18} /> Jafari Hijri Date Adjustment
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 600 }}>
                          Set an offset to manually adjust the Islamic date (e.g. for regional moon sighting).
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Box sx={{ flex: 1 }}>
                            <input 
                              type="range" 
                              min="-3" 
                              max="3" 
                              step="1"
                              value={instituteData.jafariOffset || 0}
                              onChange={(e) => setInstituteData({ ...instituteData, jafariOffset: parseInt(e.target.value) })}
                              style={{ width: '100%', accentColor: theme.palette.primary.main, cursor: 'pointer' }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                              {[-3, -2, -1, 0, 1, 2, 3].map(v => (
                                <Typography key={v} variant="caption" sx={{ fontWeight: 900, color: 'text.secondary' }}>{v}</Typography>
                              ))}
                            </Box>
                          </Box>
                          <Chip 
                            label={`${instituteData.jafariOffset > 0 ? '+' : ''}${instituteData.jafariOffset || 0} DAYS`}
                            color="primary"
                            sx={{ fontWeight: 900, borderRadius: 2, px: 2, height: 40, fontSize: '1rem' }}
                          />
                        </Box>
                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button 
                            variant="contained" 
                            size="small"
                            startIcon={<Save size={16} />} 
                            onClick={handleSaveInstitute} 
                            sx={{ borderRadius: 1, fontWeight: 800 }}
                          >
                            Save Offset
                          </Button>
                        </Box>
                      </Box>
                      <Box sx={{ 
                        p: 3, 
                        borderRadius: 1.5, 
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
                            Only Administrators can perform this action.
                          </Typography>
                        )}
                      </Box>
                      
                      <Box sx={{ 
                        p: 3, 
                        borderRadius: 1.5, 
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

                      <Box sx={{ p: 3, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.info.main, 0.03) }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2, color: 'info.dark' }}>System Activity Logs</Typography>
                        <Typography variant="body2" sx={{ mb: 3, fontWeight: 500 }}>
                          Review detailed system events, database operations, and authentication logs.
                        </Typography>
                        <Button 
                          variant="contained" 
                          color="info"
                          startIcon={<Terminal size={18} />} 
                          onClick={() => navigate('/admin/logs')}
                          sx={{ borderRadius: 1, fontWeight: 800, px: 4 }}
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
                            borderRadius: 1.5, 
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

      {/* Reset Data Confirmation Dialog */}
      <Dialog 
        open={resetConfirmOpen} 
        onClose={() => setResetConfirmOpen(false)} 
        PaperProps={{ 
          sx: { 
            borderRadius: 1.5, 
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
              borderRadius: 1, 
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
