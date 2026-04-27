import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, InputAdornment, Tab, Tabs,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, Stack, Tooltip, Zoom, Fade,
  LinearProgress, Divider, Snackbar, Alert
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Plus, Search, Edit2, Trash2, UserPlus, 
  Filter, Mail, Phone, MapPin, Shield,
  MoreVertical, User, GraduationCap, UserCheck,
  ArrowRight, ExternalLink, Download, Layout,
  Layers, CheckCircle, XCircle, Clock, Save,
  Bell, Camera, X, Printer, RotateCcw, ArrowLeft, FileText, Database
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, getDocs, writeBatch, getDoc, or, and, documentId } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, smartAddDoc, smartUpdateDoc, smartDeleteDoc } from '../firebase';
import { UserProfile, UserRole, MaktabLevel, InstituteSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { MAKTAB_LEVELS, SUBJECT_OPTIONS } from '../constants';
import { logger } from '../lib/logger';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { exportToCSV } from '../lib/exportUtils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHardwarePermissions } from '../services/hardwareService';

export default function Users() {
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter');
    const level = params.get('level');
    
    if (filter === 'students') setTabValue(0);
    else if (filter === 'teachers') setTabValue(1);
    else if (filter === 'staff') setTabValue(2);
    
    if (level) {
      setLevelFilter(level as MaktabLevel);
    }
  }, [location.search]);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(!(window as any)._usersLoaded);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [levelFilter, setLevelFilter] = useState<MaktabLevel | 'All'>('All');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'All'>('All');
  const [openDialog, setOpenDialog] = useState(false);
  const [openPromoteDialog, setOpenPromoteDialog] = useState(false);
  const [openViewProfile, setOpenViewProfile] = useState(false);
  const [profileToView, setProfileToView] = useState<UserProfile | null>(null);
  const [instituteSettings, setInstituteSettings] = useState<Partial<InstituteSettings>>({});
  const [promotingUser, setPromotingUser] = useState<UserProfile | null>(null);
  const [newGrade, setNewGrade] = useState<MaktabLevel | ''>('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [userToDeleteRef, setUserToDeleteRef] = useState<{ id: string, profile: UserProfile } | null>(null);
  
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    role: 'student' as UserRole,
    phone: '',
    maktabLevel: '' as MaktabLevel,
    admissionNo: '',
    teacherId: '',
    dob: '',
    fatherName: '',
    motherName: '',
    rollNo: '',
    admissionDate: format(new Date(), 'yyyy-MM-dd'),
    address: '',
    subject: '',
    subjectsEnrolled: [] as string[],
    assignedClasses: [] as string[],
    status: 'Active' as 'Active' | 'Inactive',
    photoURL: ''
  });

  const [cameraOpen, setCameraOpen] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const { permissions, requestCameraPermission } = useHardwarePermissions();

  const handleOpenCamera = async () => {
    if (permissions.camera === 'prompt') {
      const result = await requestCameraPermission();
      if (result === 'granted') {
        setCameraOpen(true);
      } else {
        setSnackbar({ open: true, message: 'Camera permission is required to take photos', severity: 'error' });
      }
    } else if (permissions.camera === 'denied') {
      setSnackbar({ open: true, message: 'Camera access is blocked. Please enable it in browser settings.', severity: 'error' });
    } else {
      setCameraOpen(true);
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setFormData(prev => ({ ...prev, photoURL: imageSrc }));
      setCameraOpen(false);
      setSnackbar({ open: true, message: 'Photo captured successfully!', severity: 'success' });
    }
  }, [webcamRef]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max = 500; // Better quality but safe size
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
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          
          if (base64.length > 800000) { // Still too large? compress more
            const smallerBase64 = canvas.toDataURL('image/jpeg', 0.6);
            setFormData(prev => ({ ...prev, photoURL: smallerBase64 }));
          } else {
            setFormData(prev => ({ ...prev, photoURL: base64 }));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const subjectsOptions = SUBJECT_OPTIONS;
  const maktabLevels = MAKTAB_LEVELS;

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const role = currentUser?.role || 'student';
  const isMuntazim = role === 'muntazim' || (role === 'superadmin' && !isSuperAdmin);
  const isMudarisRole = role === 'mudaris';
  const isAdmin = isSuperAdmin || isMuntazim;
  const isStaff = isSuperAdmin || isMuntazim || isMudarisRole;

  const handleSystemReset = async () => {
    if (!isSuperAdmin) return;
    setResetConfirmOpen(true);
  };

  const confirmSystemReset = async () => {
    const confirmText = "RESET ALL USERS";
    if (resetConfirmText !== confirmText) {
      setSnackbar({ open: true, message: 'Confirmation text does not match!', severity: 'error' });
      return;
    }

    setResetConfirmOpen(false);
    setLoading(true);
    try {
      const collectionsToClear = [
        'users',
        'attendance',
        'exams',
        'fees',
        'logs',
        'notifications',
        'schedule'
      ];

      let totalDeleted = 0;

      for (const collectionName of collectionsToClear) {
        const snapshot = await getDocs(collection(db, collectionName));
        const chunks = [];
        
        // Process in chunks due to batch limits
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
          chunks.push(docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(docSnap => {
            // NEVER delete the super admin
            if (collectionName === 'users') {
              if (docSnap.data().email !== 'zeeshanmaqbool200@gmail.com') {
                batch.delete(docSnap.ref);
                totalDeleted++;
              }
            } else {
              batch.delete(docSnap.ref);
              totalDeleted++;
            }
          });
          await batch.commit();
        }
      }
      
      // Clear local storage for permissions/agent states
      localStorage.removeItem('permission_agent_dismissed');
      
      logger.success(`System Reset Complete: ${totalDeleted} records removed.`);
      setSnackbar({ open: true, message: `System purged successfully. ${totalDeleted} records removed.`, severity: 'success' });
      
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'system-reset');
      setSnackbar({ open: true, message: 'Error during system reset', severity: 'error' });
    } finally {
      setLoading(false);
      setResetConfirmText('');
    }
  };

  useEffect(() => {
    let q;
    if (isSuperAdmin || isMuntazim) {
      q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    } else if (isMudarisRole) {
      // Mudaris can only see students in their assigned classes or Example class
      q = query(
        collection(db, 'users'), 
        and(
          where('role', '==', 'student'),
          or(
            where('grade', 'in', (currentUser?.assignedClasses && currentUser.assignedClasses.length > 0) ? currentUser.assignedClasses : ['__none__']),
            where('grade', '==', 'Example')
          )
        ),
        orderBy('displayName', 'asc')
      );
    } else {
      // Pending mudaris see nothing or just themselves
      q = query(collection(db, 'users'), where(documentId(), '==', currentUser?.uid || 'none'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[]);
      setLoading(false);
      (window as any)._usersLoaded = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, [isSuperAdmin, isMuntazim, isMudarisRole, currentUser?.assignedClasses, currentUser?.uid]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (settingsDoc.exists()) {
          setInstituteSettings(settingsDoc.data() as InstituteSettings);
        }
      } catch (error) {
        // Silent fail for non-critical settings
      }
    };
    fetchSettings();
  }, []);

  const handlePrint = () => {
    // Small timeout to ensure everything is rendered and focused
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleSave = async () => {
    try {
      let finalFormData = { ...formData };
      
      // Auto-assign admission number for new students if not provided
      if (!editingUser && formData.role === 'student' && !formData.admissionNo) {
        const year = format(new Date(), 'yyyy');
        const timestamp = Date.now().toString().slice(-4);
        const namePart = formData.displayName.slice(0, 3).toUpperCase();
        finalFormData.admissionNo = `ADM-${year}-${namePart}-${timestamp}`;
      }

      /* // Skipping duplicate email check to avoid permission errors for non-superadmins
      if (!editingUser) {
        const q = query(collection(db, 'users'), where('email', '==', formData.email));
        const checkSnap = await getDocs(q);
        if (!checkSnap.empty) {
          setSnackbar({ 
            open: true, 
            message: `A user with email ${formData.email} already exists!`, 
            severity: 'error' 
          });
          return;
        }
      }
      */

      // Synchronize grade and maktabLevel for students
      if (finalFormData.role === 'student' && finalFormData.maktabLevel) {
        (finalFormData as any).grade = finalFormData.maktabLevel;
      }

      if (editingUser) {
        await smartUpdateDoc(doc(db, 'users', editingUser.uid), finalFormData);
      } else {
        await smartAddDoc(collection(db, 'users'), {
          ...finalFormData,
          createdAt: Date.now(),
          photoURL: finalFormData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.displayName)}&background=random&color=fff`
        });
      }
      setOpenDialog(false);
      setEditingUser(null);
      setSnackbar({ open: true, message: `User ${editingUser ? 'updated' : 'registered'} successfully`, severity: 'success' });
      
      // Trigger confetti for a delightful experience
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: [theme.palette.primary.main, theme.palette.secondary.main, '#0d9488']
      });
    } catch (error) {
      console.error('Error saving user:', error);
      setSnackbar({ open: true, message: 'Failed to save user details. Please check connection and try again.', severity: 'error' });
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const handleDelete = async (id: string, userToDelete: UserProfile) => {
    if (!isSuperAdmin) return;
    
    // Safety check: Cannot delete the superadmin account
    if (userToDelete.email === 'zeeshanmaqbool200@gmail.com') {
      setSnackbar({ open: true, message: 'Superadmin account cannot be deleted', severity: 'error' });
      return;
    }

    setUserToDeleteRef({ id, profile: userToDelete });
    setDeleteConfirmOpen(true);
  };

  const confirmUserDeletion = async () => {
    if (!userToDeleteRef || !isSuperAdmin) return;
    const { id, profile: userToDelete } = userToDeleteRef;
    
    setDeleteConfirmOpen(false);
    setLoading(true);
    try {
      logger.db('Initiating Full User Deletion', `users/${id}`);
      
      // 1. Clear related records first across collections
      const batch = writeBatch(db);
      
      // Attendance
      const attQ = query(collection(db, 'attendance'), where('studentId', '==', id));
      const attDocs = await getDocs(attQ);
      attDocs.forEach(d => batch.delete(d.ref));
      
      // Exam records
      const examQ = query(collection(db, 'exams'), where('studentId', '==', id));
      const examDocs = await getDocs(examQ);
      examDocs.forEach(d => batch.delete(d.ref));

      // Fee records
      const feeQ = query(collection(db, 'fees'), where('studentId', '==', id));
      const feeDocs = await getDocs(feeQ);
      feeDocs.forEach(d => batch.delete(d.ref));
      
      await batch.commit();

      // 2. Delete the user document itself
      // Using smartDeleteDoc for the primary user record
      await smartDeleteDoc(doc(db, 'users', id));
      
      setSnackbar({ 
        open: true, 
        message: `${userToDelete.displayName} data purged from Firestore. Note: Manage Auth users in Firebase Console.`, 
        severity: 'success' 
      });
      logger.success('User data purged permanently', userToDelete.email);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
      setSnackbar({ open: true, message: 'Error purging user records', severity: 'error' });
    } finally {
      setLoading(false);
      setUserToDeleteRef(null);
    }
  };

  const handleApproveClass = async (user: UserProfile) => {
    try {
      const updateData: any = {
        maktabLevel: user.pendingMaktabLevel,
        pendingMaktabLevel: null,
        status: 'Active'
      };

      // Auto-assign admission number if missing on approval
      if (user.role === 'student' && !user.admissionNo) {
        const year = format(new Date(), 'yyyy');
        const timestamp = Date.now().toString().slice(-4);
        const namePart = user.displayName.slice(0, 3).toUpperCase();
        updateData.admissionNo = `ADM-${year}-${namePart}-${timestamp}`;
      }

      await smartUpdateDoc(doc(db, 'users', user.uid), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleRejectClass = async (user: UserProfile) => {
    try {
      await smartUpdateDoc(doc(db, 'users', user.uid), {
        pendingMaktabLevel: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleApproveMudaris = async (user: UserProfile) => {
    try {
      await smartUpdateDoc(doc(db, 'users', user.uid), {
        role: 'mudaris',
        status: 'Active'
      });
      logger.success(`Mudaris ${user.displayName} approved`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleRejectMudaris = async (user: UserProfile) => {
    try {
      await smartUpdateDoc(doc(db, 'users', user.uid), {
        role: 'student', // Revert to student or deactivate
        status: 'Inactive'
      });
      logger.info(`Mudaris ${user.displayName} rejected`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handlePromote = async () => {
    if (!promotingUser || !newGrade) return;
    try {
      await smartUpdateDoc(doc(db, 'users', promotingUser.uid), {
        maktabLevel: newGrade,
        grade: newGrade
      });
      setOpenPromoteDialog(false);
      setPromotingUser(null);
      setNewGrade('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${promotingUser.uid}`);
    }
  };

  const filteredUsers = users.filter(u => {
    // Hide super admin from the list to prevent accidental deletion
    if (u.email === 'zeeshanmaqbool200@gmail.com') return false;

    const matchesSearch = u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (u.admissionNo && u.admissionNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (u.teacherId && u.teacherId.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
    const matchesLevel = levelFilter === 'All' || u.maktabLevel === levelFilter || u.grade === levelFilter;
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;

    if (!matchesStatus || !matchesLevel || !matchesRole) return false;

    if (tabValue === 0) return u.role === 'student' && matchesSearch;
    if (tabValue === 1) return (u.role === 'mudaris' || u.role === 'muntazim' || u.role === 'superadmin' || u.role === 'pending_mudaris') && matchesSearch;
    if (tabValue === 2) return (u.pendingMaktabLevel || u.role === 'pending_mudaris') && matchesSearch;
    return matchesSearch;
  });

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  const handleExport = () => {
    const roleLabel = tabValue === 0 ? 'Students' : tabValue === 1 ? 'Teachers' : 'Staff';
    const usersToExport = filteredUsers.map(u => ({
      Name: u.displayName,
      Email: u.email,
      Role: u.role,
      Phone: u.phone || 'N/A',
      Level: u.maktabLevel || 'N/A',
      ID: u.admissionNo || u.teacherId || 'N/A',
      Status: u.status,
      Address: u.address || 'N/A'
    }));
    exportToCSV(usersToExport, `Maktab_${roleLabel}_Export`);
  };

  return (
    <Box sx={{ pb: 8 }}>
      <Box sx={{ mb: 2 }}>
        <Button 
          variant="text" 
          startIcon={<ArrowLeft size={20} />} 
          onClick={() => navigate(-1)}
          sx={{ fontWeight: 800, color: 'text.secondary' }}
        >
          Back / Wapis
        </Button>
      </Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>{tabValue === 0 ? 'Tulab' : tabValue === 1 ? 'Mudaris' : 'Approval'} Management</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Manage Tulab-e-Ilm, Mudaris, and administrative Muntazim
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end', alignItems: 'center' }}>
            <Box sx={{ 
              display: 'flex', 
              bgcolor: 'background.default', 
              p: 0.6, 
              borderRadius: 2,
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 2px 2px 4px #060a12, inset -2px -2px 4px #182442'
                : 'inset 2px 2px 4px #d1d9e6, inset -2px -2px 4px #ffffff',
            }}>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('grid')}
                sx={{ 
                  borderRadius: 2.5, 
                  p: 1,
                  bgcolor: viewMode === 'grid' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'grid' 
                    ? (theme.palette.mode === 'dark' ? '2px 2px 4px #060a12, -2px -2px 4px #182442' : '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff')
                    : 'none',
                  color: viewMode === 'grid' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layout size={isMobile ? 16 : 18} />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('list')}
                sx={{ 
                  borderRadius: 2.5, 
                  p: 1,
                  bgcolor: viewMode === 'list' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'list' 
                    ? (theme.palette.mode === 'dark' ? '2px 2px 4px #060a12, -2px -2px 4px #182442' : '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff')
                    : 'none',
                  color: viewMode === 'list' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layers size={isMobile ? 16 : 18} />
              </IconButton>
            </Box>
            {isAdmin && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Download size={18} />}
                onClick={handleExport}
                sx={{
                  borderRadius: 2,
                  fontWeight: 800,
                  px: isMobile ? 2 : 3,
                  py: isMobile ? 1 : 1.2,
                  minHeight: isMobile ? 40 : 48,
                  textTransform: 'none',
                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '4px 4px 10px #060a12, -4px -4px 10px #182442'
                    : '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                }}
              >
                {isMobile ? "" : "Export"}
              </Button>
            )}
            {isAdmin && (
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<UserPlus size={isMobile ? 18 : 22} />} 
                onClick={() => {
                  setEditingUser(null);
                  setFormData({ 
                    displayName: '', email: '', role: tabValue === 0 ? 'student' : 'mudaris', 
                    phone: '', maktabLevel: '' as MaktabLevel, admissionNo: '', teacherId: '', 
                    dob: '',
                    fatherName: '', motherName: '', rollNo: '', admissionDate: format(new Date(), 'yyyy-MM-dd'),
                    address: '', subject: '', subjectsEnrolled: [], assignedClasses: [], status: 'Active',
                    photoURL: ''
                  });
                  setOpenDialog(true);
                }}
                sx={{ 
                  borderRadius: 2, 
                  fontWeight: 800, 
                  px: isMobile ? 2 : 3, 
                  py: isMobile ? 1 : 1.2,
                  minHeight: isMobile ? 40 : 48,
                  textTransform: 'none',
                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '4px 4px 10px #060a12, -4px -4px 10px #182442'
                    : '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.palette.mode === 'dark'
                      ? '6px 6px 14px #060a12, -6px -6px 14px #182442'
                      : '6px 6px 14px #cbd5e1, -6px -6px 14px #ffffff',
                  }
                }}
              >
                {isMobile ? "Add" : (tabValue === 0 ? 'Add Talib' : 'Add Mudaris')}
              </Button>
            )}
          </Stack>
        </Box>
      </motion.div>

      {/* Stats Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SummaryCard title="Total Tulab-e-Ilm" value={users.filter(u => u.role === 'student').length} icon={<GraduationCap size={24} />} color="primary" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SummaryCard title="Total Mudaris" value={users.filter(u => u.role === 'mudaris').length} icon={<UserCheck size={24} />} color="success" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SummaryCard title="Muntazim" value={users.filter(u => u.role === 'muntazim' || u.role === 'superadmin').length} icon={<Shield size={24} />} color="secondary" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <SummaryCard title="Active Now" value={users.filter(u => u.status === 'Active').length} icon={<Clock size={24} />} color="warning" />
        </motion.div>
      </Box>

      <Card sx={{ 
        borderRadius: 2, 
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none'
      }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider', 
          bgcolor: 'background.paper', 
          px: 3, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: 2,
          py: 1
        }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, v) => setTabValue(v)} 
            sx={{ 
              '& .MuiTab-root': { fontWeight: 900, py: 3, minWidth: 140, textTransform: 'none', fontSize: '1rem' },
              '& .Mui-selected': { color: 'primary.main' },
              '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0' }
            }}
          >
            <Tab label="Tulab-e-Ilm" icon={<GraduationCap size={20} />} iconPosition="start" />
            <Tab label="Mudaris" icon={<UserCheck size={20} />} iconPosition="start" />
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                Pending Approvals
                {users.filter(u => u.pendingMaktabLevel).length > 0 && (
                  <Chip 
                    label={users.filter(u => u.pendingMaktabLevel).length} 
                    size="small" 
                    sx={{ height: 22, fontSize: '0.7rem', fontWeight: 900, bgcolor: 'warning.main', color: 'white' }} 
                  />
                )}
              </Box>
            } icon={<Clock size={20} />} iconPosition="start" />
          </Tabs>
          
          <Box sx={{ px: 2, py: 2, flex: { xs: 1, md: 'none' }, minWidth: { xs: '100%', md: 400 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  px: 2, 
                  borderRadius: 2, 
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                  flex: 1
                }}
              >
                <Search size={20} color={theme.palette.text.secondary} />
                <Box 
                  component="input" 
                  placeholder={`Search ${tabValue === 0 ? 'Tulab-e-Ilm' : 'Mudaris'}...`} 
                  value={searchQuery}
                  onChange={(e: any) => setSearchQuery(e.target.value)}
                  sx={{ 
                    border: 'none', 
                    outline: 'none', 
                    p: 1.5, 
                    width: '100%', 
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    bgcolor: 'transparent',
                    color: 'text.primary',
                    '&::placeholder': { color: 'text.disabled' }
                  }} 
                />
              </Paper>

              <Stack direction="row" spacing={1}>
                {tabValue === 0 && (
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Level</InputLabel>
                    <Select
                      value={levelFilter}
                      label="Level"
                      onChange={(e) => setLevelFilter(e.target.value as any)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="All">All Levels</MenuItem>
                      {maktabLevels.map(level => (
                        <MenuItem key={level} value={level}>{level}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="All">All Status</MenuItem>
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>

                {(levelFilter !== 'All' || statusFilter !== 'All') && (
                  <IconButton 
                    onClick={() => { setLevelFilter('All'); setStatusFilter('All'); }}
                    sx={{ bgcolor: 'error.light', color: 'error.main', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                  >
                    <RotateCcw size={18} />
                  </IconButton>
                )}
              </Stack>
            </Stack>
          </Box>
        </Box>
        
        {viewMode === 'list' ? (
          <Box sx={{ width: '100%', overflow: 'visible' }}>
            <TableContainer component={Box} sx={{ 
              minWidth: '100%', 
              overflowX: 'auto',
              display: 'block',
              '&::-webkit-scrollbar': { height: 8 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 4 }
            }}>
              <Table sx={{ minWidth: { xs: 800, md: '100%' } }}>
                <TableHead>
                <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.5) : 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 800, py: 2.5 }}>Profile</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Admission No / ID</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>{tabValue === 0 ? 'Maktab Level' : 'Subject'}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Contact Info</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map((user) => (
                    <TableRow 
                      component={motion.tr}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={user.uid} 
                      hover
                      sx={{ transition: 'all 0.2s' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar 
                            src={user.photoURL} 
                            imgProps={{ referrerPolicy: 'no-referrer' }}
                            sx={{ 
                              width: 44, 
                              height: 44, 
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              border: '2px solid white'
                            }} 
                          />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{user.displayName}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{user.email}</Typography>
                              {user.hardwareStatus && (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Tooltip title={`Notifications: ${user.hardwareStatus.notifications}`}>
                                    <Box sx={{ color: user.hardwareStatus.notifications === 'granted' ? 'success.main' : 'text.disabled' }}>
                                      <Bell size={12} />
                                    </Box>
                                  </Tooltip>
                                  <Tooltip title={`Camera: ${user.hardwareStatus.camera}`}>
                                    <Box sx={{ color: user.hardwareStatus.camera === 'granted' ? 'success.main' : 'text.disabled' }}>
                                      <Camera size={12} />
                                    </Box>
                                  </Tooltip>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={user.role === 'student' ? user.admissionNo || user.studentId : user.teacherId} 
                          size="small" 
                          variant="outlined" 
                          sx={{ fontWeight: 800, fontSize: '0.7rem', borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.5) : 'grey.50' }} 
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {user.role === 'student' ? (user.maktabLevel || user.grade || (user.pendingMaktabLevel ? 'Pending...' : 'N/A')) : (user.subject || 'N/A')}
                          </Typography>
                          {user.pendingMaktabLevel && (
                            <Chip 
                              label={`Req: ${user.pendingMaktabLevel}`} 
                              size="small" 
                              color="warning" 
                              sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }} 
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                            <Phone size={12} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{user.phone || 'N/A'}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                            <MapPin size={12} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>{user.address || 'N/A'}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          <Tooltip title="View Profile">
                            <IconButton 
                              size="small" 
                              sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.4) : 'grey.100', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                              onClick={() => { setProfileToView(user); setOpenViewProfile(true); }}
                            >
                              <ExternalLink size={16} />
                            </IconButton>
                          </Tooltip>
                          {isAdmin && (
                            <>
                              {user.pendingMaktabLevel && (
                                <>
                                  <Tooltip title="Approve Class">
                                    <IconButton 
                                      size="small" 
                                      sx={{ bgcolor: 'success.light', color: 'success.dark', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                                      onClick={() => handleApproveClass(user)}
                                    >
                                      <CheckCircle size={16} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Reject Class">
                                    <IconButton 
                                      size="small" 
                                      sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                      onClick={() => handleRejectClass(user)}
                                    >
                                      <XCircle size={16} />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                              {isSuperAdmin && user.role === 'pending_mudaris' && (
                                <>
                                  <Tooltip title="Approve Mudaris">
                                    <IconButton 
                                      size="small" 
                                      sx={{ bgcolor: 'success.light', color: 'success.dark', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                                      onClick={() => handleApproveMudaris(user)}
                                    >
                                      <UserCheck size={16} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Reject Mudaris">
                                    <IconButton 
                                      size="small" 
                                      sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                      onClick={() => handleRejectMudaris(user)}
                                    >
                                      <XCircle size={16} />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                              {user.role === 'student' && user.maktabLevel && (
                                <Tooltip title="Promote">
                                  <IconButton 
                                    size="small" 
                                    sx={{ bgcolor: 'primary.light', color: 'primary.dark', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                                    onClick={() => { setPromotingUser(user); setOpenPromoteDialog(true); }}
                                  >
                                    <ArrowRight size={16} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Edit">
                                <IconButton 
                                  size="small" 
                                  sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.4) : 'grey.100', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                                  onClick={() => { 
                                    setEditingUser(user); 
                                    setFormData({
                                      ...user,
                                      subjectsEnrolled: user.subjectsEnrolled || [],
                                      assignedClasses: user.assignedClasses || [],
                                      photoURL: user.photoURL || ''
                                    } as any); 
                                    setOpenDialog(true); 
                                  }}
                                >
                                  <Edit2 size={16} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton 
                                  size="small" 
                                  sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                  onClick={() => handleDelete(user.uid, user)}
                                  disabled={!isSuperAdmin}
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
        ) : (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user, index) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={user.uid}>
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <UserCard 
                        user={user} 
                        isAdmin={isAdmin} 
                        isSuperAdmin={isSuperAdmin} 
                        onEdit={() => { 
                          setEditingUser(user); 
                          setFormData({
                            ...user,
                            subjectsEnrolled: user.subjectsEnrolled || [],
                            assignedClasses: user.assignedClasses || [],
                            photoURL: user.photoURL || ''
                          } as any); 
                          setOpenDialog(true); 
                        }} 
                        onDelete={() => handleDelete(user.uid, user)}
                        onApproveClass={handleApproveClass}
                        onRejectClass={handleRejectClass}
                        onApproveMudaris={handleApproveMudaris}
                        onRejectMudaris={handleRejectMudaris}
                        onViewProfile={() => { setProfileToView(user); setOpenViewProfile(true); }}
                      />
                    </motion.div>
                  </Grid>
                ))}
              </AnimatePresence>
            </Grid>
          </Box>
        )}
        
        {filteredUsers.length === 0 && (
          <Box sx={{ p: 10, textAlign: 'center' }}>
            <User size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No Tulab/Mudaris found</Typography>
            <Typography variant="body2" color="text.secondary">Try adjusting your search query or filters</Typography>
          </Box>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 3, p: isMobile ? 1 : 2, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: isMobile ? '1.25rem' : '1.75rem', pb: 2, px: isMobile ? 2 : 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <UserPlus size={isMobile ? 24 : 32} className="text-primary-500" />
            {editingUser ? 'Update Profile' : 'Naya Registration'}
          </Box>
          <IconButton onClick={() => setOpenDialog(false)} className="close-button">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: isMobile ? 2 : 4, py: 2 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontWeight: 500, lineHeight: 1.6 }}>
            Thora waqt nikaal kar niche diye gaye details check karein aur save karein.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={12}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar 
                  src={formData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.displayName || 'User')}&background=random&color=fff`} 
                  imgProps={{ referrerPolicy: 'no-referrer' }}
                  sx={{ width: 120, height: 120, border: '4px solid', borderColor: 'primary.main', boxShadow: theme.shadows[3] }}
                />
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="outlined"
                    startIcon={<Camera size={18} />}
                    onClick={handleOpenCamera}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    Take Photo
                  </Button>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<Download size={18} />}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    Upload Photo
                    <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
                  </Button>
                  {formData.photoURL && (
                    <Button
                      variant="text"
                      color="error"
                      onClick={() => setFormData(prev => ({ ...prev, photoURL: '' }))}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                    >
                      Reset
                    </Button>
                  )}
                </Stack>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Full Name"
                required
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Email Address"
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                <InputLabel>Role / Designation</InputLabel>
                <Select
                  value={formData.role}
                  label="Role / Designation"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  <MenuItem value="student">Talib-e-Ilm</MenuItem>
                  <MenuItem value="muntazim">Muntazim (Admin)</MenuItem>
                  <MenuItem value="mudaris">Mudaris (Teacher)</MenuItem>
                  <MenuItem value="pending_mudaris">Pending Mudaris</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            {formData.role === 'student' ? (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Admission No"
                    value={formData.admissionNo}
                    onChange={(e) => setFormData({ ...formData, admissionNo: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                    <InputLabel>Maktab Level</InputLabel>
                    <Select
                      value={formData.maktabLevel}
                      label="Maktab Level"
                      onChange={(e) => setFormData({ ...formData, maktabLevel: e.target.value as MaktabLevel })}
                    >
                      {maktabLevels.map(level => (
                        <MenuItem key={level} value={level}>{level}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Date of Birth"
                    type="date"
                    value={formData.dob || ''}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Father's Name"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Mother's Name"
                    value={formData.motherName}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Roll No"
                    value={formData.rollNo}
                    onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Admission Date"
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                    <InputLabel>Subjects Enrolled</InputLabel>
                    <Select
                      multiple
                      value={formData.subjectsEnrolled || []}
                      label="Subjects Enrolled"
                      onChange={(e) => setFormData({ ...formData, subjectsEnrolled: e.target.value as string[] })}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {subjectsOptions.map((subject) => (
                        <MenuItem key={subject} value={subject}>
                          {subject}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            ) : (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Mudaris ID"
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Primary Subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                {isSuperAdmin && (
                  <Grid size={{ xs: 12 }}>
                    <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                      <InputLabel>Assigned Classes</InputLabel>
                      <Select
                        multiple
                        value={formData.assignedClasses || []}
                        label="Assigned Classes"
                        onChange={(e) => setFormData({ ...formData, assignedClasses: e.target.value as string[] })}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                      >
                        {maktabLevels.map((level) => (
                          <MenuItem key={level} value={level}>
                            {level}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </>
            )}
            <Grid size={12}>
              <TextField
                fullWidth
                label="Permanent Address"
                multiline
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, justifyContent: 'flex-end' }}>
          <Button 
            onClick={() => setOpenDialog(false)} 
            variant="outlined" 
            sx={{ fontWeight: 800, color: 'text.secondary', borderRadius: 3, px: 3 }}
          >
            Cancel / Wapis
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            startIcon={<Save size={18} />} 
            disabled={!formData.displayName || !formData.email}
            sx={{ borderRadius: 3, fontWeight: 800, px: 4, boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}` }}
          >
            {editingUser ? 'Update Profile' : 'Register Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Camera Dialog */}
      <Dialog 
        open={cameraOpen} 
        onClose={() => setCameraOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, bgcolor: 'black', color: 'white' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Capture Student Photo</Typography>
          <IconButton onClick={() => setCameraOpen(false)} sx={{ color: 'white' }}>
            <X size={24} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, position: 'relative', minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: 1280,
              height: 720,
              facingMode: "user"
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, justifyContent: 'center' }}>
          <Button 
            onClick={capture} 
            variant="contained" 
            color="primary" 
            size="large"
            startIcon={<Camera size={24} />}
            sx={{ borderRadius: 10, px: 6, py: 1.5, fontWeight: 900, boxShadow: '0 0 20px rgba(13, 148, 136, 0.5)' }}
          >
            CAPTURE
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openPromoteDialog} onClose={() => setOpenPromoteDialog(false)} PaperProps={{ sx: { borderRadius: 1, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Promote Talib-e-Ilm
          <IconButton onClick={() => setOpenPromoteDialog(false)} className="close-button">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select the new class for <strong>{promotingUser?.displayName}</strong>.
          </Typography>
          <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
            <InputLabel>New Maktab Level</InputLabel>
            <Select
              value={newGrade}
              label="New Maktab Level"
              onChange={(e) => setNewGrade(e.target.value as MaktabLevel)}
            >
              {maktabLevels.map(level => (
                <MenuItem key={level} value={level}>{level}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenPromoteDialog(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button onClick={handlePromote} variant="contained" disabled={!newGrade} sx={{ borderRadius: 3, fontWeight: 800 }}>
            Confirm Promotion
          </Button>
        </DialogActions>
      </Dialog>

      {/* Profile Detail Printable Dialog */}
      <Dialog 
        open={openViewProfile} 
        onClose={() => setOpenViewProfile(false)} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ 
          sx: { 
            borderRadius: 5, 
            p: 0, 
            overflow: 'visible',
            '@media print': {
              boxShadow: 'none',
              borderRadius: 0,
              width: '100%',
              maxWidth: '100%',
              margin: 0,
              p: 0,
              overflow: 'visible',
              bgcolor: 'white',
              color: 'black'
            }
          } 
        }}
      >
        <DialogTitle className="no-print" sx={{ fontWeight: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FileText size={24} className="text-primary-500" />
            Student Admission Form
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={() => setOpenViewProfile(false)}
              sx={{ fontWeight: 800, borderRadius: 2 }}
            >
              Back
            </Button>
            <IconButton 
              onClick={handlePrint} 
              size="small" 
              className="print-button"
              sx={{ bgcolor: 'primary.light', color: 'primary.dark', borderRadius: 2 }}
            >
              <Printer size={18} />
            </IconButton>
            <IconButton onClick={() => setOpenViewProfile(false)} size="small" sx={{ borderRadius: 2 }}>
              <X size={18} />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogActions className="no-print" sx={{ p: isMobile ? 2 : 3, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setOpenViewProfile(false)} 
            variant="contained" 
            sx={{ borderRadius: 2, fontWeight: 900, px: 4 }}
          >
            Finished / Wapis
          </Button>
        </DialogActions>
        <DialogContent sx={{ 
          p: 0,
          '@media print': {
            overflow: 'visible',
            height: 'auto'
          }
        }}>
          <Box id="printable-profile" className="admission-page" sx={{ position: 'relative', color: 'black', bgcolor: 'white', p: { xs: 0, md: 1 }, borderRadius: 0, width: '100%' }}>
             {/* Printable Form Content */}
             <Box sx={{ border: '2px solid black', p: { xs: 2, md: 3 }, position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                {/* Header with Logo */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, borderBottom: '3px solid black', pb: 2, gap: 4 }}>
                  <Avatar src={instituteSettings.logoUrl} sx={{ width: 100, height: 100, borderRadius: 0, bgcolor: 'grey.200', flexShrink: 0 }}>
                    <GraduationCap size={50} color="black" />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h3" sx={{ 
                      fontWeight: 900, 
                      color: 'black', 
                      textTransform: 'uppercase', 
                      fontSize: { xs: '1.5rem', md: '2.2rem' }, 
                      fontFamily: 'var(--font-serif)', 
                      lineHeight: 1.1,
                      wordBreak: 'break-word',
                      whiteSpace: 'normal',
                      mb: 0.5
                    }}>
                      {instituteSettings.maktabName || instituteSettings.name || 'MAKHTAB-UN-NOOR'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'black', fontSize: '1rem', mt: 1, wordBreak: 'break-word' }}>
                      {instituteSettings.tagline || 'Education for Excellence'}
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'black', display: 'block', fontSize: '0.9rem', mt: 1, wordBreak: 'break-word', maxWidth: '600px' }}>
                      {instituteSettings.address} | {instituteSettings.phone}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' }, flexShrink: 0, minWidth: 150 }}>
                    <Typography variant="h5" sx={{ fontWeight: 900, border: '3px solid black', px: 3, py: 1, display: 'inline-block', fontSize: '1.2rem', fontFamily: 'var(--font-serif)' }}>
                      ADMISSION FORM
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 2, fontWeight: 700, fontSize: '1rem' }}>
                      Session: {format(new Date(), 'yyyy')}-{parseInt(format(new Date(), 'yyyy')) + 1}
                    </Typography>
                  </Box>
                </Box>

                {/* Student Info Grid */}
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 8 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                       <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.3 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, width: 120, flexShrink: 0, fontSize: '0.7rem' }}>Full Name:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{profileToView?.displayName}</Typography>
                       </Box>
                       <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.3 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, width: 120, flexShrink: 0, fontSize: '0.7rem' }}>Father's Name:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.7rem' }}>{profileToView?.fatherName || '____________________'}</Typography>
                       </Box>
                       <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.3 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, width: 120, flexShrink: 0, fontSize: '0.7rem' }}>Mother's Name:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.7rem' }}>{profileToView?.motherName || '____________________'}</Typography>
                       </Box>
                       <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.3 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, width: 120, flexShrink: 0, fontSize: '0.7rem' }}>Date of Birth:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.7rem' }}>{profileToView?.dob ? format(new Date(profileToView.dob), 'dd MMMM yyyy') : '____________________'}</Typography>
                       </Box>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 4 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                     <Box sx={{ width: 120, height: 140, border: '1px dashed black', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 0.5 }}>
                        {profileToView?.photoURL ? (
                          <img src={profileToView.photoURL} alt="student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        ) : (
                          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'grey.600' }}>PASTE RECENT PHOTO HERE</Typography>
                        )}
                     </Box>
                  </Grid>

                  <Grid size={{ xs: 6 }}>
                     <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, width: 110, flexShrink: 0, fontSize: '0.75rem' }}>Admission No:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{profileToView?.admissionNo || profileToView?.studentId || 'N/A'}</Typography>
                     </Box>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                     <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, width: 110, flexShrink: 0, fontSize: '0.75rem' }}>Class/Grade:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{profileToView?.maktabLevel || profileToView?.grade || 'N/A'}</Typography>
                     </Box>
                  </Grid>

                  <Grid size={{ xs: 6 }}>
                     <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, width: 110, flexShrink: 0, fontSize: '0.75rem' }}>Email:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{profileToView?.email}</Typography>
                     </Box>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                     <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, width: 110, flexShrink: 0, fontSize: '0.75rem' }}>Phone/Contact:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{profileToView?.phone || '____________________'}</Typography>
                     </Box>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                     <Box sx={{ borderBottom: '1px solid #000', display: 'flex', pb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, width: 110, flexShrink: 0, fontSize: '0.75rem' }}>Address:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{profileToView?.address || '____________________________________________________________'}</Typography>
                     </Box>
                  </Grid>

                  <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                     <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, borderBottom: '2px solid black', display: 'inline-block' }}>ACADEMIC DETAILS</Typography>
                     <Box sx={{ border: '1px solid black' }}>
                        <Grid container>
                           <Grid size={{ xs: 6 }} sx={{ borderRight: '1px solid black', p: 1, bgcolor: '#f5f5f5' }}>
                              <Typography variant="caption" sx={{ fontWeight: 900 }}>Enrolled Subjects</Typography>
                           </Grid>
                           <Grid size={{ xs: 6 }} sx={{ p: 1, bgcolor: '#f5f5f5' }}>
                              <Typography variant="caption" sx={{ fontWeight: 900 }}>Previous Academic Record</Typography>
                           </Grid>
                           <Grid size={{ xs: 6 }} sx={{ borderRight: '1px solid black', p: 1, minHeight: 60 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{profileToView?.subjectsEnrolled?.join(', ') || 'N/A'}</Typography>
                           </Grid>
                           <Grid size={{ xs: 6 }} sx={{ p: 1, minHeight: 60 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>N/A</Typography>
                           </Grid>
                        </Grid>
                     </Box>
                  </Grid>

                  <Grid size={{ xs: 12 }} sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', px: 2, pb: 2 }}>
                     <Box sx={{ textAlign: 'center' }}>
                        <Box sx={{ width: 110, borderBottom: '1px solid black', mb: 0.5 }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Parent's Sign</Typography>
                     </Box>
                     <Box sx={{ textAlign: 'center' }}>
                        <Box sx={{ width: 110, borderBottom: '1px solid black', mb: 0.5 }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Incharge Sign</Typography>
                     </Box>
                     <Box sx={{ textAlign: 'center' }}>
                        <Box sx={{ width: 110, borderBottom: '1px solid black', mb: 0.5 }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Admin Sign</Typography>
                     </Box>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 4, pt: 1, borderTop: '1px dashed #ccc', textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'grey.700', fontSize: '0.65rem' }}>
                       Printed on {format(new Date(), 'PPpp')} via AIS Management System
                    </Typography>
                </Box>
             </Box>
          </Box>
        </DialogContent>
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

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmOpen} 
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, color: 'error.main' }}>
          <Trash2 size={24} />
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
            Are you sure you want to delete {userToDeleteRef?.profile.displayName}?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This action will permanently delete all records (attendance, exams, fees) from Firestore.
          </Typography>
          <Alert severity="warning" sx={{ fontWeight: 600, borderRadius: 2 }}>
            Firebase Auth account must be deleted manually from the Firebase Console to prevent the user from "coming back" via Login.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => setDeleteConfirmOpen(false)} 
            sx={{ fontWeight: 800, color: 'text.secondary', borderRadius: 3 }}
          >
            Cancel / Wapis
          </Button>
          <Button 
            onClick={confirmUserDeletion} 
            variant="contained" 
            color="error"
            sx={{ fontWeight: 800, borderRadius: 3, px: 3 }}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* System Reset Dialog */}
      <Dialog 
        open={resetConfirmOpen} 
        onClose={() => setResetConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, color: 'error.main' }}>
          <Database size={24} />
          CRITICAL: System Reset
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
            This will delete ALL users except yourself. This cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            To confirm, please type <strong>RESET ALL USERS</strong> below:
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="Type here..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => setResetConfirmOpen(false)} 
            sx={{ fontWeight: 800, color: 'text.secondary', borderRadius: 3 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmSystemReset} 
            variant="contained" 
            color="error"
            disabled={resetConfirmText !== "RESET ALL USERS"}
            sx={{ fontWeight: 800, borderRadius: 3, px: 3 }}
          >
            RESET SYSTEM
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const UserCard = React.memo(({ user, isAdmin, isSuperAdmin, onEdit, onDelete, onApproveClass, onRejectClass, onApproveMudaris, onRejectMudaris, onViewProfile }: any) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Card sx={{ 
      borderRadius: 2, 
      height: '100%', 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: 'none',
      '&:hover': { 
        transform: 'translateY(-10px)', 
        borderColor: 'primary.main',
        '& .user-actions': { opacity: 1, transform: 'translateY(0)' }
      }
    }}>
      <Box sx={{ height: 100, bgcolor: 'primary.main', position: 'relative' }}>
        <Box sx={{ position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)' }}>
          <Avatar 
            src={user.photoURL} 
            imgProps={{ referrerPolicy: 'no-referrer' }}
            sx={{ 
              width: 88, 
              height: 88, 
              border: '4px solid',
              borderColor: 'background.paper',
              boxShadow: isDark 
                ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff'
            }} 
          />
        </Box>
      </Box>
      
      <CardContent sx={{ pt: 7, textAlign: 'center', pb: 4, px: 3.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1 }}>{user.displayName}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 3, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {user.role === 'superadmin' ? (
              <><Shield size={14} className="text-warning-500" /> Super Admin</>
            ) : user.role === 'muntazim' ? (
              <><Shield size={14} className="text-primary-500" /> Muntazim</>
            ) : user.role === 'mudaris' ? (
              <><UserCheck size={14} className="text-success-500" /> Mudaris</>
            ) : user.role === 'pending_mudaris' ? (
              <><Clock size={14} className="text-warning-500" /> Pending Mudaris</>
            ) : user.role}
          </Box>
          {' • '}
          {user.role === 'student' ? user.grade : (user.assignedClasses?.join(', ') || user.subject || 'General')}
        </Typography>
        
        <Stack spacing={2} sx={{ mb: 3.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, color: 'text.secondary' }}>
            <Mail size={16} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{user.email}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, color: 'text.secondary' }}>
            <Phone size={16} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{user.phone || 'N/A'}</Typography>
          </Box>
        </Stack>
        
        <Divider sx={{ mb: 3, borderStyle: 'dashed', opacity: 0.5 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
          <Chip 
            label={user.role === 'student' ? `ID: ${user.admissionNo || user.studentId}` : `ID: ${user.teacherId}`} 
            size="small" 
            sx={{ fontWeight: 900, bgcolor: 'background.default', borderRadius: 2.5, fontSize: '0.7rem', border: 'none' }} 
          />
          <Chip 
            label={user.status} 
            size="small" 
            color={user.status === 'Active' ? 'success' : 'default'}
            sx={{ fontWeight: 900, borderRadius: 2.5, fontSize: '0.7rem', border: 'none' }} 
          />
        </Box>
      </CardContent>
      
        <Box 
          className="user-actions"
          sx={{ 
            position: 'absolute', 
            top: 16, 
            right: 16, 
            display: 'flex', 
            gap: 1.5, 
            opacity: 0, 
            transform: 'translateY(-10px)', 
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 10
          }}
        >
          {isAdmin && (
            <IconButton 
              size="small" 
              sx={{ bgcolor: 'background.paper', boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }} 
              onClick={(e) => { e.stopPropagation(); onViewProfile(); }}
            >
              <ExternalLink size={16} />
            </IconButton>
          )}
          {isAdmin && user.pendingMaktabLevel && (
            <>
              <Tooltip title="Approve Class">
                <IconButton 
                  size="small" 
                  sx={{ bgcolor: 'success.light', color: 'success.dark', '&:hover': { bgcolor: 'success.main', color: 'white' }, boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }}
                  onClick={(e) => { e.stopPropagation(); onApproveClass?.(user); }}
                >
                  <CheckCircle size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject Class">
                <IconButton 
                  size="small" 
                  sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' }, boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }}
                  onClick={(e) => { e.stopPropagation(); onRejectClass?.(user); }}
                >
                  <XCircle size={16} />
                </IconButton>
              </Tooltip>
            </>
          )}
          {isSuperAdmin && user.role === 'pending_mudaris' && (
            <>
              <Tooltip title="Approve Mudaris">
                <IconButton 
                  size="small" 
                  sx={{ bgcolor: 'success.light', color: 'success.dark', '&:hover': { bgcolor: 'success.main', color: 'white' }, boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }}
                  onClick={(e) => { e.stopPropagation(); onApproveMudaris?.(user); }}
                >
                  <UserCheck size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject Mudaris">
                <IconButton 
                  size="small" 
                  sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' }, boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }}
                  onClick={(e) => { e.stopPropagation(); onRejectMudaris?.(user); }}
                >
                  <XCircle size={16} />
                </IconButton>
              </Tooltip>
            </>
          )}
          {isSuperAdmin && (
            <>
              <IconButton size="small" sx={{ bgcolor: 'background.paper', boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }} onClick={onEdit}>
                <Edit2 size={16} />
              </IconButton>
              <IconButton size="small" sx={{ bgcolor: 'background.paper', boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }} color="error" onClick={onDelete}>
                <Trash2 size={16} />
              </IconButton>
            </>
          )}
          {!isSuperAdmin && isAdmin && user.role !== 'superadmin' && (
            <IconButton size="small" sx={{ bgcolor: 'background.paper', boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }} onClick={onEdit}>
              <Edit2 size={16} />
            </IconButton>
          )}
        </Box>
    </Card>
  );
});

const SummaryCard = React.memo(({ title, value, icon, color }: any) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const mainColor = theme.palette[color as 'primary' | 'success' | 'error' | 'warning'].main;
  
  return (
    <Card sx={{ 
      borderRadius: 2, 
      height: '100%', 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      border: 'none',
      bgcolor: 'background.paper',
      boxShadow: isDark 
        ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
        : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
      '&:hover': { 
        transform: 'translateY(-6px)', 
        boxShadow: isDark 
          ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
          : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
        borderColor: alpha(mainColor, 0.2)
      }
    }}>
      <CardContent sx={{ p: 3.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ 
            p: 1.8, 
            borderRadius: '20px', 
            bgcolor: alpha(mainColor, 0.1), 
            color: mainColor,
            boxShadow: isDark
              ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
              : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
          }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1.5 }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>{title}</Typography>
      </CardContent>
    </Card>
  );
});
