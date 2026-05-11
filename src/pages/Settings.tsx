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
  Download, FileJson, Terminal, Mic, MessageSquare, Image as ImageIcon
} from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, getDocs, deleteDoc, arrayUnion, setDoc, where } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, InstituteSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useHardwarePermissions } from '../services/hardwareService';
import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { logger } from '../lib/logger';
import { saveSessionUser } from '../lib/session';

import { styled } from '@mui/material/styles';

const IOSSwitch = styled((props: any) => (
  <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
))(({ theme }) => ({
  width: 42,
  height: 26,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 0,
    margin: 2,
    transitionDuration: '300ms',
    '&.Mui-checked': {
      transform: 'translateX(16px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        backgroundColor: theme.palette.mode === 'dark' ? '#2ECA45' : '#65C466',
        opacity: 1,
        border: 0,
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: 0.5,
      },
    },
    '&.Mui-focusVisible .MuiSwitch-thumb': {
      color: '#33cf4d',
      border: '6px solid #fff',
    },
    '&.Mui-disabled .MuiSwitch-thumb': {
      color:
        theme.palette.mode === 'light'
          ? theme.palette.grey[100]
          : theme.palette.grey[600],
    },
    '&.Mui-disabled + .MuiSwitch-track': {
      opacity: theme.palette.mode === 'light' ? 0.7 : 0.3,
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 22,
    height: 22,
  },
  '& .MuiSwitch-track': {
    borderRadius: 26 / 2,
    backgroundColor: theme.palette.mode === 'light' ? '#E9E9EA' : '#39393D',
    opacity: 1,
    transition: theme.transitions.create(['background-color'], {
      duration: 500,
    }),
  },
}));

const BrandingImageItem = ({ label, value, onUpload, onRemove, icon, isBanner }: any) => {
  const theme = useTheme();
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, display: 'block', opacity: 0.7 }}>{label}</Typography>
      <Box sx={{ 
        position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 3, height: isBanner ? 80 : 100, 
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        bgcolor: alpha(theme.palette.background.default, 0.4),
        transition: '0.2s',
        '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.02) }
      }}>
        {value ? (
          <Box sx={{ position: 'relative', width: '100%', height: '100%', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={value} alt={label} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            <IconButton 
              size="small" 
              onClick={onRemove} 
              sx={{ 
                position: 'absolute', top: 4, right: 4, 
                bgcolor: alpha(theme.palette.error.main, 0.8), 
                color: 'white', 
                '&:hover': { bgcolor: 'error.main' },
                backdropFilter: 'blur(4px)',
                width: 24, height: 24
              }}
            >
              <X size={14} />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'text.disabled' }}>
            {icon}
          </Box>
        )}
        <Box 
          sx={{ 
            position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', 
            opacity: 0, '&:hover': { opacity: 1 }, transition: '0.2s', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            cursor: 'pointer', backdropFilter: 'blur(2px)' 
          }} 
          component="label"
        >
          <input type="file" hidden accept="image/*" onChange={onUpload} />
          <Typography variant="caption" sx={{ color: 'white', fontWeight: 900, letterSpacing: 1 }}>{value ? 'REPLACE' : 'UPLOAD'}</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default function Settings() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { 
    mode, setMode, 
    highContrast, setHighContrast, 
    reduceMotion, setReduceMotion, 
    compactLayout, setCompactLayout,
    setInstituteColors
  } = useThemeContext()!;
  const { permissions } = useHardwarePermissions();
  const [searchParams] = useSearchParams();

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isManagerRole = currentUser?.role === 'manager' || (currentUser?.role === 'superadmin' && !isSuperAdmin);
  const isTeacherRole = currentUser?.role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(searchParams.get('tab') || 'general');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState<Partial<UserProfile>>({});
  const [instituteData, setInstituteData] = useState<Partial<InstituteSettings>>({});
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: true,
    push: true,
    feeReminders: true,
    attendance: false,
    inAppToasts: true
  });
  const [uiPrefs, setUiPrefs] = useState({
    highContrast: false,
    reduceMotion: false,
    compactLayout: false,
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
  const [purgeType, setPurgeType] = useState<'ALL' | 'STUDENTS' | 'ARCHIVED'>('ALL');
  const [resetConfirmText, setResetConfirmText] = useState('');

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
      // Update session storage
      saveSessionUser({ ...currentUser, ...profileData });
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
    const expectedText = 
      purgeType === 'ALL' ? "RESET ALL USERS" : 
      purgeType === 'STUDENTS' ? "PURGE STUDENTS" : 
      "PURGE ARCHIVED";

    if (resetConfirmText !== expectedText) {
      setSnackbar({ open: true, message: 'Confirmation text incorrect', severity: 'error' });
      return;
    }

    try {
      setLoading(true);
      if (purgeType === 'ARCHIVED') {
        const q = query(collection(db, 'users'), where('status', '==', 'Archived'));
        const snap = await getDocs(q);
        let count = 0;
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
          count++;
        }
        setSnackbar({ open: true, message: `${count} archived records purged forever.`, severity: 'success' });
      } else {
        const collectionsToClear = purgeType === 'ALL' 
          ? ['attendance', 'receipts', 'expenses', 'notifications', 'studyMaterials', 'quiz_results', 'notes', 'users']
          : ['attendance', 'receipts', 'expenses', 'quiz_results']; // Purging students data only
        
        let totalDeleted = 0;
        for (const coll of collectionsToClear) {
          const q = query(collection(db, coll));
          if (purgeType === 'STUDENTS' && (coll === 'users')) {
             const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
             const snap = await getDocs(qStudents);
             for (const d of snap.docs) {
               await deleteDoc(d.ref);
               totalDeleted++;
             }
          } else {
            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map(doc => {
              totalDeleted++;
              return deleteDoc(doc.ref);
            });
            await Promise.all(deletePromises);
          }
        }
        setSnackbar({ open: true, message: `System ${purgeType === 'ALL' ? 'reset' : 'purged'} successfully. ${totalDeleted} records removed.`, severity: 'success' });
      }
      setResetConfirmOpen(false);
      setResetConfirmText('');
      if (purgeType === 'ALL') {
         logout();
         navigate('/login');
      }
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

    // Individual limits: 10MB for banner, 2MB for others
    const limitMB = field === 'bannerUrl' ? 10 : 2;
    const limitBytes = limitMB * 1024 * 1024;

    if (file.size > limitBytes) {
      setSnackbar({ 
        open: true, 
        message: `Image is too large. ${field === 'bannerUrl' ? 'Cover images' : 'Logos'} must be under ${limitMB}MB.`, 
        severity: 'error' 
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Smart resizing: bigger for banners, smaller for receipts
        let max = 600; 
        if (field === 'bannerUrl') max = 1200; // Optimized for landscape cover
        if (field.includes('receipt')) max = 400; 
        
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
        
        // Remove white background fill to support transparent PNGs
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        // Use JPEG for banners to save space while maintaining quality
        // Use PNG for logos to maintain transparency
        const type = field === 'bannerUrl' ? 'image/jpeg' : 'image/png';
        const quality = field === 'bannerUrl' ? 0.75 : undefined;
        const base64 = canvas.toDataURL(type, quality);
        
        setInstituteData(prev => ({ ...prev, [field]: base64 }));
        
        // Firestore has a 1MB limit for the ENTIRE document.
        const estimate = JSON.stringify({ ...instituteData, [field]: base64 }).length;
        if (estimate > 950000) { 
          setSnackbar({ 
            open: true, 
            message: 'Warning: Institute data is near Firestore limit (1MB). If save fails, please try a smaller image.', 
            severity: 'error' 
          });
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
    { id: 'general', label: 'General', icon: <Layout size={20} />, role: 'all' },
    { id: 'account', label: 'Account', icon: <User size={20} />, role: 'all' },
    { id: 'branding', label: 'Branding', icon: <Palette size={20} />, role: 'admin' },
    { id: 'system', label: 'System', icon: <Terminal size={20} />, role: 'superadmin' },
    { id: 'logs', label: 'Audit Logs', icon: <Database size={20} />, role: 'admin' },
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
            {/* General Section */}
            {tabValue === 'general' && (
              <motion.div key="general" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                 <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>General Settings</Typography>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={4}>
                      <Box>
                        <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block' }}>APPEARANCE</Typography>
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 6 }}>
                             <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.4), border: '1px solid', borderColor: 'divider' }}>
                               <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>Theme Mode</Typography>
                               <Stack direction="row" spacing={1}>
                                  {[
                                    { id: 'light', label: 'Light', icon: <Sun size={18} /> },
                                    { id: 'dark', label: 'Dark', icon: <Moon size={18} /> },
                                    { id: 'system', label: 'System', icon: <Monitor size={18} /> }
                                  ].map((m) => (
                                    <Button
                                      key={m.id}
                                      onClick={() => setMode(m.id as any)}
                                      variant={mode === m.id ? 'contained' : 'outlined'}
                                      startIcon={m.icon}
                                      size="small"
                                      sx={{ borderRadius: 2, fontWeight: 800, flex: 1 }}
                                    >
                                      {m.label}
                                    </Button>
                                  ))}
                               </Stack>
                             </Box>
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                             <Stack spacing={2}>
                               {[
                                 { label: 'High Contrast', desc: 'Enhanced legibility', value: highContrast, onChange: (v: boolean) => setHighContrast(v), icon: <Zap size={20} /> },
                                 { label: 'Compact Layout', desc: 'Information density', value: compactLayout, onChange: (v: boolean) => setCompactLayout(v), icon: <Layout size={20} /> }
                               ].map((item, idx) => (
                                 <Box key={idx} sx={{ p: 2, px: 3, borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.05), bgcolor: 'background.default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                     <Box sx={{ color: 'primary.main', display: 'flex' }}>{item.icon}</Box>
                                     <Box>
                                       <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.label}</Typography>
                                       <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{item.desc}</Typography>
                                     </Box>
                                   </Box>
                                   <IOSSwitch checked={item.value} onChange={(e: any) => item.onChange(e.target.checked)} />
                                 </Box>
                               ))}
                             </Stack>
                          </Grid>
                        </Grid>
                      </Box>
                      <Divider />
                      <Box>
                        <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block' }}>ALERTS & NOTIFICATIONS</Typography>
                        <Grid container spacing={2}>
                          {[
                            { key: 'email', label: 'Email Reports', desc: 'Performance summaries', icon: <Mail size={18} /> },
                            { key: 'push', label: 'Push Alerts', desc: 'Critical notifications', icon: <Bell size={18} /> },
                            { key: 'feeReminders', label: 'Fee Alerts', desc: 'Due date reminders', icon: <CreditCard size={18} /> }
                          ].map((item, i) => (
                            <Grid size={{ xs: 12, md: 4 }} key={i}>
                              <Box sx={{ p: 2, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1), borderRadius: 3, bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                   <Box sx={{ color: 'primary.main', p: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 1.5, display: 'flex' }}>
                                      {item.icon}
                                   </Box>
                                   <Switch size="small" checked={(notificationPrefs as any)[item.key]} onChange={(e) => setNotificationPrefs({ ...notificationPrefs, [item.key]: e.target.checked })} />
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.label}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', lineHeight: 1.2 }}>{item.desc}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    </Stack>
                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button variant="contained" startIcon={<Save size={18} />} onClick={handleSaveSettings} sx={{ borderRadius: 2, fontWeight: 950, px: 4 }}>Save General Settings</Button>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            {/* Account Section */}
            {tabValue === 'account' && (
              <motion.div key="account" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', mb: 4 }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>Account Profile</Typography>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Grid container spacing={4}>
                      <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: 'center' }}>
                        <Box sx={{ position: 'relative', display: 'inline-block' }}>
                          <Avatar src={profileData.photoURL} sx={{ width: 120, height: 120, mb: 2, border: '4px solid', borderColor: 'primary.main' }}>{profileData.displayName?.charAt(0)}</Avatar>
                          <IconButton size="small" sx={{ position: 'absolute', bottom: 15, right: 0, bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}><Camera size={16} /></IconButton>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{profileData.displayName}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{profileData.role?.toUpperCase()}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 8 }}>
                        <Stack spacing={2}>
                          <TextField fullWidth label="Display Name" value={profileData.displayName || ''} onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })} />
                          <TextField fullWidth label="Primary Email" value={profileData.email || ''} disabled />
                          <TextField fullWidth label="Phone" value={profileData.phone || ''} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} />
                        </Stack>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button variant="contained" startIcon={<Save size={18} />} onClick={handleSaveSettings} sx={{ borderRadius: 2, fontWeight: 950, px: 4 }}>Update Profile</Button>
                    </Box>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>Security Center</Typography>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="body2" sx={{ mb: 3, fontWeight: 500, color: 'text.secondary' }}>Update your password periodically to maintain account security.</Typography>
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
                          label="Confirm Password"
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
                          borderRadius: 2, 
                          fontWeight: 950, 
                          px: 4,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
                          boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
                          '&:hover': {
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                          }
                        }}
                      >
                        Update Password
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Branding Section */}
            {tabValue === 'branding' && isAdmin && (
              <motion.div key="branding" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>Institute Branding</Typography>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={4}>
                      <Box>
                        <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block' }}>IDENTITY & COLORS</Typography>
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 8 }}>
                            <TextField fullWidth label="Institute Name" variant="filled" value={instituteData.instituteName || ''} onChange={(e) => setInstituteData({ ...instituteData, instituteName: e.target.value })} sx={{ mb: 2 }} InputProps={{ disableUnderline: true, sx: { borderRadius: 2, fontWeight: 900, fontSize: '1.2rem', bgcolor: alpha(theme.palette.primary.main, 0.05) } }} />
                            <TextField fullWidth label="Tagline" variant="filled" value={instituteData.tagline || ''} onChange={(e) => setInstituteData({ ...instituteData, tagline: e.target.value })} InputProps={{ disableUnderline: true, sx: { borderRadius: 2, fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.03) } }} />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, display: 'block', opacity: 0.7 }}>BRAND COLOR</Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {['#0f172a', '#064e3b', '#450a0a', '#18181b'].map(c => (
                                <Box key={c} onClick={() => { setInstituteData({ ...instituteData, primaryColor: c }); setInstituteColors({ primary: c, secondary: c }); }} sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: instituteData.primaryColor === c ? '3px solid white' : 'none', boxShadow: 2, transition: '0.2s', '&:hover': { transform: 'scale(1.1)' } }} />
                              ))}
                              <Box component="label" sx={{ width: 44, height: 44, borderRadius: '50%', border: '2px dashed gray', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><input type="color" hidden onChange={(e) => { setInstituteColors({ primary: e.target.value, secondary: e.target.value }); setInstituteData({ ...instituteData, primaryColor: e.target.value }); }} /><Plus size={20} /></Box>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>
                      <Divider />
                      <Box>
                        <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block' }}>VISUAL ASSETS</Typography>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 6, md: 3 }}><BrandingImageItem label="Logo" value={instituteData.logoUrl} onUpload={handleImageUpload('logoUrl')} onRemove={() => handleRemoveImage('logoUrl')} icon={<Globe />} /></Grid>
                          <Grid size={{ xs: 6, md: 3 }}><BrandingImageItem label="Banner" value={instituteData.bannerUrl} onUpload={handleImageUpload('bannerUrl')} onRemove={() => handleRemoveImage('bannerUrl')} icon={<Layout />} isBanner /></Grid>
                          <Grid size={{ xs: 6, md: 3 }}><BrandingImageItem label="Receipt Left" value={instituteData.receiptLeftImageUrl} onUpload={handleImageUpload('receiptLeftImageUrl')} onRemove={() => handleRemoveImage('receiptLeftImageUrl')} icon={<ImageIcon />} /></Grid>
                          <Grid size={{ xs: 6, md: 3 }}><BrandingImageItem label="Receipt Right" value={instituteData.receiptRightImageUrl} onUpload={handleImageUpload('receiptRightImageUrl')} onRemove={() => handleRemoveImage('receiptRightImageUrl')} icon={<ImageIcon />} /></Grid>
                        </Grid>
                      </Box>
                      <Divider />
                      <Box>
                         <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block' }}>DASHBOARD QUOTES</Typography>
                         <TextField
                            fullWidth
                            multiline
                            rows={4}
                            placeholder={`Success is not final.\n\nKnowledge is light.`}
                            value={instituteData.quotes?.join('\n\n') || ''}
                            onChange={(e) => setInstituteData({ ...instituteData, quotes: e.target.value.split(/\n\n+/) })}
                            InputProps={{ sx: { borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.02), fontWeight: 600, p: 2 } }}
                          />
                      </Box>
                    </Stack>
                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button variant="contained" startIcon={<Save size={18} />} onClick={handleSaveInstitute} sx={{ borderRadius: 2, fontWeight: 950, px: 4 }}>Save Branding</Button>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* System Section */}
            {tabValue === 'system' && isSuperAdmin && (
              <motion.div key="system" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>System Administration</Typography>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={4}>
                      <Box sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                         <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}><Languages size={18} /> Jafari Hijri Offset</Typography>
                         <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <Box sx={{ flex: 1 }}>
                              <input type="range" min="-3" max="3" step="1" value={instituteData.jafariOffset || 0} onChange={(e) => setInstituteData({ ...instituteData, jafariOffset: parseInt(e.target.value) })} style={{ width: '100%', accentColor: theme.palette.primary.main }} />
                            </Box>
                            <Chip label={`${instituteData.jafariOffset || 0} DAYS`} color="primary" sx={{ fontWeight: 900, borderRadius: 2 }} />
                         </Box>
                      </Box>

                      <Box sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>Data Backup</Typography>
                        <Button variant="outlined" startIcon={<Download size={18} />} onClick={handleGenerateBackup} sx={{ fontWeight: 800, borderRadius: 2 }}>Generate Database JSON Backup</Button>
                      </Box>

                      <Box sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.2), bgcolor: alpha(theme.palette.error.main, 0.02) }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'error.main' }}>System Data Management</Typography>
                        <Stack spacing={2}>
                           <Button variant="contained" color="error" startIcon={<RefreshCw size={18} />} onClick={() => { setPurgeType('ALL'); setResetConfirmOpen(true); }} sx={{ fontWeight: 900 }}>Full System Reset (Caution!)</Button>
                           <Button variant="outlined" color="error" startIcon={<Trash2 size={18} />} onClick={() => { setPurgeType('STUDENTS'); setResetConfirmOpen(true); }} sx={{ fontWeight: 800 }}>Purge Student Records</Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Logs Section */}
            {tabValue === 'logs' && (
              <motion.div key="logs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>Audit Logs</Typography>
                    <Button variant="outlined" size="small" startIcon={<Terminal size={16} />} onClick={() => navigate('/admin-logs')}>Detailed Dashboard</Button>
                  </Box>
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontWeight: 600 }}>Track system access, form views, and critical entity changes.</Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper sx={{ p: 3, textAlign: 'left', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}><Eye size={18} /> Access Monitoring</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Logs every time a sensitive form or student record is accessed.</Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper sx={{ p: 3, textAlign: 'left', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 1 }}><Database size={18} /> Data Integrity</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Tracks creation and modification of records with creator attribution.</Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="error"
                          startIcon={<LogOut size={20} />}
                          onClick={logout}
                          sx={{ borderRadius: 1.5, py: 2, fontWeight: 900 }}
                        >
                          Sign Out of Account
                        </Button>
                    </Box>
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
        <DialogTitle sx={{ fontWeight: 900, color: 'error.main', letterSpacing: -0.5 }}>
          {purgeType === 'ALL' ? 'CRITICAL: System Reset' : 'Purge Students Data'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {purgeType === 'ALL' 
              ? 'Are you sure you want to delete ALL application data? This includes every user (Students & Admins), all fees, expenses, attendance, and settings. You will be logged out.'
              : 'Are you sure you want to purge all student-related data? This includes all student accounts, their receipts, attendance, and exam results. Admin/Teacher accounts will remain active.'}
            
            <Box component="span" sx={{ display: 'block', mt: 2, fontWeight: 800, color: 'error.main' }}>
              This action is permanent and cannot be undone.
            </Box>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 900, mb: 1, display: 'block' }}>
                To confirm, please type <strong>{purgeType === 'ALL' ? "RESET ALL USERS" : "PURGE STUDENTS"}</strong> below:
              </Typography>
              <TextField 
                fullWidth
                size="small"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="type confirmation phrase"
                sx={{ mt: 1 }}
              />
            </Box>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setResetConfirmOpen(false)} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            onClick={confirmResetData} 
            color="error" 
            variant="contained" 
            disabled={resetConfirmText !== (purgeType === 'ALL' ? "RESET ALL USERS" : "PURGE STUDENTS")}
            sx={{ 
              borderRadius: 1, 
              fontWeight: 800,
              boxShadow: theme.palette.mode === 'dark'
                ? '6px 6px 12px #060a12, -6px -6px 12px #182442'
                : '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
            }}
          >
            {purgeType === 'ALL' ? 'YES, RESET EVERYTHING' : 'YES, PURGE STUDENTS'}
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
