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
  Bell, Globe, Save, Camera, Trash2, Plus, Minus,
  CheckCircle, Smartphone, Mail, Lock, X, Sparkles,
  CreditCard, HelpCircle, LogOut, ChevronRight,
  Monitor, Moon, Sun, Languages, Database,
  Key, Eye, EyeOff, Smartphone as MobileIcon,
  Cloud, Zap, HardDrive, RefreshCw, AlertTriangle, Layout,
  Download, FileJson, Terminal, Mic, MessageSquare, Image as ImageIcon,
  Edit2, ExternalLink, AlertCircle, ShieldCheck
} from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, getDocs, deleteDoc, arrayUnion, setDoc, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, InstituteSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
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
  const { setIsSaving } = useData();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { 
    mode, setMode, 
    highContrast, setHighContrast, 
    reduceMotion, setReduceMotion, 
    compactLayout, setCompactLayout,
    navPreference, setNavPreference
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
  
  const [originalPrefs, setOriginalPrefs] = useState<string>('');
  const [originalInstitute, setOriginalInstitute] = useState<string>('');
  const [originalProfile, setOriginalProfile] = useState<string>('');
  
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
    navPreference: 'bottom' as 'bottom' | 'side'
  });

  const [passwordDialog, setPasswordDialog] = useState({
    open: false,
    current: '',
    new: '',
    confirm: '',
    loading: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [purgeType, setPurgeType] = useState<'ALL' | 'STUDENTS' | 'ARCHIVED'>('ALL');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [accessLogs, setAccessLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin || tabValue !== 'security') return;

    const q = query(
      collection(db, 'access_logs'), 
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccessLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'access_logs'));

    return () => unsubscribe();
  }, [isSuperAdmin, tabValue]);

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
          setOriginalProfile(JSON.stringify(data));
          if (data.notificationPrefs) setNotificationPrefs(data.notificationPrefs);
          if (data.uiPrefs) setUiPrefs(prev => ({ ...prev, ...data.uiPrefs }));
          
          setOriginalPrefs(JSON.stringify({
            notificationPrefs: data.notificationPrefs || notificationPrefs,
            uiPrefs: data.uiPrefs || uiPrefs
          }));
        }

        const instDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (instDoc.exists()) {
          const data = instDoc.data() as InstituteSettings;
          setInstituteData(data);
          setOriginalInstitute(JSON.stringify(data));
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

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...profileData,
        updatedAt: new Date().toISOString()
      });
      setOriginalProfile(JSON.stringify(profileData));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
      setSnackbar({ open: true, message: 'Failed to update profile', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccentColor = (color: string) => {
    const current = instituteData.accentColors || [];
    if (current.includes(color)) return;
    const updated = [...current, color].slice(-7);
    setInstituteData({ ...instituteData, accentColors: updated });
  };

  const handleRemoveAccent = (color: string) => {
    const current = instituteData.accentColors || [];
    const updated = current.filter((c) => c !== color);
    setInstituteData({ ...instituteData, accentColors: updated });
  };

  const handleSaveSettings = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setIsSaving(true);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...profileData,
        notificationPrefs,
        uiPrefs,
        updatedAt: new Date().toISOString()
      });
      // Update session storage
      saveSessionUser({ ...currentUser, ...profileData });
      setOriginalPrefs(JSON.stringify({ notificationPrefs, uiPrefs }));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setIsSaving(false);
    }
  };

  const handleSaveInstitute = async () => {
    try {
      setLoading(true);
      setIsSaving(true);
      
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
      setOriginalInstitute(JSON.stringify(instituteData));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/institute');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setIsSaving(false);
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

  const calculateTotalBrandingSize = () => {
    const fields: (keyof InstituteSettings)[] = ['logoUrl', 'bannerUrl', 'stampUrl', 'leftImageUrl', 'rightImageUrl'];
    let total = 0;
    fields.forEach(field => {
      const val = instituteData[field];
      if (typeof val === 'string') total += val.length;
    });
    return total;
  };

  const saveFieldToInstitute = async (field: string, value: string) => {
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'settings', 'institute'), {
        [field]: value,
        updatedAt: new Date().toISOString()
      });
      // Update original so dirty check works correctly
      setOriginalInstitute(prev => {
        try {
          const parsed = JSON.parse(prev);
          parsed[field] = value;
          return JSON.stringify(parsed);
        } catch (e) { return prev; }
      });
    } catch (err: any) {
      console.error(`Failed to auto-save ${field}:`, err);
      setSnackbar({ open: true, message: 'Auto-save failed, but image is kept locally.', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (field: 'logoUrl' | 'bannerUrl' | 'stampUrl' | 'leftImageUrl' | 'rightImageUrl') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SOURCE_SIZE = 20 * 1024 * 1024; // Increased to 20MB as we compress anyway
    if (file.size > MAX_SOURCE_SIZE) {
      setSnackbar({ open: true, message: 'Source image is too large (Max 20MB).', severity: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Stricter target dimensions for better document packing
        let maxDim = field === 'bannerUrl' ? 1000 : 600; 
        if (field === 'stampUrl' || field.includes('Left') || field.includes('Right')) maxDim = 400; 

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        const ctx = canvas.getContext('2d');
        const compress = (w: number, h: number, q: number, format: 'image/jpeg' | 'image/png') => {
          canvas.width = w;
          canvas.height = h;
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
          }
          return canvas.toDataURL(format, format === 'image/jpeg' ? q : undefined);
        };

        // Aggressive quality targets to keep document under 1MB total
        const PER_IMAGE_SAFE_LIMIT = field === 'bannerUrl' ? 180000 : 100000; 
        
        let resultFormat: 'image/jpeg' | 'image/png' = field === 'bannerUrl' ? 'image/jpeg' : 'image/png';
        let quality = 0.8;
        let base64 = compress(width, height, quality, resultFormat);

        // Iterative compression loop
        if (base64.length > PER_IMAGE_SAFE_LIMIT) {
          resultFormat = 'image/jpeg'; // Force JPEG for better compression
          while (base64.length > PER_IMAGE_SAFE_LIMIT && quality > 0.05) {
            quality -= 0.1;
            base64 = compress(width, height, quality, resultFormat);
          }
        }

        // Final check - if still too large, reduce dimensions
        if (base64.length > PER_IMAGE_SAFE_LIMIT) {
           base64 = compress(width * 0.6, height * 0.6, 0.4, 'image/jpeg');
        }
        
        setInstituteData(prev => ({ ...prev, [field]: base64 }));
        
        // Auto-save this specific field immediately
        saveFieldToInstitute(field, base64);

        setSnackbar({ 
          open: true, 
          message: `Image optimized & saved (${(base64.length / 1024).toFixed(0)} KB)`, 
          severity: 'success' 
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async (field: 'logoUrl' | 'bannerUrl' | 'stampUrl' | 'leftImageUrl' | 'rightImageUrl') => {
    setInstituteData(prev => ({ ...prev, [field]: '' }));
    await saveFieldToInstitute(field, '');
  };

  const menuItems = [
    { id: 'appearance', label: 'Visual & Theme', icon: <Palette size={20} />, role: 'all' },
    { id: 'permissions', label: 'Permissions', icon: <Key size={20} />, role: 'admin' },
    { id: 'security', label: 'Account Security', icon: <Shield size={20} />, role: 'all' },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={20} />, role: 'all' },
    { id: 'data', label: 'Data & System', icon: <Database size={20} />, role: 'admin' },
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

  const isPrefsDirty = originalPrefs !== JSON.stringify({ notificationPrefs, uiPrefs });
  const isInstituteDirty = originalInstitute !== JSON.stringify(instituteData);
  const isProfileDirty = originalProfile !== JSON.stringify(profileData);

  return (
    <Box sx={{ pb: isMobile ? 12 : 8, px: isSmallMobile ? 0 : 0 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: isMobile ? 3 : 5, textAlign: 'left', px: isMobile ? 2 : 0 }}>
          <Typography 
            variant={isMobile ? "h4" : "h3"} 
            sx={{ fontWeight: 950, letterSpacing: -2, mb: 0.5, color: 'text.primary' }}
          >
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: -0.2 }}>
            Personalize your experience and institute management
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
                scrollButtons
                allowScrollButtonsMobile
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
            {/* Visual & Theme Section */}
            {tabValue === 'appearance' && (
              <motion.div key="appearance" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                 <Stack spacing={4}>
                   <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                    <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>Layout & Personalization</Typography>
                    </Box>
                    <CardContent sx={{ p: 4 }}>
                      <Stack spacing={4}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', mb: 3, display: 'block' }}>User Interface Preferences</Typography>
                          <Grid container spacing={3}>
                            <Grid size={{ xs: 12, md: 6 }}>
                               <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.4), border: '1px solid', borderColor: 'divider' }}>
                                 <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>Theme Mode</Typography>
                                 <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
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
                                        sx={{ 
                                          borderRadius: 2, 
                                          fontWeight: 800, 
                                          flex: { xs: '1 1 auto', sm: 1 },
                                          minWidth: { xs: '90px', sm: 'auto' },
                                          fontSize: { xs: '0.7rem', sm: '0.8125rem' }
                                        }}
                                      >
                                        {m.label}
                                      </Button>
                                    ))}
                                 </Stack>
                               </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                               <Stack spacing={2}>
                                 <Box sx={{ p: 2, px: 3, borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1), bgcolor: 'background.default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                     <Box sx={{ color: 'primary.main', display: 'flex' }}><Zap size={20} /></Box>
                                     <Box>
                                       <Typography variant="body2" sx={{ fontWeight: 800 }}>High Contrast</Typography>
                                       <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Enhanced legibility</Typography>
                                     </Box>
                                   </Box>
                                   <IOSSwitch checked={highContrast} onChange={(e: any) => setHighContrast(e.target.checked)} />
                                 </Box>
                                 <Box sx={{ p: 2, px: 3, borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1), bgcolor: 'background.default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                     <Box sx={{ color: 'primary.main', display: 'flex' }}><Layout size={20} /></Box>
                                     <Box>
                                       <Typography variant="body2" sx={{ fontWeight: 800 }}>Compact Layout</Typography>
                                       <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Information density</Typography>
                                     </Box>
                                   </Box>
                                   <IOSSwitch checked={compactLayout} onChange={(e: any) => setCompactLayout(e.target.checked)} />
                                 </Box>
                               </Stack>
                            </Grid>
                          </Grid>
                        </Box>
                      </Stack>
                      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                        <AnimatePresence>
                          {isPrefsDirty && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                              <Button variant="contained" startIcon={<Save size={18} />} onClick={handleSaveSettings} sx={{ borderRadius: 2, fontWeight: 950, px: 4 }}>Save Theme Settings</Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Box>
                    </CardContent>
                   </Card>

                    {isAdmin && (
                      <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                          <Typography variant="h6" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Sparkles size={22} color={theme.palette.primary.main} /> 
                            Institutional Identity & Visual Branding
                          </Typography>
                        </Box>
                        <CardContent sx={{ p: 4 }}>
                          <Stack spacing={4}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', mb: 3, display: 'block' }}>Recognition & Identity</Typography>
                              <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 8 }}>
                                  <TextField 
                                    fullWidth 
                                    label="Institute Name" 
                                    variant="filled" 
                                    value={instituteData.instituteName || ''} 
                                    onChange={(e) => setInstituteData({ ...instituteData, instituteName: e.target.value })} 
                                    sx={{ mb: 2 }} 
                                    InputProps={{ 
                                      disableUnderline: true, 
                                      sx: { borderRadius: 2.5, fontWeight: 900, fontSize: '1.4rem', bgcolor: alpha(theme.palette.primary.main, 0.05), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } } 
                                    }} 
                                  />
                                  <TextField 
                                    fullWidth 
                                    label="Public Tagline" 
                                    variant="filled" 
                                    value={instituteData.tagline || ''} 
                                    onChange={(e) => setInstituteData({ ...instituteData, tagline: e.target.value })} 
                                    InputProps={{ 
                                      disableUnderline: true, 
                                      sx: { borderRadius: 2, fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.03) } 
                                    }} 
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                  <Box sx={{ p: 2.5, borderRadius: 4, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.15), bgcolor: alpha(theme.palette.primary.main, 0.02), boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 900, mb: 1.5, display: 'block', opacity: 0.8, letterSpacing: 1, textTransform: 'uppercase' }}>Accent Palette</Typography>
                                    
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                                      {(instituteData.accentColors?.length ? instituteData.accentColors : ['#fbbf24', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316']).map((c, i) => (
                                        <Tooltip key={i} title={c}>
                                          <Box 
                                            onClick={async () => {
                                              const updatedData = { ...instituteData, primaryColor: c };
                                              setInstituteData(updatedData);
                                              if (isAdmin) {
                                                try {
                                                  await updateDoc(doc(db, 'settings', 'institute'), { primaryColor: c });
                                                } catch (e) {
                                                  console.error('Failed to update color in real-time', e);
                                                }
                                              }
                                            }} 
                                            sx={{ 
                                              width: 36, 
                                              height: 36, 
                                              borderRadius: 2, 
                                              bgcolor: c, 
                                              cursor: 'pointer', 
                                              border: instituteData.primaryColor === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.1)', 
                                              boxShadow: instituteData.primaryColor === c ? `0 0 15px ${alpha(c, 0.5)}` : 'none', 
                                              transition: 'all 0.2s',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}
                                          >
                                            {instituteData.primaryColor === c && <CheckCircle size={16} color="#fff" />}
                                          </Box>
                                        </Tooltip>
                                      ))}
                                    </Box>
                                    <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6 }}>Active: <strong>{instituteData.primaryColor || 'Default'}</strong></Typography>
                                  </Box>
                                </Grid>
                              </Grid>
                            </Box>
                            <Divider />
                            <Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', display: 'block' }}>Visual Assets</Typography>
                                <Box sx={{ textAlign: 'right' }}>
                                   <Typography variant="caption" sx={{ fontWeight: 900, color: calculateTotalBrandingSize() > 800000 ? 'error.main' : 'text.secondary', display: 'block' }}>
                                      Storage Utilization: {(calculateTotalBrandingSize() / 1024).toFixed(0)}KB / 1024KB
                                   </Typography>
                                   <Box sx={{ width: 120, height: 4, bgcolor: 'divider', borderRadius: 2, mt: 0.5, overflow: 'hidden' }}>
                                      <Box sx={{ width: `${Math.min(100, (calculateTotalBrandingSize() / 1048576) * 100)}%`, height: '100%', bgcolor: calculateTotalBrandingSize() > 800000 ? 'error.main' : 'primary.main', transition: '0.5s' }} />
                                   </Box>
                                </Box>
                              </Box>
                              <Grid container spacing={3}>
                                <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><BrandingImageItem label="Primary Logo" value={instituteData.logoUrl} onUpload={handleImageUpload('logoUrl')} onRemove={() => handleRemoveImage('logoUrl')} icon={<Monitor size={24} />} /></Grid>
                                <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><BrandingImageItem label="Banner Image" value={instituteData.bannerUrl} onUpload={handleImageUpload('bannerUrl')} onRemove={() => handleRemoveImage('bannerUrl')} icon={<ImageIcon size={24} />} isBanner /></Grid>
                                <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><BrandingImageItem label="Official Stamp" value={instituteData.stampUrl} onUpload={handleImageUpload('stampUrl')} onRemove={() => handleRemoveImage('stampUrl')} icon={<ShieldCheck size={24} />} /></Grid>
                                <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><BrandingImageItem label="Shared Left Image" value={instituteData.leftImageUrl} onUpload={handleImageUpload('leftImageUrl')} onRemove={() => handleRemoveImage('leftImageUrl')} icon={<CheckCircle size={24} />} /></Grid>
                                <Grid size={{ xs: 6, md: 4, lg: 2.4 }}><BrandingImageItem label="Shared Right Image" value={instituteData.rightImageUrl} onUpload={handleImageUpload('rightImageUrl')} onRemove={() => handleRemoveImage('rightImageUrl')} icon={<CheckCircle size={24} />} /></Grid>
                              </Grid>
                              <Typography variant="caption" sx={{ mt: 2, display: 'block', fontWeight: 600, color: 'text.secondary', bgcolor: alpha(theme.palette.info.main, 0.05), p: 1.5, borderRadius: 2, border: '1px dashed', borderColor: alpha(theme.palette.info.main, 0.2) }}>
                                <strong>Note:</strong> The Primary Logo is automatically used as a watermark on all official documents. Separate watermark uploads are no longer required to save system space.
                              </Typography>
                            </Box>
                            <Divider />
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', mb: 3, display: 'block' }}>Greeting & Motivation</Typography>
                               <TextField
                                  fullWidth
                                  multiline
                                  rows={3}
                                  variant="outlined"
                                  label="One quote per line"
                                  value={instituteData.quotes?.join('\n') || ''}
                                  onChange={(e) => setInstituteData({ ...instituteData, quotes: e.target.value.split('\n').filter(q => q.trim().length > 0) })}
                                  InputProps={{ sx: { borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.02), fontWeight: 600 } }}
                                />
                             </Box>
                             <Divider />
                             <Box>
                               <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', mb: 3, display: 'block' }}>Academic Calendar (General Holidays)</Typography>
                               <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                                 <TextField
                                   type="date"
                                   size="small"
                                   fullWidth
                                   label="Add Holiday Date"
                                   InputLabelProps={{ shrink: true }}
                                   id="new-holiday-date"
                                   sx={{ flex: 1 }}
                                 />
                                 <Button 
                                   variant="contained" 
                                   startIcon={<Plus size={18} />}
                                   onClick={() => {
                                     const input = document.getElementById('new-holiday-date') as HTMLInputElement;
                                     if (input.value) {
                                       const current = instituteData.holidays || [];
                                       if (!current.includes(input.value)) {
                                         setInstituteData({ ...instituteData, holidays: [...current, input.value].sort() });
                                       }
                                       input.value = '';
                                     }
                                   }}
                                   sx={{ borderRadius: 2, fontWeight: 800 }}
                                 >
                                   Add
                                 </Button>
                               </Stack>
                               <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                 {(instituteData.holidays || []).map((h) => (
                                   <Chip 
                                     key={h} 
                                     label={h} 
                                     onDelete={() => {
                                       const updated = (instituteData.holidays || []).filter(date => date !== h);
                                       setInstituteData({ ...instituteData, holidays: updated });
                                     }}
                                     sx={{ fontWeight: 700, borderRadius: 1.5 }} 
                                   />
                                 ))}
                                 {(!instituteData.holidays || instituteData.holidays.length === 0) && (
                                   <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 700 }}>No general holidays configured. Sundays are handled automatically.</Typography>
                                 )}
                               </Box>
                             </Box>
                             <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                              <AnimatePresence>
                                {isInstituteDirty && (
                                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                                    <Button variant="contained" startIcon={<Save size={18} />} onClick={handleSaveInstitute} sx={{ borderRadius: 2, fontWeight: 950, px: 4 }}>Update Institutional Identity</Button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    )}
                 </Stack>
              </motion.div>
            )}

            {/* Permissions Section */}
            {tabValue === 'permissions' && isAdmin && (
              <motion.div key="permissions" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.secondary.main, 0.02) }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>Portal Access Permissions</Typography>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={4}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', mb: 3, display: 'block' }}>Student User Controls</Typography>
                        <Grid container spacing={2}>
                          {[
                            { key: 'showDashboardStats', label: 'Attendance Stats', desc: 'Allow students to see attendance %' },
                            { key: 'showQuickActions', label: 'Quick Actions', desc: 'Show course/fee shortcut buttons' },
                            { key: 'showEnrolledSubjects', label: 'Enrolled Subjects', desc: 'List current subjects on dashboard' },
                            { key: 'showNotifications', label: 'Banner Notifications', desc: 'Show alert banners to students' }
                          ].map((setting) => (
                            <Grid size={{ xs: 12, md: 6 }} key={setting.key}>
                              <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{setting.label}</Typography>
                                  <Typography variant="caption" sx={{ opacity: 0.7 }}>{setting.desc}</Typography>
                                </Box>
                                <Switch 
                                  checked={instituteData.portalSettings?.student?.[setting.key as keyof typeof instituteData.portalSettings.student] ?? true} 
                                  onChange={(e) => {
                                    const student = { ...(instituteData.portalSettings?.student || {}), [setting.key]: e.target.checked };
                                    setInstituteData({ ...instituteData, portalSettings: { ...(instituteData.portalSettings || { teacher: {}, manager: {} }), student: student as any } as any });
                                  }}
                                />
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'secondary.main', mb: 3, display: 'block' }}>Teacher & Staff Controls</Typography>
                        <Grid container spacing={2}>
                          {[
                            { key: 'showQuickActions', label: 'Quick Actions', desc: 'Show attendance/course shortcuts' },
                            { key: 'showRevenueStats', label: 'Class Revenue', desc: 'Allow teachers to see class fee status' },
                            { key: 'showAttendanceStats', label: 'Attendance Rates', desc: 'Show class-wise attendance metrics' },
                            { key: 'showPendingActions', label: 'Pending Approvals', desc: 'Show student/fee approval lists' },
                            { key: 'allowProfileEdit', label: 'Profile Editing', desc: 'Allow teachers to update expertise' }
                          ].map((setting) => (
                            <Grid size={{ xs: 12, md: 6 }} key={setting.key}>
                              <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{setting.label}</Typography>
                                  <Typography variant="caption" sx={{ opacity: 0.7 }}>{setting.desc}</Typography>
                                </Box>
                                <Switch 
                                  checked={instituteData.portalSettings?.teacher?.[setting.key as keyof typeof instituteData.portalSettings.teacher] ?? true} 
                                  onChange={(e) => {
                                    const teacher = { ...(instituteData.portalSettings?.teacher || {}), [setting.key]: e.target.checked };
                                    setInstituteData({ ...instituteData, portalSettings: { ...(instituteData.portalSettings || { student: {}, manager: {} }), teacher: teacher as any } as any });
                                  }}
                                />
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    </Stack>
                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                      <AnimatePresence>
                        {isInstituteDirty && (
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                            <Button variant="contained" color="secondary" startIcon={<Save size={18} />} onClick={handleSaveInstitute} sx={{ borderRadius: 2, fontWeight: 950, px: 4 }}>Save Permission Matrix</Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Account Security Section */}
            {tabValue === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                 <Stack spacing={4}>
                   <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                     <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>Credential Security</Typography>
                     </Box>
                     <CardContent sx={{ p: 4 }}>
                        <Grid container spacing={4}>
                           <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 2 }}>Authentication Secret</Typography>
                              <Stack spacing={2}>
                                 <TextField fullWidth size="small" label="Current Secret" type={showPassword ? 'text' : 'password'} value={passwordDialog.current} onChange={(e) => setPasswordDialog({ ...passwordDialog, current: e.target.value })} InputProps={{ endAdornment: <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</IconButton>, sx: { borderRadius: 2 } }} />
                                 <TextField fullWidth size="small" label="New Secret" type={showPassword ? 'text' : 'password'} value={passwordDialog.new} onChange={(e) => setPasswordDialog({ ...passwordDialog, new: e.target.value })} InputProps={{ sx: { borderRadius: 2 } }} />
                                 <TextField fullWidth size="small" label="Confirm New Secret" type={showPassword ? 'text' : 'password'} value={passwordDialog.confirm} onChange={(e) => setPasswordDialog({ ...passwordDialog, confirm: e.target.value })} InputProps={{ sx: { borderRadius: 2 } }} />
                                 <Button variant="contained" color="primary" fullWidth startIcon={<Lock size={18} />} onClick={handleUpdatePassword} disabled={passwordDialog.loading || !passwordDialog.new} sx={{ py: 1.5, fontWeight: 900, borderRadius: 2 }}>Update Authentication Secret</Button>
                              </Stack>
                           </Grid>
                           <Grid size={{ xs: 12, md: 6 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 2 }}>Admin Identity</Typography>
                              <Stack spacing={2}>
                                 <TextField fullWidth label="Display Name" size="small" value={profileData.displayName || ''} onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })} variant="filled" InputProps={{ disableUnderline: true, sx: { borderRadius: 2, fontWeight: 700 } }} />
                                 <TextField fullWidth label="Login Email" size="small" value={profileData.email || ''} disabled variant="filled" InputProps={{ disableUnderline: true, sx: { borderRadius: 2, fontWeight: 700, opacity: 0.8 } }} />
                                 <Button variant="outlined" fullWidth onClick={handleSaveProfile} disabled={!isProfileDirty || loading} sx={{ py: 1.5, fontWeight: 900, borderRadius: 2 }}>Update Profile Identity</Button>
                              </Stack>
                           </Grid>
                        </Grid>
                     </CardContent>
                   </Card>

                    <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                      <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                         <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>System Audit Logs</Typography>
                         <Button variant="text" size="small" startIcon={<ExternalLink size={16} />} onClick={() => navigate('/admin/logs')} sx={{ fontWeight: 800 }}>Explore Full Audit</Button>
                      </Box>
                      <CardContent sx={{ p: 0 }}>
                        <List disablePadding>
                            {accessLogs.length > 0 ? accessLogs.map((log) => (
                              <ListItem key={log.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1.5, px: 3 }}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                  {log.level === 'error' ? <AlertTriangle size={18} color={theme.palette.error.main} /> : 
                                    log.level === 'warn' ? <AlertCircle size={18} color={theme.palette.warning.main} /> :
                                    <Terminal size={18} color={theme.palette.primary.main} />}
                                </ListItemIcon>
                                <ListItemText 
                                  primary={<Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.85rem' }}>{log.message}</Typography>}
                                  secondary={<Typography variant="caption" sx={{ fontWeight: 600 }}>{log.userEmail || 'System'} • {new Date(log.timestamp).toLocaleTimeString()}</Typography>}
                                />
                                <Typography variant="caption" sx={{ fontWeight: 900, color: 'success.main', letterSpacing: 1 }}>AUTHENTICATED</Typography>
                              </ListItem>
                            )) : (
                              <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>テレメトリ接続中. イベント待機中...</Typography>
                              </Box>
                            )}
                        </List>
                      </CardContent>
                    </Card>

                    <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', overflow: 'hidden' }}>
                      <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Device Access</Typography>
                         <Chip label="Active Device" size="small" color="primary" sx={{ fontWeight: 900, borderRadius: 1 }} />
                      </Box>
                      <CardContent sx={{ p: 3 }}>
                         <List disablePadding>
                            <ListItem sx={{ py: 2, px: 2.5, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                               <ListItemIcon><Monitor size={22} color={theme.palette.primary.main} /></ListItemIcon>
                               <ListItemText 
                                 primary={<Typography variant="body2" sx={{ fontWeight: 800 }}>Primary Browser Session</Typography>} 
                                 secondary={<Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main' }}>Secure connection active from this endpoint</Typography>} 
                               />
                            </ListItem>
                         </List>
                      </CardContent>
                    </Card>

                    <Box sx={{ mt: 2 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="error"
                          startIcon={<LogOut size={20} />}
                          onClick={logout}
                          sx={{ borderRadius: 2, py: 2, fontWeight: 900, boxShadow: 'none' }}
                        >
                          Sign Out of All Sessions
                        </Button>
                    </Box>
                 </Stack>
              </motion.div>
            )}

            {/* Notifications Section */}
            {tabValue === 'notifications' && (
              <motion.div key="notifications" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>Notification & Alert Sync</Typography>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={4}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', mb: 3, display: 'block' }}>Alert Preferences</Typography>
                        <Grid container spacing={3}>
                          {[
                            { key: 'email', label: 'Email Reports', desc: 'Periodic summaries to your primary inbox', icon: <Mail size={18} /> },
                            { key: 'push', label: 'Push Intelligence', desc: 'Real-time banners on browser and mobile', icon: <Bell size={18} /> },
                            { key: 'feeReminders', label: 'Payment Alerts', desc: 'Automatic overdue notifications for finance', icon: <CreditCard size={18} /> },
                            { key: 'inAppToasts', label: 'In-App Alerts', desc: 'Subtle toast notifications during usage', icon: <MessageSquare size={18} /> }
                          ].map((item, i) => (
                            <Grid size={{ xs: 12, md: 6 }} key={i}>
                              <Box sx={{ p: 3, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1), borderRadius: 3, bgcolor: alpha(theme.palette.background.default, 0.4), display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Stack direction="row" spacing={2}>
                                  <Box sx={{ color: 'primary.main', p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2, display: 'flex', height: 'fit-content' }}>
                                    {item.icon}
                                  </Box>
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{item.label}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', maxWidth: 200 }}>{item.desc}</Typography>
                                  </Box>
                                </Stack>
                                <IOSSwitch size="small" checked={(notificationPrefs as any)[item.key]} onChange={(e: any) => setNotificationPrefs({ ...notificationPrefs, [item.key]: e.target.checked })} />
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    </Stack>
                    <Box sx={{ mt: 5, display: 'flex', justifyContent: 'flex-end' }}>
                      <AnimatePresence>
                        {isPrefsDirty && (
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                            <Button variant="contained" startIcon={<Save size={18} />} onClick={handleSaveNotifications} sx={{ borderRadius: 2, fontWeight: 950, px: 4 }}>Save Notification Sync</Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Data Section */}
            {tabValue === 'data' && isAdmin && (
              <motion.div key="data" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <Stack spacing={4}>
                  <Card variant="outlined" sx={{ borderRadius: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>Data Infrastructure & Continuity</Typography>
                    </Box>
                    <CardContent sx={{ p: 4 }}>
                      <Stack spacing={5}>
                        <Box>
                           <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 3 }}>Calendar & Regional Adjustments</Typography>
                           <Box sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.2), bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                             <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="center" justifyContent="space-between">
                                <Box sx={{ maxWidth: 500 }}>
                                   <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                     <Languages size={22} color={theme.palette.primary.main} /> 
                                     Islamic Hijri Date Offset
                                   </Typography>
                                   <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                      Adjust the lunar calendar shifting globally across receipts, reporting, and dashboard views to align with local moon sightings.
                                   </Typography>
                                </Box>
                                <Stack direction="row" spacing={3} alignItems="center">
                                    <IconButton 
                                      size="large" 
                                      onClick={() => setInstituteData(prev => ({ ...prev, jafariOffset: (prev.jafariOffset || 0) - 1 }))}
                                      sx={{ bgcolor: 'background.paper', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) } }}
                                    >
                                      <Minus size={24} />
                                    </IconButton>
                                    <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                                      <Typography variant="h2" sx={{ fontWeight: 950, color: 'primary.main', letterSpacing: -2 }}>
                                        {Number(instituteData.jafariOffset || 0) > 0 ? '+' : ''}{instituteData.jafariOffset || 0}
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6, letterSpacing: 1 }}>DAYS SHIFT</Typography>
                                    </Box>
                                    <IconButton 
                                      size="large" 
                                      onClick={() => setInstituteData(prev => ({ ...prev, jafariOffset: (prev.jafariOffset || 0) + 1 }))}
                                      sx={{ bgcolor: 'background.paper', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) } }}
                                    >
                                      <Plus size={24} />
                                    </IconButton>
                                </Stack>
                             </Stack>
                           </Box>
                        </Box>

                        <Divider />

                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 3 }}>Infrastructure Maintenance</Typography>
                          <Grid container spacing={3}>
                             <Grid size={{ xs: 12, md: 6 }}>
                                <Paper variant="outlined" sx={{ p: 4, borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
                                   <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                      <Download size={20} color={theme.palette.primary.main} /> Database Snapshots
                                   </Typography>
                                   <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 4, fontWeight: 500 }}>Generate a secure JSON snapshot of all institutional records for external cold storage.</Typography>
                                   <Button variant="contained" fullWidth onClick={handleGenerateBackup} sx={{ fontWeight: 950, borderRadius: 2.5, py: 1.5, bgcolor: 'text.primary', '&:hover': { bgcolor: 'text.secondary' } }}>Download Cloud Backup</Button>
                                </Paper>
                             </Grid>
                          </Grid>
                        </Box>

                        <Divider />

                        <Box>
                           <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'error.main', display: 'block', mb: 3 }}>Danger Zone</Typography>
                           <Paper 
                             variant="outlined" 
                             sx={{ 
                               p: 4, 
                               borderRadius: 4, 
                               borderColor: alpha(theme.palette.error.main, 0.3), 
                               bgcolor: alpha(theme.palette.error.main, 0.03),
                               borderStyle: 'dashed'
                             }}
                           >
                              <Stack spacing={3}>
                                 <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 950, color: 'error.main', mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                      <AlertTriangle size={22} /> Critical Data Purge
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                       Destructive actions that irreversibly remove specific data domains. Use with extreme caution.
                                    </Typography>
                                 </Box>
                                 <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                       <Button 
                                          variant="outlined" 
                                          color="error" 
                                          fullWidth 
                                          startIcon={<Trash2 size={18} />} 
                                          onClick={() => { setPurgeType('STUDENTS'); setResetConfirmOpen(true); }} 
                                          sx={{ fontWeight: 950, borderRadius: 2.5, py: 1.5, bgcolor: 'background.paper', border: '2px solid' }}
                                       >
                                          Purge All Student Records
                                       </Button>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                       <Button 
                                          variant="contained" 
                                          color="error" 
                                          fullWidth 
                                          startIcon={<AlertCircle size={18} />} 
                                          onClick={() => { setPurgeType('ALL'); setResetConfirmOpen(true); }} 
                                          sx={{ fontWeight: 950, borderRadius: 2.5, py: 1.5, boxShadow: 'none' }}
                                       >
                                          Full System Factory Reset
                                       </Button>
                                    </Grid>
                                 </Grid>
                              </Stack>
                           </Paper>
                        </Box>
                      </Stack>

                      <Box sx={{ mt: 6, display: 'flex', justifyContent: 'flex-end' }}>
                        <AnimatePresence>
                          {(isInstituteDirty || isPrefsDirty) && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                              <Button variant="contained" size="large" color="primary" startIcon={<RefreshCw size={20} />} onClick={async () => { await handleSaveInstitute(); await handleSaveSettings(); }} sx={{ borderRadius: 3, fontWeight: 950, px: 6, py: 2 }}>Synchronize Global Systems</Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Box>
                    </CardContent>
                  </Card>
                </Stack>
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
