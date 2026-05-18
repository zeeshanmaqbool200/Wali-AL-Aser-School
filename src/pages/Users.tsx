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
import ImageCaptureDialog from '../components/ImageCaptureDialog';
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
  MessageCircle,
  Users as UsersIcon,
  Camera
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
import { useData } from '../context/DataContext';
import { format } from 'date-fns';
import { safelyFormatDate } from '../lib/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { logger } from '../lib/logger';
import { UserProfile, InstituteSettings, FeeReceipt } from '../types';
import { CLASS_LEVELS, SUBJECT_OPTIONS } from '../constants';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';
import FeeReceiptModal from '../components/FeeReceiptModal';

const MotionTableRow = motion.create(TableRow);

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
  const { users: allUsers, receipts: allReceipts, loading: globalLoading, isSyncing, setIsSaving } = useData();
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin' || currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isManagerRole = currentUser?.role === 'manager';
  const isTeacherRole = currentUser?.role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(() => {
    if ((window as any)._usersLoaded) return false;
    return true;
  });
  const [emailError, setEmailError] = useState('');
  const [admissionError, setAdmissionError] = useState('');
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('users_search') || '');
  const [tabValue, setTabValue] = useState(() => Number(sessionStorage.getItem('users_tab')) || 0);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  
  const [statusFilter, setStatusFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const openFilter = Boolean(filterAnchorEl);

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
    qualifications: '', // Added qualifications field
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
  const [openCapture, setOpenCapture] = useState(false);

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

    setIsSaving(true);
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
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    setDeleteConfirmOpen(false);
    setIsSaving(true);
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
      setIsSaving(false);
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
            const uReceipts = (allReceipts || []).filter(r => r.studentId === u.uid).slice(0, 5);
            const dob = u.dob ? new Date(u.dob) : null;
            let admissionPage = `
              <div class="admission-container" style="page-break-after: always; position: relative;">
                 <img class="watermark" src="${instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'}" crossorigin="anonymous" referrerpolicy="no-referrer">
                 
                 <div class="header">
                    <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                    <img class="logo" src="${instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'}" crossorigin="anonymous" referrerpolicy="no-referrer">
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
                      ${u.photoURL ? `<img src="${u.photoURL}" crossorigin="anonymous" referrerpolicy="no-referrer">` : '<div style="line-height:1">تصویر<br>4*4</div>'}
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

            let receiptPage = uReceipts.length > 0 ? `
              <div style="page-break-after: always; direction: ltr; text-align: left; padding: 15mm; border-top: 1pt solid #eee;">
                 <h2 style="text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 4mm;">FEE RECORDS: ${u.displayName.toUpperCase()}</h2>
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-top: 8mm;">
                    ${uReceipts.map(r => `
                       <div style="border: 1pt solid #000; padding: 4mm; border-radius: 4mm; min-height: 45mm;">
                          <div style="border-bottom: 0.5pt solid #000; margin-bottom: 2mm; font-weight: 900; display: flex; justify-content: space-between;">
                            <span>#${r.receiptNo}</span><span>${r.date}</span>
                          </div>
                          <div style="margin-bottom: 1mm;"><b>Head:</b> ${r.feeHead}</div>
                          <div style="margin-bottom: 1mm;"><b>Amount:</b> ₹${r.amount}</div>
                          <div style="margin-bottom: 1mm;"><b>Status:</b> ${r.status}</div>
                          <div style="margin-bottom: 1mm;"><b>Mode:</b> ${r.paymentMode}</div>
                       </div>
                    `).join('')}
                 </div>
              </div>
            ` : '';

            return admissionPage + receiptPage;
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

  const handleStudentIDCard = (u: UserProfile) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrDetails = `Name: ${u.displayName}\nID: ${u.admissionNo || u.uid.slice(0,8)}\nLevel: ${u.classLevel || 'N/A'}`;
    const verificationUrl = `${window.location.origin}/verify/profile/${u.uid}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Student ID Card - ${u.displayName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 10mm; }
            body { 
              margin: 0; 
              padding: 0; 
              font-family: 'Inter', sans-serif; 
              background: white;
              display: flex;
              justify-content: center;
              padding-top: 20mm;
            }
            .print-container {
              display: flex;
              flex-wrap: wrap;
              gap: 10mm;
              justify-content: center;
              width: 100%;
            }
            .id-card {
              width: 54mm;
              height: 86mm;
              position: relative;
              overflow: hidden;
              background: #0d9488;
              color: white;
              border-radius: 3mm;
              box-shadow: 0 0 5px rgba(0,0,0,0.1);
              border: 0.1mm solid #eee;
            }
            .id-card.back { background: #0b2e33; }
            
            .header {
              height: 15mm;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              border-bottom: 0.5mm solid rgba(255,255,255,0.2);
            }
            .logo { height: 8mm; margin-bottom: 1mm; }
            .inst-name { font-size: 8pt; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5pt; }

            .content-area {
              background: white;
              color: #0b2e33;
              margin: 2mm;
              margin-top: 5mm;
              height: 60mm;
              border-radius: 8mm 8mm 2mm 2mm;
              position: relative;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              border: 0.2mm solid rgba(0,0,0,0.05);
            }
            .student-photo {
              width: 18mm;
              height: 18mm;
              border-radius: 50%;
              border: 0.8mm solid #fbbf24;
              object-fit: cover;
              margin-top: -6mm;
              z-index: 3;
              background: #f3f4f6;
            }

            .qr-code-front {
              width: 16mm;
              height: 16mm;
              margin-top: 1mm;
            }

            .name { font-size: 10pt; font-weight: 900; margin-top: 2mm; color: #0d9488; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
            .role { font-size: 7pt; font-weight: 700; color: #666; margin-bottom: 1mm; text-transform: uppercase; }
            
            .details {
               width: 100%;
               font-size: 6.5pt;
               text-align: left;
               padding: 0 4mm;
               margin-top: 1mm;
            }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 0.5mm; }
            .detail-label { font-weight: 800; color: #888; }
            .detail-val { font-weight: 900; color: #0b2e33; }

            .footer-strip {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              height: 4mm;
              background: linear-gradient(90deg, #0d9488, #fbbf24);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 5pt;
              font-weight: 800;
              color: white;
            }

            .back-container {
              padding: 5mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100%;
              text-align: center;
            }
            .back-logo { width: 15mm; opacity: 0.2; margin-bottom: 5mm; }
            .verification-title { font-size: 8pt; font-weight: 900; margin-bottom: 2mm; color: #fbbf24; }
            .qr-code-back { width: 25mm; height: 25mm; padding: 1mm; background: white; border-radius: 2mm; }
            .back-contact { font-size: 6pt; font-weight: 700; margin-top: 5mm; color: rgba(255,255,255,0.7); }
            
            @media print {
              .no-print { display: none; }
              body { background: white; }
              .id-card { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="id-card">
              <div class="header">
                 <img class="logo" src="${instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'}">
                 <h1 class="inst-name">${instituteSettings.instituteName || 'Maktab Wali Ul Asr'}</h1>
              </div>
              <div class="content-area">
                 <img class="student-photo" src="${u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=0d9488&color=fff`}">
                 <div class="name">${u.displayName}</div>
                 <div class="role">${u.role.toUpperCase()}</div>
                 <img class="qr-code-front" src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrDetails)}">
                 <div class="details">
                    <div class="detail-row">
                      <span class="detail-label">ID:</span>
                      <span class="detail-val">${u.admissionNo || u.uid.slice(0,8)}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Class:</span>
                      <span class="detail-val">${u.classLevel || 'N/A'}</span>
                    </div>
                 </div>
              </div>
              <div class="footer-strip">QUALITY IS OUR TRADITION</div>
            </div>

            <div class="id-card back">
              <div class="back-container">
                 <img class="back-logo" src="${instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'}">
                 <h2 class="verification-title">VERIFY STUDENT</h2>
                 <img class="qr-code-back" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verificationUrl)}">
                 <div class="back-contact">
                    ${instituteSettings.address || 'Chattergam, Budgam'}<br>
                    ${instituteSettings.phone || '+91 90554-99359'}
                 </div>
              </div>
              <div class="footer-strip" style="background: #fbbf24; color: #0b2e33;">VALID IDENTITY DOCUMENT</div>
            </div>
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 1200); };
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

  // Real-time duplicate check
  useEffect(() => {
    if (openDialog && !editingUser) {
      const emailTrim = formData.email?.trim().toLowerCase();
      const admTrim = formData.admissionNo?.trim().toUpperCase();

      if (emailTrim && allUsers.some(u => u.email?.toLowerCase() === emailTrim)) {
        setEmailError('Member with this email already exists!');
      } else {
        setEmailError('');
      }

      if (admTrim && allUsers.some(u => u.admissionNo?.toUpperCase() === admTrim)) {
        setAdmissionError('Admission Number already assigned!');
      } else {
        setAdmissionError('');
      }
    } else {
      setEmailError('');
      setAdmissionError('');
    }
  }, [formData.email, formData.admissionNo, allUsers, openDialog, editingUser]);

  useEffect(() => {
    if (!globalLoading) {
      setUsers(allUsers);
      setLoading(false);
      (window as any)._usersLoaded = true;
    }
  }, [allUsers, globalLoading]);

  useEffect(() => {
    // Only fetch if global data is empty as a fallback
    if (allUsers.length === 0) {
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
        let docs = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[];
        docs.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setUsers(docs);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [isStaff, allUsers.length]);

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
        label: 'Download ID Card', 
        icon: <Download size={16} />, 
        color: 'success.main',
        onClick: () => { handleStudentIDCard(targetUser); } 
      },
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
           setIsSaving(true);
           try {
             const updateData: any = { isVerified: true, status: 'Active' };
             if (targetUser.role === 'student' && !targetUser.admissionNo) {
               const year = format(new Date(), 'yyyy');
               updateData.admissionNo = `ADM-${year}-${(targetUser.displayName||'STU').slice(0,3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
             }
             await smartUpdateDoc(doc(db, 'users', targetUser.uid), updateData);
             setSnackbar({ open: true, message: `${targetUser.displayName} verified successfully`, severity: 'success' });
           } catch (e) { 
             handleFirestoreError(e, OperationType.UPDATE, `users/${targetUser.uid}`); 
           } finally {
             setIsSaving(false);
           }
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
          setIsSaving(true);
          try { 
            await smartUpdateDoc(doc(db, 'users', targetUser.uid), { role: 'teacher', status: 'Active' }); 
            setSnackbar({ open: true, message: `${targetUser.displayName} approved as teacher`, severity: 'success' });
          } catch (e) { 
            handleFirestoreError(e, OperationType.UPDATE, `users/${targetUser.uid}`); 
          } finally {
            setIsSaving(false);
          }
        },
        disabled: !isSuperAdmin
      });
    }

    items.push({ divider: true, label: '', icon: null, onClick: () => {} });
    
    return <ActionMenu items={items} />;
  };

  const handleSave = async () => {
    setIsSaving(true);
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
        const userData: any = {
          ...finalFormData,
          uid,
          id: uid, 
          instituteId: instituteSettings.id || 'default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          photoURL: finalFormData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalFormData.displayName)}&background=random&color=fff`,
        };

        // Auto-generate IDs if empty
        if (userData.role === 'student' && !userData.admissionNo) {
          const year = new Date().getFullYear();
          userData.admissionNo = `ADM-${year}-${(userData.displayName || 'STU').slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
        } else if (['teacher', 'manager', 'superadmin'].includes(userData.role) && !userData.staffId) {
          const prefix = userData.role === 'teacher' ? 'TEA' : userData.role === 'manager' ? 'MGR' : 'ADM';
          userData.staffId = `WUA-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
          // Maintain legacy fields for compatibility
          if (userData.role === 'teacher') userData.teacherId = userData.staffId;
          if (userData.role === 'manager') userData.managerId = userData.staffId;
        }

        if (!userData.qualifications) {
          userData.qualifications = '';
        }

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
      
      // Auto-switch tab and reset filters to show newly added user
      if (!editingUser) {
        if (finalFormData.role === 'student') setTabValue(0);
        else if (['teacher', 'manager', 'superadmin'].includes(finalFormData.role)) setTabValue(1);
        setStatusFilter('All');
        setLevelFilter('All');
        setGenderFilter('All');
        setSearchQuery('');
      }

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save user details.', severity: 'error' });
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally { 
      setLoading(false);
      setIsSaving(false); 
    }
  };

  const handleArchive = async (user: UserProfile) => {
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async (user: UserProfile) => {
    setIsSaving(true);
    try {
      await smartUpdateDoc(doc(db, 'users', user.uid), {
        status: 'Active',
        isVerified: true
      });
      setSnackbar({ open: true, message: `${user.displayName} restored successfully`, severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
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
        // 1. Delete user document
        await deleteDoc(doc(db, 'users', id));
        
        // 2. Delete associated receipts
        const receiptsQuery = query(collection(db, 'receipts'), where('studentId', '==', id));
        const receiptsSnap = await getDocs(receiptsQuery);
        for (const r of receiptsSnap.docs) {
          await deleteDoc(r.ref);
        }
        
        // 3. Delete associated attendance
        const attendanceQuery = query(collection(db, 'attendance'), where('studentId', '==', id));
        const attendanceSnap = await getDocs(attendanceQuery);
        for (const a of attendanceSnap.docs) {
          await deleteDoc(a.ref);
        }

        // 4. Delete associated quiz results
        const resultsQuery = query(collection(db, 'quiz_results'), where('userId', '==', id));
        const resultsSnap = await getDocs(resultsQuery);
        for (const res of resultsSnap.docs) {
          await deleteDoc(res.ref);
        }

        // 5. Delete notifications
        const notifsQuery = query(collection(db, 'notifications'), where('userId', '==', id));
        const notifsSnap = await getDocs(notifsQuery);
        for (const n of notifsSnap.docs) {
          await deleteDoc(n.ref);
        }

        setSnackbar({ open: true, message: `${userToDelete.displayName} and all associated data purged from system.`, severity: 'success' });
      } else {
        // MOVE TO ARCHIVE
        await updateDoc(doc(db, 'users', id), { 
          status: 'Archived',
          isVerified: false,
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setSnackbar({ open: true, message: `${userToDelete.displayName} moved to archive`, severity: 'success' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
      setSnackbar({ open: true, message: 'Failed to complete deletion', severity: 'error' });
    } finally { 
      setUserToDeleteRef(null); 
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (u.email === 'zeeshanmaqbool200@gmail.com') return false;
      
      const s = searchQuery.toLowerCase();
      const matchesSearch = (u.displayName?.toLowerCase() || '').includes(s) || 
                          (u.email?.toLowerCase() || '').includes(s) ||
                          (u.admissionNo?.toLowerCase() || '').includes(s) ||
                          (u.phone || '').includes(s);
      if (!matchesSearch) return false;

      const matchesGender = genderFilter === 'All' || u.gender === genderFilter;
      if (!matchesGender) return false;

      const matchesLevel = levelFilter === 'All' || u.classLevel === levelFilter;
      if (!matchesLevel) return false;

      const currentStatus = u.status || (u.isVerified ? 'Active' : 'Pending');
      const matchesStatus = statusFilter === 'All' || currentStatus === statusFilter;
      if (!matchesStatus) return false;

      if (tabValue === 2) return !u.isVerified || u.role === 'pending_teacher';
      if (tabValue === 3) return u.status === 'Archived';
      
      if (u.status === 'Archived') return false;
      if (tabValue === 0) return u.role === 'student';
      if (tabValue === 1) return ['teacher', 'manager', 'superadmin'].includes(u.role);
      return true;
    });
  }, [users, searchQuery, genderFilter, levelFilter, statusFilter, tabValue]);

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

  if (loading && users.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 4 }} />
          <Grid container spacing={3}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rectangular" width="100%" height={250} sx={{ borderRadius: 4 }} />
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 8, pt: 2 }}>
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
          <Box id="users-directory-header">
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 950, color: 'text.primary', mb: 0.5, letterSpacing: -1.0 }}>Member Directory</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, display: 'block', opacity: 0.8, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Manage records with precision</Typography>
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
                  sx={{ 
                    borderRadius: 3, 
                    fontWeight: 900, 
                    textTransform: 'none',
                    background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${alpha(theme.palette.info.main, 0.7)} 100%)`,
                    boxShadow: `0 8px 16px ${alpha(theme.palette.info.main, 0.3)}`,
                  }}
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
                sx={{ 
                  borderRadius: 3, 
                  fontWeight: 900, 
                  textTransform: 'none',
                  px: isMobile ? 2 : 3,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '8px 8px 16px #000000, -8px -8px 16px rgba(255,255,255,0.02)'
                    : `0 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                {tabValue === 1 ? 'Add Staff' : 'Add Student'}
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Paper 
          elevation={0}
          sx={{ 
            display: 'flex', 
            gap: 2, 
            flexWrap: 'wrap', 
            alignItems: 'center',
            mb: 4,
            p: 2,
            borderRadius: 4,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.4) : 'white',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:focus-within': {
              borderColor: 'primary.main',
              boxShadow: `0 15px 40px ${alpha(theme.palette.primary.main, 0.1)}`
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 2, minWidth: { xs: '100%', md: 400 } }}>
            <Box sx={{ 
              p: 1.5, 
              borderRadius: 2.5, 
              bgcolor: alpha(theme.palette.primary.main, 0.1), 
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Search size={22} />
            </Box>
            <Box 
              component="input" 
              placeholder="Search members by name, ID, or phone..." 
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              sx={{ 
                border: 'none', 
                outline: 'none', 
                py: 1.5, 
                width: '100%', 
                fontWeight: 800,
                fontSize: '1.05rem',
                bgcolor: 'transparent',
                color: 'text.primary',
                '&::placeholder': { 
                  color: 'text.disabled',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }
              }} 
            />
          </Box>

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
              '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
              '& .MuiTab-root': { fontWeight: 900, textTransform: 'none', fontSize: '0.9rem', minWidth: 100 }
            }}
          >
            <Tab label="Students" />
            <Tab label="Staff" />
            <Tab label="Pending" />
            {isSuperAdmin && <Tab label="Archive" />}
          </Tabs>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => setFilterAnchorEl(e.currentTarget)}
              startIcon={<Filter size={18} />}
              sx={{ 
                borderRadius: 2, 
                fontWeight: 800, 
                textTransform: 'none',
                borderColor: alpha(theme.palette.divider, 0.2),
                color: 'text.primary',
                px: 2
              }}
            >
              Filter
            </Button>

            <Menu
              anchorEl={filterAnchorEl}
              open={openFilter}
              onClose={() => setFilterAnchorEl(null)}
              PaperProps={{ sx: { borderRadius: 3, p: 1, minWidth: 200 } }}
            >
              <Typography variant="overline" sx={{ px: 2, py: 1, fontWeight: 900, opacity: 0.6 }}>Filter Members</Typography>
              <MenuItem disableRipple sx={{ '&:hover': { bgcolor: 'transparent' } }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="All">All Status</MenuItem>
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Archived">Archived</MenuItem>
                  </Select>
                </FormControl>
              </MenuItem>
              <MenuItem disableRipple sx={{ '&:hover': { bgcolor: 'transparent' } }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Level</InputLabel>
                  <Select
                    value={levelFilter}
                    label="Level"
                    onChange={(e) => setLevelFilter(e.target.value)}
                  >
                    <MenuItem value="All">All Levels</MenuItem>
                    {CLASS_LEVELS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                  </Select>
                </FormControl>
              </MenuItem>
              <MenuItem disableRipple sx={{ '&:hover': { bgcolor: 'transparent' } }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Gender</InputLabel>
                  <Select
                    value={genderFilter}
                    label="Gender"
                    onChange={(e) => setGenderFilter(e.target.value)}
                  >
                    <MenuItem value="All">All Genders</MenuItem>
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                  </Select>
                </FormControl>
              </MenuItem>
              <Divider sx={{ my: 1 }} />
              <MenuItem onClick={() => { setStatusFilter('All'); setLevelFilter('All'); setGenderFilter('All'); setFilterAnchorEl(null); }}>
                <Typography color="error" sx={{ fontWeight: 800, fontSize: '0.85rem' }}>Clear All Filters</Typography>
              </MenuItem>
            </Menu>
            
            <Tooltip title="Selection Mode">
              <IconButton 
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedUsers([]);
                }}
                sx={{ 
                  bgcolor: selectionMode ? 'primary.main' : alpha(theme.palette.divider, 0.1),
                  color: selectionMode ? 'white' : 'text.primary',
                  '&:hover': { bgcolor: selectionMode ? 'primary.dark' : alpha(theme.palette.divider, 0.2) }
                }}
              >
                <UserCheck size={20} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>

        {loading && users.length > 0 && <LinearProgress sx={{ mb: 2, height: 2, borderRadius: 2 }} />}

        {viewMode === 'grid' ? (
          <Grid container spacing={3}>
            <AnimatePresence mode="popLayout">
              {filteredUsers.map(u => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={u.uid}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  >
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
                  </motion.div>
                </Grid>
              ))}
            </AnimatePresence>
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
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map((u) => (
                    <MotionTableRow
                      key={u.uid}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
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
                    </MotionTableRow>
                  ))}
                </AnimatePresence>
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
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar>
            <Button 
              startIcon={<X size={18} />} 
              onClick={() => setOpenProfileDialog(false)}
              sx={{ 
                fontWeight: 800, 
                color: 'text.secondary', 
                textTransform: 'none', 
                px: 2,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                mr: 2,
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.05),
                  color: 'error.main',
                  borderColor: 'error.main'
                }
              }}
            >
              Close
            </Button>
            <Typography sx={{ ml: 2, flex: 1, fontWeight: 900, fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'primary.main' }}>
              Member Profile
            </Typography>
            <Stack direction="row" spacing={1}>
               {isSuperAdmin && (
                 <Button 
                   variant="outlined" 
                   size="small"
                   startIcon={<Edit2 size={16} />} 
                   onClick={() => {
                     if (profileToView) {
                       setEditingUser(profileToView);
                        setFormData({
                          displayName: profileToView.displayName || '',
                          email: profileToView.email || '',
                          role: profileToView.role || 'student',
                          status: profileToView.status || 'Active',
                          isVerified: profileToView.isVerified ?? true,
                          classLevel: profileToView.classLevel || '',
                          admissionNo: profileToView.admissionNo || '',
                          teacherId: profileToView.teacherId || '',
                          password: '',
                          gender: (profileToView as any).gender || '',
                          phone: profileToView.phone || '',
                          fatherName: profileToView.fatherName || '',
                          motherName: profileToView.motherName || '',
                          dob: profileToView.dob || '',
                          address: profileToView.address || '',
                          qualifications: profileToView.qualifications || '',
                          photoURL: profileToView.photoURL || '',
                          subjectsEnrolled: profileToView.subjectsEnrolled || []
                        });
                       setOpenDialog(true);
                     }
                   }}
                   sx={{ borderRadius: 10, fontWeight: 800, textTransform: 'none' }}
                 >
                   Edit Profile
                 </Button>
               )}
               <Button 
                variant="outlined" 
                size="small"
                startIcon={<Printer size={16} />} 
                onClick={() => { setOpenAdmissionForm(true); }}
                sx={{ borderRadius: 10, fontWeight: 800, textTransform: 'none' }}
              >
                Admission Form
              </Button>
              <Button 
                variant="contained" 
                size="small"
                id="btn-download-id"
                startIcon={<Download size={16} />} 
                onClick={() => profileToView && handleStudentIDCard(profileToView)}
                sx={{ borderRadius: 10, fontWeight: 900, textTransform: 'none', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)' }}
              >
                Download ID
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ bgcolor: theme.palette.mode === 'dark' ? '#0a0a0a' : 'background.default', p: 0 }}>
           {profileToView && (
             <Box sx={{ pb: 10 }}>
                {/* Hero Header */}
                <Box sx={{ 
                  height: { xs: 200, md: 300 }, 
                  background: profileToView.role === 'teacher' 
                    ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url(https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop)`
                    : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative',
                  mb: -10,
                  display: 'flex',
                  alignItems: 'flex-end',
                  p: 6
                }}>
                   {profileToView.role === 'teacher' && (
                     <Box sx={{ animate: 'fadeInUp 1s' }}>
                        <Typography variant="h2" sx={{ color: 'white', fontWeight: 950, letterSpacing: -3 }}>{profileToView.displayName?.split(' ')[0]}</Typography>
                        <Chip label="Distinguished Faculty" sx={{ bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white', fontWeight: 900, border: '1px solid rgba(255,255,255,0.3)' }} />
                     </Box>
                   )}
                </Box>
                
                <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, px: { xs: 2, md: 4 } }}>
                  <Grid container spacing={4}>
                    {/* Left Panel */}
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Card className="ios-card" sx={{ p: 4, textAlign: 'center', bgcolor: theme.palette.mode === 'dark' ? '#111' : 'white', borderRadius: 8 }}>
                        <Avatar 
                          src={profileToView.photoURL} 
                          sx={{ width: 180, height: 180, mx: 'auto', mb: 3, border: `6px solid ${theme.palette.background.paper}`, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }} 
                        />
                        <Typography variant="h4" id="profile-name" sx={{ 
                          fontWeight: 950, 
                          mb: 1, 
                          letterSpacing: -1.5, 
                          fontFamily: 'var(--font-heading)', 
                          color: 'text.primary',
                          fontSize: { xs: '1.8rem', md: '2.2rem' },
                          lineHeight: 1.1
                        }}>
                          {profileToView.displayName}
                        </Typography>
                        
                        <Stack spacing={1} direction="row" justifyContent="center" sx={{ mb: 4 }}>
                          <Chip label={profileToView.role?.toUpperCase()} size="small" sx={{ fontWeight: 900, bgcolor: 'primary.main', color: 'white' }} />
                          {profileToView.isVerified && <Chip icon={<CheckCircle size={14} />} label="Verified" size="small" variant="outlined" color="success" sx={{ fontWeight: 800 }} />}
                        </Stack>

                        <Divider sx={{ my: 4, borderColor: alpha(theme.palette.divider, 0.1) }} />

                        <Box sx={{ textAlign: 'left', mb: 4 }}>
                           <Typography className="ui-label" sx={{ mb: 2, display: 'block', opacity: 0.6 }}>COMMUNICATION</Typography>
                           <Stack spacing={2.5}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 2, bgcolor: alpha(theme.palette.divider, 0.05), borderRadius: 4 }}>
                                <Phone size={20} className="text-primary" />
                                <Box>
                                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, opacity: 0.5 }}>PHONE</Typography>
                                  <Typography sx={{ fontWeight: 800 }}>{profileToView.phone || 'N/A'}</Typography>
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 2, bgcolor: alpha(theme.palette.divider, 0.05), borderRadius: 4 }}>
                                <Mail size={20} className="text-primary" />
                                <Box>
                                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, opacity: 0.5 }}>EMAIL</Typography>
                                  <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>{profileToView.email}</Typography>
                                </Box>
                              </Box>
                           </Stack>
                        </Box>
                        
                        {profileToView.role === 'student' && (
                          <Box sx={{ p: 4, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 6, border: '1px dashed', borderColor: alpha(theme.palette.primary.main, 0.2) }}>
                            <Typography className="ui-label" sx={{ mb: 2, display: 'block', textAlign: 'center' }}>ID VERIFICATION</Typography>
                            <Box sx={{ p: 1, bgcolor: 'white', display: 'inline-block', borderRadius: 4, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
                              <QRCodeSVG value={`${window.location.origin}/verify/profile/${profileToView.uid}`} size={160} bgColor="white" fgColor="#000000" />
                            </Box>
                          </Box>
                        )}
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
                                  {safelyFormatDate(profileToView.dob)}
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
                                          {safelyFormatDate(r.date)} • {r.receiptNo}
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
                         <Card className="ios-card" id="profile-academic-card" sx={{ p: 4, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, mb: 3, fontFamily: 'var(--font-heading)', color: 'primary.main' }}>Academic Details</Typography>
                            <Grid container spacing={3}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography className="ui-label" sx={{ color: 'text.secondary', fontWeight: 800 }}>ADMISSION NO</Typography>
                                <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', color: 'primary.main', fontFamily: 'JetBrains Mono, monospace' }}>{profileToView.admissionNo || 'N/A'}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography className="ui-label" sx={{ color: 'text.secondary', fontWeight: 800 }}>ENROLLED SINCE</Typography>
                                <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'text.primary' }}>{safelyFormatDate(profileToView.createdAt)}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <Typography className="ui-label" sx={{ color: 'text.secondary', fontWeight: 800 }}>ENROLLED SUBJECTS</Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                                  {profileToView.subjectsEnrolled?.map((s) => (
                                    <Chip 
                                      key={s} 
                                      label={s} 
                                      size="small" 
                                      sx={{ 
                                        fontWeight: 900, 
                                        borderRadius: 2, 
                                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                                        color: 'primary.main',
                                        border: '1px solid',
                                        borderColor: alpha(theme.palette.primary.main, 0.1)
                                      }} 
                                    />
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
        PaperProps={{ sx: { bgcolor: 'background.default' } }}
      >
        <AppBar sx={{ position: 'relative', bgcolor: 'background.paper', color: 'text.primary' }} elevation={0} className="no-print">
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => setOpenAdmissionForm(false)} sx={{ color: 'text.secondary' }}><X size={20} /></IconButton>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Admission Form</Typography>
            </Box>
            <Button variant="contained" startIcon={<Printer />} onClick={handlePrint}>Print Form</Button>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center', overflowX: 'auto', bgcolor: 'background.default' }}>
           <Paper className="admission-page" sx={{ 
             width: '210mm', 
             minHeight: '297mm', 
             p: '12mm', 
             boxSizing: 'border-box',
             bgcolor: '#FFFFFF', 
             color: '#000000', 
             position: 'relative',
             direction: 'rtl',
             fontFamily: '"Noto Nastaliq Urdu", serif',
             display: 'flex',
             flexDirection: 'column',
             boxShadow: 3,
             my: { xs: 0, md: 4 },
             overflow: 'hidden'
           }}>
                <Box sx={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  width: '140mm', 
                  opacity: 0.04, 
                  zIndex: 0, 
                  pointerEvents: 'none' 
                }}>
                  <img src={instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'} style={{ width: '100%' }} crossOrigin="anonymous" referrerPolicy="no-referrer" />
                </Box>

              <Box sx={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ textAlign: 'center', fontSize: '1.5rem', mb: 1 }}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Typography>

                <Box sx={{ textAlign: 'center', mb: 1 }}>
                  <img 
                    src={instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'} 
                    style={{ width: 60, height: 60, objectFit: 'contain' }} 
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                  <Typography variant="h4" sx={{ fontWeight: 950, color: 'success.main', mt: 0.5, fontSize: '1.8rem', lineHeight: 1.1, fontFamily: 'var(--font-urdu)' }}>مکتب ولی العصر</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#64748b', mt: 0, opacity: 0.8 }}>زیر نگران ادارہ ولی العصر چھترگام</Typography>
                </Box>

                <Typography sx={{ textAlign: 'center', fontSize: '2.5rem', fontWeight: 950, my: 2, lineHeight: 0.8, fontFamily: 'var(--font-urdu)' }}>تحریرِ داخلہ</Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, borderBottom: '2px solid', borderColor: 'success.main', pb: 1 }}>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 900 }}>داخلہ نمبر: <span style={{ fontFamily: 'Inter, sans-serif' }}>{profileToView?.admissionNo || profileToView?.uid.slice(0,8)}</span></Typography>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 900 }}>جماعت / درجہ: <span style={{ borderBottom: '2px dotted black', minWidth: 100, display: 'inline-block', textAlign: 'center' }}>{profileToView?.classLevel || ''}</span></Typography>
                </Box>

                <Stack spacing={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, minWidth: 120 }}>نام :</Typography>
                    <Box sx={{ display: 'flex', flex: 1, gap: 4 }}>
                      <Box sx={{ flex: 1, height: 44, border: '1.5px solid black', borderRadius: 1.5, display: 'flex', alignItems: 'center', px: 2, position: 'relative' }}>
                        <Typography sx={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', opacity: 0.7 }}>ابتدائی</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{(profileToView?.displayName || '').split(' ')[0]}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, height: 44, border: '1.5px solid black', borderRadius: 1.5, display: 'flex', alignItems: 'center', px: 2, position: 'relative' }}>
                         <Typography sx={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', opacity: 0.7 }}>آخری</Typography>
                         <Typography variant="h6" sx={{ fontWeight: 800 }}>{(profileToView?.displayName || '').split(' ').slice(1).join(' ')}</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, minWidth: 120 }}>ولدیت :</Typography>
                    <Box sx={{ flex: 1, height: 44, border: '1.5px solid black', borderRadius: 1.5, display: 'flex', alignItems: 'center', px: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>{profileToView?.fatherName}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, minWidth: 120 }}>سکونت :</Typography>
                    <Box sx={{ flex: 1, height: 44, border: '1.5px solid black', borderRadius: 1.5, display: 'flex', alignItems: 'center', px: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>{profileToView?.address}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, minWidth: 120 }}>تاریخ پیدائش :</Typography>
                    <Box sx={{ flex: 1, height: 44, border: '1.5px solid black', borderRadius: 1.5, display: 'flex', alignItems: 'center', px: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>{safelyFormatDate(profileToView?.dob)}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, minWidth: 120 }}>رابطہ نمبر :</Typography>
                    <Box sx={{ flex: 1, height: 44, border: '1.5px solid black', borderRadius: 1.5, display: 'flex', alignItems: 'center', px: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>{profileToView?.phone}</Typography>
                    </Box>
                  </Box>
                </Stack>

                <Box sx={{ display: 'flex', gap: 6, mt: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, border: '3px solid', borderColor: 'error.main', borderRadius: 5, p: 3 }}>
                    <Typography variant="h6" sx={{ color: 'error.main', fontWeight: 900, mb: 1 }}>ضروری ہدایات</Typography>
                    <Typography sx={{ color: 'error.main', fontSize: '1rem', fontWeight: 700, lineHeight: 1.8 }}>
                      • فارم میں درج معلومات درست ہیں اور میں ادارے کے قوانین کا پابند رہوں گا/گی۔<br/>
                      • داخلے کے لیے عمر کم از کم 5 سال ہونی چاہیے۔<br/>
                      • ادارے کی ہدایات پر عمل کرنا لازمی ہے۔
                    </Typography>
                  </Box>
                  <Box sx={{ width: 45 * 3.77, height: 55 * 3.77, border: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fafafa', overflow: 'hidden' }}>
                     {profileToView?.photoURL ? 
                       <img 
                        src={profileToView.photoURL} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                       /> : 
                       <Typography sx={{ fontWeight: 800, color: 'text.disabled', textAlign: 'center' }}>تصویر<br/>(4cm x 5cm)</Typography>
                     }
                  </Box>
                </Box>

                <Box sx={{ mt: 'auto', mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pt: 6 }}>
                   <Typography sx={{ width: 180, borderTop: '2px solid black', pt: 1, fontWeight: 900, textAlign: 'center' }}>دستخط والدین</Typography>
                   <Box sx={{ textAlign: 'center' }}>
                     <QRCodeSVG value={`${window.location.origin}/verify/profile/${profileToView?.uid}`} size={80} />
                     <Typography sx={{ fontWeight: 900, mt: 0.5, color: 'success.main', fontSize: '0.8rem' }}>دفتر ادارہ</Typography>
                   </Box>
                   <Typography sx={{ width: 180, borderTop: '2px solid black', pt: 1, fontWeight: 900, textAlign: 'center' }}>دستخط مدرس</Typography>
                </Box>
                
                <Box sx={{ pt: 2, borderTop: '1px solid #eee' }}>
                   <Box sx={{ height: 6, borderRadius: 2, background: (t) => `linear-gradient(90deg, ${t.palette.primary.main}, #fbbf24)` }} />
                   <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 1 }}>
                     <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>📞 +91 9055499359</Typography>
                     <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>📞 +91 9797100753</Typography>
                     <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>📞 +91 7006182924</Typography>
                   </Box>
                </Box>
              </Box>

              {/* Second Page: Receipts */}
              {profileReceipts.length > 0 && (
                <Box sx={{ 
                  '@media print': { pageBreakBefore: 'always', mt: 0, pt: 10 }, 
                  mt: 8, 
                  position: 'relative', 
                  zIndex: 10,
                  width: '100%',
                  bgcolor: 'white',
                  color: 'black',
                  direction: 'ltr' // Receipts are usually LTR
                }}>
                  <Box sx={{ borderBottom: '3px solid black', pb: 1, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 950, textTransform: 'uppercase', color: 'black' }}>Financial Summary</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: 'black' }}>{profileToView?.displayName}</Typography>
                  </Box>

                  <Grid container spacing={3}>
                    {profileReceipts.map((r) => (
                      <Grid key={r.id} size={{ xs: 12, sm: 6 }}>
                        <Box sx={{ 
                          border: '1.5px solid black', 
                          p: 2, 
                          borderRadius: 2, 
                          pageBreakInside: 'avoid',
                          mb: 1,
                          bgcolor: 'white'
                        }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, borderBottom: '1px solid #000', pb: 1 }}>
                            <Typography sx={{ fontWeight: 950, fontSize: '0.9rem', color: 'black' }}>#{r.receiptNo}</Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: 'black' }}>{safelyFormatDate(r.date)}</Typography>
                          </Box>
                          <Stack spacing={0.5}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: 'black' }}>Head:</Typography>
                              <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', color: 'black' }}>{r.feeHead}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: 'black' }}>Amount:</Typography>
                              <Typography sx={{ fontWeight: 950, fontSize: '1rem', color: 'black' }}>₹{r.amount}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: 'black' }}>Mode:</Typography>
                              <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', color: 'black' }}>{r.paymentMode}</Typography>
                            </Box>
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>

                  <Box sx={{ mt: 10, pt: 4, borderTop: '2px solid black', textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.7rem', color: 'black' }}>
                      Electronically generated on {new Date().toLocaleString()} • Wali Ul Aser Financial System
                    </Typography>
                  </Box>
                </Box>
              )}

              <style>{`
                @media print {
                  @page { size: A4; margin: 0; }
                  body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
                  .no-print { display: none !important; }
                  .MuiDialog-container { display: block !important; }
                  .MuiPaper-root { margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; background: white !important; color: black !important; }
                  .admission-page { 
                    width: 210mm !important; 
                    height: 297mm !important; 
                    margin: 0 !important;
                    padding: 10mm !important;
                    box-shadow: none !important;
                    -webkit-print-color-adjust: exact !important;
                    background: white !important;
                    color: black !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                  }
                  .admission-page * {
                    background: transparent !important;
                    color: black !important;
                  }
                  img { max-width: 100%; display: block !important; }
                }
              `}</style>
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
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar 
                  src={formData.photoURL} 
                  sx={{ width: 100, height: 100, border: '4px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }} 
                />
                <IconButton 
                  size="small"
                  onClick={() => setOpenCapture(true)}
                  sx={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    right: 0, 
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    '&:hover': { bgcolor: 'background.default' }
                  }}
                >
                  <Camera size={16} />
                </IconButton>
                <ImageCaptureDialog 
                  open={openCapture}
                  onClose={() => setOpenCapture(false)}
                  onCapture={(base64) => setFormData(prev => ({ ...prev, photoURL: base64 }))}
                />
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField 
                  fullWidth 
                  label="Full Name" 
                  name="displayName" 
                  value={formData.displayName} 
                  onChange={handleFormChange} 
                  required 
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField 
                  fullWidth 
                  label="Email Address" 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleFormChange}
                  error={!!emailError}
                  helperText={emailError || "Optional: For login and notifications"}
                />
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
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField 
                  fullWidth 
                  label={formData.role === 'student' ? "Admission No" : "Staff ID"} 
                  name="admissionNo" 
                  value={formData.admissionNo} 
                  onChange={handleFormChange}
                  placeholder="Auto-generated if empty"
                  error={!!admissionError}
                  helperText={admissionError || "Unique identifier"}
                />
              </Grid>
              {formData.role === 'student' && (
                <>
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
                  <Grid size={{ xs: 12 }}>
                    <FormControl fullWidth>
                      <InputLabel>Enrolled Subjects (Required for Curriculum)</InputLabel>
                      <Select
                        multiple
                        name="subjectsEnrolled"
                        value={formData.subjectsEnrolled || []}
                        label="Enrolled Subjects (Required for Curriculum)"
                        onChange={handleFormChange}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
                              <Chip 
                                key={value} 
                                label={value} 
                                size="small" 
                                sx={{ 
                                  fontWeight: 800, 
                                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                                  color: 'primary.main',
                                  borderRadius: 1
                                }} 
                              />
                            ))}
                          </Box>
                        )}
                      >
                        {SUBJECT_OPTIONS.map((subject) => (
                          <MenuItem 
                            key={subject} 
                            value={subject}
                            sx={{ fontWeight: formData.subjectsEnrolled?.includes(subject) ? 900 : 500 }}
                          >
                            {subject}
                          </MenuItem>
                        ))}
                      </Select>
                      <Typography variant="caption" sx={{ mt: 0.5, ml: 1, fontWeight: 600, color: 'text.secondary' }}>
                        Select all subjects this student is studying (Quran, Urdu, Diniyat, etc.)
                      </Typography>
                    </FormControl>
                  </Grid>
                </>
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
              {(formData.role === 'teacher' || formData.role === 'manager') && (
                <Grid size={{ xs: 12 }}>
                  <TextField 
                    fullWidth 
                    label="Qualifications" 
                    name="qualifications" 
                    value={formData.qualifications || ''} 
                    onChange={handleFormChange} 
                    placeholder="e.g. M.A Urdu, B.Ed, Hafiz-e-Quran"
                    helperText="Academic or professional degrees"
                  />
                </Grid>
              )}
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
            disabled={!formData.displayName || loading || !!emailError || !!admissionError}
            sx={{ 
              fontWeight: 950, 
              px: 5, 
              py: 1.2,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.35)}`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
              }
            }}
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
  const theme = useTheme();
  return (
    <Card 
      onClick={() => onOpenProfile(user)} 
      sx={{ 
        borderRadius: { xs: 6, sm: 4 }, 
        cursor: 'pointer', 
        transition: 'all 0.2s ease', 
        '&:hover': { boxShadow: theme.palette.mode === 'dark' ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.06)' },
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : alpha(theme.palette.divider, 0.1),
        position: 'relative',
        overflow: 'hidden',
        bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.5) : 'white',
        '& .MuiTypography-root': {
          fontFamily: theme.palette.mode === 'dark' ? '"Outfit", sans-serif' : 'inherit'
        }
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar 
            src={user.photoURL} 
            imgProps={{ loading: 'lazy' }}
            sx={{ width: 60, height: 60, border: '2px solid', borderColor: alpha(theme.palette.primary.main, 0.2) }} 
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" sx={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.displayName}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>ID: {user.admissionNo || user.uid.slice(0,8)}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, alignItems: 'center' }}>
              <Chip label={user.classLevel || user.role} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 900, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
              {user.status === 'Archived' && <Chip label="Archived" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 900 }} />}
              {user.phone && (
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`https://wa.me/${user.phone.replace(/\D/g, '')}`, '_blank');
                  }}
                  sx={{ 
                    p: 0, 
                    ml: 0.5, 
                    color: '#25D366',
                    '&:hover': { bgcolor: alpha('#25D366', 0.1) }
                  }}
                >
                  <MessageCircle size={16} />
                </IconButton>
              )}
            </Stack>
          </Box>
          <Box onClick={(e) => e.stopPropagation()}>
            {actionMenu}
          </Box>
        </Stack>

        {selectionMode && (
          <Box sx={{ position: 'absolute', top: 5, right: 5 }} onClick={(e) => e.stopPropagation()}>
            <Checkbox 
              checked={isSelected} 
              size="small"
              onChange={(e) => onSelect(e.target.checked)}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
