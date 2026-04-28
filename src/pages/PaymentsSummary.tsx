import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Paper, Chip, TextField, InputAdornment, MenuItem, Select, FormControl, 
  InputLabel, CircularProgress, Avatar, Divider, Tooltip,
  Stack, Fade, Zoom
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Search, Download, Filter, TrendingUp, Users, CreditCard, 
  CheckCircle, Clock, Calendar, ArrowUpRight, ArrowDownRight,
  FileText, DollarSign, PieChart as PieChartIcon, Activity,
  ChevronRight, MoreVertical, Sparkles, Layout, Filter as FilterIcon
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
  const [timeRange, setTimeRange] = useState('month'); // today, month, year

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
    }

    return matchesSearch && matchesClass && matchesFeeHead && matchesMode && matchesTime;
  });

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
    const day = format(new Date(r.date), 'dd MMM');
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
          <Stack direction="row" spacing={2}>
            <FormControl 
              size="small" 
              sx={{ 
                minWidth: 150, 
                '& .MuiOutlinedInput-root': { 
                  borderRadius: 4, 
                  bgcolor: 'background.paper',
                  '& fieldset': { border: 'none' },
                  boxShadow: theme.palette.mode === 'dark'
                    ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                    : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                } 
              }}
            >
              <Select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                sx={{ fontWeight: 800 }}
              >
                <MenuItem value="today" sx={{ fontWeight: 700 }}>Today</MenuItem>
                <MenuItem value="month" sx={{ fontWeight: 700 }}>This Month</MenuItem>
                <MenuItem value="year" sx={{ fontWeight: 700 }}>This Year</MenuItem>
              </Select>
            </FormControl>
            <Button 
              variant="contained" 
              startIcon={<Download size={18} />} 
              onClick={handleExportCSV}
              sx={{ 
                borderRadius: 4, 
                fontWeight: 900, 
                px: 4, 
                py: 1.5,
                textTransform: 'none',
                boxShadow: theme.palette.mode === 'dark'
                  ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                  : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
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
          { title: 'Total Collected', value: `₹${totalCollected.toLocaleString()}`, trend: '+12.5%', icon: <TrendingUp size={24} />, color: 'success', subtitle: 'Approved payments' },
          { title: 'Pending Amount', value: `₹${pendingAmount.toLocaleString()}`, trend: 'Awaiting', icon: <Clock size={24} />, color: 'warning', subtitle: 'Requires review' },
          { title: 'Approved Receipts', value: approvedCount, trend: 'Success', icon: <CheckCircle size={24} />, color: 'primary', subtitle: 'Completed' },
          { title: 'Pending Receipts', value: pendingCount, trend: 'Review', icon: <FileText size={24} />, color: 'error', subtitle: 'Teacher review needed' }
        ].map((stat, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card sx={{ 
                borderRadius: 7, 
                border: 'none',
                bgcolor: 'background.paper',
                boxShadow: theme.palette.mode === 'dark'
                  ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
                  : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { 
                  transform: 'translateY(-8px)', 
                  boxShadow: theme.palette.mode === 'dark'
                    ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
                    : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
                }
              }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette[stat.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.1), 
                        color: `${stat.color}.main`, 
                        borderRadius: 4,
                        width: 56,
                        height: 56,
                        boxShadow: theme.palette.mode === 'dark'
                          ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                          : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                      }}
                    >
                      {stat.icon}
                    </Avatar>
                    <Chip 
                      label={stat.trend} 
                      size="small" 
                      sx={{ 
                        fontWeight: 900, 
                        borderRadius: 2, 
                        height: 24, 
                        bgcolor: alpha(theme.palette[stat.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.1), 
                        color: `${stat.color}.main`,
                        border: 'none'
                      }} 
                    />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1 }}>{stat.value}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>{stat.title}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, fontWeight: 700 }}>{stat.subtitle}</Typography>
                </CardContent>
              </Card>
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
            borderRadius: 7, 
            border: 'none',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
              : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
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
            borderRadius: 7, 
            border: 'none',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
              : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
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
              <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 4 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : 'white' }}>
                    <Sparkles size={20} color={theme.palette.primary.main} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
                    Digital payments (UPI/Card) account for 65% of total collections this month.
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
        borderRadius: 7, 
        border: 'none',
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'dark'
          ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
          : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
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
                  px: 2.5, 
                  borderRadius: 4, 
                  border: 'none',
                  bgcolor: 'background.default',
                  boxShadow: theme.palette.mode === 'dark'
                    ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                    : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                }}
              >
                <Search size={20} style={{ marginRight: 10, color: theme.palette.text.secondary }} />
                <Box 
                  component="input"
                  placeholder="Search student or receipt number..."
                  value={searchTerm}
                  onChange={(e: any) => setSearchTerm(e.target.value)}
                  sx={{ 
                    border: 'none', 
                    outline: 'none', 
                    py: 1.5, 
                    width: '100%', 
                    fontWeight: 700,
                    bgcolor: 'transparent',
                    color: 'text.primary',
                    fontSize: '0.95rem',
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
                    borderRadius: 4, 
                    bgcolor: 'background.default',
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    fontWeight: 800,
                    boxShadow: theme.palette.mode === 'dark'
                      ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                      : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
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
                    borderRadius: 4, 
                    bgcolor: 'background.default',
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    fontWeight: 800,
                    boxShadow: theme.palette.mode === 'dark'
                      ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                      : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
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
                {filteredReceipts.map((r) => (
                  <TableRow 
                    component={motion.tr}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={r.id} 
                    hover
                    sx={{ transition: 'all 0.2s' }}
                  >
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
                      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>₹{r.amount.toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.paymentMode} size="small" variant="outlined" sx={{ fontWeight: 800, borderRadius: 2 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        {format(new Date(r.date), 'dd MMM yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={r.status.toUpperCase()} 
                        size="small" 
                        color={r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'error'} 
                        sx={{ fontWeight: 900, fontSize: '0.65rem', height: 24, borderRadius: 1.5 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </AnimatePresence>
              {filteredReceipts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
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
      borderRadius: 5, 
      border: '1px solid', 
      borderColor: 'divider',
      height: '100%',
      transition: 'all 0.3s ease',
      '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 12px 30px rgba(0,0,0,0.08)' }
    }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2.5 }}>
          <Avatar 
            sx={{ 
              bgcolor: alpha(mainColor, 0.1), 
              color: mainColor, 
              borderRadius: 3,
              width: 52,
              height: 52
            }}
          >
            {icon}
          </Avatar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: mainColor }}>
            <Typography variant="caption" sx={{ fontWeight: 900 }}>{trend}</Typography>
            <ArrowUpRight size={14} />
          </Box>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', fontWeight: 700 }}>
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
}
