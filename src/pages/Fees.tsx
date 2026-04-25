import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Autocomplete, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper, Chip, 
  IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, InputAdornment, 
  Tab, Tabs, Badge, Alert, useMediaQuery,
  Stack, Tooltip, Zoom, Fade, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Plus, Search, Filter, Download, Printer, 
  CheckCircle, XCircle, Clock, CreditCard, 
  FileText, Share2, MoreVertical, Trash2, Eye,
  ArrowUpRight, ArrowDownRight, Wallet, History,
  AlertCircle, Check, Edit, Save, X, RotateCcw
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, getDoc, or, and } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, smartAddDoc, smartUpdateDoc } from '../firebase';
import { UserProfile, FeeReceipt } from '../types';
import { useAuth } from '../context/AuthContext';
import { FEE_HEADS, PAYMENT_MODES } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import FeeReceiptModal from '../components/FeeReceiptModal';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { logger } from '../lib/logger';
import { exportToCSV } from '../lib/exportUtils';

export default function Fees() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(!(window as any)._feesLoaded);
  const [tabValue, setTabValue] = useState(0);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<FeeReceipt | null>(null);
  const [openReceiptModal, setOpenReceiptModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feeHeadFilter, setFeeHeadFilter] = useState<string>('All');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('All');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, id: string }>({ open: false, id: '' });
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });
  
  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    amount: '',
    feeHead: 'Monthly Fee',
    paymentMode: 'Cash',
    transactionId: '',
    remarks: ''
  });

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const role = currentUser?.role || 'student';
  const isMuntazim = role === 'muntazim' || (role === 'superadmin' && !isSuperAdmin);
  const isMudarisRole = role === 'mudaris';
  const isAdmin = isSuperAdmin || isMuntazim;
  const isStaff = isAdmin || isMudarisRole;

  const [settings, setSettings] = React.useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }
      } catch (error) {
        logger.error('Error fetching settings', error as Error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    
    // Filtering receipts
    if (currentUser.role === 'student') {
      q = query(collection(db, 'receipts'), where('studentId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    } else if (isMudarisRole) {
      // Mudaris can only see receipts for their grade and Example grade
      q = query(
        collection(db, 'receipts'), 
        or(
          where('grade', 'in', (currentUser.assignedClasses && currentUser.assignedClasses.length > 0) ? currentUser.assignedClasses : ['__none__']),
          where('grade', '==', 'Example')
        ),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[]);
      setLoading(false);
      (window as any)._feesLoaded = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'receipts');
    });

    if (isStaff) {
      // Fetch students for the autocomplete
      let studentsQuery;
      if (isAdmin) {
        studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
      } else {
        studentsQuery = query(
          collection(db, 'users'), 
          and(
            where('role', '==', 'student'),
            or(
              where('grade', 'in', (currentUser.assignedClasses && currentUser.assignedClasses.length > 0) ? currentUser.assignedClasses : ['__none__']),
              where('grade', '==', 'Example')
            )
          )
        );
      }
      
      onSnapshot(studentsQuery, (snapshot) => {
        setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    return () => unsubscribe();
  }, [currentUser, isStaff, isAdmin, isMudarisRole]);

  const handleAddReceipt = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const student = students.find(s => s.uid === formData.studentId);
      const receiptId = `WUA-${format(new Date(), 'yyyy')}-${Math.floor(100000 + Math.random() * 900000)}`;
      const newReceipt = {
        ...formData,
        amount: Number(formData.amount),
        date: format(new Date(), 'yyyy-MM-dd'),
        status: isStaff ? 'approved' : 'pending',
        createdAt: Date.now(),
        createdBy: currentUser.uid,
        receiptNo: receiptId,
        receiptNumber: receiptId,
        studentOfficialId: student?.admissionNo || student?.studentId || '',
        grade: student?.maktabLevel || student?.grade || ''
      };
      await smartAddDoc(collection(db, 'receipts'), newReceipt);
      
      // Trigger confetti for a delightful experience
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: [theme.palette.primary.main, theme.palette.secondary.main, '#10b981']
      });

      setOpenAddDialog(false);
      setFormData({ studentId: '', studentName: '', amount: '', feeHead: 'Monthly Fee', paymentMode: 'Cash', transactionId: '', remarks: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'receipts');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (receipt: FeeReceipt) => {
    if (!isStaff) return;
    try {
      const currentDoc = await getDoc(doc(db, 'receipts', receipt.id));
      if (currentDoc.exists() && currentDoc.data().approvedAt && currentDoc.data().status === 'approved') {
        setSnackbar({ open: true, message: "This receipt was already approved by another admin.", severity: 'info' });
        return;
      }

      const updates: any = {
        status: 'approved',
        approvedBy: currentUser?.uid,
        approvedByName: currentUser?.displayName,
        approvedAt: Date.now(),
        updatedAt: Date.now()
      };

      await smartUpdateDoc(doc(db, 'receipts', receipt.id), updates);

      if (receipt.feeHead === 'Admission Fee') {
        const studentDoc = await getDoc(doc(db, 'users', receipt.studentId));
        if (studentDoc.exists()) {
          const studentData = studentDoc.data() as UserProfile;
          if (!studentData.admissionNo) {
            const admissionNo = `ADM-${format(new Date(), 'yyyy')}-${Math.floor(1000 + Math.random() * 9000)}`;
            await smartUpdateDoc(doc(db, 'users', receipt.studentId), {
              admissionNo: admissionNo,
              status: 'Active'
            });
          }
        }
      }

      setSnackbar({ open: true, message: "Receipt approved successfully!", severity: 'success' });
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#10b981', '#3b82f6']
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `receipts/${receipt.id}`);
    }
  };

  const handleReject = async (receipt: FeeReceipt) => {
    if (!isStaff) return;
    try {
      await smartUpdateDoc(doc(db, 'receipts', receipt.id), {
        status: 'rejected',
        rejectedBy: currentUser?.uid,
        rejectedAt: Date.now()
      });
      setSnackbar({ open: true, message: "Receipt rejected", severity: 'info' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `receipts/${receipt.id}`);
    }
  };

  const handleUpdateReceipt = async () => {
    if (!editingReceipt) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'receipts', editingReceipt.id), {
        ...formData,
        amount: Number(formData.amount)
      });
      setSnackbar({ open: true, message: "Receipt updated successfully!", severity: 'success' });
      setOpenEditDialog(false);
      setEditingReceipt(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `receipts/${editingReceipt.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirm({ open: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'receipts', deleteConfirm.id));
      setDeleteConfirm({ open: false, id: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `receipts/${deleteConfirm.id}`);
    }
  };

  const getStatusChip = (status: FeeReceipt['status']) => {
    switch (status) {
      case 'approved': 
        return (
          <Chip 
            label="Approved" 
            color="success" 
            size="small" 
            icon={<CheckCircle size={14} />} 
            sx={{ fontWeight: 800, borderRadius: 2, height: 24 }}
          />
        );
      case 'pending': 
        return (
          <Chip 
            label="Pending" 
            color="warning" 
            size="small" 
            icon={<Clock size={14} />} 
            sx={{ fontWeight: 800, borderRadius: 2, height: 24 }}
          />
        );
      case 'rejected': 
        return (
          <Chip 
            label="Rejected" 
            color="error" 
            size="small" 
            icon={<XCircle size={14} />} 
            sx={{ fontWeight: 800, borderRadius: 2, height: 24 }}
          />
        );
      default: return <Chip label={status} size="small" sx={{ fontWeight: 800, borderRadius: 2 }} />;
    }
  };

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (r.receiptNo && r.receiptNo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTab = tabValue === 0 || 
                       (tabValue === 1 && r.status === 'pending') || 
                       (tabValue === 2 && r.status === 'approved');
    const matchesFeeHead = feeHeadFilter === 'All' || r.feeHead === feeHeadFilter;
    const matchesPaymentMode = paymentModeFilter === 'All' || r.paymentMode === paymentModeFilter;

    return matchesSearch && matchesTab && matchesFeeHead && matchesPaymentMode;
  });

  const totalRevenue = receipts.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0);
  const pendingRevenue = receipts.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  const handleExport = () => {
    const dataToExport = filteredReceipts.map(r => ({
      'Receipt No': r.receiptNo || r.receiptNumber,
      'Student Name': r.studentName,
      'Grade': r.grade || 'N/A',
      'Amount': r.amount,
      'Head': r.feeHead,
      'Status': r.status,
      'Mode': r.paymentMode,
      'Date': format(new Date(r.date), 'dd MMM yyyy'),
      'Transaction ID': r.transactionId || 'N/A'
    }));
    exportToCSV(dataToExport, 'Maktab_Fees_Export');
  };

  return (
    <Box sx={{ pb: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Fees & Payments</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Manage Tulab-e-Ilm payments and official receipts
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end', alignItems: 'center' }}>
            {isStaff && (
              <IconButton 
                onClick={handleExport}
                sx={{ 
                  borderRadius: 1, 
                  bgcolor: 'background.paper',
                  border: `1px solid ${theme.palette.divider}`,
                  p: isMobile ? 1 : 1.5,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  }
                }}
              >
                <Download size={isMobile ? 18 : 22} />
              </IconButton>
            )}
            {(!isStaff && currentUser?.role === 'student' && !currentUser?.maktabLevel) ? (
              <Tooltip title="Your class selection must be approved by a teacher before you can use this feature.">
                <span>
                  <Button 
                    variant="contained" 
                    disabled
                    startIcon={<Plus size={isMobile ? 18 : 24} />} 
                    sx={{ 
                      borderRadius: 2, 
                      fontWeight: 800, 
                      px: isMobile ? 2 : 3, 
                      py: isMobile ? 1 : 1.2,
                      minHeight: isMobile ? 40 : 48,
                      textTransform: 'none',
                      fontSize: isMobile ? '0.8rem' : '0.9rem',
                      opacity: 0.7
                    }}
                  >
                    {isMobile ? "Add" : "Apply for Fee"}
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button 
                variant="contained" 
                startIcon={<Plus size={isMobile ? 18 : 22} />} 
                onClick={() => {
                  if (currentUser?.role === 'student') {
                    setFormData({ ...formData, studentId: currentUser.uid, studentName: currentUser.displayName });
                  }
                  setOpenAddDialog(true);
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
                {isMobile ? "Add" : (isStaff ? 'New Payment' : 'Apply for Fee')}
              </Button>
            )}
          </Stack>
        </Box>
      </motion.div>

      {/* Summary Cards - Only for Super Admin */}
      {isSuperAdmin && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <SummaryCard 
              title="Total Revenue" 
              value={`₹${totalRevenue.toLocaleString()}`} 
              icon={<Wallet size={24} />} 
              color="primary" 
              trend="+12.5%"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <SummaryCard 
              title="Pending Approval" 
              value={`₹${pendingRevenue.toLocaleString()}`} 
              icon={<Clock size={24} />} 
              color="warning" 
              trend={`${receipts.filter(r => r.status === 'pending').length} items`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <SummaryCard 
              title="Approved Today" 
              value={`₹${receipts.filter(r => r.status === 'approved' && r.approvedAt && r.approvedAt > Date.now() - 86400000).reduce((sum, r) => sum + r.amount, 0).toLocaleString()}`} 
              icon={<CheckCircle size={24} />} 
              color="success" 
              trend="Today"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <SummaryCard 
              title="Rejected" 
              value={receipts.filter(r => r.status === 'rejected').length} 
              icon={<XCircle size={24} />} 
              color="error" 
              trend="Total"
            />
          </Grid>
        </Grid>
      )}

      {/* Student Personal Summary */}
      {!isStaff && currentUser?.role === 'student' && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <SummaryCard 
              title="My Total Paid" 
              value={`₹${totalRevenue.toLocaleString()}`} 
              icon={<Wallet size={24} />} 
              color="primary" 
              trend="Verified"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <SummaryCard 
              title="Pending Approval" 
              value={`₹${pendingRevenue.toLocaleString()}`} 
              icon={<Clock size={24} />} 
              color="warning" 
              trend="In Process"
            />
          </Grid>
        </Grid>
      )}

      <Card sx={{ 
        borderRadius: 1, 
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'dark'
          ? '0 4px 12px rgba(0,0,0,0.5)'
          : '0 4px 12px rgba(0,0,0,0.05)',
      }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider', 
          bgcolor: alpha(theme.palette.background.default, 0.5), 
          px: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          backdropFilter: 'blur(10px)'
        }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, v) => setTabValue(v)} 
            variant={isMobile ? "scrollable" : "standard"}
            scrollButtons="auto"
            sx={{ 
              flex: 1,
              '& .MuiTab-root': { fontWeight: 800, py: 2, minWidth: isMobile ? 80 : 120, color: 'text.secondary', textTransform: 'none', fontSize: isMobile ? '0.8rem' : '0.95rem' },
              '& .Mui-selected': { color: 'primary.main' },
              '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' }
            }}
          >
            <Tab label="All Receipts" />
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                Pending
                {receipts.filter(r => r.status === 'pending').length > 0 && (
                  <Chip 
                    label={receipts.filter(r => r.status === 'pending').length} 
                    size="small" 
                    sx={{ height: 22, minWidth: 22, fontSize: '0.7rem', fontWeight: 900, bgcolor: 'warning.main', color: 'white' }} 
                  />
                )}
              </Box>
            } />
            <Tab label="Approved" />
          </Tabs>
          
          <Box sx={{ px: 2, py: 2, flex: { xs: 1, md: 'none' }, minWidth: { xs: '100%', md: 450 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    px: 2, 
                    borderRadius: 1, 
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: 'background.default',
                    flex: 1
                  }}
                >
                  <Search size={18} color={theme.palette.text.secondary} />
                  <Box 
                    component="input" 
                    placeholder={isMobile ? "Search..." : "Search receipt or Talib-e-Ilm..."} 
                    value={searchQuery}
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    sx={{ 
                      border: 'none', 
                      outline: 'none', 
                      p: 1.2, 
                      width: '100%', 
                      fontWeight: 600,
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      fontSize: '0.9rem',
                      '&::placeholder': { color: 'text.disabled' }
                    }} 
                  />
                </Paper>

                <Stack direction="row" spacing={1}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Fee Head</InputLabel>
                    <Select
                      value={feeHeadFilter}
                      label="Fee Head"
                      onChange={(e) => setFeeHeadFilter(e.target.value as any)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="All">All Heads</MenuItem>
                      {FEE_HEADS.map(head => (
                        <MenuItem key={head} value={head}>{head}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Mode</InputLabel>
                    <Select
                      value={paymentModeFilter}
                      label="Mode"
                      onChange={(e) => setPaymentModeFilter(e.target.value as any)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="All">All Modes</MenuItem>
                      {PAYMENT_MODES.map(mode => (
                        <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {(feeHeadFilter !== 'All' || paymentModeFilter !== 'All') && (
                    <IconButton 
                      onClick={() => { setFeeHeadFilter('All'); setPaymentModeFilter('All'); }}
                      sx={{ bgcolor: 'error.light', color: 'error.main', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                    >
                      <RotateCcw size={18} />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
          </Box>
        </Box>
        
        <Box sx={{ overflowX: 'auto', width: '100%' }}>
          <TableContainer component={Box} sx={{ minWidth: { xs: 800, md: '100%' } }}>
            <Table>
              <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.3) }}>
                <TableCell sx={{ fontWeight: 800, py: 2.5, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>Receipt Details</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>Talib-e-Ilm</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>Fee Head</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }} align="center">Status</TableCell>
                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filteredReceipts.map((receipt) => (
                  <TableRow 
                    component={motion.tr}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={receipt.id} 
                    hover
                    sx={{ 
                      transition: 'all 0.2s',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                      '& .MuiTableCell-root': { borderBottom: '1px solid', borderColor: 'divider' }
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main' }}>
                          <FileText size={20} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                            {receipt.receiptNo}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {receipt.paymentMode} • {receipt.transactionId || 'No ID'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{receipt.studentName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={receipt.feeHead} 
                        size="small" 
                        sx={{ 
                          fontWeight: 700, 
                          bgcolor: alpha(theme.palette.text.primary, 0.05),
                          color: 'text.primary'
                        }} 
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'text.primary' }}>
                        ₹{receipt.amount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        {format(new Date(receipt.date), 'dd MMM yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {getStatusChip(receipt.status)}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Tooltip title="View Receipt">
                          <IconButton 
                            size="small" 
                            sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                            onClick={() => {
                              setSelectedReceipt(receipt);
                              setOpenReceiptModal(true);
                            }}
                          >
                            <Eye size={18} />
                          </IconButton>
                        </Tooltip>
                        {isStaff && receipt.status === 'pending' && (
                          <>
                            <Tooltip title="Approve">
                              <IconButton 
                                size="small" 
                                sx={{ bgcolor: 'success.light', color: 'success.dark', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                                onClick={() => handleApprove(receipt)}
                              >
                                <Check size={18} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton 
                                size="small" 
                                sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                onClick={() => handleReject(receipt)}
                              >
                                <XCircle size={18} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {isStaff && (
                          <>
                            {(isSuperAdmin || receipt.createdBy === currentUser?.uid || receipt.uploadedBy === currentUser?.uid) && (
                              <>
                                <Tooltip title="Edit">
                                  <IconButton 
                                    size="small" 
                                    sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                                    onClick={() => {
                                      setEditingReceipt(receipt);
                                      setFormData({
                                        studentId: receipt.studentId,
                                        studentName: receipt.studentName,
                                        amount: receipt.amount.toString(),
                                        feeHead: receipt.feeHead,
                                        paymentMode: receipt.paymentMode,
                                        transactionId: receipt.transactionId || '',
                                        remarks: receipt.remarks || ''
                                      });
                                      setOpenEditDialog(true);
                                    }}
                                  >
                                    <Edit size={18} />
                                  </IconButton>
                                </Tooltip>
                                {isSuperAdmin && (
                                  <Tooltip title="Delete">
                                    <IconButton 
                                      size="small" 
                                      sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                      onClick={() => handleDelete(receipt.id)}
                                    >
                                      <Trash2 size={18} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </>
                            )}
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
        
        {filteredReceipts.length === 0 && (
          <Box sx={{ p: 10, textAlign: 'center' }}>
            <CreditCard size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No receipts found</Typography>
            <Typography variant="body2" color="text.secondary">Try adjusting your filters or search query</Typography>
          </Box>
        )}
      </Card>

      {/* Add Payment Dialog */}
      <Dialog 
        open={openAddDialog} 
        onClose={() => setOpenAddDialog(false)} 
        maxWidth="sm" 
        fullWidth 
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
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.6rem', pb: 1, letterSpacing: -1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isStaff ? 'Record New Payment' : 'Apply for Fee / Submit Payment'}
          <IconButton onClick={() => setOpenAddDialog(false)} className="close-button">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 600 }}>
            {isStaff 
              ? 'Enter the details of the Talib-e-Ilm payment below to generate a new receipt.' 
              : 'Submit your fee payment details for verification and official receipt generation.'}
          </Typography>
          <Grid container spacing={3}>
            <Grid size={12}>
              {currentUser?.role === 'student' ? (
                <TextField
                  fullWidth
                  label="Talib-e-Ilm"
                  value={currentUser.displayName}
                  disabled
                  InputProps={{ sx: { borderRadius: 4, bgcolor: 'background.default' } }}
                />
              ) : (
                <Autocomplete
                  options={students}
                  getOptionLabel={(option) => `${option.displayName} (${option.admissionNo || option.studentId || 'N/A'})`}
                  onChange={(e, v) => setFormData({ ...formData, studentId: v?.uid || '', studentName: v?.displayName || '' })}
                  renderInput={(params) => <TextField {...params} label="Select Talib-e-Ilm" required InputProps={{ ...params.InputProps, sx: { borderRadius: 4 } }} />}
                />
              )}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                required
                InputProps={{ 
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  sx: { borderRadius: 4 }
                }}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Fee Head"
                SelectProps={{ native: true }}
                value={formData.feeHead}
                onChange={(e) => setFormData({ ...formData, feeHead: e.target.value })}
                InputProps={{ sx: { borderRadius: 4 } }}
              >
                <option value="Monthly Fee">Monthly Fee</option>
                {(!formData.studentId || !students.find(s => s.uid === formData.studentId)?.admissionNo) && (
                  <option value="Admission Fee">Admission Fee</option>
                )}
                <option value="Quran / Hifz Fee">Quran / Hifz Fee</option>
                <option value="Exam / Test Fee">Exam / Test Fee</option>
                <option value="Book / Kitab Fee">Book / Kitab Fee</option>
                <option value="Activity / Competition Fee (Gez-z & Gen-x)">Activity / Competition Fee (Gez-z & Gen-x)</option>
                <option value="Sadqa / Donation">Sadqa / Donation</option>
                <option value="Others">Others</option>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Payment Mode"
                SelectProps={{ native: true }}
                value={formData.paymentMode}
                onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                InputProps={{ sx: { borderRadius: 4 } }}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Others">Others</option>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Transaction ID"
                placeholder="Optional"
                value={formData.transactionId}
                onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                InputProps={{ sx: { borderRadius: 4 } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Remarks"
                placeholder="Add any additional notes..."
                multiline
                rows={2}
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                InputProps={{ sx: { borderRadius: 4 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 4, gap: 1.5 }}>
          <Button 
            onClick={() => {
              setOpenAddDialog(false);
              setFormData({ studentId: '', studentName: '', amount: '', feeHead: 'Monthly Fee', paymentMode: 'Cash', transactionId: '', remarks: '' });
            }}
            sx={{ fontWeight: 900, color: 'text.secondary', textTransform: 'none' }}
          >
            Cancel / Wapis
          </Button>
          <Button 
            onClick={handleAddReceipt} 
            variant="contained" 
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Plus size={18} />} 
            disabled={!formData.studentId || !formData.amount || submitting}
            sx={{ 
              borderRadius: 1.5, 
              fontWeight: 900, 
              px: 4, 
              py: 1.2,
              textTransform: 'none',
              boxShadow: 'none'
            }}
          >
            {submitting ? 'Processing...' : (isStaff ? 'Record Payment' : 'Submit Application')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Receipt Dialog */}
      <Dialog 
        open={openEditDialog} 
        onClose={() => setOpenEditDialog(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Edit Receipt
          <IconButton onClick={() => setOpenEditDialog(false)} className="close-button">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
            Update the receipt details below.
          </Typography>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Student Name"
              value={formData.studentName}
              disabled
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              fullWidth
              label="Amount (INR)"
              type="number"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}>
              <InputLabel>Fee Head</InputLabel>
              <Select
                value={formData.feeHead}
                label="Fee Head"
                onChange={(e) => setFormData({ ...formData, feeHead: e.target.value })}
              >
                <MenuItem value="Monthly Fee">Monthly Fee</MenuItem>
                <MenuItem value="Admission Fee">Admission Fee</MenuItem>
                <MenuItem value="Exam Fee">Exam Fee</MenuItem>
                <MenuItem value="Books/Stationery">Books/Stationery</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}>
              <InputLabel>Payment Mode</InputLabel>
              <Select
                value={formData.paymentMode}
                label="Payment Mode"
                onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value as any })}
              >
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Online">Online Transfer</MenuItem>
                <MenuItem value="UPI">UPI (GPay/PhonePe)</MenuItem>
                <MenuItem value="Cheque">Cheque</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Transaction ID / Ref (Optional)"
              value={formData.transactionId}
              onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              fullWidth
              label="Remarks"
              multiline
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => {
              setOpenEditDialog(false);
              setEditingReceipt(null);
              setFormData({ studentId: '', studentName: '', amount: '', feeHead: 'Monthly Fee', paymentMode: 'Cash', transactionId: '', remarks: '' });
            }}
            sx={{ fontWeight: 800, color: 'text.secondary' }}
          >
            Cancel / Wapis
          </Button>
          <Button 
            onClick={handleUpdateReceipt} 
            variant="contained" 
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <Save size={18} />} 
            disabled={submitting || !formData.amount}
            sx={{ borderRadius: 1.5, fontWeight: 800, px: 3, boxShadow: 'none' }}
          >
            {submitting ? 'Updating...' : 'Update Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <FeeReceiptModal 
          open={openReceiptModal} 
          onClose={() => setOpenReceiptModal(false)} 
          receipt={selectedReceipt} 
          settings={settings}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: '' })} PaperProps={{ sx: { borderRadius: 5, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this receipt? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteConfirm({ open: false, id: '' })} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" sx={{ borderRadius: 3, fontWeight: 800 }}>
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const SummaryCard = React.memo(({ title, value, icon, color, trend }: any) => {
  const theme = useTheme();
  const mainColor = theme.palette[color as 'primary' | 'success' | 'error' | 'warning'].main;
  
  return (
    <Card sx={{ 
      borderRadius: 1, 
      height: '100%', 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      border: `1px solid ${theme.palette.divider}`,
      bgcolor: 'background.paper',
      boxShadow: 'none',
      '&:hover': { 
        transform: 'translateY(-4px)', 
        borderColor: mainColor
      }
    }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ 
            p: 1.2, 
            borderRadius: 0.5, 
            bgcolor: alpha(mainColor, 0.1), 
            color: mainColor,
            border: `1px solid ${alpha(mainColor, 0.1)}`
          }}>
            {icon}
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: mainColor, fontSize: '0.65rem', bgcolor: alpha(mainColor, 0.05), px: 1, py: 0.5, borderRadius: 0.5 }}>{trend}</Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5, letterSpacing: -1 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>{title}</Typography>
      </CardContent>
    </Card>
  );
});
