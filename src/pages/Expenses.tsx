import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Typography, TextField, Button, Paper, Grid, MenuItem, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, Stack, alpha, useTheme, Card, CardContent,
  CircularProgress, Alert, Tooltip, InputAdornment, Menu, Skeleton,
  Dialog, Checkbox
} from '@mui/material';
import { 
  Plus, Trash2, Download, FileText, PieChart as PieIcon, 
  TrendingUp, Calendar, Search, Filter, IndianRupee,
  ChevronRight, ArrowUpRight, ArrowDownRight, Printer,
  History, CheckCircle, X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { 
  collection, addDoc, query, onSnapshot, orderBy, 
  deleteDoc, doc, serverTimestamp, where, getDocs
} from 'firebase/firestore';
import { db, auth, smartDeleteDoc, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import ActionMenu from '../components/ActionMenu';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';
import { EXPENSE_CATEGORIES as CATEGORIES } from '../constants';

interface Expense {
  id: string;
  itemName: string;
  category: string;
  type: 'credit' | 'debit';
  amount: number;
  spentBy: string;
  spentById: string;
  date: string;
  description: string;
  createdAt: any;
}

export default function Expenses() {
  const theme = useTheme();
  const { user } = useAuth(); // Assuming useAuth is available
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('debit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);

  // Filter State
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [monthlyFeeTotal, setMonthlyFeeTotal] = useState(0);

  useEffect(() => {
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const q = query(collection(db, 'receipts'), where('status', '==', 'approved'), where('date', '>=', start));
    const unsubscribe = onSnapshot(q, (snap) => {
      const total = snap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
      setMonthlyFeeTotal(total);
    }, (err) => console.error(err));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expenseDataRaw = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(expenseDataRaw);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'expenses');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !category || !amount) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        itemName,
        category,
        type,
        amount: parseFloat(amount),
        description,
        date: entryDate,
        spentBy: user?.displayName || 'Authorized Admin',
        spentById: user?.uid || auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });

      setItemName('');
      setCategory('');
      setType('debit');
      setAmount('');
      setDescription('');
    } catch (err) {
      console.error("Error adding expense:", err);
      setError("Failed to add record. Check permissions.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await smartDeleteDoc(doc(db, 'expenses', id));
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (err) {
      // Error handled by smartDeleteDoc/handleFirestoreError
      setError("Failed to delete record.");
    } finally {
      setDeletingId(null);
    }
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const totalDebits = expenses.filter(e => e.type === 'debit').reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const totalCredits = expenses.filter(e => e.type === 'credit').reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const netBalance = totalCredits - totalDebits;

  // Monthly stats
  const now = new Date();
  const currentMonthExpenses = expenses.filter(e => {
    const expDate = new Date(e.date);
    return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
  });

  const monthCredits = currentMonthExpenses.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);
  const monthDebits = currentMonthExpenses.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);
  const monthNet = monthCredits - monthDebits;

  const filteredExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.date);
    const isDateInRange = isWithinInterval(expDate, {
      start: new Date(startDate),
      end: new Date(endDate)
    });
    const s = searchQuery.toLowerCase();
    const matchesSearch = exp.itemName.toLowerCase().includes(s) || 
                          exp.category.toLowerCase().includes(s) ||
                          (exp.description && exp.description.toLowerCase().includes(s)) ||
                          (exp.spentBy && exp.spentBy.toLowerCase().includes(s));
    const matchesType = typeFilter === 'all' || exp.type === typeFilter;
    return isDateInRange && matchesSearch && matchesType;
  });

  // Chart Data
  const pieData = CATEGORIES.map(cat => ({
    name: cat.label,
    value: filteredExpenses.filter(e => e.category === cat.value).reduce((sum, e) => sum + e.amount, 0),
    color: cat.color
  })).filter(d => d.value > 0);

  // Monthly trend (last 6 months)
  const monthlyTrend = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const monthStr = format(d, 'MM yyyy');
    
    const monthData = expenses.filter(e => {
        const expDate = new Date(e.date);
        return expDate.getMonth() === d.getMonth() && expDate.getFullYear() === d.getFullYear();
    });

    return {
      name: monthStr,
      debits: monthData.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0),
      credits: monthData.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0)
    };
  });

  const exportCSV = () => {
    const data = filteredExpenses.map(exp => ({
      'Date': format(new Date(exp.date), 'dd-MM-yyyy'),
      'Time': exp.createdAt ? format(exp.createdAt.toDate(), 'hh:mm a') : 'N/A',
      'Type': (exp.type || 'debit').toUpperCase(),
      'Item': exp.itemName,
      'Category': exp.category,
      'Amount': exp.amount,
      'Admin Name': exp.spentBy,
      'Description': exp.description
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Operations_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('INSTITUTE WALI UL ASER', 105, 18, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Institute Financial Operations Report', 105, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Period: ${format(new Date(startDate), 'dd MM yyyy')} to ${format(new Date(endDate), 'dd MM yyyy')}`, 105, 36, { align: 'center' });

    // Summary Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text('FINANCIAL SUMMARY', 14, 55);
    doc.line(14, 57, 60, 57);
    
    doc.setFontSize(10);
    doc.text(`Total Credits: Rs.${totalCredits.toLocaleString()}`, 14, 65);
    doc.text(`Total Debits: Rs.${totalDebits.toLocaleString()}`, 14, 72);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`NET SETTLEMENT: Rs.${netBalance.toLocaleString()}`, 14, 82);
    doc.setFont("helvetica", "normal");
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated By: ${user?.displayName || 'Authorized Admin'}`, 130, 65);
    doc.text(`Date of Generation: ${format(new Date(), 'dd MM yyyy HH:mm')}`, 130, 72);

    // Table
    (doc as any).autoTable({
      startY: 95,
      head: [['Date', 'Description', 'Category', 'Type', 'Amount (Rs.)', 'Logged By']],
      body: filteredExpenses.map(exp => [
        format(new Date(exp.date), 'dd-MM-yyyy'), 
        exp.itemName, 
        (exp.category || 'other').toUpperCase(), 
        (exp.type || 'debit').toUpperCase(),
        { content: exp.amount.toLocaleString(), styles: { textColor: exp.type === 'debit' ? [185, 28, 28] : [22, 163, 74] } },
        exp.spentBy
      ]),
      headStyles: { fillColor: [15, 118, 110], halign: 'center' },
      columnStyles: {
        4: { halign: 'right' },
        3: { halign: 'center' }
      },
      styles: { fontSize: 9 },
      theme: 'striped'
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    if (finalY < 270) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('This is a computer-generated report and does not require a physical signature.', 105, finalY, { align: 'center' });
    }

    doc.save(`Institute_Finance_${startDate}_to_${endDate}.pdf`);
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
              <Skeleton variant="rectangular" height={130} sx={{ borderRadius: 4 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 4 }} />
      </Stack>
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 4 }}>
      <Alert severity="error" variant="filled" sx={{ borderRadius: 4 }}>{error}</Alert>
    </Box>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <Box sx={{ p: { xs: 2, md: 4 }, pb: 12 }}>
        
        {/* Header Section */}
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 4 }} spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'text.primary', mb: 0.5, letterSpacing: -1 }}>
              Institute Finance
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Manage ledger, credits, debits and institutional payrolls
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Tooltip title="Download Ledger as CSV">
              <Button 
                variant="outlined" 
                startIcon={<Download size={18} />} 
                onClick={exportCSV}
                sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700 }}
              >
                Ledger
              </Button>
            </Tooltip>
            <Button 
              variant="contained" 
              startIcon={<Printer size={18} />} 
              onClick={exportPDF}
              sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700, px: 3, boxShadow: '0 8px 16px rgba(15, 118, 110, 0.2)' }}
            >
              Print Report
            </Button>
          </Stack>
        </Stack>

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
                  {selectedIds.length} Selected
                </Box>
                <Button 
                  size="small" 
                  variant="text" 
                  onClick={() => { setSelectedIds([]); setIsSelectionMode(false); }}
                  sx={{ fontWeight: 800, color: 'text.secondary' }}
                >
                  Clear
                </Button>
              </Stack>
              
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="contained" 
                  color="error" 
                  startIcon={<Trash2 size={18} />}
                  onClick={() => {
                    if (confirm(`Delete ${selectedIds.length} records?`)) {
                      selectedIds.forEach(id => handleDelete(id));
                      setSelectedIds([]);
                      setIsSelectionMode(false);
                    }
                  }}
                  sx={{ borderRadius: 2.5, fontWeight: 800, px: 2, textTransform: 'none' }}
                >
                  Bulk Delete
                </Button>
                <IconButton 
                  onClick={() => { setSelectedIds([]); setIsSelectionMode(false); }}
                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main' }}
                >
                  <X size={20} />
                </IconButton>
              </Stack>
            </Box>
          )}
        </AnimatePresence>

        {/* Monthly Summary Stats */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 2.5, 
            mb: 4, 
            borderRadius: 4, 
            bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.5) : alpha(theme.palette.primary.main, 0.03),
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
          }}
        >
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ textAlign: 'center', borderRight: { md: '1px solid' }, borderColor: 'divider', px: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly Collection (Receipts)</Typography>
                <Typography variant="h6" sx={{ fontWeight: 950, color: 'primary.main' }}>₹{monthlyFeeTotal.toLocaleString()}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ textAlign: 'center', borderRight: { md: '1px solid' }, borderColor: 'divider', px: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly Operational Income</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900, color: 'success.main' }}>₹{monthCredits.toLocaleString()}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ textAlign: 'center', borderRight: { md: '1px solid' }, borderColor: 'divider', px: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly Expenditure</Typography>
                <Typography variant="h6" sx={{ fontWeight: 900, color: 'error.main' }}>₹{monthDebits.toLocaleString()}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ textAlign: 'center', px: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Net Savings (Sum Total)</Typography>
                <Typography variant="h6" sx={{ fontWeight: 950, color: (monthlyFeeTotal + monthNet) >= 0 ? 'success.main' : 'error.main' }}>
                  ₹{(monthlyFeeTotal + monthNet).toLocaleString()}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={4}>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 4, borderRadius: 5, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 3 }}>Quick Entry: Income / Expense</Typography>
              <form onSubmit={handleSubmit}>
                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      fullWidth
                      label="Item / Purpose"
                      placeholder="e.g. Monthly Electricity Bill"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      required
                      variant="filled"
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3, fontWeight: 700 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      select
                      fullWidth
                      label="Transaction Type"
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      required
                      variant="filled"
                      InputProps={{ 
                        disableUnderline: true, 
                        sx: { 
                            borderRadius: 3, 
                            fontWeight: 800,
                            color: type === 'credit' ? 'success.main' : 'error.main'
                        } 
                      }}
                    >
                      <MenuItem value="debit" sx={{ fontWeight: 800, color: 'error.main' }}>Debit (Expense)</MenuItem>
                      <MenuItem value="credit" sx={{ fontWeight: 800, color: 'success.main' }}>Credit (Income)</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      select
                      fullWidth
                      label="Category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                      variant="filled"
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3, fontWeight: 700 } }}
                    >
                      {CATEGORIES.map((cat) => (
                        <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 5 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Amount"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      variant="filled"
                      InputProps={{ 
                        disableUnderline: true, 
                        sx: { borderRadius: 3, fontWeight: 900, fontSize: '1.1rem' },
                        startAdornment: <InputAdornment position="start"><Typography sx={{ fontWeight: 900, color: 'text.secondary' }}>Rs.</Typography></InputAdornment>
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Transaction Date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      required
                      variant="filled"
                      InputLabelProps={{ shrink: true }}
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3, fontWeight: 700 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Button
                      fullWidth
                      type="submit"
                      variant="contained"
                      disabled={submitting}
                      sx={{ height: 56, borderRadius: 3, textTransform: 'none', fontWeight: 900, fontSize: '1rem' }}
                    >
                      {submitting ? <CircularProgress size={24} color="inherit" /> : 'Record Entry'}
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Detailed Description (Audit Note)"
                      placeholder="Add any specific details for audit trail..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      variant="filled"
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3, fontWeight: 600 } }}
                    />
                  </Grid>
                </Grid>
              </form>
            </Paper>
          </Grid>

          {/* Analysis Section */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 4, borderRadius: 5, height: 450, position: 'relative', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 4 }}>Financial Pulse (Last 6 Months)</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis hide />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: 12 }}
                    itemStyle={{ fontWeight: 800 }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar name="Income" dataKey="credits" fill={theme.palette.success.main} radius={[6, 6, 0, 0]} />
                  <Bar name="Expense" dataKey="debits" fill={theme.palette.error.main} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 4, borderRadius: 5, height: 450, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 4 }}>Category Distribution</Typography>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Records Table */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ borderRadius: 5, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      placeholder="Search items, categories, or admins..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      variant="outlined"
                      size="small"
                      InputProps={{
                        startAdornment: <Search size={18} style={{ marginRight: 12, opacity: 0.5 }} />,
                        sx: { borderRadius: 3, bgcolor: 'background.paper', height: 45 }
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack direction="row" spacing={2} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        startIcon={<Filter size={18} />}
                        onClick={(e) => setAnchorEl(e.currentTarget)}
                        sx={{ borderRadius: 3, px: 3, height: 45, fontWeight: 800, textTransform: 'none' }}
                      >
                        Filters & Range
                        {(typeFilter !== 'all' || startDate !== format(startOfMonth(new Date()), 'yyyy-MM-dd')) && (
                          <Box sx={{ width: 8, height: 8, bgcolor: 'error.main', borderRadius: '50%', ml: 1 }} />
                        )}
                      </Button>

                      <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={() => setAnchorEl(null)}
                        PaperProps={{ 
                          sx: { 
                            p: 2, 
                            mt: 1.5, 
                            minWidth: 320, 
                            borderRadius: 4, 
                            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                          } 
                        }}
                      >
                        <Stack spacing={3} sx={{ p: 1 }}>
                          <Box>
                            <Typography variant="overline" sx={{ fontWeight: 900, color: 'text.disabled', mb: 1, display: 'block' }}>Type Filter</Typography>
                            <Stack direction="row" spacing={1}>
                              {['all', 'credit', 'debit'].map((t) => (
                                <Chip 
                                  key={t}
                                  label={t.toUpperCase()}
                                  onClick={() => setTypeFilter(t as any)}
                                  color={typeFilter === t ? 'primary' : 'default'}
                                  variant={typeFilter === t ? 'filled' : 'outlined'}
                                  sx={{ fontWeight: 800, flex: 1 }}
                                />
                              ))}
                            </Stack>
                          </Box>
                          
                          <Box>
                            <Typography variant="overline" sx={{ fontWeight: 900, color: 'text.disabled', mb: 1, display: 'block' }}>Date Range</Typography>
                            <Stack direction="row" spacing={2}>
                              <TextField
                                type="date"
                                label="From"
                                fullWidth
                                size="small"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                              <TextField
                                type="date"
                                label="To"
                                fullWidth
                                size="small"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Stack>
                          </Box>

                          <Button 
                            fullWidth 
                            variant="contained" 
                            onClick={() => setAnchorEl(null)}
                            sx={{ borderRadius: 2, fontWeight: 900, mt: 1 }}
                          >
                            Apply Filters
                          </Button>
                          
                          <Button 
                            fullWidth 
                            size="small"
                            onClick={() => {
                              setTypeFilter('all');
                              setStartDate(format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
                              setEndDate(format(new Date(), 'yyyy-MM-dd'));
                              setAnchorEl(null);
                            }}
                            sx={{ fontWeight: 700, color: 'text.disabled' }}
                          >
                            Reset All
                          </Button>
                        </Stack>
                      </Menu>

                      <Button
                        variant="contained"
                        startIcon={<Download size={18} />}
                        onClick={exportCSV}
                        sx={{ borderRadius: 3, px: 3, height: 45, fontWeight: 900, textTransform: 'none' }}
                      >
                        Export
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>

              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox 
                              checked={filteredExpenses.length > 0 && selectedIds.length === filteredExpenses.length} 
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(filteredExpenses.map(exp => exp.id));
                                  setIsSelectionMode(true);
                                } else {
                                  setSelectedIds([]);
                                  setIsSelectionMode(false);
                                }
                              }}
                              sx={{ color: theme.palette.primary.main }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 900, bgcolor: 'background.paper', fontSize: '0.85rem' }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 900, bgcolor: 'background.paper', fontSize: '0.85rem' }}>Time</TableCell>
                          <TableCell sx={{ fontWeight: 900, bgcolor: 'background.paper', fontSize: '0.85rem' }}>Item / Purpose</TableCell>
                          <TableCell sx={{ fontWeight: 900, bgcolor: 'background.paper', fontSize: '0.85rem' }}>Category</TableCell>
                          <TableCell sx={{ fontWeight: 900, bgcolor: 'background.paper', fontSize: '0.85rem' }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 900, bgcolor: 'background.paper', fontSize: '0.85rem' }} align="right">Amount</TableCell>
                          <TableCell sx={{ fontWeight: 900, bgcolor: 'background.paper', fontSize: '0.85rem' }} align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                    <AnimatePresence>
                      {filteredExpenses.map((exp) => {
                        const isSelected = selectedIds.includes(exp.id);
                        return (
                          <TableRow 
                            key={exp.id}
                            component={motion.tr}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            hover
                            selected={isSelected}
                            onClick={() => {
                              if (isSelectionMode) {
                                setSelectedIds(prev => isSelected ? prev.filter(id => id !== exp.id) : [...prev, exp.id]);
                                if (selectedIds.length === 1 && isSelected) setIsSelectionMode(false);
                              }
                            }}
                            sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: isSelectionMode ? 'pointer' : 'default' }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox 
                                checked={isSelected} 
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const next = isSelected ? selectedIds.filter(id => id !== exp.id) : [...selectedIds, exp.id];
                                  setSelectedIds(next);
                                  setIsSelectionMode(next.length > 0);
                                }}
                                sx={{ color: theme.palette.primary.main }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            {format(new Date(exp.date), 'dd-MM-yyyy')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, color: 'text.disabled', fontSize: '0.75rem' }}>
                            {exp.createdAt ? format(exp.createdAt.toDate(), 'hh:mm a') : '--:--'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{exp.itemName}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Logged By: <span style={{ fontWeight: 800, color: theme.palette.primary.main }}>{exp.spentBy || 'Admin'}</span>
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={(exp.category || 'other').toUpperCase()} 
                              size="small"
                              sx={{ 
                                fontWeight: 900, 
                                fontSize: '0.65rem',
                                bgcolor: alpha(CATEGORIES.find(c => c.value === exp.category)?.color || '#000', 0.1),
                                color: CATEGORIES.find(c => c.value === exp.category)?.color,
                                borderRadius: 1.5
                              }} 
                            />
                          </TableCell>
                          <TableCell>
                             <Chip 
                                label={(exp.type || 'debit').toUpperCase()} 
                                size="small"
                                sx={{ 
                                    fontWeight: 900, 
                                    fontSize: '0.65rem',
                                    bgcolor: alpha(exp.type === 'credit' ? theme.palette.success.main : theme.palette.error.main, 0.1),
                                    color: exp.type === 'credit' ? 'success.main' : 'error.main',
                                    borderRadius: 1.5
                                }} 
                                icon={exp.type === 'credit' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                             />
                          </TableCell>
                          <TableCell align="right">
                            <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: exp.type === 'credit' ? 'success.main' : 'error.main' }}>
                              {exp.type === 'credit' ? '+' : '-'} Rs.{exp.amount.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <ActionMenu 
                              items={[
                                {
                                  label: 'Delete Entry',
                                  icon: <Trash2 size={16} />,
                                  onClick: () => {
                                    setItemToDelete(exp.id);
                                    setDeleteDialogOpen(true);
                                  },
                                  color: theme.palette.error.main
                                }
                              ]}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </AnimatePresence>
                    {filteredExpenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 12 }}>
                          <Box sx={{ opacity: 0.5 }}>
                              <History size={48} style={{ marginBottom: 12 }} />
                              <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                No financial records found for the selected period
                              </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* Delete Confirmation Dialog */}
        <Dialog 
          open={deleteDialogOpen} 
          onClose={() => !deletingId && setDeleteDialogOpen(false)}
          PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>Confirm Deletion</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Are you sure you want to delete this financial record? This action will permanently remove it from the ledger.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button 
                onClick={() => setDeleteDialogOpen(false)} 
                disabled={deletingId !== null}
                sx={{ fontWeight: 800 }}
              >
                Cancel
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={() => itemToDelete && handleDelete(itemToDelete)}
                disabled={deletingId !== null}
                sx={{ borderRadius: 2, fontWeight: 800, px: 3 }}
              >
                {deletingId ? 'Deleting...' : 'Delete Record'}
              </Button>
            </Stack>
          </Box>
        </Dialog>
      </Box>
    </motion.div>
  );
}

