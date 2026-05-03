import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Card, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  IconButton, 
  Chip, 
  Avatar, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Select, 
  Stack, 
  alpha, 
  useTheme, 
  useMediaQuery, 
  Skeleton, 
  Alert, 
  Snackbar, 
  Checkbox, 
  Divider,
  Popover,
  Tooltip,
  Menu,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  Calendar, 
  Wallet, 
  MoreVertical,
  X,
  FileText,
  CreditCard,
  User,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, deleteDoc, addDoc } from '../firebase';
import { db, OperationType, handleFirestoreError, smartAddDoc, smartUpdateDoc } from '../firebase';
import { UserProfile, FeeReceipt } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FEE_HEADS, PAYMENT_MODES } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import FeeReceiptModal from '../components/FeeReceiptModal';
import { logger } from '../lib/logger';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

export default function Fees() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [feeHeadFilter, setFeeHeadFilter] = useState<string>('All');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, id: string }>({ open: false, id: '' });
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState<null | HTMLElement>(null);
  
  const [formData, setFormData] = useState({
    studentId: '',
    isNonStudent: false,
    studentName: '',
    amount: '',
    feeHead: 'Monthly Fee',
    paymentMode: 'Cash',
    transactionId: '',
    remarks: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const isSuperAdmin = user?.email === 'zeeshanmaqbool200@gmail.com';
  const role = user?.role || 'student';
  const isManagerRole = role === 'manager' || (role === 'superadmin' && !isSuperAdmin);
  const isTeacherRole = role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

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
    if (!user) return;

    let q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    
    if (!isStaff) {
      q = query(collection(db, 'receipts'), where('studentId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribeReceipts = onSnapshot(q, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'receipts');
    });

    if (isStaff) {
      const studentQuery = query(collection(db, 'users'), where('role', '==', 'student'));
      const unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
        setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

      const expensesQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));
      const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
        setExpenses(snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((e: any) => ![10000, 20199, 20000, 50000].includes(Number(e.amount)))
        );
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

      return () => {
        unsubscribeReceipts();
        unsubscribeStudents();
        unsubscribeExpenses();
      };
    }

    return () => {
      unsubscribeReceipts();
    };
  }, [user, isStaff, isAdmin, isTeacherRole]);

  const handleAddReceipt = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let student: any = null;
      if (!formData.isNonStudent) {
        student = students.find(s => s.uid === formData.studentId);
      }
      
      const receiptId = `WUA-${format(new Date(), 'yyyy')}-${Math.floor(100000 + Math.random() * 900000)}`;
      const newReceipt = {
        ...formData,
        amount: Number(formData.amount),
        date: formData.date || format(new Date(), 'yyyy-MM-dd'),
        monthYear: formData.feeHead === 'Monthly Fee' ? format(new Date(formData.date || new Date()), 'MM-yyyy') : null,
        status: isStaff ? 'approved' : 'pending',
        createdAt: Date.now(),
        createdBy: user.uid,
        receiptNo: receiptId,
        receiptNumber: receiptId,
        studentOfficialId: formData.isNonStudent ? 'NON-STUDENT' : (student?.admissionNo || student?.studentId || ''),
        studentPhotoURL: student?.photoURL || '',
        classLevel: formData.isNonStudent ? 'General' : (student?.classLevel || 'N/A'),
        studentId: formData.isNonStudent ? `non-${Date.now()}` : formData.studentId,
        studentName: formData.isNonStudent ? formData.studentName : (student?.displayName || 'Unknown')
      };
      await smartAddDoc(collection(db, 'receipts'), newReceipt);
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setOpenAddDialog(false);
      setFormData({
        studentId: '',
        isNonStudent: false,
        studentName: '',
        amount: '',
        feeHead: 'Monthly Fee',
        paymentMode: 'Cash',
        transactionId: '',
        remarks: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      setSnackbar({ open: true, message: 'Receipt generated successfully!', severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'receipts');
      setSnackbar({ open: true, message: 'Failed to generate receipt.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await smartUpdateDoc(doc(db, 'receipts', id), { status });
      setSnackbar({ open: true, message: `Receipt ${status} successfully!`, severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'receipts');
      setSnackbar({ open: true, message: 'Failed to update receipt status.', severity: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'receipts', deleteConfirm.id));
      setDeleteConfirm({ open: false, id: '' });
      setSnackbar({ open: true, message: 'Receipt deleted successfully!', severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'receipts');
      setSnackbar({ open: true, message: 'Failed to delete receipt.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      const matchesSearch = 
        r.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.receiptNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.studentOfficialId?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesHead = feeHeadFilter === 'All' || r.feeHead === feeHeadFilter;
      const matchesMode = paymentModeFilter === 'All' || r.paymentMode === paymentModeFilter;
      
      const receiptDate = new Date(r.date);
      const matchesStart = !startDate || receiptDate >= new Date(startDate);
      const matchesEnd = !endDate || receiptDate <= new Date(endDate);
      
      const matchesTab = 
        tabValue === 0 ? true : 
        tabValue === 1 ? r.status === 'pending' : 
        r.status === 'approved';

      return matchesSearch && matchesHead && matchesMode && matchesStart && matchesEnd && matchesTab;
    });
  }, [receipts, searchQuery, feeHeadFilter, paymentModeFilter, startDate, endDate, tabValue]);

  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceipt | null>(null);
  const [openReceiptModal, setOpenReceiptModal] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const totalRevenue = receipts.filter(r => r.status === 'approved').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const pendingRevenue = receipts.filter(r => r.status === 'pending').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const currentMonthExpenses = expenses
    .filter(e => {
      const expDate = new Date(e.date);
      const now = new Date();
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const stats = {
    totalFeesMonth: receipts
      .filter(r => {
        const rDate = new Date(r.date);
        const now = new Date();
        return r.status === 'approved' && rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  };

  useEffect(() => {
    const receiptNo = searchParams.get('receipt');
    if (receiptNo && receipts.length > 0) {
      const receipt = receipts.find(r => r.receiptNo === receiptNo || r.receiptNumber === receiptNo);
      if (receipt) {
        setSelectedReceipt(receipt);
        setOpenReceiptModal(true);
      }
    }
  }, [searchParams, receipts]);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement> | boolean) => {
    const shouldSelect = typeof event === 'boolean' ? event : event.target.checked;
    if (shouldSelect) {
      setSelectedReceiptIds(filteredReceipts.map(r => r.id));
      setIsSelectionMode(true);
    } else {
      setSelectedReceiptIds([]);
      setIsSelectionMode(false);
    }
  };

  const toggleSelectReceipt = (id: string) => {
    setSelectedReceiptIds(prev => {
      const isSelected = prev.includes(id);
      const next = isSelected ? prev.filter(i => i !== id) : [...prev, id];
      if (next.length > 0) setIsSelectionMode(true);
      else setIsSelectionMode(false);
      return next;
    });
  };

  const handleTouchStart = (id: string) => {
    const timer = setTimeout(() => {
      if (!isSelectionMode) {
        setIsSelectionMode(true);
        toggleSelectReceipt(id);
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      }
    }, 700);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleBulkPrint = () => {
    if (selectedReceiptIds.length === 0) {
      setSnackbar({ open: true, message: 'Please select receipts to print.', severity: 'info' });
      return;
    }
    setIsBulkPrinting(true);
    setTimeout(() => {
      window.print();
      setIsBulkPrinting(false);
    }, 500);
  };

  if (loading) return (
    <Box sx={{ p: 4, width: '100%' }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="text" width="40%" height={60} />
          <Skeleton variant="rectangular" width={180} height={50} sx={{ borderRadius: 2 }} />
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3].map(i => (
            <Grid size={{ xs: 12, md: 4 }} key={i}>
              <Skeleton variant="rectangular" width="100%" height={150} sx={{ borderRadius: 5 }} />
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ pb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }} className="no-print">
        <Box>
          <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 950, letterSpacing: -1 }}>Maliat & Fees</Typography>
          <Typography variant={isMobile ? "caption" : "body1"} color="text.secondary" sx={{ fontWeight: 600 }}>Financial Management & Fee Reporting System</Typography>
        </Box>
        {isStaff && (
          <Button 
            variant="contained" 
            startIcon={<Plus />} 
            onClick={() => setOpenAddDialog(true)}
            sx={{ 
              borderRadius: 3, 
              py: isMobile ? 1 : 1.5, 
              px: isMobile ? 2 : 3, 
              fontWeight: 800,
              fontSize: isMobile ? '0.75rem' : 'inherit'
            }}
          >
            {isMobile ? 'New Receipt' : 'Generate New Receipt'}
          </Button>
        )}
      </Box>

      {/* Monthly Expenses Display */}
      {isStaff && (
        <Grid container spacing={isMobile ? 1.5 : 3} sx={{ mb: 4 }} className="no-print">
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 5, p: isMobile ? 2 : 3, bgcolor: '#10b981', color: 'white', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.8, fontSize: isMobile ? '0.65rem' : 'inherit' }}>Month Ka Revenue</Typography>
              <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 950 }}>INR {stats.totalFeesMonth?.toLocaleString() || 0}</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 5, p: isMobile ? 2 : 3, bgcolor: '#f43f5e', color: 'white', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.8, fontSize: isMobile ? '0.65rem' : 'inherit' }}>Month Ke Expenses</Typography>
              <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 950 }}>INR {currentMonthExpenses?.toLocaleString() || 0}</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 5, p: isMobile ? 2 : 3, bgcolor: '#3b82f6', color: 'white', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.8, fontSize: isMobile ? '0.65rem' : 'inherit' }}>Net Savings</Typography>
              <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 950 }}>INR {( (stats.totalFeesMonth || 0) - (currentMonthExpenses || 0) ).toLocaleString()}</Typography>
            </Card>
          </Grid>
        </Grid>
      )}

      {isStaff && (
        <Grid container spacing={isMobile ? 1.5 : 3} sx={{ mb: 4 }} className="no-print">
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 5, p: isMobile ? 2 : 3, bgcolor: 'primary.main', color: 'white' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.8, fontSize: isMobile ? '0.65rem' : 'inherit' }}>Approved Revenue</Typography>
                  <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 950 }}>INR {totalRevenue.toLocaleString()}</Typography>
                </Box>
                <div style={{ padding: isMobile ? 8 : 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <Wallet size={isMobile ? 24 : 40} />
                </div>
              </Box>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 5, p: isMobile ? 2 : 3, bgcolor: 'warning.main', color: 'white' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.8, fontSize: isMobile ? '0.65rem' : 'inherit' }}>Pending Evaluation</Typography>
                  <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 950 }}>INR {pendingRevenue.toLocaleString()}</Typography>
                </Box>
                <div style={{ padding: isMobile ? 8 : 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <Clock size={isMobile ? 24 : 40} />
                </div>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      <Card sx={{ borderRadius: 5, overflow: 'hidden', border: '1px solid', borderColor: 'divider', position: 'relative' }}>
        {/* Top Action Bar */}
        <Box 
          sx={{ 
            p: 2, 
            display: 'flex', 
            gap: 2, 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.5)
          }} 
          className="no-print"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {/* 3 Dots Menu - Top Left Section Trigger */}
            <IconButton 
              onClick={(e) => setBulkMenuAnchor(e.currentTarget)} 
              color={isSelectionMode ? "primary" : "default"}
              sx={{ 
                bgcolor: isSelectionMode ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) }
              }}
            >
              <MoreVertical size={20} />
            </IconButton>

            <Tabs 
              value={tabValue} 
              onChange={(e, v) => setTabValue(v)} 
              sx={{ 
                minHeight: 40,
                '& .MuiTab-root': {
                  minHeight: 40,
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  borderRadius: 2,
                  px: 2,
                  minWidth: 'auto'
                }
              }}
            >
              <Tab label="All" />
              <Tab label="Pending" />
              <Tab label="Approved" />
            </Tabs>

            {isSelectionMode && (
              <Box 
                sx={{ 
                  ml: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1.5, 
                  bgcolor: alpha(theme.palette.primary.main, 0.9), 
                  color: 'white',
                  px: 2, 
                  py: 0.8, 
                  borderRadius: 100,
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)'
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 950, letterSpacing: 0.5 }}>
                  {selectedReceiptIds.length} SELECTED
                </Typography>
                <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.3)', height: 12 }} />
                <IconButton 
                  size="small" 
                  onClick={() => { setSelectedReceiptIds([]); setIsSelectionMode(false); }} 
                  sx={{ color: 'white', p: 0.2 }}
                >
                  <X size={14} />
                </IconButton>
              </Box>
            )}
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                px: 2, 
                bgcolor: alpha(theme.palette.divider, 0.05), 
                borderRadius: 20, 
                border: '1px solid', 
                borderColor: 'divider',
                width: { xs: 150, md: 250 },
                transition: 'all 0.3s ease',
                '&:focus-within': {
                  width: { xs: 180, md: 300 },
                  bgcolor: 'background.paper',
                  borderColor: 'primary.main',
                  boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.1)'
                }
              }}
            >
              <Search size={16} className="text-gray-400" />
              <Box 
                component="input" 
                placeholder="Search..." 
                value={searchQuery} 
                onChange={(e: any) => setSearchQuery(e.target.value)} 
                sx={{ 
                  border: 'none', 
                  outline: 'none', 
                  p: 1, 
                  bgcolor: 'transparent', 
                  fontWeight: 600, 
                  width: '100%',
                  fontSize: '0.85rem'
                }} 
              />
            </Box>
            <IconButton 
              onClick={(e) => setAnchorEl(e.currentTarget)} 
              sx={{ 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 2,
                bgcolor: Boolean(anchorEl) ? alpha(theme.palette.primary.main, 0.1) : 'transparent'
              }}
            >
              <Filter size={18} />
            </IconButton>
          </Stack>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.divider, 0.02) }}>
                <TableCell padding="checkbox">
                  <Checkbox 
                    checked={filteredReceipts.length > 0 && selectedReceiptIds.length === filteredReceipts.length} 
                    onChange={handleSelectAll} 
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Receipt # / Date</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Student Particulars</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Financial Head</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
                {filteredReceipts.map((receipt) => {
                  const isItemSelected = selectedReceiptIds.includes(receipt.id);
                  return (
                    <TableRow 
                      component={motion.tr}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={receipt.id}
                      hover
                      selected={isItemSelected}
                      onMouseDown={() => isMobile && handleTouchStart(receipt.id)}
                      onMouseUp={handleTouchEnd}
                      onTouchStart={() => handleTouchStart(receipt.id)}
                      onTouchEnd={handleTouchEnd}
                      onClick={() => {
                        if (isSelectionMode) toggleSelectReceipt(receipt.id);
                        else {
                          setSelectedReceipt(receipt);
                          setOpenReceiptModal(true);
                        }
                      }}
                      sx={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox 
                           checked={isItemSelected} 
                           onChange={(e) => { e.stopPropagation(); toggleSelectReceipt(receipt.id); }} 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 800 }}>{receipt.receiptNo}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{receipt.date}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar src={receipt.studentPhotoURL} sx={{ width: 32, height: 32 }} />
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>{receipt.studentName}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{receipt.studentOfficialId}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 800 }}>{receipt.feeHead}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{receipt.paymentMode}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 950, color: 'primary.main' }}>INR {receipt.amount?.toLocaleString()}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={receipt.status?.toUpperCase()} 
                          size="small" 
                          color={receipt.status === 'approved' ? 'success' : receipt.status === 'rejected' ? 'error' : 'warning'}
                          sx={{ fontWeight: 900, borderRadius: 1.5, fontSize: '0.65rem' }}
                        />
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        {receipt.status === 'pending' && isStaff && (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Approve">
                              <IconButton size="small" color="success" onClick={() => handleUpdateStatus(receipt.id, 'approved')}>
                                <CheckCircle size={18} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton size="small" color="error" onClick={() => handleUpdateStatus(receipt.id, 'rejected')}>
                                <XCircle size={18} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        )}
                        <IconButton size="small" onClick={() => setDeleteConfirm({ open: true, id: receipt.id })}>
                          <Trash2 size={18} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Filters Popover */}
      <Popover anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} PaperProps={{ sx: { p: 3, borderRadius: 4, width: 300, boxShadow: theme.shadows[10] } }}>
        <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>Financial Filters</Typography>
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Fee Head</InputLabel>
            <Select value={feeHeadFilter} label="Fee Head" onChange={(e) => setFeeHeadFilter(e.target.value)}>
              <MenuItem value="All">All Heads</MenuItem>
              {FEE_HEADS.map(head => <MenuItem key={head} value={head}>{head}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Payment Mode</InputLabel>
            <Select value={paymentModeFilter} label="Payment Mode" onChange={(e) => setPaymentModeFilter(e.target.value)}>
              <MenuItem value="All">All Modes</MenuItem>
              {PAYMENT_MODES.map(mode => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField type="date" label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" />
          <TextField type="date" label="To" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" />
          <Button variant="contained" fullWidth onClick={() => setAnchorEl(null)} sx={{ borderRadius: 2, fontWeight: 800 }}>Apply Filters</Button>
          <Button variant="text" fullWidth onClick={() => { setFeeHeadFilter('All'); setPaymentModeFilter('All'); setStartDate(''); setEndDate(''); }}>Reset All</Button>
        </Stack>
      </Popover>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkMenuAnchor}
        open={Boolean(bulkMenuAnchor)}
        onClose={() => setBulkMenuAnchor(null)}
        PaperProps={{ 
          sx: { 
            borderRadius: 3, 
            minWidth: 200, 
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            border: '1px solid rgba(0,0,0,0.05)',
            p: 1
          } 
        }}
      >
        <Box sx={{ px: 2, py: 1, mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1 }}>
            Bulk Actions
          </Typography>
        </Box>
        <MenuItem 
          onClick={() => { handleBulkPrint(); setBulkMenuAnchor(null); }}
          disabled={!isSelectionMode || selectedReceiptIds.length === 0}
          sx={{ borderRadius: 2, mb: 0.5 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Printer size={18} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Print ({selectedReceiptIds.length}) Receipts</Typography>
          </Stack>
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem 
          onClick={() => { setIsSelectionMode(!isSelectionMode); setBulkMenuAnchor(null); }}
          sx={{ borderRadius: 2, mb: 0.5 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <CheckCircle size={18} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {isSelectionMode ? "Exit Selection Mode" : "Enter Selection Mode"}
            </Typography>
          </Stack>
        </MenuItem>
        {isSelectionMode && (
          <MenuItem 
            onClick={() => { setSelectedReceiptIds([]); setIsSelectionMode(false); setBulkMenuAnchor(null); }} 
            sx={{ color: 'error.main', borderRadius: 2 }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Trash2 size={18} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Clear Selection</Typography>
            </Stack>
          </MenuItem>
        )}
      </Menu>

      {/* Add Receipt Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 5, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 2 }}>
           <div style={{ backgroundColor: alpha(theme.palette.primary.main, 0.1), padding: 8, borderRadius: 12 }}>
             <FileText className="text-primary-600" />
           </div>
           Generate Financial Receipt
        </DialogTitle>
        <DialogContent>
           <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 600 }}>Create an official institute receipt for student fees or other financial collection.</Typography>
           <Grid container spacing={2}>
              <Grid size={12}>
                 <FormControl fullWidth sx={{ mb: 2 }}>
                   <InputLabel>Collection Type</InputLabel>
                   <Select value={formData.isNonStudent ? 'General' : 'Student'} label="Collection Type" onChange={(e) => setFormData({ ...formData, isNonStudent: e.target.value === 'General', studentId: '', studentName: '' })}>
                     <MenuItem value="Student">Registered Student</MenuItem>
                     <MenuItem value="General">General / Non-Student</MenuItem>
                   </Select>
                 </FormControl>
              </Grid>
              {!formData.isNonStudent ? (
                <Grid size={12}>
                  <FormControl fullWidth>
                    <InputLabel>Select Student</InputLabel>
                    <Select value={formData.studentId} label="Select Student" onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}>
                      {students.map(s => <MenuItem key={s.uid} value={s.uid}>{s.displayName} ({s.admissionNo})</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              ) : (
                <Grid size={12}>
                  <TextField fullWidth label="Full Name" value={formData.studentName} onChange={(e) => setFormData({ ...formData, studentName: e.target.value })} />
                </Grid>
              )}
              <Grid size={6}>
                 <TextField fullWidth label="Amount (Rs.)" type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
              </Grid>
              <Grid size={6}>
                 <FormControl fullWidth>
                   <InputLabel>Fee Head</InputLabel>
                   <Select value={formData.feeHead} label="Fee Head" onChange={(e) => setFormData({ ...formData, feeHead: e.target.value })}>
                     {FEE_HEADS.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                   </Select>
                 </FormControl>
              </Grid>
              <Grid size={6}>
                 <FormControl fullWidth>
                   <InputLabel>Payment Mode</InputLabel>
                   <Select value={formData.paymentMode} label="Payment Mode" onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}>
                     {PAYMENT_MODES.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                   </Select>
                 </FormControl>
              </Grid>
              <Grid size={6}>
                 <TextField fullWidth type="date" label="Date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid size={12}>
                 <TextField fullWidth label="Transaction ID / Receipt No." value={formData.transactionId} onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })} />
              </Grid>
              <Grid size={12}>
                 <TextField fullWidth multiline rows={2} label="Remarks (Internal)" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} />
              </Grid>
           </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
           <Button onClick={() => setOpenAddDialog(false)} sx={{ fontWeight: 700 }}>Cancel</Button>
           <Button variant="contained" onClick={handleAddReceipt} disabled={submitting || (!formData.studentId && !formData.isNonStudent) || !formData.amount} sx={{ borderRadius: 2.5, fontWeight: 800, px: 4 }}>{submitting ? 'Generating...' : 'Authorize & Generate'}</Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <FeeReceiptModal 
          open={openReceiptModal} 
          onClose={() => { setOpenReceiptModal(false); navigate('/fees', { replace: true }); }} 
          receipt={selectedReceipt} 
          settings={settings}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: '' })} PaperProps={{ sx: { borderRadius: 5, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Are you sure you want to delete this receipt? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteConfirm({ open: false, id: '' })} sx={{ fontWeight: 800 }} disabled={submitting}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={submitting} sx={{ borderRadius: 3, fontWeight: 800 }}>
            {submitting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity as any} sx={{ width: '100%', borderRadius: 3, fontWeight: 700 }}>{snackbar.message}</Alert>
      </Snackbar>

      {/* Bulk Print Layout (6x3 on A4) */}
      {isBulkPrinting && (
        <Box sx={{ display: 'none', '@media print': { display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'white', zIndex: 9999 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', width: '210mm', height: '297mm', margin: '0 auto', p: '5mm', boxSizing: 'border-box' }}>
            {receipts.filter(r => selectedReceiptIds.includes(r.id)).map((receipt) => (
              <Box key={receipt.id} sx={{ width: '100%', height: '48mm', border: '0.1px solid #eee', p: 1.5, overflow: 'hidden', pageBreakInside: 'avoid', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <Box sx={{ borderBottom: '1px solid black', pb: 0.5, mb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 950, fontSize: '7px', color: 'black' }}>OFFICIAL RECORD</Typography>
                    <Typography sx={{ fontWeight: 950, fontSize: '7px', color: 'black' }}>{receipt.receiptNo}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 950, fontSize: '10px', color: 'black', textAlign: 'center', mb: 0.5, lineHeight: 1.1 }}>{settings?.instituteName || 'WUA INSTITUTE'}</Typography>
                <div style={{ flex: 1 }}>
                   <PrintField label="Student" value={receipt.studentName} />
                   <PrintField label="Head" value={receipt.feeHead} />
                   <PrintField label="Amount" value={`INR ${receipt.amount}`} />
                   <PrintField label="Date" value={receipt.date} />
                </div>
                <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', opacity: 0.8 }}>
                   <Box sx={{ textAlign: 'center' }}>
                      <Box sx={{ width: 30, borderTop: '0.5px solid black', mb: 0.2 }} />
                      <Typography sx={{ fontSize: '5px', color: 'black', fontWeight: 700 }}>RECEPTION</Typography>
                   </Box>
                   <Typography sx={{ fontSize: '5px', color: 'grey.600', fontWeight: 600 }}>ID: {receipt.id.slice(0, 8)}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function PrintField({ label, value }: { label: string, value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '0.1px solid #f0f0f0' }}>
       <Typography sx={{ fontSize: '7px', fontWeight: 900, color: 'black' }}>{label}:</Typography>
       <Typography sx={{ fontSize: '7px', fontWeight: 600, color: 'black' }}>{value}</Typography>
    </Box>
  );
}
