import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Paper, Chip, TextField, InputAdornment, MenuItem, Select, FormControl, 
  InputLabel, CircularProgress, Avatar, Divider, Tooltip,
  Stack, Fade, Zoom, Checkbox
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Search, Download, Filter, TrendingUp, Users, CreditCard, 
  CheckCircle, Clock, Calendar, ArrowUpRight, ArrowDownRight,
  FileText, IndianRupee, PieChart as PieChartIcon, Activity,
  ChevronRight, MoreVertical, Sparkles, Layout, Filter as FilterIcon, Printer
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { FeeReceipt, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
  AreaChart, Area
} from 'recharts';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function PaymentsSummary() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('All');
  const [filterFeeHead, setFilterFeeHead] = useState('All');
  const [filterMode, setFilterMode] = useState('All');
  const [timeRange, setTimeRange] = useState('month'); // today, month, year, custom
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const role = currentUser?.role || 'student';
  const isManagerRole = role === 'manager' || (role === 'superadmin' && !isSuperAdmin);
  const isTeacherRole = role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

  useEffect(() => {
    let q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    
    // Filtering based on role
    if (isTeacherRole && !isSuperAdmin) {
      q = query(
        collection(db, 'receipts'), 
        where('classLevel', 'in', (currentUser?.assignedClasses && currentUser.assignedClasses.length > 0) ? currentUser.assignedClasses : ['__none__']), 
        orderBy('createdAt', 'desc')
      );
    } else if (currentUser?.role === 'student') {
      q = query(
        collection(db, 'receipts'), 
        where('studentId', '==', currentUser.uid), 
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[];
      setReceipts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'receipts');
    });
    return () => unsubscribe();
  }, [currentUser, isStaff, isTeacherRole]);

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.receiptNo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass === 'All' || r.classLevel === filterClass;
    const matchesFeeHead = filterFeeHead === 'All' || r.feeHead === filterFeeHead;
    const matchesMode = filterMode === 'All' || r.paymentMode === filterMode;
    
    let matchesTime = true;
    const date = new Date(r.date);
    const now = new Date();
    if (timeRange === 'today') {
      matchesTime = isWithinInterval(date, { start: startOfDay(now), end: endOfDay(now) });
    } else if (timeRange === 'month') {
      matchesTime = isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
    } else if (timeRange === 'year') {
      matchesTime = isWithinInterval(date, { start: startOfYear(now), end: endOfYear(now) });
    } else if (timeRange === 'custom') {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));
      matchesTime = isWithinInterval(date, { start, end });
    }

    return matchesSearch && matchesClass && matchesFeeHead && matchesMode && matchesTime;
  });

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedReceipts(filteredReceipts.map(r => r.id!));
    } else {
      setSelectedReceipts([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedReceipts(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const totalCollected = filteredReceipts.reduce((sum, r) => sum + (r.status === 'approved' ? r.amount : 0), 0);
  const pendingAmount = filteredReceipts.reduce((sum, r) => sum + (r.status === 'pending' ? r.amount : 0), 0);
  const approvedCount = filteredReceipts.filter(r => r.status === 'approved').length;
  const pendingCount = filteredReceipts.filter(r => r.status === 'pending').length;

  // Chart Data
  const modeData = [
    { name: 'Cash', value: filteredReceipts.filter(r => r.paymentMode === 'Cash').length },
    { name: 'UPI', value: filteredReceipts.filter(r => r.paymentMode === 'UPI').length },
    { name: 'Card', value: filteredReceipts.filter(r => r.paymentMode === 'Card').length },
    { name: 'Cheque', value: filteredReceipts.filter(r => r.paymentMode === 'Cheque').length },
  ].filter(d => d.value > 0);

  const dailyData = filteredReceipts.reduce((acc: any[], r) => {
    const day = format(new Date(r.date), 'dd MM');
    const existing = acc.find(d => d.day === day);
    if (existing) {
      existing.amount += r.status === 'approved' ? r.amount : 0;
    } else {
      acc.push({ day, amount: r.status === 'approved' ? r.amount : 0 });
    }
    return acc;
  }, []).reverse();

  const handleExportCSV = () => {
    const headers = ['Receipt No', 'Student', 'Class', 'Fee Head', 'Amount', 'Mode', 'Date', 'Status'];
    const rows = filteredReceipts.map(r => [
      r.receiptNo, r.studentName, r.classLevel, r.feeHead, r.amount, r.paymentMode, r.date, r.status
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Payments_Summary_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Payments Summary</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Detailed analysis of fees and collections
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
            <FormControl 
              size="small" 
              sx={{ 
                minWidth: 150, 
                '& .MuiOutlinedInput-root': { 
                  borderRadius: 3, 
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                } 
              }}
            >
              <Select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                sx={{ fontWeight: 700 }}
              >
                <MenuItem value="today" sx={{ fontWeight: 700 }}>Today</MenuItem>
                <MenuItem value="month" sx={{ fontWeight: 700 }}>This Month</MenuItem>
                <MenuItem value="year" sx={{ fontWeight: 700 }}>This Year</MenuItem>
                <MenuItem value="custom" sx={{ fontWeight: 700 }}>Custom Range</MenuItem>
              </Select>
            </FormControl>

            {timeRange === 'custom' && (
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  type="date"
                  size="small"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { borderRadius: 3, border: '1px solid', borderColor: 'divider' }
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>to</Typography>
                <TextField
                  type="date"
                  size="small"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { borderRadius: 3, border: '1px solid', borderColor: 'divider' }
                  }}
                />
              </Stack>
            )}

            {selectedReceipts.length > 0 && (
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<Printer size={18} />} 
                onClick={() => {
                  const selectedDocs = receipts.filter(r => selectedReceipts.includes(r.id!));
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Bulk Receipts Printing</title>
                          <style>
                            @page { size: A4; margin: 0; }
                            body { margin: 0; padding: 10mm; font-family: 'Inter', sans-serif; overflow: hidden; }
                            .grid {
                              display: grid;
                              grid-template-columns: 1fr 1fr;
                              grid-template-rows: repeat(6, 43mm);
                              gap: 4mm;
                              width: 190mm;
                              height: 277mm;
                            }
                            .receipt {
                              border: 1px dashed #444;
                              padding: 4mm;
                              font-size: 8.5px;
                              display: flex;
                              flex-direction: column;
                              justify-content: space-between;
                              position: relative;
                              overflow: hidden;
                              background: #fff;
                            }
                            .receipt:after {
                              content: 'OFFICIAL COPY';
                              position: absolute;
                              top: 50%;
                              left: 50%;
                              transform: translate(-50%, -50%) rotate(-45deg);
                              font-size: 20px;
                              color: rgba(0,0,0,0.03);
                              font-weight: 900;
                              white-space: nowrap;
                              z-index: 0;
                            }
                            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 2px; margin-bottom: 3px; position: relative; z-index: 1; }
                            .title { font-weight: 900; text-transform: uppercase; font-size: 10px; color: #000; }
                            .receipt-no { font-weight: 800; font-family: 'Courier New', Courier, monospace; }
                            .body { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center; }
                            .row { display: flex; justify-content: space-between; margin-bottom: 2px; line-height: 1.2; }
                            .label { color: #555; font-weight: 700; width: 35mm; }
                            .value { font-weight: 800; text-align: right; border-bottom: 0.5px solid #eee; flex: 1; }
                            .amount-box { border: 1.5px solid black; padding: 2px 5px; font-weight: 900; display: inline-block; background-color: #f9f9f9; width: fit-content; align-self: flex-end; font-size: 11px; margin-top: 2px; }
                            .footer { border-top: 1px solid #000; padding-top: 2px; margin-top: 3px; text-align: center; font-style: italic; font-size: 7px; color: #444; position: relative; z-index: 1; }
                            @media print {
                              .no-print { display: none; }
                              body { -webkit-print-color-adjust: exact; }
                            }
                          </style>
                        </head>
                        <body>
                          <div class="grid">
                            ${selectedDocs.map((r, idx) => `
                              <div class="receipt">
                                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 2mm; background: #0d9488;"></div>
                                <div class="header">
                                  <div style="display: flex; align-items: center; gap: 2mm;">
                                    <div style="width: 8mm; height: 8mm; background: #0d9488; border-radius: 2px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 6px;">WUA</div>
                                    <span class="title">Wali Ul Aser Institute</span>
                                  </div>
                                  <span class="receipt-no">REF: ${r.receiptNo}</span>
                                </div>
                                <div class="body">
                                  <div style="text-align: center; margin-bottom: 2mm; text-decoration: underline; font-weight: 800; font-size: 9px; letter-spacing: 1px;">OFFICIAL FEE RECEIPT</div>
                                  <div class="row">
                                    <span class="label">STUDENT NAME:</span>
                                    <span class="value">${(r.studentName || 'N/A').toUpperCase()}</span>
                                  </div>
                                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4mm;">
                                    <div class="row">
                                      <span class="label">CLASS:</span>
                                      <span class="value">${(r.classLevel || 'N/A').toUpperCase()}</span>
                                    </div>
                                    <div class="row">
                                      <span class="label">DATE:</span>
                                      <span class="value">${format(new Date(r.date), 'dd/MM/yyyy')}</span>
                                    </div>
                                  </div>
                                  <div class="row">
                                    <span class="label">CATEGORY:</span>
                                    <span class="value">${(r.feeHead || 'N/A').toUpperCase()}</span>
                                  </div>
                                  <div class="row">
                                    <span class="label">MODE:</span>
                                    <span class="value">${(r.paymentMode || 'N/A').toUpperCase()}</span>
                                  </div>
                                  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1mm;">
                                     <div style="font-size: 6px; color: #888; font-family: monospace;">AUTH_ID: ${r.id?.slice(0, 10)}</div>
                                     <div class="amount-box">
                                       PAID: Rs.${r.amount.toLocaleString()}
                                     </div>
                                  </div>
                                </div>
                                <div class="footer">
                                  COMPUTER GENERATED VALID RECEIPT • VALIDATED ON ${format(new Date(), 'dd/mm/yy')}
                                </div>
                              </div>
                            `).join('')}
                          </div>
                          <script>
                            window.onload = () => {
                              window.print();
                              // window.close();
                            };
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                }}
                sx={{ 
                  borderRadius: 3, 
                  fontWeight: 900, 
                  px: 3,
                  textTransform: 'none',
                  boxShadow: 'none'
                }}
              >
                Print (${selectedReceipts.length})
              </Button>
            )}

            <Button 
              variant="outlined" 
              startIcon={<Download size={18} />} 
              onClick={handleExportCSV}
              sx={{ 
                borderRadius: 3, 
                fontWeight: 800, 
                px: 3,
                textTransform: 'none'
              }}
            >
              Export CSV
            </Button>
          </Stack>
        </Box>
      </motion.div>

      {/* Stats Grid - Only for Administrator */}
      {isSuperAdmin && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { title: 'Total Collected', value: `Rs.${totalCollected.toLocaleString()}`, trend: '+12.5%', icon: <TrendingUp size={24} />, color: 'success', subtitle: 'Approved payments' },
          { title: 'Pending Amount', value: `Rs.${pendingAmount.toLocaleString()}`, trend: 'Awaiting', icon: <Clock size={24} />, color: 'warning', subtitle: 'Requires review' },
          { title: 'Approved Receipts', value: approvedCount, trend: 'Success', icon: <CheckCircle size={24} />, color: 'primary', subtitle: 'Completed' },
          { title: 'Pending Receipts', value: pendingCount, trend: 'Review', icon: <FileText size={24} />, color: 'error', subtitle: 'Teacher review needed' }
        ].map((stat, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <SummaryCard {...stat} />
            </motion.div>
          </Grid>
        ))}
      </Grid>
      )}

      {/* Charts - Only for Administrator */}
      {isSuperAdmin && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ 
            borderRadius: 6, 
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Collection Trend</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Analysis of daily income</Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ height: 350, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: theme.palette.text.secondary, fontWeight: 600, fontSize: 12 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: theme.palette.text.secondary, fontWeight: 600, fontSize: 12 }} 
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        borderRadius: 12, 
                        border: 'none', 
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        padding: '12px'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke={theme.palette.primary.main} 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorAmount)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ 
            borderRadius: 6, 
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            height: '100%'
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Payment Distribution</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Details by payment method</Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {modeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} 
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span style={{ fontWeight: 700, color: theme.palette.text.primary, fontSize: '0.85rem' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : 'white' }}>
                    <Sparkles size={20} color={theme.palette.primary.main} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
                    Digital payments (UPI/Card) account for significant collections this month.
                  </Typography>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}

      {/* Filters & Table */}
      <Card sx={{ 
        borderRadius: 6, 
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}>
        <Box sx={{ 
          p: 3, 
          borderBottom: '1px solid', 
          borderColor: 'divider', 
          bgcolor: alpha(theme.palette.background.default, 0.5),
          backdropFilter: 'blur(10px)'
        }}>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  px: 2, 
                  borderRadius: 3, 
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                }}
              >
                <Search size={18} style={{ marginRight: 10, color: theme.palette.text.secondary }} />
                <Box 
                  component="input"
                  placeholder="Search student or receipt number..."
                  value={searchTerm}
                  onChange={(e: any) => setSearchTerm(e.target.value)}
                  sx={{ 
                    border: 'none', 
                    outline: 'none', 
                    py: 1.2, 
                    width: '100%', 
                    fontWeight: 600,
                    bgcolor: 'transparent',
                    color: 'text.primary',
                    fontSize: '0.9rem',
                    '&::placeholder': { color: 'text.disabled' }
                  }} 
                />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontWeight: 800 }}>Fee Category</InputLabel>
                <Select 
                  value={filterFeeHead} 
                  label="Fee Category" 
                  onChange={(e) => setFilterFeeHead(e.target.value)}
                  sx={{ 
                    borderRadius: 3, 
                    bgcolor: 'background.default',
                    fontWeight: 700,
                  }}
                >
                  <MenuItem value="All" sx={{ fontWeight: 700 }}>All Categories</MenuItem>
                  <MenuItem value="Tuition Fee" sx={{ fontWeight: 700 }}>Tuition Fee</MenuItem>
                  <MenuItem value="Exam Fee" sx={{ fontWeight: 700 }}>Exam Fee</MenuItem>
                  <MenuItem value="Library Fee" sx={{ fontWeight: 700 }}>Library Fee</MenuItem>
                  <MenuItem value="Registration Fee" sx={{ fontWeight: 700 }}>Registration Fee</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontWeight: 800 }}>Payment Method</InputLabel>
                <Select 
                  value={filterMode} 
                  label="Payment Method" 
                  onChange={(e) => setFilterMode(e.target.value)}
                  sx={{ 
                    borderRadius: 3, 
                    bgcolor: 'background.default',
                    fontWeight: 700,
                  }}
                >
                  <MenuItem value="All" sx={{ fontWeight: 700 }}>All Methods</MenuItem>
                  <MenuItem value="Cash" sx={{ fontWeight: 700 }}>Cash</MenuItem>
                  <MenuItem value="UPI" sx={{ fontWeight: 700 }}>UPI</MenuItem>
                  <MenuItem value="Card" sx={{ fontWeight: 700 }}>Card</MenuItem>
                  <MenuItem value="Cheque" sx={{ fontWeight: 700 }}>Cheque</MenuItem>
                  <MenuItem value="Bank Transfer" sx={{ fontWeight: 700 }}>Bank Transfer</MenuItem>
                  <MenuItem value="Others" sx={{ fontWeight: 700 }}>Others</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.5) : 'grey.50' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedReceipts.length > 0 && selectedReceipts.length < filteredReceipts.length}
                    checked={filteredReceipts.length > 0 && selectedReceipts.length === filteredReceipts.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 800, py: 2.5 }}>Receipt Number</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Student</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Class Level</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Fee Category</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Method</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filteredReceipts.map((r) => {
                  const isItemSelected = selectedReceipts.includes(r.id!);
                  return (
                    <TableRow 
                      component={motion.tr}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={r.id} 
                      hover
                      selected={isItemSelected}
                      onClick={() => handleSelectOne(r.id!)}
                      sx={{ transition: 'all 0.2s', cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isItemSelected}
                          onChange={() => handleSelectOne(r.id!)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                        {r.receiptNo}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8rem', fontWeight: 800 }}>
                          {r.studentName.charAt(0)}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.studentName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.classLevel || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.feeHead} size="small" sx={{ fontWeight: 700, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.5) : 'grey.100' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Rs.{r.amount.toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.paymentMode} size="small" variant="outlined" sx={{ fontWeight: 800, borderRadius: 2 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        {format(new Date(r.date), 'dd MM yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={(r.status || 'pending').toUpperCase()} 
                        size="small" 
                        color={r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'error'} 
                        sx={{ fontWeight: 900, fontSize: '0.65rem', height: 24, borderRadius: 1.5 }}
                      />
                    </TableCell>
                    </TableRow>
                  );
                })}
              </AnimatePresence>
              {filteredReceipts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 10 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <FileText size={48} color={theme.palette.divider} style={{ marginBottom: 16 }} />
                      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 700 }}>No records found matching your filters.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

function SummaryCard({ title, value, icon, color, subtitle, trend }: any) {
  const theme = useTheme();
  const mainColor = theme.palette[color as 'primary' | 'success' | 'warning' | 'error'].main;
  
  return (
    <Card sx={{ 
      borderRadius: 6, 
      border: '1px solid', 
      borderColor: 'divider',
      height: '100%',
      transition: 'all 0.3s ease',
      boxShadow: '0 1px 4px rgba(0,0,0,0.01)',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }
    }}>
      <CardContent sx={{ p: 2.2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
          <Avatar 
            sx={{ 
              bgcolor: alpha(mainColor, 0.08), 
              color: mainColor, 
              borderRadius: 2.5,
              width: 44,
              height: 44
            }}
          >
            {icon}
          </Avatar>
          <Chip 
            label={trend} 
            size="small" 
            sx={{ 
              fontWeight: 800, 
              borderRadius: 1.5, 
              height: 20, 
              bgcolor: alpha(mainColor, 0.1), 
              color: mainColor,
              border: 'none',
              fontSize: '0.6rem',
              fontFamily: 'var(--font-heading)'
            }} 
          />
        </Box>
        <Typography variant="h5" sx={{ 
          fontWeight: 800, 
          mb: 0.2, 
          letterSpacing: -0.5,
          fontFamily: 'var(--font-heading)'
        }}>{value}</Typography>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            fontWeight: 800, 
            textTransform: 'uppercase', 
            letterSpacing: 0.8, 
            fontSize: '0.65rem',
            fontFamily: 'var(--font-heading)',
            opacity: 0.8
          }}
        >{title}</Typography>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1, fontWeight: 700, fontSize: '0.6rem' }}>{subtitle}</Typography>
      </CardContent>
    </Card>
  );
}
