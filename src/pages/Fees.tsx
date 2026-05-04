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

import { cache, CACHE_KEYS } from '../lib/cache';

export default function Fees() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(() => Number(sessionStorage.getItem('fees_tab')) || 0);
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('fees_search') || '');
  const [feeHeadFilter, setFeeHeadFilter] = useState<string>(() => sessionStorage.getItem('fees_head_filter') || 'All');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>(() => sessionStorage.getItem('fees_mode_filter') || 'All');
  const [startDate, setStartDate] = useState<string>(() => sessionStorage.getItem('fees_start_date') || '');
  const [endDate, setEndDate] = useState<string>(() => sessionStorage.getItem('fees_end_date') || '');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, id: string }>({ open: false, id: '' });
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<any>(null);
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
    sessionStorage.setItem('fees_tab', tabValue.toString());
    sessionStorage.setItem('fees_search', searchQuery);
    sessionStorage.setItem('fees_head_filter', feeHeadFilter);
    sessionStorage.setItem('fees_mode_filter', paymentModeFilter);
    sessionStorage.setItem('fees_start_date', startDate);
    sessionStorage.setItem('fees_end_date', endDate);
  }, [tabValue, searchQuery, feeHeadFilter, paymentModeFilter, startDate, endDate]);

  useEffect(() => {
    if (!user) return;

    // Hydrate from cache
    const hydrate = async () => {
      const cached = await cache.get<FeeReceipt[]>(CACHE_KEYS.FEES);
      if (cached) {
        setReceipts(cached);
        setLoading(false);
      }
    };
    hydrate();

    let q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    
    if (!isStaff) {
      q = query(collection(db, 'receipts'), where('studentId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribeReceipts = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((r: any) => ![10000, 20000, 30000, 50000].includes(Number(r.amount))) as FeeReceipt[];
      setReceipts(data);
      cache.set(CACHE_KEYS.FEES, data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'receipts');
    });

    if (isStaff) {
      const studentQuery = query(collection(db, 'users'), where('role', '==', 'student'));
      const unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
        setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

      return () => {
        unsubscribeReceipts();
        unsubscribeStudents();
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
      
      // Optimistic UI update
      setReceipts(prev => [newReceipt as any, ...prev]);
      
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
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        pb: 2,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }} className="no-print">
        <Box>
          <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontWeight: 950, letterSpacing: -1, color: 'primary.main' }}>Maliat & Fees</Typography>
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
              fontSize: isMobile ? '0.75rem' : 'inherit',
              boxShadow: theme.shadows[4]
            }}
          >
            {isMobile ? 'New Receipt' : 'Generate New Receipt'}
          </Button>
        )}
      </Box>

      {/* Compact Finance Stats */}
      {isStaff && (
        <Box sx={{ mb: 4 }} className="no-print">
          <Paper 
            elevation={0}
            variant="outlined" 
            sx={{ 
              borderRadius: 4, 
              p: 3, 
              bgcolor: alpha(theme.palette.primary.main, 0.03),
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.1),
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
            }}
          >
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ textAlign: 'center', borderRight: { md: '1px solid' }, borderColor: alpha(theme.palette.divider, 0.1), px: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Current Month Total Fees</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 950, color: 'success.main', mt: 0.5 }}>₹{(stats.totalFeesMonth || 0).toLocaleString()}</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ textAlign: 'center', px: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>Accumulated Revenue</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 950, color: 'primary.main', mt: 0.5 }}>₹{totalRevenue.toLocaleString()}</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}

      <Card sx={{ borderRadius: 5, overflow: 'hidden', border: '1px solid', borderColor: 'divider', position: 'relative' }}>
        {/* Bulk Action Bar (Floating) */}
        <AnimatePresence>
          {isSelectionMode && (
            <Box 
              component={motion.div}
              initial={{ y: 100, opacity: 0, x: '-50%' }}
              animate={{ y: 0, opacity: 1, x: '-50%' }}
              exit={{ y: 100, opacity: 0, x: '-50%' }}
              sx={{ 
                position: 'fixed', 
                bottom: { xs: 80, md: 30 }, 
                left: '50%', 
                zIndex: 6000,
                width: { xs: '90%', md: 'auto' },
                minWidth: { md: 500 },
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                backdropFilter: 'blur(20px)',
                p: 1.5,
                borderRadius: 4,
                boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.2)
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 2, px: 2, py: 1, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle size={18} />
                  {selectedReceiptIds.length} Selected
                </Box>
                <Button 
                  size="small" 
                  variant="text" 
                  onClick={() => handleSelectAll(false)}
                  sx={{ fontWeight: 800, color: 'text.secondary' }}
                >
                  Clear
                </Button>
              </Stack>
              
              <Stack direction="row" spacing={1}>
                {isAdmin && (
                  <Button 
                    variant="contained" 
                    color="primary" 
                    startIcon={<Printer />}
                    onClick={handleBulkPrint}
                    sx={{ borderRadius: 2.5, fontWeight: 800, px: 2, textTransform: 'none' }}
                  >
                    Bulk Print
                  </Button>
                )}
                <IconButton 
                  onClick={() => { setSelectedReceiptIds([]); setIsSelectionMode(false); }}
                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main' }}
                >
                  <X size={20} />
                </IconButton>
              </Stack>
            </Box>
          )}
        </AnimatePresence>

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
            <IconButton 
              onClick={() => setIsSelectionMode(!isSelectionMode)} 
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

        <TableContainer sx={{ overflow: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
          <Table sx={{ minWidth: 900, borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.divider, 0.05) }}>
                <TableCell padding="checkbox" sx={{ borderBottom: '2px solid', borderColor: 'divider' }}>
                  <Checkbox 
                    checked={filteredReceipts.length > 0 && selectedReceiptIds.length === filteredReceipts.length} 
                    onChange={handleSelectAll} 
                    sx={{ color: theme.palette.primary.main }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 800, py: 2, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Receipt # / Date</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Student Particulars</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Financial Head</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', borderBottom: '2px solid', borderColor: 'divider' }}>Action</TableCell>
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
                      sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:selected': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox 
                           checked={isItemSelected} 
                           onChange={(e) => { e.stopPropagation(); toggleSelectReceipt(receipt.id); }} 
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>{receipt.receiptNo}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                          {format(new Date(receipt.date), 'dd MM yyyy')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar src={receipt.studentPhotoURL} sx={{ width: 34, height: 34, border: '2px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }} />
                          <Box>
                            <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{receipt.studentName}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{receipt.studentOfficialId}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>{receipt.feeHead}</Typography>
                        <Chip label={receipt.paymentMode} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 950, color: 'primary.main', fontSize: '1rem' }}>₹{receipt.amount?.toLocaleString()}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={receipt.status?.toUpperCase()} 
                          size="small" 
                          variant={receipt.status === 'approved' ? 'filled' : 'outlined'}
                          color={receipt.status === 'approved' ? 'success' : receipt.status === 'rejected' ? 'error' : 'warning'}
                          sx={{ fontWeight: 900, borderRadius: 1.5, fontSize: '0.65rem' }}
                        />
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="View / Print">
                            <IconButton 
                              size="small" 
                              color="primary" 
                              sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                              onClick={() => {
                                setSelectedReceipt(receipt);
                                setOpenReceiptModal(true);
                              }}
                            >
                              <Printer size={18} />
                            </IconButton>
                          </Tooltip>

                          {receipt.status === 'pending' && isStaff && (
                            <>
                              <Tooltip title="Approve">
                                <IconButton 
                                  size="small" 
                                  color="success" 
                                  sx={{ bgcolor: alpha(theme.palette.success.main, 0.05) }}
                                  onClick={() => handleUpdateStatus(receipt.id, 'approved')}
                                >
                                  <CheckCircle size={18} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton 
                                  size="small" 
                                  color="error" 
                                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.05) }}
                                  onClick={() => handleUpdateStatus(receipt.id, 'rejected')}
                                >
                                  <XCircle size={18} />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}

                          {isStaff && (
                            <Tooltip title="Delete">
                              <IconButton 
                                size="small" 
                                sx={{ bgcolor: alpha(theme.palette.divider, 0.1) }}
                                onClick={() => setDeleteConfirm({ open: true, id: receipt.id })}
                              >
                                <Trash2 size={18} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
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

      {/* Bulk Print Layout (4x3 on A4 for 12 receipts) */}
      {isBulkPrinting && (
        <Box sx={{ display: 'none', '@media print': { display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'white', zIndex: 9999 } }}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gridTemplateRows: 'repeat(4, 1fr)', 
            width: '210mm', 
            height: '297mm', 
            margin: '0 auto', 
            p: '5mm', 
            boxSizing: 'border-box',
            gap: '2mm'
          }}>
            {receipts.filter(r => selectedReceiptIds.includes(r.id)).map((receipt) => (
              <Box key={receipt.id} sx={{ 
                width: '100%', 
                height: '70mm', 
                border: '0.1px solid #ddd', 
                p: 2, 
                borderRadius: 2,
                overflow: 'hidden', 
                pageBreakInside: 'avoid', 
                display: 'flex', 
                flexDirection: 'column', 
                boxSizing: 'border-box',
                position: 'relative'
              }}>
                <Box sx={{ borderBottom: '1.5px solid black', pb: 0.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 950, fontSize: '8px', color: 'black' }}>OFFICIAL RECORD</Typography>
                    <Typography sx={{ fontWeight: 950, fontSize: '8px', color: 'black' }}>#{receipt.receiptNo}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                  {settings?.logoUrl && (
                    <Box 
                      component="img" 
                      src={settings.logoUrl} 
                      sx={{ width: 18, height: 18, objectFit: 'contain', bgcolor: 'transparent' }} 
                    />
                  )}
                  <Typography sx={{ fontWeight: 950, fontSize: '12px', color: 'black', textAlign: 'center', lineHeight: 1.1, textTransform: 'uppercase' }}>
                    {settings?.instituteName || 'WUA INSTITUTE'}
                  </Typography>
                </Box>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                   <PrintField label="Student" value={receipt.studentName} />
                   <PrintField label="Admission No" value={receipt.studentOfficialId || 'N/A'} />
                   <PrintField label="Head" value={receipt.feeHead} />
                   <PrintField label="Amount" value={`INR ${receipt.amount}`} />
                   <PrintField label="Date" value={receipt.date} />
                   <PrintField label="Payment" value={receipt.paymentMode} />
                </div>
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                   <Box sx={{ textAlign: 'center' }}>
                      <Box sx={{ width: 40, borderTop: '1px solid black', mb: 0.2 }} />
                      <Typography sx={{ fontSize: '6px', color: 'black', fontWeight: 800 }}>SIGNATURE</Typography>
                   </Box>
                   <Box sx={{ textAlign: 'right' }}>
                     <Typography sx={{ fontSize: '6px', color: 'grey.600', fontWeight: 600 }}>TID: {receipt.id.slice(0, 10)}</Typography>
                     <Typography sx={{ fontSize: '5px', color: 'grey.400' }}>{new Date().toLocaleString()}</Typography>
                   </Box>
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
