import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  Card, 
  CardContent, 
  Grid, 
  Avatar, 
  Chip, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  InputAdornment,
  Stack,
  Skeleton,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  CircularProgress,
  AppBar,
  Toolbar,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  FormControlLabel,
  Switch,
  Alert,
  Snackbar,
  useTheme,
  useMediaQuery,
  alpha,
  Container
} from '@mui/material';
import { 
  Search, 
  Plus, 
  UserPlus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Filter, 
  Download, 
  ChevronRight, 
  UserCheck, 
  Shield, 
  Mail, 
  Phone, 
  Clock, 
  X, 
  ArrowLeft, 
  Printer, 
  Grid as GridIcon, 
  List as ListIcon, 
  FileText, 
  History,
  ArrowRight,
  RotateCcw,
  User,
  IndianRupee,
  Users as UsersIcon
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  writeBatch,
  getDoc,
  orderBy
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  getAuth,
} from 'firebase/auth';
import { 
  initializeApp,
  deleteApp
} from 'firebase/app';
import { db, auth, firebaseConfig, handleFirestoreError, OperationType, smartUpdateDoc, smartDeleteDoc } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { logger } from '../lib/logger';
import { UserProfile, InstituteSettings, FeeReceipt } from '../types';
import { CLASS_LEVELS, SUBJECT_OPTIONS } from '../constants';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';
import FeeReceiptModal from '../components/FeeReceiptModal';

// Types

const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

import { cache, CACHE_KEYS } from '../lib/cache';

export default function Users() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isManagerRole = currentUser?.role === 'manager';
  const isTeacherRole = currentUser?.role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('users_search') || '');
  const [tabValue, setTabValue] = useState(() => Number(sessionStorage.getItem('users_tab')) || 0);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  
  const [statusFilter, setStatusFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  
  const [profileToView, setProfileToView] = useState<UserProfile | null>(null);
  const [openProfileDialog, setOpenProfileDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (sessionStorage.getItem('users_view') as any) || 'grid');
  const [genderFilter, setGenderFilter] = useState('All');
  const [profileReceipts, setProfileReceipts] = useState<FeeReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceipt | null>(null);
  const [openReceiptModal, setOpenReceiptModal] = useState(false);
  
  const [instituteSettings, setInstituteSettings] = useState<any>({
    instituteName: '',
    tagline: '',
    address: '',
    phone: '',
    logoUrl: ''
  });

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    role: 'student',
    status: 'Active',
    isVerified: true,
    classLevel: '',
    phone: '',
    address: '',
    admissionNo: '',
    teacherId: '',
    password: '',
    fatherName: '',
    motherName: '',
    gender: '', // Added gender field
    dob: '',
    photoURL: '',
    subjectsEnrolled: [] as string[]
  });

  const handleFormChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDeleteRef, setUserToDeleteRef] = useState<{ id: string, profile: UserProfile } | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' });
  const [stayOpen, setStayOpen] = useState(false);
  
  const [promotingUser, setPromotingUser] = useState<UserProfile | null>(null);
  const [openPromoteDialog, setOpenPromoteDialog] = useState(false);
  const [newClassLevel, setNewClassLevel] = useState('');

  const [openAdmissionForm, setOpenAdmissionForm] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkActionAnchor, setBulkActionAnchor] = useState<null | HTMLElement>(null);

  const handleBulkAction = async (action: 'verify' | 'delete' | 'print') => {
    setBulkActionAnchor(null);
    if (selectedUsers.length === 0) return;

    if (action === 'print') {
      handleBulkPrint();
      return;
    }

    if (action === 'delete') {
      if (!isSuperAdmin) {
        setSnackbar({ open: true, message: 'Only Superadmin can delete users', severity: 'error' });
        return;
      }
      setDeleteConfirmOpen(true);
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      for (const userId of selectedUsers) {
        const userRef = doc(db, 'users', userId);
        if (action === 'verify') {
          batch.update(userRef, { isVerified: true, status: 'Active' });
        }
      }
      await batch.commit();
      logger.success(`${selectedUsers.length} users updated`);
      setSelectedUsers([]);
      setSnackbar({ open: true, message: 'Bulk update successful', severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bulk-action');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setDeleteConfirmOpen(false);
    setLoading(true);
    try {
      const batch = writeBatch(db);
      for (const userId of selectedUsers) {
        batch.delete(doc(db, 'users', userId));
      }
      await batch.commit();
      setSelectedUsers([]);
      logger.success('Users deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bulk-delete');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPrint = () => {
    const selectedDocs = users.filter(u => selectedUsers.includes(u.uid));
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Admission Forms - Wali Ul Asr</title>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: #fff; direction: rtl; }
            .admission-container { 
              width: 210mm; 
              height: 297mm; 
              padding: 15mm; 
              box-sizing: border-box; 
              position: relative; 
              overflow: hidden;
              page-break-after: always;
              border: 0.5px solid #eee;
              display: flex;
              flex-direction: column;
            }
            .urdu-text { font-family: 'Noto Nastaliq Urdu', serif; }
            .header { text-align: center; margin-bottom: 5mm; }
            .bismillah { font-size: 18pt; margin-bottom: 2mm; }
            .logo { width: 35mm; height: 35mm; object-fit: contain; margin-bottom: 2mm; }
            .institute-name { font-size: 32pt; font-weight: 900; color: #0d9488; margin: 0; line-height: 1.1; }
            .tagline { font-size: 14pt; font-weight: 700; color: #666; margin-top: 1mm; }
            .form-title { font-size: 58pt; font-weight: 950; text-align: center; margin: 10mm 0; line-height: 0.8; }
            
            .top-data { display: flex; justify-content: space-between; border-bottom: 3px solid #0d9488; padding-bottom: 2mm; margin-bottom: 15mm; }
            .data-item { font-size: 16pt; font-weight: 900; }
            
            .form-row { display: flex; align-items: center; gap: 8mm; margin-bottom: 12mm; }
            .field-label { font-size: 24pt; font-weight: 900; min-width: 35mm; white-space: nowrap; }
            .input-box { border: 2.5px solid #000; height: 14mm; border-radius: 8px; position: relative; display: flex; align-items: center; padding: 0 4mm; font-size: 20pt; font-weight: 800; min-width: 0; }
            .box-sub-label { position: absolute; top: -10mm; left: 50%; transform: translateX(-50%); font-size: 11pt; color: #444; white-space: nowrap; }
            
            .instructions-box { flex: 1; border: 3px solid #ef4444; border-radius: 12px; padding: 4mm; position: relative; margin-top: 8mm; }
            .instr-title { position: absolute; top: -5.5mm; right: 10mm; background: #fff; padding: 0 3mm; color: #ef4444; font-weight: 900; font-size: 14pt; border: 2px solid #ef4444; border-radius: 20px; }
            .instr-content { color: #ef4444; font-size: 11.5pt; font-weight: 700; line-height: 1.6; margin: 0; list-style-type: '• '; padding-right: 2mm; }
            
            .photo-box { width: 45mm; height: 55mm; border: 2.5px solid #000; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16pt; flex-shrink: 0; overflow: hidden; background: #fafafa; }
            .photo-box img { width: 100%; height: 100%; object-fit: cover; }
            
            .footer-sigs { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15mm; border-top: 1px solid #eee; pt: 8mm; }
            .sig-item { text-align: center; font-size: 14pt; font-weight: 900; border-top: 2px solid #000; width: 50mm; padding-top: 2mm; }
            .sig-office { border: none; color: #0d9488; }
            
            .brand-strip { height: 2mm; background: linear-gradient(90deg, #0d9488, #fbbf24); margin-top: auto; border-radius: 10px; }
            .footer-bottom { display: flex; justify-content: center; gap: 10mm; font-size: 12pt; font-weight: 800; padding: 4mm 0; font-family: 'Inter', sans-serif; border-bottom: none; }
            .qr-container { position: absolute; bottom: 15mm; left: 15mm; opacity: 0.8; }
            .qr-code { width: 25mm; height: 25mm; }
            
            .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 140mm; opacity: 0.04; z-index: -1; pointer-events: none; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body class="urdu-text">
          ${selectedDocs.map(u => {
            const dob = u.dob ? new Date(u.dob) : null;
            return `
              <div class="admission-container">
                 <img class="watermark" src="${instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'}">
                 
                 <div class="header">
                    <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                    <img class="logo" src="${instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'}">
                    <h1 class="institute-name">مکتب ولی العصر</h1>
                    <div class="tagline">زیر نگران ادارہ ولی العصر چھترگام</div>
                 </div>
                 
                 <div class="form-title">تحریرِ داخلہ</div>
                 
                 <div class="top-data">
                    <div class="data-item">داخلہ نمبر: <span style="font-family: 'Inter', sans-serif; font-size: 18pt;">${u.admissionNo || u.uid.slice(0,8)}</span></div>
                    <div class="data-item">جماعت / درجہ: <span style="border-bottom: 2px dotted #000; min-width: 30mm; display: inline-block; text-align: center;">${u.classLevel || ''}</span></div>
                 </div>
                 
                 <div class="form-row">
                    <span class="field-label">نام :</span>
                    <div style="display: flex; gap: 5mm; flex: 1;">
                      <div class="input-box" style="flex: 1;">
                        <span class="box-sub-label">ابتدائی</span>
                        ${(u.displayName || '').split(' ')[0]}
                      </div>
                      <div class="input-box" style="flex: 1;">
                        <span class="box-sub-label">درمیانی</span>
                        ${(u.displayName || '').split(' ').length > 2 ? (u.displayName || '').split(' ').slice(1, -1).join(' ') : ''}
                      </div>
                      <div class="input-box" style="flex: 1;">
                        <span class="box-sub-label">آخری</span>
                        ${(u.displayName || '').split(' ').length > 1 ? (u.displayName || '').split(' ').pop() : ''}
                      </div>
                    </div>
                 </div>
                 
                 <div class="form-row">
                    <span class="field-label">ولدیت :</span>
                    <div class="input-box" style="flex: 1;">
                      <span class="box-sub-label">والد یا والدہ یا سرپرست کا پورا نام</span>
                      ${u.fatherName || ''}
                    </div>
                 </div>
                 
                 <div class="form-row">
                    <span class="field-label">سکونت :</span>
                    <div class="input-box" style="flex: 2.5;">
                      <span class="box-sub-label">اپنے علاقے کے نام کے ساتھ شہر کا نام</span>
                      ${u.address || ''}
                    </div>
                    <span class="field-label" style="min-width: fit-content;">ضلع :</span>
                    <div class="input-box" style="flex: 1;">${u.address?.toLowerCase().includes('srinagar') ? 'سرینگر' : ''}</div>
                 </div>
                 
                 <div class="form-row">
                    <span class="field-label">تاریخ پیدائش :</span>
                    <div style="display: flex; gap: 3mm; flex: 1.2;">
                       <div class="input-box" style="flex: 1; justify-content: center;">
                         <span class="box-sub-label">دن</span>
                         <span style="font-family: 'Inter', sans-serif;">${dob ? dob.getDate() : ''}</span>
                       </div>
                       <div class="input-box" style="flex: 1.2; justify-content: center;">
                         <span class="box-sub-label">مہینہ</span>
                         <span style="font-family: 'Inter', sans-serif;">${dob ? (dob.getMonth() + 1) : ''}</span>
                       </div>
                       <div class="input-box" style="flex: 1.5; justify-content: center;">
                         <span class="box-sub-label">سال</span>
                         <span style="font-family: 'Inter', sans-serif;">${dob ? dob.getFullYear() : ''}</span>
                       </div>
                    </div>
                    <span class="field-label" style="min-width: fit-content; margin: 0 5mm;">سن :</span>
                    <div style="display: flex; gap: 8mm;">
                      <div style="display: flex; align-items: center; gap: 3mm;">
                        <div style="width: 7mm; height: 7mm; border: 2.5px solid #000; border-radius: 50%; background: ${u.gender === 'male' ? '#000' : 'transparent'};"></div>
                        <span style="font-size: 22pt; font-weight: 700;">بچہ</span>
                      </div>
                      <div style="display: flex; align-items: center; gap: 3mm;">
                        <div style="width: 7mm; height: 7mm; border: 2.5px solid #000; border-radius: 50%; background: ${u.gender === 'female' ? '#000' : 'transparent'};"></div>
                        <span style="font-size: 22pt; font-weight: 700;">بچی</span>
                      </div>
                    </div>
                 </div>
                 
                 <div class="form-row">
                    <span class="field-label">رابطہ نمبر :</span>
                    <div class="input-box" style="flex: 1;">
                      <span class="box-sub-label">واٹس ایپ یا جس پر رابطہ کیا جا سکے</span>
                      <span style="font-family: 'Inter', sans-serif;">${u.phone || ''}</span>
                    </div>
                 </div>
                 
                 <div style="display: flex; gap: 15mm; margin-top: 15mm; align-items: flex-start; justify-content: space-between;">
                    <div class="instructions-box">
                      <div class="instr-title">ضروری ہدایات</div>
                      <ul class="instr-content">
                        <li>والدین اس بات کی تصدیق کرتے ہیں کہ انہوں نے فارم میں دی گئی تمام معلومات درست طور پر درج کی ہیں۔</li>
                        <li>داخلے کے لیے بچے کی عمر کم از کم 5 سال ہونی چاہیے۔</li>
                        <li>ادارے کی جانب سے دی گئی ہر اہم اطلاع پر مناسب توجہ دی جائے گی۔</li>
                        <li>والدین نے تمام ہدایات کو بغور پڑھا ہے اور فارم مکمل دیانت داری سے پُر کیا ہے۔</li>
                      </ul>
                    </div>
                    <div class="photo-box">
                      ${u.photoURL ? `<img src="${u.photoURL}">` : '<div style="line-height:1">تصویر<br>4*4</div>'}
                    </div>
                 </div>
                 
                 <div class="footer-sigs">
                    <div class="sig-item">دستخط والدین</div>
                    <div class="sig-item">دستخط مدرس</div>
                    <div class="sig-item sig-office">دفتر ادارہ ولی العصر</div>
                 </div>
                 
                 <div class="brand-strip"></div>
                 
                 <div class="footer-bottom">
                    <div class="footer-phone"><span>📞</span> +91 9055499359</div>
                    <div class="footer-phone"><span>📞</span> +91 9797100753</div>
                    <div class="footer-phone"><span>📞</span> +91 7006182924</div>
                 </div>
                 
                 <div class="qr-container">
                   <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://${window.location.host}/verify/profile/${u.uid}">
                 </div>
              </div>
            `;
          }).join('')}
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    sessionStorage.setItem('users_search', searchQuery);
    sessionStorage.setItem('users_tab', tabValue.toString());
    sessionStorage.setItem('users_view', viewMode);
  }, [searchQuery, tabValue, viewMode]);

  useEffect(() => {
    // Hydrate from cache first
    const hydrate = async () => {
      const cached = await cache.get<UserProfile[]>(CACHE_KEYS.USERS);
      if (cached) {
        setUsers(cached);
        setLoading(false);
      }
    };
    hydrate();

    let q;
    if (isStaff) {
      q = query(collection(db, 'users'));
    } else {
      q = query(
        collection(db, 'users'),
        where('role', 'in', ['teacher', 'manager', 'super_admin', 'superadmin'])
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allUsers = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[];
      allUsers.sort((a, b) => {
        const nameA = (a.displayName || '').toLowerCase();
        const nameB = (b.displayName || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
      setUsers(allUsers);
      cache.set(CACHE_KEYS.USERS, allUsers);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isSuperAdmin, isManagerRole, isTeacherRole, currentUser?.uid]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (settingsDoc.exists()) {
          setInstituteSettings(settingsDoc.data() as InstituteSettings);
        }
      } catch (error) { /* silent fail */ }
    };
    fetchSettings();
  }, []);

  const handlePrint = () => {
    setTimeout(() => { window.print(); }, 100);
  };

  const UserActionMenu = ({ user: targetUser }: { user: any }) => {
    const isTargetSuperAdmin = targetUser.role === 'superadmin';
    const canManageUser = isSuperAdmin || (isAdmin && !isTargetSuperAdmin);

    const items: ActionMenuItem[] = [
      { 
        label: 'Admission Form', 
        icon: <FileText size={16} />, 
        onClick: () => { setProfileToView(targetUser); setOpenAdmissionForm(true); } 
      },
      { 
        label: 'Edit Info', 
        icon: <Edit2 size={16} />, 
        onClick: () => { 
          setEditingUser(targetUser); 
          setFormData({
            ...targetUser,
            subjectsEnrolled: targetUser.subjectsEnrolled || [],
            assignedClasses: targetUser.assignedClasses || [],
            photoURL: targetUser.photoURL || ''
          } as any); 
          setOpenDialog(true); 
        },
        disabled: !canManageUser
      },
      { 
        label: 'Promote', 
        icon: <ArrowRight size={16} />, 
        onClick: () => { setPromotingUser(targetUser); setOpenPromoteDialog(true); },
        disabled: !(canManageUser && targetUser.role === 'student' && targetUser.classLevel)
      }
    ];

    // Conditionally add actions based on tab/status
    if (tabValue === 2) {
      items.push({ 
        label: 'Verify Member', 
        icon: <UserCheck size={16} />, 
        color: 'primary.main', 
        onClick: async () => {
           try {
             const updateData: any = { isVerified: true, status: 'Active' };
             if (targetUser.role === 'student' && !targetUser.admissionNo) {
               const year = format(new Date(), 'yyyy');
               updateData.admissionNo = `ADM-${year}-${(targetUser.displayName||'STU').slice(0,3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
             }
             await smartUpdateDoc(doc(db, 'users', targetUser.uid), updateData);
             setSnackbar({ open: true, message: `${targetUser.displayName} verified successfully`, severity: 'success' });
           } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `users/${targetUser.uid}`); }
        },
        disabled: !canManageUser
      });
    }

    if (tabValue === 3) {
      items.push({ 
        label: 'Restore Member', 
        icon: <RotateCcw size={16} />, 
        color: 'success.main', 
        onClick: () => handleRestore(targetUser),
        disabled: !canManageUser
      });
      if (isSuperAdmin) {
        items.push({ 
          label: 'Delete Permanently', 
          icon: <Trash2 size={16} />, 
          color: 'error.main', 
          onClick: () => handleDelete(targetUser.uid, targetUser),
          disabled: !isSuperAdmin
        });
      }
    } else {
      items.push({ 
        label: 'Archive Member', 
        icon: <Trash2 size={16} />, 
        color: 'error.main', 
        onClick: () => handleArchive(targetUser),
        disabled: !canManageUser
      });
    }

    if (targetUser.role === 'pending_teacher' && isSuperAdmin) {
      items.push({ 
        label: 'Approve Teacher', 
        icon: <UserCheck size={16} />, 
        color: 'success.main', 
        onClick: async () => {
          try { await smartUpdateDoc(doc(db, 'users', targetUser.uid), { role: 'teacher', status: 'Active' }); }
          catch (e) { handleFirestoreError(e, OperationType.UPDATE, `users/${targetUser.uid}`); }
        },
        disabled: !isSuperAdmin
      });
    }

    items.push({ divider: true, label: '', icon: null, onClick: () => {} });
    
    return <ActionMenu items={items} />;
  };

  const handleSave = async () => {
    try {
      let finalFormData = { ...formData };
      if (editingUser) {
        const { password: _, ...dataToUpdate } = finalFormData as any;
        const updatedData = { ...dataToUpdate, updatedAt: Date.now() };
        
        // Optimistic UI update
        setUsers(prev => prev.map(u => u.uid === editingUser.uid ? { ...u, ...updatedData } : u));
        
        await smartUpdateDoc(doc(db, 'users', editingUser.uid), updatedData);
      } else {
        setLoading(true);
        let uid = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const userData = {
          ...finalFormData,
          uid,
          id: uid, 
          instituteId: instituteSettings.id || 'default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          photoURL: finalFormData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalFormData.displayName)}&background=random&color=fff`,
        };
        const { password: _, ...dataToStore } = userData as any;
        
        // Optimistic UI update for new user
        if (tabValue === 0 && dataToStore.role === 'student') {
           setUsers(prev => [...prev, dataToStore].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
        }

        await setDoc(doc(db, 'users', uid), dataToStore);
      }

      setSnackbar({ open: true, message: `User ${editingUser ? 'updated' : 'registered'} successfully`, severity: 'success' });
      setOpenDialog(false);
      setEditingUser(null);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save user details.', severity: 'error' });
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally { setLoading(false); }
  };

  const handleArchive = async (user: UserProfile) => {
    try {
      await smartUpdateDoc(doc(db, 'users', user.uid), {
        status: 'Archived',
        isVerified: false,
        archivedAt: serverTimestamp(),
        archivedBy: currentUser?.displayName || 'Admin'
      });
      setSnackbar({ open: true, message: `${user.displayName} archived successfully`, severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleRestore = async (user: UserProfile) => {
    try {
      await smartUpdateDoc(doc(db, 'users', user.uid), {
        status: 'Active',
        isVerified: true
      });
      setSnackbar({ open: true, message: `${user.displayName} restored successfully`, severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleDelete = async (id: string, userToDelete: UserProfile) => {
    if (!isSuperAdmin) return;
    setUserToDeleteRef({ id, profile: userToDelete });
    setDeleteConfirmOpen(true);
  };

  const confirmUserDeletion = async () => {
    if (!userToDeleteRef || !isSuperAdmin) return;
    const { id, profile: userToDelete } = userToDeleteRef;
    setDeleteConfirmOpen(false);
    setLoading(true);
    try {
      if (userToDelete.status === 'Archived' || tabValue === 3) {
        // PERMANENT PURGE FROM DATABASE
        await deleteDoc(doc(db, 'users', id));
        setSnackbar({ open: true, message: `${userToDelete.displayName} has been vanished from database`, severity: 'success' });
      } else {
        // MOVE TO ARCHIVE
        await smartUpdateDoc(doc(db, 'users', id), { 
          status: 'Archived',
          isVerified: false,
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setSnackbar({ open: true, message: `${userToDelete.displayName} moved to archive`, severity: 'success' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    } finally { 
      setUserToDeleteRef(null); 
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (u.email === 'zeeshanmaqbool200@gmail.com') return false;
    const s = searchQuery.toLowerCase();
    const matchesSearch = u.displayName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    if (!matchesSearch) return false;

    const matchesGender = genderFilter === 'All' || u.gender === genderFilter;
    if (!matchesGender) return false;

    if (tabValue === 2) return !u.isVerified || u.role === 'pending_teacher';
    if (tabValue === 3) return u.status === 'Archived';
    
    if (u.status === 'Archived') return false;
    if (tabValue === 0) return u.role === 'student';
    if (tabValue === 1) return ['teacher', 'manager', 'superadmin'].includes(u.role);
    return true;
  });

  const handleOpenProfile = async (user: UserProfile) => {
    setProfileToView(user);
    setOpenProfileDialog(true);
    setReceiptsLoading(true);
    try {
      const q = query(
        collection(db, 'receipts'),
        where('studentId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const receipts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as FeeReceipt[];
      setProfileReceipts(receipts);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setReceiptsLoading(false);
    }
  };

  if (loading) return <Box sx={{ p: 4 }}><Skeleton variant="rectangular" width="100%" height={500} /></Box>;

  return (
    <Box sx={{ pb: 8 }}>
      <Box sx={{ mb: 2 }}>
        <Button variant="text" startIcon={<ArrowLeft />} onClick={() => navigate(-1)} sx={{ fontWeight: 800 }}>Back</Button>
      </Box>

      <Stack spacing={3}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'center' }, 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 4,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box>
            <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 900, color: 'primary.main', mb: 0.5 }}>Users Directory</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>Manage students, staff and administrators</Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
            <Stack direction="row" spacing={1}>
              <IconButton 
                size="small"
                color={viewMode === 'grid' ? 'primary' : 'inherit'} 
                onClick={() => setViewMode('grid')}
                sx={{ bgcolor: viewMode === 'grid' ? alpha(theme.palette.primary.main, 0.1) : 'background.paper', borderRadius: 2 }}
              >
                <GridIcon size={isMobile ? 18 : 20} />
              </IconButton>
              <IconButton 
                size="small"
                color={viewMode === 'list' ? 'primary' : 'inherit'} 
                onClick={() => setViewMode('list')}
                sx={{ bgcolor: viewMode === 'list' ? alpha(theme.palette.primary.main, 0.1) : 'background.paper', borderRadius: 2 }}
              >
                <ListIcon size={isMobile ? 18 : 20} />
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flex: { xs: 1, sm: 'none' }, justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
              {selectedUsers.length > 0 && (
                <Button 
                  variant="contained" 
                  color="info"
                  size={isMobile ? "small" : "medium"}
                  onClick={() => handleBulkAction('print')} 
                  sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none' }}
                >
                  Print ({selectedUsers.length})
                </Button>
              )}
              <Button 
                variant="outlined" 
                size={isMobile ? "small" : "medium"}
                startIcon={<Download size={16} />} 
                onClick={() => exportToCSV(filteredUsers, 'Users')} 
                sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none' }}
              >
                Export
              </Button>
              <Button 
                variant="contained" 
                size={isMobile ? "small" : "medium"}
                startIcon={<Plus size={16} />} 
                onClick={() => { setEditingUser(null); setOpenDialog(true); }} 
                sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none' }}
              >
                {tabValue === 1 ? 'Add Staff' : 'Add Student'}
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          flexWrap: 'wrap', 
          alignItems: 'center',
          mb: 3 
        }}>
          <motion.div
            animate={{ width: isSearchExpanded || searchQuery ? (isMobile ? '100%' : 400) : 44 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <TextField 
              size="small" 
              placeholder="Search users..." 
              value={searchQuery} 
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => !searchQuery && setIsSearchExpanded(false)}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{ 
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
                sx: { 
                  borderRadius: 10,
                  bgcolor: 'background.paper',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }
              }}
              sx={{ width: '100%' }}
            />
          </motion.div>

          <Tabs 
            value={tabValue} 
            onChange={(_, v) => {
              setTabValue(v);
              setSelectedUsers([]);
              setSelectionMode(false);
            }} 
            variant="scrollable"
            scrollButtons="auto"
            sx={{ 
              flex: 1,
              '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' }
            }}
          >
            <Tab label="Students" />
            <Tab label="Staff" />
            <Tab label="Pending" />
            {isSuperAdmin && <Tab label="Archive" />}
          </Tabs>

          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select 
                value={genderFilter} 
                onChange={(e) => setGenderFilter(e.target.value)}
                displayEmpty
                sx={{ 
                  borderRadius: 10, 
                  bgcolor: 'background.paper',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  fontSize: '0.85rem',
                  fontWeight: 700
                }}
              >
                <MenuItem value="All">All Genders</MenuItem>
                <MenuItem value="male">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <User size={14} color="#007AFF" />
                    <span>Male</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="female">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <User size={14} color="#FF2D55" />
                    <span>Female</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title="Toggle Selection Mode">
              <IconButton 
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedUsers([]);
                }}
                color={selectionMode ? "primary" : "default"}
                sx={{ bgcolor: selectionMode ? alpha(theme.palette.primary.main, 0.1) : 'background.paper', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
              >
                <UserCheck size={20} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {viewMode === 'grid' ? (
          <Grid container spacing={3}>
            {filteredUsers.map(u => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={u.uid}>
                <UserCard 
                  user={u} 
                  actionMenu={<UserActionMenu user={u} />}
                  onOpenProfile={handleOpenProfile}
                  onSelect={(selected: boolean) => {
                    if (selected) setSelectedUsers(prev => [...prev, u.uid]);
                    else setSelectedUsers(prev => prev.filter(id => id !== u.uid));
                  }}
                  isSelected={selectedUsers.includes(u.uid)}
                  selectionMode={selectionMode}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 6, boxShadow: theme.shadows[2], overflow: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
            <Table sx={{ minWidth: 800, borderCollapse: 'separate', borderSpacing: 0 }}>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  {selectionMode && (
                    <TableCell padding="checkbox" sx={{ borderBottom: '2px solid', borderColor: 'divider' }}>
                      <Checkbox
                        checked={selectedUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                        indeterminate={selectedUsers.length > 0 && selectedUsers.length < filteredUsers.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers(filteredUsers.map(u => u.uid));
                          else setSelectedUsers([]);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 800, borderBottom: '2px solid', borderColor: 'divider', py: 2, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Member</TableCell>
                  <TableCell sx={{ fontWeight: 800, borderBottom: '2px solid', borderColor: 'divider', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Admission No</TableCell>
                  <TableCell sx={{ fontWeight: 800, borderBottom: '2px solid', borderColor: 'divider', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Role / Level</TableCell>
                  <TableCell sx={{ fontWeight: 800, borderBottom: '2px solid', borderColor: 'divider', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, borderBottom: '2px solid', borderColor: 'divider', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Phone</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, borderBottom: '2px solid', borderColor: 'divider', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow 
                    key={u.uid} 
                    hover 
                    onClick={() => handleOpenProfile(u)} 
                    sx={{ cursor: 'pointer', transition: 'background 0.2s', '&:selected': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                    selected={selectedUsers.includes(u.uid)}
                  >
                    {selectionMode && (
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedUsers.includes(u.uid)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUsers(prev => [...prev, u.uid]);
                            else setSelectedUsers(prev => prev.filter(id => id !== u.uid));
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={u.photoURL} imgProps={{ loading: 'lazy' }} sx={{ width: 42, height: 42, border: '2px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }} />
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{u.displayName}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{u.email}</Typography>
                          <Typography variant="caption" sx={{ display: 'block', color: u.gender === 'male' ? '#007AFF' : u.gender === 'female' ? '#FF2D55' : 'text.secondary', fontWeight: 800, textTransform: 'capitalize', mt: 0.2 }}>
                            {u.gender || 'N/A'}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', color: 'primary.main' }}>{u.admissionNo || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Chip label={u.role} size="small" sx={{ fontWeight: 800, textTransform: 'uppercase', width: 'fit-content', px: 1, height: 20, fontSize: '0.65rem' }} />
                        {u.classLevel && (
                          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {u.classLevel}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={u.status || (u.isVerified ? 'Active' : 'Pending')} 
                        color={u.status === 'Active' || (u.status !== 'Archived' && u.isVerified) ? 'success' : 'warning'}
                        size="small"
                        variant={u.status === 'Active' ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, color: 'text.secondary' }}>{u.phone || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <UserActionMenu user={u} />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                      <Box sx={{ opacity: 0.5 }}>
                        <UsersIcon size={48} style={{ marginBottom: 16 }} />
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>No users found matching your search</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>

      {/* Profile Dialog */}
      <Dialog 
        fullScreen 
        open={openProfileDialog} 
        onClose={() => setOpenProfileDialog(false)}
      >
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'white', color: 'black', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenProfileDialog(false)}><ArrowLeft /></IconButton>
            <Typography sx={{ ml: 2, flex: 1, fontWeight: 900, fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>
              Student Profile
            </Typography>
            <Stack direction="row" spacing={1}>
               <Button 
                variant="outlined" 
                startIcon={<Printer />} 
                onClick={() => { setOpenAdmissionForm(true); }}
                sx={{ borderRadius: 10, fontWeight: 700 }}
              >
                Admission Form
              </Button>
              <Button 
                variant="contained" 
                startIcon={<Download />} 
                onClick={() => profileToView && exportToCSV([profileToView], `Profile_${profileToView.displayName}`)}
                sx={{ borderRadius: 10, fontWeight: 700 }}
              >
                Download ID
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ bgcolor: '#f2f2f7', p: 0 }}>
           {profileToView && (
             <Box sx={{ pb: 10 }}>
                {/* Hero Header */}
                <Box sx={{ 
                  height: 200, 
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  position: 'relative',
                  mb: -10
                }} />
                
                <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, px: { xs: 2, md: 4 } }}>
                  <Grid container spacing={4}>
                    {/* Left Panel */}
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Card className="ios-card" sx={{ p: 4, textAlign: 'center' }}>
                        <Avatar 
                          src={profileToView.photoURL} 
                          sx={{ width: 160, height: 160, mx: 'auto', mb: 3, border: '6px solid white', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }} 
                        />
                        <Typography variant="h4" sx={{ fontWeight: 950, mb: 1, letterSpacing: -1, fontFamily: 'var(--font-heading)' }}>
                          {profileToView.displayName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, mb: 3 }}>
                          {profileToView.email}
                        </Typography>
                        
                        <Stack spacing={1} direction="row" justifyContent="center">
                          <Chip label={profileToView.classLevel || 'Unassigned'} size="small" sx={{ fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                          <Chip label={profileToView.status || 'Active'} size="small" variant="outlined" sx={{ fontWeight: 800 }} />
                        </Stack>

                        <Divider sx={{ my: 4 }} />

                        <Box sx={{ textAlign: 'left', mb: 4 }}>
                           <Typography className="ui-label" sx={{ mb: 1.5, display: 'block' }}>CONTACT DETAILS</Typography>
                           <Stack spacing={2}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Phone size={18} className="text-zinc-400" />
                                <Typography sx={{ fontWeight: 700 }}>{profileToView.phone || 'No phone'}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Mail size={18} className="text-zinc-400" />
                                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{profileToView.email}</Typography>
                              </Box>
                           </Stack>
                        </Box>

                        <Box sx={{ p: 3, bgcolor: '#f2f2f7', borderRadius: 5 }}>
                           <Typography className="ui-label" sx={{ mb: 1.5, display: 'block', textAlign: 'center' }}>PROFILE VERIFICATON</Typography>
                           <Box sx={{ p: 1, bgcolor: 'white', display: 'inline-block', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <QRCodeSVG value={`${window.location.origin}/verify/profile/${profileToView.uid}`} size={140} />
                           </Box>
                        </Box>
                      </Card>
                    </Grid>

                    {/* Right Panel */}
                    <Grid size={{ xs: 12, md: 8 }}>
                       <Stack spacing={4}>
                         {/* Basic Info */}
                         <Card className="ios-card" sx={{ p: 4 }}>
                           <Typography variant="h6" sx={{ fontWeight: 900, mb: 3, fontFamily: 'var(--font-heading)' }}>Parental Information</Typography>
                           <Grid container spacing={3}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography className="ui-label">FATHER NAME</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{profileToView.fatherName || 'N/A'}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography className="ui-label">MOTHER NAME</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{profileToView.motherName || 'N/A'}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography className="ui-label">DATE OF BIRTH</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                  {profileToView.dob ? format(new Date(profileToView.dob), 'dd MM yyyy') : 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography className="ui-label">GENDER</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', textTransform: 'capitalize' }}>{profileToView.gender || 'N/A'}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <Typography className="ui-label">HOME ADDRESS</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{profileToView.address || 'No address provided'}</Typography>
                              </Grid>
                           </Grid>
                         </Card>

                         {/* Financial History Section */}
                         <Card className="ios-card" sx={{ p: 4 }}>
                           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                              <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-heading)' }}>Fee History</Typography>
                              <Button 
                                variant="text" 
                                size="small" 
                                endIcon={<ChevronRight size={16} />} 
                                onClick={() => navigate(`/fees?studentId=${profileToView.uid}`)}
                                sx={{ fontWeight: 800 }}
                              >
                                View All
                              </Button>
                           </Box>

                           {receiptsLoading ? (
                             <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
                           ) : profileReceipts.length === 0 ? (
                             <Box sx={{ py: 4, textAlign: 'center', bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 4 }}>
                               <Typography sx={{ fontWeight: 600, color: 'text.secondary' }}>No receipts found for this student.</Typography>
                             </Box>
                           ) : (
                             <Stack spacing={2}>
                               {profileReceipts.slice(0, 5).map((r) => (
                                 <Box 
                                    key={r.id}
                                    onClick={() => { setSelectedReceipt(r); setOpenReceiptModal(true); }}
                                    sx={{ 
                                      p: 2, 
                                      borderRadius: 3, 
                                      border: '1px solid', 
                                      borderColor: 'divider',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      '&:hover': {
                                        bgcolor: 'background.paper',
                                        borderColor: 'primary.main',
                                        transform: 'scale(1.01)'
                                      }
                                    }}
                                 >
                                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                      <Box sx={{ p: 1, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2, color: 'success.main' }}>
                                        <IndianRupee size={20} />
                                      </Box>
                                      <Box>
                                        <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>{r.feeHead}</Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                          {format(new Date(r.date), 'dd MM yyyy')} • {r.receiptNo}
                                        </Typography>
                                      </Box>
                                   </Box>
                                   <Box sx={{ textAlign: 'right' }}>
                                      <Typography variant="h6" sx={{ fontWeight: 900, color: 'primary.main' }}>₹{r.amount}</Typography>
                                      <Chip label={r.status} size="small" color={r.status === 'approved' ? 'success' : 'warning'} sx={{ fontWeight: 800, height: 20, fontSize: '0.6rem' }} />
                                   </Box>
                                 </Box>
                               ))}
                             </Stack>
                           )}
                         </Card>

                         {/* Academic Information */}
                         <Card className="ios-card" sx={{ p: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, mb: 3, fontFamily: 'var(--font-heading)' }}>Academic Details</Typography>
                            <Grid container spacing={3}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography className="ui-label">ADMISSION NO</Typography>
                                <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'primary.main' }}>{profileToView.admissionNo || 'N/A'}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography className="ui-label">ENROLLED SINCE</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{profileToView.createdAt ? format(profileToView.createdAt, 'dd MM yyyy') : 'N/A'}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <Typography className="ui-label">ENROLLED SUBJECTS</Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                                  {profileToView.subjectsEnrolled?.map((s) => (
                                    <Chip key={s} label={s} size="small" variant="outlined" sx={{ fontWeight: 700, borderRadius: 2 }} />
                                  )) || <Typography variant="body2" sx={{ fontWeight: 600 }}>No subjects listed</Typography>}
                                </Stack>
                              </Grid>
                            </Grid>
                         </Card>
                       </Stack>
                    </Grid>
                  </Grid>
                </Container>
             </Box>
           )}
        </DialogContent>
      </Dialog>

      {/* Shared Receipt Modal */}
      {selectedReceipt && (
        <FeeReceiptModal
          open={openReceiptModal}
          onClose={() => setOpenReceiptModal(false)}
          receipt={selectedReceipt}
          settings={instituteSettings}
        />
      )}

      {/* Admission Form Dialog */}
      <Dialog 
        fullScreen 
        open={openAdmissionForm} 
        onClose={() => setOpenAdmissionForm(false)}
        PaperProps={{ sx: { bgcolor: '#eee' } }}
      >
        <AppBar sx={{ position: 'relative', bgcolor: 'white', color: 'black' }} elevation={0} className="no-print">
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => setOpenAdmissionForm(false)}><ArrowLeft /></IconButton>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Admission Form</Typography>
            </Box>
            <Button variant="contained" startIcon={<Printer />} onClick={handlePrint}>Print Form</Button>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: { xs: 0, md: 4 }, display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
           <Paper className="admission-page" sx={{ 
             width: '210mm', 
             minHeight: '297mm', 
             p: { xs: 2, md: 8 }, 
             bgcolor: 'white', 
             color: 'black', 
             position: 'relative',
             direction: 'rtl',
             fontFamily: '"Noto Nastaliq Urdu", serif',
             display: 'flex',
             flexDirection: 'column',
             boxShadow: 3
           }}>
              <Box sx={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)', 
                width: '150mm', 
                opacity: 0.04, 
                zIndex: 0, 
                pointerEvents: 'none' 
              }}>
                <img src={instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'} style={{ width: '100%' }} />
              </Box>

              <Box sx={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ textAlign: 'center', fontSize: '1.8rem', mb: 1 }}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Typography>

                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <img src={instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'} style={{ width: 100, height: 100, objectFit: 'contain' }} />
                  <Typography variant="h2" sx={{ fontWeight: 900, color: 'success.main', mt: 1, fontSize: '3rem' }}>مکتب ولی العصر</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', mt: 0.5 }}>زیر نگران ادارہ ولی العصر چھترگام</Typography>
                </Box>

                <Typography sx={{ textAlign: 'center', fontSize: '5rem', fontWeight: 950, my: 4, lineHeight: 0.8 }}>تحریرِ داخلہ</Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 6, borderBottom: '3px solid', borderColor: 'success.main', pb: 1 }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 900 }}>داخلہ نمبر: <span style={{ fontFamily: 'Inter, sans-serif' }}>{profileToView?.admissionNo || profileToView?.uid.slice(0,8)}</span></Typography>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 900 }}>جماعت / درجہ: <span style={{ borderBottom: '2px dotted black', minWidth: 100, display: 'inline-block', textAlign: 'center' }}>{profileToView?.classLevel || ''}</span></Typography>
                </Box>

                <Stack spacing={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 900, minWidth: 120 }}>نام :</Typography>
                    <Box sx={{ display: 'flex', flex: 1, gap: 4 }}>
                      <Box sx={{ flex: 1, height: 50, border: '2px solid black', borderRadius: 2, display: 'flex', alignItems: 'center', px: 2 }}>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>{(profileToView?.displayName || '').split(' ')[0]}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, height: 50, border: '2px solid black', borderRadius: 2, display: 'flex', alignItems: 'center', px: 2 }}>
                         <Typography variant="h5" sx={{ fontWeight: 800 }}>{(profileToView?.displayName || '').split(' ').slice(1).join(' ')}</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 900, minWidth: 120 }}>ولدیت :</Typography>
                    <Box sx={{ flex: 1, height: 50, border: '2px solid black', borderRadius: 2, display: 'flex', alignItems: 'center', px: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>{profileToView?.fatherName}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 900, minWidth: 120 }}>سکونت :</Typography>
                    <Box sx={{ flex: 1, height: 50, border: '2px solid black', borderRadius: 2, display: 'flex', alignItems: 'center', px: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>{profileToView?.address}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 900, minWidth: 120 }}>تاریخ پیدائش :</Typography>
                    <Box sx={{ flex: 1, height: 50, border: '2px solid black', borderRadius: 2, display: 'flex', alignItems: 'center', px: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>{profileToView?.dob || ''}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 900, minWidth: 120 }}>رابطہ نمبر :</Typography>
                    <Box sx={{ flex: 1, height: 50, border: '2px solid black', borderRadius: 2, display: 'flex', alignItems: 'center', px: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>{profileToView?.phone}</Typography>
                    </Box>
                  </Box>
                </Stack>

                <Box sx={{ display: 'flex', gap: 6, mt: 8, justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1, border: '3px solid', borderColor: 'error.main', borderRadius: 5, p: 3 }}>
                    <Typography variant="h6" sx={{ color: 'error.main', fontWeight: 900, mb: 1 }}>ضروری ہدایات</Typography>
                    <Typography sx={{ color: 'error.main', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.8 }}>
                      • فارم میں درج معلومات درست ہیں۔<br/>
                      • داخلے کے لیے عمر کم از کم 5 سال ہونی چاہیے۔<br/>
                      • ادارے کی ہدایات پر عمل کرنا ضروری ہے۔
                    </Typography>
                  </Box>
                  <Box sx={{ width: 160, height: 200, border: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     {profileToView?.photoURL ? 
                       <img src={profileToView.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 
                       <Typography sx={{ fontWeight: 800, color: 'error.main' }}>تصویر</Typography>
                     }
                  </Box>
                </Box>

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pt: 6 }}>
                   <Typography sx={{ width: 180, borderTop: '2px solid black', pt: 1, fontWeight: 900, textAlign: 'center' }}>دستخط والدین</Typography>
                   <Box sx={{ textAlign: 'center' }}>
                     <QRCodeSVG value={`${window.location.origin}/verify/profile/${profileToView?.uid}`} size={100} />
                     <Typography sx={{ fontWeight: 900, mt: 1, color: 'success.main' }}>دفتر ادارہ</Typography>
                   </Box>
                   <Typography sx={{ width: 180, borderTop: '2px solid black', pt: 1, fontWeight: 900, textAlign: 'center' }}>دستخط مدرس</Typography>
                </Box>
                
                <Box sx={{ mt: 'auto', pt: 4 }}>
                   <Box sx={{ height: 6, borderRadius: 2, background: (t) => `linear-gradient(90deg, ${t.palette.primary.main}, #fbbf24)` }} />
                   <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 1 }}>
                     <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>📞 +91 9055499359</Typography>
                     <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>📞 +91 7006182924</Typography>
                   </Box>
                </Box>
              </Box>
           </Paper>
        </DialogContent>
      </Dialog>

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, px: 3, pt: 3 }}>
          {editingUser ? 'Edit Member Profile' : 'Register New Student'}
        </DialogTitle>
        <DialogContent sx={{ px: 3 }}>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Full Name" name="displayName" value={formData.displayName} onChange={handleFormChange} required />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Email Address" type="email" name="email" value={formData.email} onChange={handleFormChange} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select name="role" value={formData.role} label="Role" onChange={handleFormChange}>
                    <MenuItem value="student">Student</MenuItem>
                    <MenuItem value="teacher">Teacher</MenuItem>
                    <MenuItem value="manager">Manager</MenuItem>
                    {isSuperAdmin && <MenuItem value="superadmin">Super Admin</MenuItem>}
                  </Select>
                </FormControl>
              </Grid>
              {formData.role === 'student' && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Class Level</InputLabel>
                    <Select name="classLevel" value={formData.classLevel} label="Class Level" onChange={handleFormChange}>
                      {CLASS_LEVELS.map(level => (
                        <MenuItem key={level} value={level}>{level}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Gender</InputLabel>
                  <Select name="gender" value={(formData as any).gender || ''} label="Gender" onChange={handleFormChange}>
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Phone Number" name="phone" value={formData.phone} onChange={handleFormChange} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Father's Name" name="fatherName" value={formData.fatherName} onChange={handleFormChange} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Mother's Name" name="motherName" value={formData.motherName} onChange={handleFormChange} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Date of Birth" type="date" name="dob" value={formData.dob} onChange={handleFormChange} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Home Address" name="address" value={formData.address} onChange={handleFormChange} multiline rows={2} />
              </Grid>
              {!editingUser && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="Initial Password" name="password" type="password" value={(formData as any).password || ''} onChange={handleFormChange} />
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            disabled={!formData.displayName || loading}
            sx={{ fontWeight: 900, px: 4 }}
          >
            {editingUser ? 'Update Profile' : 'Register Member'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Confirm Deletion</DialogTitle>
        <DialogContent><Typography sx={{ fontWeight: 600 }}>Are you sure you want to delete this user and all their records?</Typography></DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button onClick={confirmUserDeletion} color="error" variant="contained" sx={{ fontWeight: 900 }}>Delete Forever</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} sx={{ width: '100%', fontWeight: 700 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

const UserCard = ({ user, actionMenu, onOpenProfile, onSelect, isSelected, selectionMode }: any) => {
  const isProfilePartiallyComplete = !!(user.dob && user.fatherName && user.motherName && user.address && user.phone);

  return (
    <Card 
      onClick={() => onOpenProfile(user)} 
      sx={{ 
        borderRadius: 4, 
        cursor: 'pointer', 
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
        '&:hover': { transform: 'translateY(-8px)', boxShadow: 10 },
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        position: 'relative',
        overflow: 'visible'
      }}
    >
      {/* {isProfilePartiallyComplete && user.status !== 'Archived' && (
         <Tooltip title="Information Complete">
           <Box sx={{ 
             position: 'absolute', 
             top: -5, 
             right: -5, 
             width: 15, 
             height: 15, 
             bgcolor: 'success.main', 
             borderRadius: '50%', 
             border: '3px solid white', 
             zIndex: 10,
             animation: 'pulse-green 2s infinite'
           }} />
         </Tooltip>
      )} */}
      <Box sx={{ height: 80, bgcolor: 'primary.main' }} />
      <CardContent sx={{ pt: 5, textAlign: 'center', position: 'relative' }}>
        <Avatar 
          src={user.photoURL} 
          imgProps={{ loading: 'lazy' }}
          sx={{ width: 80, height: 80, position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', border: '3px solid white' }} 
        />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>{user.displayName}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
          {user.role} {user.classLevel ? `• ${user.classLevel}` : ''}
        </Typography>
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1, alignItems: 'center' }}>
          {selectionMode && (
            <Checkbox 
              checked={isSelected} 
              onChange={(e) => { e.stopPropagation(); onSelect(e.target.checked); }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {actionMenu}
        </Box>
      </CardContent>
    </Card>
  );
};
