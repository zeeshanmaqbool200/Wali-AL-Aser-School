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
  LinearProgress, Divider, Snackbar, Alert, Switch, Checkbox
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import QRCode from 'qrcode';
import { 
  Plus, Search, Edit2, Trash2, UserPlus, 
  Filter, Mail, Phone, MapPin, Shield, Calendar,
  MoreVertical, User, GraduationCap, UserCheck,
  ArrowRight, ExternalLink, Download, Layout,
  Layers, CheckCircle, XCircle, Clock, Save,
  Bell, Camera, X, Printer, RotateCcw, ArrowLeft, FileText, Database, IndianRupee
} from 'lucide-react';
import { 
  collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, 
  orderBy, where, getDocs, writeBatch, getDoc, or, and, documentId, setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, smartAddDoc, smartUpdateDoc, smartSetDoc, smartDeleteDoc, firebaseConfig } from '../firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { UserProfile, UserRole, ClassLevel, InstituteSettings, FeeReceipt } from '../types';
import { useAuth } from '../context/AuthContext';
import { CLASS_LEVELS, SUBJECT_OPTIONS } from '../constants';
import { logger } from '../lib/logger';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { exportToCSV } from '../lib/exportUtils';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useHardwarePermissions } from '../services/hardwareService';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';

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
      setLevelFilter(level as any);
    }
  }, [location.search]);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(!(window as any)._usersLoaded);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [levelFilter, setLevelFilter] = useState<ClassLevel | 'All'>('All');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'All'>('All');
  const [openDialog, setOpenDialog] = useState(false);
  const [openPromoteDialog, setOpenPromoteDialog] = useState(false);
  const [openViewProfile, setOpenViewProfile] = useState(false);
  const [viewProfileMode, setViewProfileMode] = useState<'digital' | 'print'>('digital');
  const [profileToView, setProfileToView] = useState<UserProfile | null>(null);
  const [instituteSettings, setInstituteSettings] = useState<Partial<InstituteSettings>>({});
  const [promotingUser, setPromotingUser] = useState<UserProfile | null>(null);
  const [newClassLevel, setNewClassLevel] = useState<string | ''>('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [studentReceipts, setStudentReceipts] = useState<FeeReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  useEffect(() => {
    if (openViewProfile && profileToView?.uid) {
      setLoadingReceipts(true);
      const q = query(
        collection(db, 'receipts'),
        where('studentId', '==', profileToView.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setStudentReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[]);
        setLoadingReceipts(false);
      });
      return () => unsubscribe();
    }
  }, [openViewProfile, profileToView]);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [stayOpen, setStayOpen] = useState(false);
  const [userToDeleteRef, setUserToDeleteRef] = useState<{ id: string, profile: UserProfile } | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [purgeType, setPurgeType] = useState<'ALL' | 'STUDENTS'>('STUDENTS');

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedUsers(filteredUsers.map(u => u.uid));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedUsers(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };
  
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: 'password123', // Default password
    role: 'student' as UserRole,
    phone: '',
    classLevel: '' as any,
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

  // Auto-generate IDs
  useEffect(() => {
    if (openDialog && !editingUser) {
      const generateId = () => {
        const prefix = formData.role === 'student' ? 'STD' : formData.role === 'teacher' ? 'TCH' : 'STF';
        const timestamp = Date.now().toString().slice(-4);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const newId = `${prefix}-${timestamp}-${random}`;
        
        if (formData.role === 'student') {
          setFormData(prev => ({ ...prev, admissionNo: newId }));
        } else {
          setFormData(prev => ({ ...prev, teacherId: newId }));
        }
      };
      generateId();
    }
  }, [openDialog, editingUser, formData.role]);

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

  const handleBulkDelete = async () => {
    if (!isSuperAdmin || selectedUsers.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedUsers.length} users? This cannot be undone.`)) return;
    
    setLoading(true);
    try {
      const batchSize = 100;
      for (let i = 0; i < selectedUsers.length; i += batchSize) {
        const chunk = selectedUsers.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach(uid => {
          batch.delete(doc(db, 'users', uid));
        });
        await batch.commit();
      }
      setSelectedUsers([]);
      setSnackbar({ open: true, message: `Successfully deleted ${selectedUsers.length} users`, severity: 'success' });
    } catch (error) {
      console.error("Bulk delete error:", error);
      setSnackbar({ open: true, message: 'Bulk delete failed', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPrint = (type: 'admission' | 'receipt') => {
    const selectedDocs = users.filter(u => selectedUsers.includes(u.uid));
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    if (type === 'admission') {
      printWindow.document.write(`
        <html>
          <head>
            <title>Admission Forms - ${instituteSettings.instituteName}</title>
            <style>
              @page { size: A4; margin: 0; }
              body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .page {
                width: 210mm;
                height: 297mm;
                padding: 15mm;
                box-sizing: border-box;
                page-break-after: always;
                position: relative;
                background: white;
              }
              .border-frame {
                position: absolute;
                top: 5mm; left: 5mm; right: 5mm; bottom: 5mm;
                border: 2px double #0d9488;
                pointer-events: none;
              }
              .header { display: flex; align-items: center; border-bottom: 2px solid #0d9488; padding-bottom: 5mm; margin-bottom: 8mm; }
              .logo { width: 35mm; height: 35mm; object-fit: contain; margin-right: 8mm; }
              .inst-info { flex: 1; }
              .inst-name { font-size: 26pt; font-weight: 950; color: #0d9488; margin: 0; font-family: 'Cinzel', serif; letter-spacing: 1px; }
              .inst-tagline { font-size: 11pt; font-weight: 700; color: #444; margin: 2mm 0; font-style: italic; }
              .form-type { background: #0d9488; color: white; padding: 2mm 6mm; display: inline-block; font-weight: 900; font-size: 14pt; border-radius: 4px; }
              
              .main-grid { display: grid; grid-template-columns: 3fr 1fr; gap: 10mm; margin-top: 5mm; }
              .field { margin-bottom: 5mm; border-bottom: 1px dotted #ccc; padding-bottom: 1mm; }
              .label { font-size: 9pt; color: #666; font-weight: 800; text-transform: uppercase; margin-bottom: 1mm; display: block; }
              .value { font-size: 13pt; font-weight: 700; color: #000; }
              
              .photo-area { 
                width: 40mm; 
                height: 50mm; 
                border: 2px dashed #0d9488; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                background: #f9f9f9;
                text-align: center;
                font-size: 8pt;
                color: #888;
                overflow: hidden;
              }
              .photo-area img { width: 100%; height: 100%; object-fit: cover; }
              
              .section-title { 
                background: #f0fdfa; 
                border-left: 5px solid #0d9488; 
                padding: 2mm 4mm; 
                font-weight: 900; 
                font-size: 12pt; 
                color: #0d9488;
                margin: 8mm 0 5mm 0;
                text-transform: uppercase;
              }
              
              .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5mm; }
              .academic-table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
              .academic-table th { background: #f0fdfa; border: 1px solid #0d9488; padding: 3mm; font-weight: 900; text-align: left; font-size: 10pt; }
              .academic-table td { border: 1px solid #ddd; padding: 4mm; font-size: 11pt; }
              
              .footer { position: absolute; bottom: 25mm; left: 15mm; right: 15mm; display: flex; justify-content: space-between; align-items: flex-end; }
              .sig-line { width: 50mm; border-top: 1px solid #000; text-align: center; padding-top: 2mm; font-size: 9pt; font-weight: 800; }
              .qr-zone { text-align: center; }
              .qr-zone img { width: 30mm; height: 30mm; }
              .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100pt; color: rgba(13, 148, 136, 0.03); font-weight: 900; z-index: -1; pointer-events: none; white-space: nowrap; }
            </style>
          </head>
          <body>
            ${selectedDocs.map(u => `
              <div class="page">
                <div class="border-frame"></div>
                <div class="watermark">WALI UL ASER</div>
                <div class="header">
                  <img class="logo" src="${instituteSettings.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png'}">
                  <div class="inst-info">
                    <h1 class="inst-name">${instituteSettings.instituteName || 'WALI UL ASER INSTITUTE'}</h1>
                    <p class="inst-tagline">${instituteSettings.tagline || 'Religious and Academic Excellence'}</p>
                    <p style="font-size: 9pt; font-weight: 600; color: #555;">${instituteSettings.address || ''} | ${instituteSettings.phone || ''}</p>
                  </div>
                  <div style="text-align: right;">
                    <div class="form-type">ADMISSION FORM</div>
                    <p style="font-weight: 800; margin-top: 4mm; color: #0d9488;">Session ${new Date().getFullYear()}-${new Date().getFullYear() + 1}</p>
                  </div>
                </div>

                <div class="main-grid">
                  <div class="fields-column">
                    <div class="field">
                      <span class="label">Full Name of Student</span>
                      <span class="value">${u.displayName}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5mm;">
                      <div class="field">
                        <span class="label">Father's Name</span>
                        <span class="value">${u.fatherName || 'Not Provided'}</span>
                      </div>
                      <div class="field">
                        <span class="label">Mother's Name</span>
                        <span class="value">${u.motherName || 'Not Provided'}</span>
                      </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 5mm;">
                      <div class="field">
                        <span class="label">Date of Birth (DOB)</span>
                        <span class="value">${u.dob ? format(new Date(u.dob), 'dd MMMM yyyy') : 'Not Provided'}</span>
                      </div>
                      <div class="field">
                        <span class="label">Gender</span>
                        <span class="value">_________</span>
                      </div>
                    </div>
                  </div>
                  <div class="photo-area">
                    ${u.photoURL ? `<img src="${u.photoURL}">` : 'Affix Recent<br>Passport Size<br>Photograph'}
                  </div>
                </div>

                <div class="section-title">Registration Details</div>
                <div class="info-grid">
                  <div class="field">
                    <span class="label">Admission Number</span>
                    <span class="value">${u.admissionNo || u.uid.slice(0, 8)}</span>
                  </div>
                  <div class="field">
                    <span class="label">Class / Level</span>
                    <span class="value">${u.classLevel || 'N/A'}</span>
                  </div>
                  <div class="field">
                    <span class="label">Roll Number</span>
                    <span class="value">${u.rollNo || 'Pending'}</span>
                  </div>
                </div>

                <div class="field">
                  <span class="label">Permanent Residential Address</span>
                  <span class="value">${u.address || '____________________________________________________________________'}</span>
                </div>

                <div class="section-title">Academic & Contact</div>
                <table class="academic-table">
                  <tr>
                    <th>Enrolled Subjects / Courses</th>
                    <th>Contact Phone Number</th>
                  </tr>
                  <tr>
                    <td>${u.subjectsEnrolled?.join(', ') || 'General Curriculum'}</td>
                    <td>${u.phone || 'Not Provided'}</td>
                  </tr>
                </table>

                <div style="margin-top: 10mm; font-size: 9pt; line-height: 1.5; color: #444; border: 1px solid #eee; padding: 4mm; border-radius: 4px;">
                  <strong>Declaration:</strong> I hereby declare that the information provided above is true to the best of my knowledge. I agree to abide by the rules and regulations of the institute.
                </div>

                <div class="footer">
                  <div class="sig-line">Parent Signature</div>
                  <div class="qr-zone">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://${window.location.host}/verify/profile/${u.uid}">
                    <div style="font-size: 7pt; font-weight: 800; margin-top: 1mm; color: #0d9488;">VERIFIED IDENTITY</div>
                  </div>
                  <div class="sig-line">Admin/Principal Signature</div>
                </div>
                
                <div style="position: absolute; bottom: 8mm; width: 100%; text-align: center; font-size: 8pt; color: #888;">
                  Generated on ${format(new Date(), 'dd-MM-yyyy hh:mm a')} | Ref: ${u.uid}
                </div>
              </div>
            `).join('')}
            <script>
              window.onload = () => {
                setTimeout(() => { window.print(); window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
    } else {
      // Small fee summary report
      printWindow.document.write(`
        <html>
          <head><title>Fee Summary</title></head>
          <body>
            <h1>Fee Summary Report</h1>
            <table border="1" width="100%" cellpadding="10" style="border-collapse: collapse;">
              <thead>
                <tr>
                  <th>Admission No</th>
                  <th>Student Name</th>
                  <th>Class Level</th>
                  <th>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                ${selectedDocs.map(u => `
                  <tr>
                    <td>${u.admissionNo || 'N/A'}</td>
                    <td>${u.displayName}</td>
                    <td>${u.classLevel || 'N/A'}</td>
                    <td>Pending Calculation</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>window.onload = () => { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
    }
    printWindow.document.close();
  };
  const subjectsOptions = SUBJECT_OPTIONS;
  const classLevels = CLASS_LEVELS;

  const isSuperAdmin = currentUser?.email?.toLowerCase() === 'zeeshanmaqbool200@gmail.com' || currentUser?.uid === 'sZUiAgoSF8MTPBQAOtj6jbFkot93';
  const role = currentUser?.role || 'student';
  const isManagerRole = role === 'manager' || (role === 'superadmin' && !isSuperAdmin);
  const isTeacherRole = role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isSuperAdmin || isManagerRole || isTeacherRole;
  const canAddStudent = isStaff;
  const canAddTeacher = isSuperAdmin || isManagerRole;

  const [refreshKey, setRefreshKey] = useState(0);

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
    setSnackbar({ open: true, message: 'Refreshing data...', severity: 'success' });
  };

  const confirmSystemReset = async () => {
    const confirmText = purgeType === 'ALL' ? "RESET ALL USERS" : "PURGE STUDENTS";
    if (resetConfirmText.trim().toUpperCase() !== confirmText.toUpperCase()) {
      setSnackbar({ open: true, message: 'Confirmation text does not match!', severity: 'error' });
      return;
    }

    setResetConfirmOpen(false);
    setLoading(true);
    try {
      const collectionsToClear = purgeType === 'ALL' 
        ? ['users', 'attendance', 'exams', 'fees', 'notifications', 'schedule', 'access_logs', 'system_logs']
        : ['users', 'attendance', 'exams', 'fees'];

      let totalDeleted = 0;

      for (const collectionName of collectionsToClear) {
        let snapshot;
        if (purgeType === 'STUDENTS' && (collectionName === 'users' || collectionName === 'attendance' || collectionName === 'fees' || collectionName === 'exams')) {
          if (collectionName === 'users') {
            snapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
          } else {
             // For simplicity in STUDENTS mode, we clear these collections as they are student-heavy
             snapshot = await getDocs(collection(db, collectionName));
          }
        } else {
          snapshot = await getDocs(collection(db, collectionName));
        }
        
        const docs = snapshot.docs;
        const chunks = [];
        for (let i = 0; i < docs.length; i += 500) {
          chunks.push(docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(docSnap => {
            // PROTECT THE SUPER ADMIN - DONT DELETE THEM
            if (collectionName === 'users') {
              const data = docSnap.data();
              const isSA = data.email?.toLowerCase() === 'zeeshanmaqbool200@gmail.com' || data.role === 'superadmin';
              if (!isSA) {
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
    if (isSuperAdmin || isManagerRole) {
      q = query(collection(db, 'users'));
    } else if (isTeacherRole) {
      // Teacher can only see students in their assigned classes or Example class
      // OR students with pending levels that match their assigned classes
      const classes = (currentUser?.assignedClasses && currentUser.assignedClasses.length > 0) ? currentUser.assignedClasses : ['__none__'];
      q = query(
        collection(db, 'users'), 
        and(
          where('role', '==', 'student'),
          or(
            where('classLevel', 'in', classes),
            where('classLevel', '==', 'Example'),
            where('pendingClassLevel', 'in', classes)
          )
        )
      );
    } else {
      // Pending teacher see nothing or just themselves
      q = query(collection(db, 'users'), where(documentId(), '==', currentUser?.uid || 'none'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allUsers = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[];
      
      // Sort client-side to ensure documents missing displayName still appear
      allUsers.sort((a, b) => {
        const nameA = (a.displayName || '').toLowerCase();
        const nameB = (b.displayName || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      setUsers(allUsers);
      setLoading(false);
      (window as any)._usersLoaded = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isSuperAdmin, isManagerRole, isTeacherRole, currentUser?.assignedClasses, currentUser?.uid, refreshKey]);

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

  const [createAuthAccount, setCreateAuthAccount] = useState(true);

  // Consolidated Action Menu Component using shared ActionMenu
  const UserActionMenu = ({ user: targetUser }: { user: any }) => {
    const isTargetSuperAdmin = targetUser.role === 'superadmin';
    const canManageUser = isSuperAdmin || (isAdmin && !isTargetSuperAdmin);

    const items: ActionMenuItem[] = [
      { 
        label: 'View Profile', 
        icon: <ExternalLink size={16} />, 
        onClick: () => { setProfileToView(targetUser); setOpenViewProfile(true); } 
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
      },
      { 
        label: 'Approve Class', 
        icon: <CheckCircle size={16} />, 
        color: 'success.main', 
        onClick: () => handleApproveClass(targetUser),
        disabled: !(isAdmin && targetUser.pendingClassLevel)
      },
      { 
        label: 'Reject Class', 
        icon: <XCircle size={16} />, 
        color: 'error.main', 
        onClick: () => handleRejectClass(targetUser),
        disabled: !(isAdmin && targetUser.pendingClassLevel)
      },
      { 
        label: 'Approve Teacher', 
        icon: <UserCheck size={16} />, 
        color: 'success.main', 
        onClick: () => handleApproveTeacher(targetUser),
        disabled: !(isSuperAdmin && targetUser.role === 'pending_teacher')
      },
      { 
        label: 'Reject Teacher', 
        icon: <XCircle size={16} />, 
        color: 'error.main', 
        onClick: () => handleRejectTeacher(targetUser),
        disabled: !(isSuperAdmin && targetUser.role === 'pending_teacher')
      },
      { divider: true, label: '', icon: null, onClick: () => {} },
      { 
        label: 'Delete Account', 
        icon: <Trash2 size={16} />, 
        color: 'error.main', 
        onClick: () => handleDelete(targetUser.uid, targetUser),
        disabled: !canManageUser
      }
    ];

    return <ActionMenu items={items} />;
  };

  const handleSave = async () => {
    try {
      let finalFormData = { ...formData };
      
      // Email existence check in Firestore
      if (!editingUser) {
        const emailCheckQ = query(collection(db, 'users'), where('email', '==', finalFormData.email));
        const emailCheckSnap = await getDocs(emailCheckQ);
        if (!emailCheckSnap.empty) {
          setSnackbar({ open: true, message: 'This email is already registered in the database!', severity: 'error' });
          return;
        }
      }

      // Auto-assign admission number for new students if not provided
      if (!editingUser && formData.role === 'student' && !formData.admissionNo) {
        const year = format(new Date(), 'yyyy');
        const timestamp = Date.now().toString().slice(-4);
        const namePart = (formData.displayName || 'USR').slice(0, 3).toUpperCase();
        finalFormData.admissionNo = `ADM-${year}-${namePart}-${timestamp}`;
      }

      // Auto-assign teacherId if not provided
      if (!editingUser && formData.role === 'teacher' && !formData.teacherId) {
        const timestamp = Date.now().toString().slice(-4);
        const namePart = (formData.displayName || 'TCH').slice(0, 3).toUpperCase();
        finalFormData.teacherId = `TCH-${namePart}-${timestamp}`;
      }

      // Synchronize classLevel for students
      if (finalFormData.role === 'student') {
        if (!finalFormData.classLevel) {
          setSnackbar({ open: true, message: 'Please select a Class Level for the student.', severity: 'error' });
          return;
        }
      }

      // Auto-generate password if not provided or use student specific format
      if (!editingUser && finalFormData.role === 'student') {
        const namePart = finalFormData.displayName.split(' ')[0] || 'Student';
        finalFormData.password = `${namePart}@123`;
      } else if (!editingUser && !finalFormData.password) {
        finalFormData.password = 'Student@123';
      }

      if (editingUser) {
        const { password: _, ...dataToUpdate } = finalFormData as any;
        await smartUpdateDoc(doc(db, 'users', editingUser.uid), {
          ...dataToUpdate,
          updatedAt: serverTimestamp()
        });
      } else {
        setLoading(true);
        
        let uid: string;

        if (createAuthAccount) {
          // Create Firebase Auth User for student using a secondary App instance 
          // to avoid signing out the current admin
          try {
            const secondaryApp = initializeApp(firebaseConfig, `user-creation-${Date.now()}`);
            const secondaryAuth = getAuth(secondaryApp);
            
            // Generate password in Name@123 format if not explicitly provided
            // Ensure minimum 6 characters for Firebase Auth
            if (!finalFormData.password) {
              const namePart = (finalFormData.displayName || 'User').split(' ')[0];
              const safeName = namePart.length >= 2 ? namePart : `${namePart}User`;
              const capitalized = safeName.charAt(0).toUpperCase() + safeName.slice(1).toLowerCase();
              finalFormData.password = `${capitalized}@123`;
            } else if (finalFormData.password.length < 6) {
              // Pad passwords that are too short to avoid 400 WEAK_PASSWORD
              finalFormData.password = finalFormData.password.padEnd(6, '0');
            }

            const userCredential = await createUserWithEmailAndPassword(
              secondaryAuth, 
              finalFormData.email, 
              finalFormData.password
            );
            
            await updateProfile(userCredential.user, {
              displayName: finalFormData.displayName,
              photoURL: finalFormData.photoURL
            });

            uid = userCredential.user.uid;
            await deleteApp(secondaryApp);
          } catch (authError: any) {
            console.error('Auth User Creation Error:', authError);
            let errorMessage = authError.message;
            if (authError.code === 'auth/email-already-in-use') {
              errorMessage = 'Conflict: Email already exists in Auth system.';
            } else if (authError.code === 'auth/weak-password') {
              errorMessage = 'Password must be at least 6 characters.';
            } else if (authError.code === 'auth/invalid-email') {
              errorMessage = 'The email address is badly formatted.';
            } else if (authError.message?.includes('400')) {
              errorMessage = 'Auth Service Error (400): Ensure Email/Password provider is enabled in Firebase Console.';
            }
            setSnackbar({ open: true, message: errorMessage, severity: 'error' });
            setLoading(false);
            return;
          }
        } else {
          // Just Firestore entry
          uid = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Prepare doc
        const userData = {
          ...finalFormData,
          uid,
          id: uid, 
          instituteId: instituteSettings.id || 'default',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          role: finalFormData.role === 'pending_teacher' ? 'pending_teacher' : finalFormData.role,
          photoURL: finalFormData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalFormData.displayName)}&background=random&color=fff`,
          authEnabled: createAuthAccount
        };
        
        if (tabValue === 0) userData.role = 'student';
        const { password: _, ...dataToStore } = userData as any;

        try {
          await setDoc(doc(db, 'users', uid), dataToStore);
          setSnackbar({ open: true, message: createAuthAccount ? `Registration Success! Pass: ${finalFormData.password}` : 'Student added to database successfully', severity: 'success' });
          logger.success('User added', finalFormData.email);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
          throw error;
        } finally {
          setLoading(false);
        }
      }

      if (!stayOpen) {
        setOpenDialog(false);
        setEditingUser(null);
      } else {
        // Reset form for next student but keep level/subjects if student
        setFormData(prev => ({
          ...prev,
          displayName: '',
          email: '',
          phone: '',
          admissionNo: '', // Will be auto-generated by useEffect
          photoURL: '',
          dob: '',
          rollNo: ''
        }));
      }

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
    // Remove global loading to prevent full page jump
    // setLoading(true); 
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
      // Using documentId() since id is the doc id
      await smartDeleteDoc(doc(db, 'users', id));
      
      // Optionally remove from state if onSnapshot is slow (but it should be fast)
      setUsers(prev => prev.filter(u => u.uid !== id));
      
      setSnackbar({ 
        open: true, 
        message: `${userToDelete.displayName} data purged. Student no longer exists in students list.`, 
        severity: 'success' 
      });
      logger.success('User data purged permanently', userToDelete.email);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
      setSnackbar({ open: true, message: 'Error purging user records', severity: 'error' });
    } finally {
      // setLoading(false);
      setUserToDeleteRef(null);
    }
  };

  const handleApproveClass = async (user: UserProfile) => {
    try {
      const updateData: any = {
        classLevel: user.pendingClassLevel,
        pendingClassLevel: null,
        status: 'Active'
      };

      // Auto-assign admission number if missing on approval
      if (user.role === 'student' && !user.admissionNo) {
        const year = format(new Date(), 'yyyy');
        const timestamp = Date.now().toString().slice(-4);
        const namePart = (user.displayName || 'STU').slice(0, 3).toUpperCase();
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
        pendingClassLevel: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleApproveTeacher = async (user: UserProfile) => {
    try {
      await smartUpdateDoc(doc(db, 'users', user.uid), {
        role: 'teacher',
        status: 'Active'
      });
      logger.success(`Teacher ${user.displayName} approved`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleRejectTeacher = async (user: UserProfile) => {
    try {
      await smartUpdateDoc(doc(db, 'users', user.uid), {
        role: 'student', // Revert to student or deactivate
        status: 'Inactive'
      });
      logger.info(`Teacher ${user.displayName} rejected`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handlePromote = async () => {
    if (!promotingUser || !newClassLevel) return;
    try {
      await smartUpdateDoc(doc(db, 'users', promotingUser.uid), {
        classLevel: newClassLevel
      });
      setOpenPromoteDialog(false);
      setPromotingUser(null);
      setNewClassLevel('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${promotingUser.uid}`);
    }
  };

  const filteredUsers = users.filter(u => {
    // Hide super admin from the list to prevent accidental deletion
    if (u.email === 'zeeshanmaqbool200@gmail.com') return false;

    const s = searchQuery.toLowerCase();
    const matchesSearch = u.displayName.toLowerCase().includes(s) || 
                         u.email.toLowerCase().includes(s) ||
                         (u.admissionNo && u.admissionNo.toLowerCase().includes(s)) ||
                         (u.teacherId && u.teacherId.toLowerCase().includes(s)) ||
                         (u.fatherName && u.fatherName.toLowerCase().includes(s)) ||
                         (u.rollNo && u.rollNo.toString().includes(s));
    
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
    const matchesLevel = levelFilter === 'All' || u.classLevel === levelFilter;
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;

    if (!matchesStatus || !matchesLevel || !matchesRole) return false;

    if (tabValue === 0) return u.role === 'student' && matchesSearch;
    if (tabValue === 1) return (u.role === 'teacher' || u.role === 'manager' || u.role === 'superadmin' || u.role === 'pending_teacher') && matchesSearch;
    if (tabValue === 2) return (u.pendingClassLevel) && matchesSearch;
    return matchesSearch;
  });

  if (loading) return (
    <Box sx={{ p: 4, width: '100%' }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="text" width="30%" height={60} />
          <Skeleton variant="rectangular" width={150} height={50} sx={{ borderRadius: 2 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={200} height={40} sx={{ borderRadius: 1 }} />
        </Box>
        <Skeleton variant="rectangular" width="100%" height={500} sx={{ borderRadius: 4 }} />
      </Stack>
    </Box>
  );

  const handleExport = () => {
    const roleLabel = tabValue === 0 ? 'Students' : tabValue === 1 ? 'Teachers' : 'Staff';
    const usersToExport = filteredUsers.map(u => ({
      Name: u.displayName,
      Email: u.email,
      Role: u.role,
      Phone: u.phone || 'N/A',
      Level: u.classLevel || 'N/A',
      ID: u.admissionNo || u.teacherId || 'N/A',
      Status: u.status,
      Address: u.address || 'N/A'
    }));
    exportToCSV(usersToExport, `Institute_${roleLabel}_Export`);
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
          Back
        </Button>
      </Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography 
              variant="h4" 
              className={tabValue === 0 || tabValue === 1 ? "urdu-text" : ""}
              sx={{ 
                fontFamily: tabValue === 0 || tabValue === 1 ? 'var(--font-urdu)' : 'var(--font-display)',
                fontWeight: 900, 
                letterSpacing: -1, 
                mb: 0.5,
                color: 'primary.main',
                lineHeight: 1.5
              }}
            >
              {tabValue === 0 ? 'طالب علم (Talaba)' : tabValue === 1 ? 'اساتذہ اور سٹاف' : 'Naye Talaba'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
              System Directory & Access Control
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end', alignItems: 'center' }}>
            <Box sx={{ 
              display: 'flex', 
              bgcolor: 'background.default', 
              p: 0.6, 
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('grid')}
                sx={{ 
                  borderRadius: 2, 
                  bgcolor: viewMode === 'grid' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'grid' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  color: viewMode === 'grid' ? 'primary.main' : 'text.secondary',
                }}
              >
                <Layout size={18} />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('list')}
                sx={{ 
                  borderRadius: 2, 
                  bgcolor: viewMode === 'list' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'list' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  color: viewMode === 'list' ? 'primary.main' : 'text.secondary',
                }}
              >
                <Layers size={18} />
              </IconButton>
            </Box>

            <ActionMenu 
              icon={
                <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.5, display: 'flex' }}>
                  <MoreVertical size={20} />
                </Box>
              }
              items={[
                { label: 'Data Export Karein', icon: <Download size={18} />, onClick: handleExport, disabled: !isAdmin },
                { label: 'Taza Karein (Refresh)', icon: <RotateCcw size={18} />, onClick: handleManualRefresh },
                { 
                  label: 'Admission Forms Print Karein', 
                  icon: <Printer size={18} />, 
                  onClick: () => {
                    const selectedDocs = users.filter(u => selectedUsers.includes(u.uid));
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Bulk Admission Forms</title>
                            <style>
                              @page { size: A4; margin: 0; }
                              body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
                              .page {
                                width: 210mm;
                                height: 297mm;
                                padding: 15mm;
                                box-sizing: border-box;
                                page-break-after: always;
                                border: 1px solid #eee;
                              }
                              .header { display: flex; align-items: center; border-bottom: 3px solid black; padding-bottom: 5mm; margin-bottom: 10mm; position: relative; }
                              .logo-container { width: 35mm; height: 35mm; margin-right: 10mm; flex-shrink: 0; }
                              .logo { width: 100%; height: 100%; object-fit: contain; }
                              .title-box { flex: 1; }
                              .inst-name { font-size: 24pt; font-weight: 900; text-transform: uppercase; margin: 0; font-family: 'Cinzel', serif; }
                              .tagline { font-size: 12pt; font-weight: 700; margin: 2mm 0; }
                              .form-title { border: 2px solid black; padding: 2mm 5mm; font-weight: 900; display: inline-block; font-size: 14pt; }
                              .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 5mm; }
                              .field-row { border-bottom: 1px solid black; padding: 3mm 0; display: flex; align-items: baseline; }
                              .field-label { width: 40mm; font-weight: 800; font-size: 10pt; flex-shrink: 0; }
                              .field-value { font-size: 11pt; border-bottom: 1px solid transparent; }
                              .photo-box { width: 35mm; height: 45mm; border: 1px dashed black; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 8pt; margin-left: auto; overflow: hidden; }
                              .photo-box img { width: 100%; height: 100%; object-fit: cover; }
                              .section-title { font-weight: 900; font-size: 12pt; border-bottom: 2px solid black; display: inline-block; margin: 10mm 0 5mm 0; text-transform: uppercase; }
                              .academic-table { width: 100%; border-collapse: collapse; margin-top: 5mm; }
                              .academic-table td { border: 1px solid black; padding: 3mm; width: 50%; height: 20mm; vertical-align: top; }
                              .table-head { background-color: #f0f0f0; font-weight: 900; font-size: 9pt; }
                              .footer { margin-top: 20mm; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 10mm; }
                              .sign-box { text-align: center; border-top: 1px solid black; width: 40mm; padding-top: 2mm; font-weight: 800; font-size: 9pt; }
                              .qr-box { text-align: center; }
                              .qr-box img { width: 25mm; height: 25mm; }
                            </style>
                          </head>
                          <body>
                            ${selectedDocs.map(u => `
                              <div class="page">
                                <div class="header">
                                  <div class="logo-container" style="position: relative; padding: 4mm;">
                                    <div style="position: absolute; inset: 0; background: rgba(13, 148, 136, 0.1); border-radius: 50%; border: 1px solid rgba(13, 148, 136, 0.3);"></div>
                                    <img class="logo" src="${instituteSettings.logoUrl}" style="position: relative; z-index: 1;" onerror="this.src='https://ui-avatars.com/api/?name=${u.displayName}&background=0d9488&color=fff'">
                                  </div>
                                  <div class="title-box">
                                    <h1 class="inst-name">${instituteSettings.instituteName || 'INSTITUTE NAME'}</h1>
                                    <p class="tagline">${instituteSettings.tagline || ''}</p>
                                    <p style="font-size: 9pt;">${instituteSettings.address || ''} | ${instituteSettings.phone || ''}</p>
                                  </div>
                                  <div style="text-align: right;">
                                    <div class="form-title">ADMISSION FORM</div>
                                    <p style="font-weight: 800; margin-top: 5mm;">Session: ${new Date().getFullYear()}-${new Date().getFullYear() + 1}</p>
                                  </div>
                                </div>
                                <div class="content-grid">
                                  <div>
                                    <div class="field-row">
                                      <span class="field-label">Student Name:</span>
                                      <span class="field-value">${u.displayName}</span>
                                    </div>
                                    <div class="field-row">
                                      <span class="field-label">Father's Name:</span>
                                      <span class="field-value">${u.fatherName || '____________________'}</span>
                                    </div>
                                    <div class="field-row">
                                      <span class="field-label">Mother's Name:</span>
                                      <span class="field-value">${u.motherName || '____________________'}</span>
                                    </div>
                                    <div class="field-row">
                                      <span class="field-label">Date of Birth:</span>
                                      <span class="field-value">${u.dob ? format(new Date(u.dob), 'dd MMMM yyyy') : '____________________'}</span>
                                    </div>
                                  </div>
                                  <div class="photo-box">
                                    ${u.photoURL ? `<img src="${u.photoURL}">` : 'PASTE PHOTO'}
                                  </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 5mm;">
                                  <div class="field-row">
                                    <span class="field-label">Admission No:</span>
                                    <span class="field-value">${u.admissionNo || u.uid}</span>
                                  </div>
                                  <div class="field-row">
                                    <span class="field-label">Class / Level:</span>
                                    <span class="field-value">${u.classLevel || 'N/A'}</span>
                                  </div>
                                  <div class="field-row">
                                    <span class="field-label">Phone No:</span>
                                    <span class="field-value">${u.phone || '____________________'}</span>
                                  </div>
                                  <div class="field-row">
                                    <span class="field-label">Admission Date:</span>
                                    <span class="field-value">${u.admissionDate || format(new Date(), 'dd-MM-yyyy')}</span>
                                  </div>
                                </div>
                                <div class="field-row" style="width: 100%;">
                                  <span class="field-label">Home Address:</span>
                                  <span class="field-value">${u.address || '____________________________________________________________'}</span>
                                </div>
                                <div class="section-title">Academic Details</div>
                                <table class="academic-table">
                                  <tr class="table-head">
                                    <td>Enrolled Subjects</td>
                                    <td>Previous Academic Record</td>
                                  </tr>
                                  <tr>
                                    <td>${u.subjectsEnrolled?.join(', ') || 'N/A'}</td>
                                    <td>N/A</td>
                                  </tr>
                                </table>
                                <div class="footer">
                                  <div class="sign-box">Parent / Guardian Signature</div>
                                  <div class="qr-box">
                                    <div style="font-weight: 800; font-size: 6pt; margin-bottom: 1mm;">SECURE QR</div>
                                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://${window.location.host}/verify/profile/${u.uid}">
                                  </div>
                                  <div class="sign-box">Principal / Admin Signature</div>
                                </div>
                                <p style="text-align: center; font-size: 7pt; color: #777; margin-top: 15mm; font-style: italic;">
                                  This is a computer-generated admission form. All rights reserved by ${instituteSettings.instituteName}.
                                </p>
                              </div>
                            `).join('')}
                            <script>
                              window.onload = () => {
                                window.print();
                              };
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  },
                  disabled: selectedUsers.length === 0 
                },
                { divider: true, label: '', icon: null, onClick: () => {} },
                { 
                  label: 'Purge System Data', 
                  icon: <Database size={18} />, 
                  color: 'error.main', 
                  onClick: () => { setPurgeType('ALL'); setResetConfirmOpen(true); },
                  disabled: !isSuperAdmin 
                },
              ]}
            />
            
            {canAddStudent && (
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<UserPlus size={20} />} 
                onClick={() => {
                  setEditingUser(null);
                  setFormData({ 
                    displayName: '', 
                    email: '', 
                    password: 'password123',
                    role: tabValue === 1 ? 'teacher' : 'student', 
                    phone: '',
                    classLevel: '' as ClassLevel, 
                    admissionNo: '', 
                    teacherId: '', 
                    dob: '',
                    fatherName: '', 
                    motherName: '', 
                    rollNo: '', 
                    admissionDate: format(new Date(), 'yyyy-MM-dd'),
                    address: '', 
                    subject: '', 
                    subjectsEnrolled: [], 
                    assignedClasses: [], 
                    status: 'Active',
                    photoURL: ''
                  });
                  setOpenDialog(true);
                }}
                sx={{ 
                  borderRadius: 2, 
                  fontWeight: 800, 
                  px: 3, 
                  py: 1.2,
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  '&:hover': { transform: 'translateY(-2px)' }
                }}
              >
                {isMobile ? "Add" : (tabValue === 0 ? 'Naya Talib-e-Ilm' : 'Naya Ustad')}
              </Button>
            )}
          </Stack>
        </Box>
      </motion.div>

      {/* Stats Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SummaryCard title="Kul Talaba" value={users.filter(u => u.role === 'student').length} icon={<GraduationCap size={24} />} color="primary" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SummaryCard title="Kul Asatiza" value={users.filter(u => u.role === 'teacher').length} icon={<UserCheck size={24} />} color="success" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SummaryCard title="Administrators" value={users.filter(u => u.role === 'manager' || u.role === 'superadmin').length} icon={<Shield size={24} />} color="secondary" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <SummaryCard title="Active Now" value={users.filter(u => u.status === 'Active').length} icon={<Clock size={24} />} color="warning" />
        </motion.div>
      </Box>

      {/* Floating Bulk Actions Bar */}
      <AnimatePresence>
        {selectedUsers.length > 0 && (
          <Box
            component={motion.div}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            sx={{
              position: 'fixed',
              bottom: { xs: 80, md: 30 },
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              bgcolor: 'background.paper',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              borderRadius: 4,
              p: 2,
              px: { xs: 2, md: 4 },
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 2, md: 4 },
              border: '2px solid',
              borderColor: 'primary.main',
              minWidth: { xs: '90%', md: 600 },
              maxWidth: '95%'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
              <Box sx={{ bgcolor: 'primary.main', color: 'white', width: 28, height: 28, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                {selectedUsers.length}
              </Box>
              <Typography sx={{ fontWeight: 800, color: 'text.primary', fontSize: { xs: '0.8rem', md: '1rem' } }}>
                {selectedUsers.length} Selected
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ opacity: 0.5 }} />

            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, justifyContent: 'flex-end', overflowX: 'auto', p: 0.5 }}>
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<X size={16} />} 
                onClick={() => setSelectedUsers([])}
                sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none', color: 'text.secondary', borderColor: 'divider', flexShrink: 0 }}
              >
                Clear
              </Button>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Printer size={16} />} 
                onClick={() => handleBulkPrint('admission')}
                sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none', bgcolor: 'primary.main', flexShrink: 0 }}
              >
                Admission Forms
              </Button>
              {tabValue === 0 && (
                <Button 
                  variant="outlined" 
                  size="small" 
                  startIcon={<FileText size={16} />} 
                  onClick={() => handleBulkPrint('receipt')}
                  sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none', color: 'primary.main', borderColor: 'primary.main', flexShrink: 0 }}
                >
                  Fee Summary
                </Button>
              )}
              {isSuperAdmin && (
                <Button 
                  variant="outlined" 
                  size="small" 
                  color="error"
                  startIcon={<Trash2 size={16} />} 
                  onClick={handleBulkDelete}
                  sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none', flexShrink: 0 }}
                >
                  Delete
                </Button>
              )}
            </Box>
          </Box>
        )}
      </AnimatePresence>

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
            <Tab label="Talaba" icon={<GraduationCap size={20} />} iconPosition="start" />
            <Tab label="Asatiza" icon={<UserCheck size={20} />} iconPosition="start" />
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                Manzoori (Pending)
                {users.filter(u => u.pendingClassLevel).length > 0 && (
                  <Chip 
                    label={users.filter(u => u.pendingClassLevel).length} 
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
                  borderRadius: 3, 
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  flex: 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                }}
              >
                <Search size={18} color={theme.palette.text.secondary} />
                <Box 
                  component="input" 
                  placeholder={`Search ${tabValue === 0 ? 'Talaba' : 'Asatiza'}...`} 
                  value={searchQuery}
                  onChange={(e: any) => setSearchQuery(e.target.value)}
                  sx={{ 
                    border: 'none', 
                    outline: 'none', 
                    p: 1.2, 
                    width: '100%', 
                    fontWeight: 600,
                    fontSize: '0.875rem',
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
                      {classLevels.map(level => (
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
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedUsers.length > 0 && selectedUsers.length < filteredUsers.length}
                      checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, py: 2.5 }}>Profile</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Admission No / ID</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>{tabValue === 0 ? 'Class Level' : 'Subject'}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Contact Info</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map((user) => {
                    const isItemSelected = selectedUsers.includes(user.uid);
                    return (
                      <TableRow 
                        component={motion.tr}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={user.uid} 
                        hover
                        selected={isItemSelected}
                        onClick={(e) => {
                          // Prevent click from triggering when clicking on user actions (like buttons inside)
                          if ((e.target as HTMLElement).closest('.action-menu-trigger')) return;
                          handleSelectOne(user.uid);
                        }}
                        sx={{ transition: 'all 0.2s', cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isItemSelected}
                            onChange={() => handleSelectOne(user.uid)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
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
                            {user.role === 'student' ? (user.classLevel || (user.pendingClassLevel ? 'Pending...' : 'N/A')) : (user.subject || 'N/A')}
                          </Typography>
                          {(user.pendingClassLevel) && (
                            <Chip 
                              label={`Req: ${user.pendingClassLevel}`} 
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
                        <UserActionMenu user={user} />
                      </TableCell>
                    </TableRow>
                  );
                })}
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
                        actionMenu={<UserActionMenu user={user} />}
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
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No Students/Teachers found</Typography>
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
        PaperProps={{ sx: { borderRadius: 3, p: isMobile ? 1 : 2, boxShadow: '0 5px 20px rgba(0,0,0,0.05)' } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: isMobile ? '1.25rem' : '1.75rem', pb: 2, px: isMobile ? 2 : 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <UserPlus size={isMobile ? 24 : 32} className="text-primary-500" />
            {editingUser ? 'Update Profile' : 'New User Registration'}
          </Box>
          <IconButton onClick={() => setOpenDialog(false)} className="close-button">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: isMobile ? 2 : 4, py: 2 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontWeight: 500, lineHeight: 1.6 }}>
            Please provide the following details to register or update a member in the system.
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
            {!editingUser && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Temporary Password"
                    required
                    placeholder="Set email pass"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    helperText="Default will be Name@123 (min 6 chars)"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    p: 2, 
                    borderRadius: 3, 
                    border: '1px solid', 
                    borderColor: 'divider',
                    bgcolor: alpha(theme.palette.primary.main, 0.05)
                  }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Enable App Access</Typography>
                      <Typography variant="caption" color="text.secondary">Create login account for this user</Typography>
                    </Box>
                    <Switch 
                      checked={createAuthAccount} 
                      onChange={(e) => setCreateAuthAccount(e.target.checked)}
                      color="primary"
                    />
                  </Box>
                </Grid>
              </>
            )}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                <InputLabel>Role / Designation</InputLabel>
                  <Select
                    value={formData.role}
                    label="Role / Designation"
                    disabled={!canAddStudent && formData.role === 'student'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  >
                    <MenuItem value="student">Student</MenuItem>
                    {canAddTeacher && <MenuItem value="manager">Administrator</MenuItem>}
                    {canAddTeacher && <MenuItem value="teacher">Teacher</MenuItem>}
                    {canAddTeacher && <MenuItem value="pending_teacher">Pending Registration</MenuItem>}
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
                    <InputLabel>Class Level</InputLabel>
                    <Select
                      value={formData.classLevel}
                      label="Class Level"
                      onChange={(e) => setFormData({ ...formData, classLevel: e.target.value as ClassLevel })}
                    >
                      {classLevels.map(level => (
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
                    label="Teacher ID"
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
                        {classLevels.map((level) => (
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
        <DialogActions sx={{ p: 3, gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
          {!editingUser && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input 
                type="checkbox" 
                id="stay-open" 
                checked={stayOpen} 
                onChange={(e) => setStayOpen(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded" 
              />
              <Typography variant="caption" sx={{ fontWeight: 700, cursor: 'pointer' }} component="label" htmlFor="stay-open">
                Agla Talib-e-Ilm Shamil Karein (Save and stay)
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              onClick={() => setOpenDialog(false)} 
              variant="outlined" 
              sx={{ fontWeight: 800, color: 'text.secondary', borderRadius: 3, px: 3 }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              variant="contained" 
              startIcon={<Save size={18} />} 
              disabled={!formData.displayName || !formData.email}
              sx={{ borderRadius: 3, fontWeight: 800, px: 4, boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}` }}
            >
              {editingUser ? 'Profile Update' : 'Admission Karein'}
            </Button>
          </Box>
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
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Tasveer Lejiye</Typography>
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
          Promote Student
          <IconButton onClick={() => setOpenPromoteDialog(false)} className="close-button">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            <strong>{promotingUser?.displayName}</strong> ke liye agli class select karein.
          </Typography>
          <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
            <InputLabel>New Class Level</InputLabel>
            <Select
              value={newClassLevel}
              label="New Class Level"
              onChange={(e) => setNewClassLevel(e.target.value as ClassLevel)}
            >
              {classLevels.map(level => (
                <MenuItem key={level} value={level}>{level}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenPromoteDialog(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button onClick={handlePromote} variant="contained" disabled={!newClassLevel} sx={{ borderRadius: 3, fontWeight: 800 }}>
            Promotion Confirm Karein
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
              bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'white',
              color: 'text.primary'
            }
          } 
        }}
      >
        <DialogTitle className="no-print" sx={{ p: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.05) }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FileText size={24} className="text-primary-500" />
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                {viewProfileMode === 'digital' ? 'Student Profile Card' : 'Admission Form (Preview)'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tabs 
                value={viewProfileMode} 
                onChange={(_, v) => setViewProfileMode(v)} 
                sx={{ 
                  minHeight: 0, 
                  mr: 2,
                  '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' }
                }}
              >
                <Tab value="digital" label="Digital View" sx={{ minHeight: 40, fontWeight: 800, textTransform: 'none' }} />
                <Tab value="print" label="Print Mode" sx={{ minHeight: 40, fontWeight: 800, textTransform: 'none' }} />
              </Tabs>
              <IconButton 
                onClick={handlePrint} 
                size="small" 
                className="print-button"
                sx={{ bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'white', color: 'primary.dark', borderRadius: 2, '&:hover': { bgcolor: 'grey.100' } }}
              >
                <Printer size={18} />
              </IconButton>
              <IconButton onClick={() => setOpenViewProfile(false)} size="small" sx={{ borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'white' }}>
                <X size={18} />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ 
          p: viewProfileMode === 'digital' ? 3 : 0,
          bgcolor: viewProfileMode === 'digital' ? 'background.default' : 'white',
          '@media print': {
            overflow: 'visible',
            height: 'auto'
          }
        }}>
          {viewProfileMode === 'digital' ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                <Card sx={{ 
                  borderRadius: 6, 
                  overflow: 'hidden', 
                  border: 'none',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '20px 20px 60px #060a12, -20px -20px 60px #182442'
                    : '20px 20px 60px #d1d9e6, -20px -20px 60px #ffffff',
                }}>
                  <Box sx={{ 
                    h: 160, 
                    bgcolor: 'primary.main', 
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    position: 'relative',
                    p: 3,
                    display: 'flex',
                    alignItems: 'flex-end'
                  }}>
                    <Avatar 
                      src={profileToView?.photoURL}
                      sx={{ 
                        width: 140, 
                        height: 140, 
                        border: '6px solid', 
                        borderColor: 'background.paper', 
                        mb: -10,
                        zIndex: 2,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                      }}
                    >
                      {profileToView?.displayName?.charAt(0)}
                    </Avatar>
                  </Box>
                  <Box sx={{ pt: 12, p: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: -1 }}>
                          {profileToView?.displayName}
                        </Typography>
                        <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mt: 0.5 }}>
                          {profileToView?.classLevel} • {profileToView?.admissionNo || 'No ID'}
                        </Typography>
                      </Box>
                      <Chip 
                        label={profileToView?.status} 
                        color={profileToView?.status === 'Active' ? 'success' : 'error'}
                        sx={{ fontWeight: 900, borderRadius: 2 }}
                      />
                    </Box>

                    <Grid container spacing={3}>
                      {[
                        { icon: <User size={18} />, label: "Father Name", value: profileToView?.fatherName },
                        { icon: <Calendar size={18} />, label: "Date of Birth", value: profileToView?.dob ? format(new Date(profileToView.dob), 'dd MMM yyyy') : 'N/A' },
                        { icon: <Phone size={18} />, label: "Contact", value: profileToView?.phone },
                        { icon: <MapPin size={18} />, label: "Address", value: profileToView?.address },
                        { icon: <Shield size={18} />, label: "Roll No", value: profileToView?.rollNo },
                        { icon: <BookOpen size={18} />, label: "Admission Date", value: profileToView?.admissionDate ? format(new Date(profileToView.admissionDate), 'dd MMM yyyy') : 'N/A' },
                      ].map((item, i) => (
                        <Grid size={{ xs: 12, sm: 6 }} key={i}>
                          <Box sx={{ display: 'flex', gap: 2, p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.03), border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1) }}>
                            <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>{item.icon}</Box>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {item.label}
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 700 }}>{item.value || 'Not provided'}</Typography>
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                  <Box sx={{ p: 4, bgcolor: alpha(theme.palette.primary.main, 0.05), display: 'flex', justifyContent: 'center' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 4, display: 'inline-block', mb: 1, border: '1px solid #eee' }}>
                        <QRCodeSVG value={`https://sys.waliulaser.com/verify/${profileToView?.uid}`} size={100} />
                      </Box>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: 'text.secondary' }}>SCAN QR TO VERIFY IDENTITY</Typography>
                    </Box>
                  </Box>
                </Card>
              </Box>
            </motion.div>
          ) : (
            <Box id="printable-profile" className="admission-page" sx={{ position: 'relative', color: 'black', bgcolor: 'white', p: { xs: 0, md: 1 }, borderRadius: 0, width: '100%' }}>
              {/* Existing Admission Form Content */}
              <Box sx={{ border: '2px solid black', p: { xs: 2, md: 3 }, position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                 {/* ... existing header and grid ... */}
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
                      {instituteSettings.instituteName || instituteSettings.name || 'INSTITUTE NAME'}
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
                        <Typography variant="body2" sx={{ fontWeight: 800, width: 110, flexShrink: 0, fontSize: '0.75rem' }}>Class / Level:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{profileToView?.classLevel || 'N/A'}</Typography>
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

                  <Grid size={{ xs: 12 }} sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', px: 2, pb: 2 }}>
                     <Box sx={{ textAlign: 'center' }}>
                        <Box sx={{ width: 110, borderBottom: '1px solid black', mb: 0.5 }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Parent's Sign</Typography>
                     </Box>
                     
                     <Box sx={{ textAlign: 'center', bgcolor: '#f9fafb', p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, display: 'block', fontSize: '0.5rem', mb: 0.5 }}>SECURE VALIDATION</Typography>
                        {profileToView && <VerificationQR profile={profileToView} />}
                     </Box>

                     <Box sx={{ textAlign: 'center' }}>
                        <Box sx={{ width: 110, borderBottom: '1px solid black', mb: 0.5 }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Admin Sign</Typography>
                     </Box>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 4, pt: 1, borderTop: '1px dashed #ccc', textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'grey.700', fontSize: '0.65rem' }}>
                       Printed on {format(new Date(), 'dd-MM-yyyy hh:mm a')} via AIS Management System
                    </Typography>
                </Box>

                {/* Internal UI only section - Not for print */}
                <Box className="no-print" sx={{ mt: 4, borderTop: '2px solid #eee', pt: 3 }}>
                   <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IndianRupee size={20} className="text-primary-500" />
                      Payment History
                   </Typography>
                   {loadingReceipts ? (
                     <CircularProgress size={24} />
                   ) : studentReceipts.length > 0 ? (
                     <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                       <Table size="small">
                         <TableHead sx={{ bgcolor: 'grey.50' }}>
                           <TableRow>
                             <TableCell sx={{ fontWeight: 800 }}>Receipt</TableCell>
                             <TableCell sx={{ fontWeight: 800 }}>Category</TableCell>
                             <TableCell sx={{ fontWeight: 800 }}>Amount</TableCell>
                             <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                             <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                           </TableRow>
                         </TableHead>
                         <TableBody>
                           {studentReceipts.map(r => (
                             <TableRow key={r.id}>
                               <TableCell sx={{ fontWeight: 700 }}>{r.receiptNo}</TableCell>
                               <TableCell>{r.feeHead}</TableCell>
                               <TableCell sx={{ fontWeight: 800 }}>Rs.{r.amount}</TableCell>
                               <TableCell>
                                 <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                   {format(new Date(r.date), 'MMMM yyyy')}
                                 </Typography>
                                 <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                   {format(new Date(r.date), 'dd-MM-yyyy')}
                                 </Typography>
                               </TableCell>
                               <TableCell>
                                 <Chip 
                                   label={r.status} 
                                   size="small" 
                                   color={r.status === 'approved' ? 'success' : 'warning'} 
                                   sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                                 />
                               </TableCell>
                             </TableRow>
                           ))}
                         </TableBody>
                       </Table>
                     </TableContainer>
                   ) : (
                     <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                       No payment records found for this student.
                     </Typography>
                   )}
                </Box>
             </Box>
          </Box>
        )}
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
            Cancel
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
    </Box>
  );
}

const VerificationQR = ({ profile }: { profile: any }) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const verificationLink = `https://${window.location.host}/verify/profile/${profile.id || profile.uid}`;
    QRCode.toDataURL(verificationLink, {
      margin: 1,
      width: 150,
      color: {
        dark: '#0d9488',
        light: '#ffffff',
      },
    }).then(setUrl);
  }, [profile]);

  if (!url) return <CircularProgress size={20} />;
  return <Box component="img" src={url} sx={{ width: 100, height: 100, borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />;
};

const UserCard = React.memo(({ user, isAdmin, isSuperAdmin, actionMenu }: any) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Card sx={{ 
      borderRadius: 4, 
      height: '100%', 
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      '&:hover': { 
        transform: 'translateY(-6px)', 
        boxShadow: '0 12px 24px rgba(0,0,0,0.06)',
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
                ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                : '2px 2px 6px rgba(0,0,0,0.1)'
            }} 
          />
        </Box>
      </Box>
      
      <CardContent sx={{ pt: 7, textAlign: 'center', pb: 4, px: 3.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1 }}>{user.displayName}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 3, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {user.role === 'superadmin' ? (
              <><Shield size={14} className="text-warning-500" /> Administrator</>
            ) : user.role === 'manager' ? (
              <><Shield size={14} className="text-primary-500" /> Manager</>
            ) : user.role === 'teacher' ? (
              <><UserCheck size={14} className="text-success-500" /> Teacher</>
            ) : user.role === 'pending_teacher' ? (
              <><Clock size={14} className="text-warning-500" /> Pending Teacher</>
            ) : user.role}
          </Box>
          {' • '}
          {user.role === 'superadmin' ? 'System' : user.role === 'student' ? user.classLevel : (user.assignedClasses?.join(', ') || user.subject || 'General')}
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
          <Box sx={{ bgcolor: 'background.paper', borderRadius: '50%', boxShadow: theme.shadows[2] }}>
            {actionMenu}
          </Box>
        </Box>
    </Card>
  );
});

const SummaryCard = React.memo(({ title, value, icon, color }: any) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const paletteColor = color as 'primary' | 'success' | 'warning' | 'secondary' | 'error';
  const mainColor = theme.palette[paletteColor]?.main || theme.palette.primary.main;
  
  return (
    <Card sx={{ 
      borderRadius: 4, 
      height: '100%', 
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: '0 1px 4px rgba(0,0,0,0.01)',
      '&:hover': { 
        transform: 'translateY(-2px)', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        borderColor: alpha(mainColor, 0.2)
      }
    }}>
      <CardContent sx={{ p: isMobile ? 1.5 : 2.2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box sx={{ 
            p: 1, 
            borderRadius: 2, 
            bgcolor: alpha(mainColor, 0.08), 
            color: mainColor,
            display: 'flex'
          }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h5" sx={{ 
          fontWeight: 800, 
          mb: 0.2, 
          letterSpacing: -0.5,
          fontFamily: 'var(--font-heading)'
        }}>{value}</Typography>
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ 
            fontWeight: 800, 
            textTransform: 'uppercase', 
            letterSpacing: 1,
            fontSize: '0.6rem',
            fontFamily: 'var(--font-heading)',
            opacity: 0.8
          }}
        >
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
});
