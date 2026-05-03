import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  CircularProgress, IconButton, Chip, Avatar, 
  Divider, Paper, List, ListItem, ListItemText, 
  ListItemAvatar, Tooltip, Select, MenuItem, 
  FormControl, InputLabel, TextField,
  Stack, Fade, Zoom, Tab, Tabs
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Download, FileText, TrendingUp, Users, 
  BookOpen, Calendar, IndianRupee, Filter,
  BarChart2, PieChart as PieChartIcon, Share2,
  Printer, Mail, FileSpreadsheet, ChevronRight,
  ArrowUpRight, ArrowDownRight, Sparkles,
  GraduationCap, Award, Briefcase, Activity,
  Wallet, PieChart as PieIcon, BarChart3, Clock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend,
  AreaChart, Area
} from 'recharts';
import { collection, query, onSnapshot, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth, isWithinInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '../lib/exportUtils';

const COLORS = ['#0d9488', '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4'];

export default function Reports() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'academic' | 'financial'>('financial');
  
  // Date Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 11)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [counts, setCounts] = useState({ students: 0, fees: 0, credits: 0, debits: 0, attendance: 0 });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<any[]>([]);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const role = currentUser?.role || 'student';
  const isManagerRole = role === 'manager' || (role === 'superadmin' && !isSuperAdmin);
  const isAdmin = isSuperAdmin || isManagerRole;

  useEffect(() => {
    if (!currentUser || !isAdmin) return;

    const qFees = query(collection(db, 'receipts'), where('status', '==', 'approved'));
    const unsubFees = onSnapshot(qFees, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setAllReceipts(data.filter((r: any) => ![10000, 20000, 50000].includes(Number(r.amount))));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'receipts');
    });

    const qExp = query(collection(db, 'expenses'));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setAllExpenses(data.filter((e: any) => ![10000, 20000, 50000].includes(Number(e.amount))));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    return () => {
      unsubFees();
      unsubExp();
    };
  }, [currentUser?.uid, isAdmin]);

  useEffect(() => {
    if (!allReceipts.length && !allExpenses.length) return;

    // Use all data for summary cards if requested, or wide interval
    const totalFees = allReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalCredits = allExpenses.filter(e => e.type === 'credit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalDebits = allExpenses.filter(e => e.type === 'debit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const yearlyData = Array.from({ length: 5 }, (_, i) => {
      const year = new Date().getFullYear() - i;
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const yearFees = allReceipts
        .filter(r => r.date >= yearStart && r.date <= yearEnd)
        .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
      const yearCredits = allExpenses
        .filter(e => e.type === 'credit' && e.date >= yearStart && e.date <= yearEnd)
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const yearDebits = allExpenses
        .filter(e => e.type === 'debit' && e.date >= yearStart && e.date <= yearEnd)
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      
      return { 
        year, 
        revenue: yearFees + yearCredits, 
        expenses: yearDebits, 
        net: (yearFees + yearCredits) - yearDebits 
      };
    });

    setCounts(prev => ({ 
      ...prev, 
      fees: totalFees, 
      credits: totalCredits,
      debits: totalDebits
    }));

    // Interval for Charts
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const interval = { start, end };
    
    const filteredReceipts = allReceipts.filter(r => {
      const d = r.date ? new Date(r.date) : (r.createdAt ? (typeof r.createdAt === 'number' ? new Date(r.createdAt) : r.createdAt.toDate()) : null);
      return d && isWithinInterval(d, interval);
    });
    const filteredExpenses = allExpenses.filter(e => {
      const d = e.date ? new Date(e.date) : (e.createdAt ? (typeof e.createdAt === 'number' ? new Date(e.createdAt) : e.createdAt.toDate()) : null);
      return d && isWithinInterval(d, interval);
    });

    // Chart Performance: Combine Monthly Trend
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    const financialTrend = last6Months.map(month => {
      const monthStr = format(month, 'MMM yyyy');
      const monthFees = allReceipts
          .filter(r => r.date && isSameMonth(new Date(r.date), month))
          .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
      const monthCredits = allExpenses
          .filter(e => e.type === 'credit' && e.date && isSameMonth(new Date(e.date), month))
          .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const monthDebits = allExpenses
          .filter(e => e.type === 'debit' && e.date && isSameMonth(new Date(e.date), month))
          .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

      return { 
          name: monthStr, 
          revenue: monthFees + monthCredits,
          expenses: monthDebits
      };
    });
    setRevenueData(financialTrend);

    // Category Breakdown
    const expByCat: Record<string, number> = {};
    filteredExpenses.filter(e => e.type === 'debit').forEach(e => {
      const cat = e.category || 'Other';
      expByCat[cat] = (expByCat[cat] || 0) + (Number(e.amount) || 0);
    });
    setExpenseCategories(Object.keys(expByCat).map(key => ({ name: key, value: expByCat[key] })));
  }, [allReceipts, allExpenses, startDate, endDate]);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const unsubscribes: (() => void)[] = [];

    // 1. Enrollment & Students
    const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const students = snapshot.docs.map(doc => doc.data());
      setCounts(prev => ({ ...prev, students: students.length }));

      const distribution: Record<string, number> = {};
      students.forEach(s => {
        const level = s.classLevel || s.grade || 'Unassigned';
        distribution[level] = (distribution[level] || 0) + 1;
      });
      
      setEnrollmentData(Object.keys(distribution).map(key => ({
        name: key,
        value: distribution[key]
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    unsubscribes.push(unsubStudents);

    setLoading(false);
    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser?.uid, isAdmin]);

  useEffect(() => {
    if (!currentUser || !isAdmin) return;
    const unsubscribes: (() => void)[] = [];
      const qQuizzes = query(collection(db, 'quiz_results'), orderBy('timestamp', 'desc'), limit(500));
      const unsubQuizzes = onSnapshot(qQuizzes, (snapshot) => {
        const results = snapshot.docs.map(doc => doc.data());
        const classLevelStats: Record<string, { totalScore: number, count: number }> = {};
        
        results.filter(r => {
            if (!r.timestamp) return true;
            const d = r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
            return isWithinInterval(d, { start: new Date(startDate), end: new Date(endDate) });
        }).forEach(r => {
          const level = r.classLevel || 'N/A';
          if (!classLevelStats[level]) classLevelStats[level] = { totalScore: 0, count: 0 };
          classLevelStats[level].totalScore += r.percentage;
          classLevelStats[level].count += 1;
        });

        setPerformanceData(Object.keys(classLevelStats).map(key => ({
          name: key,
          average: Math.round(classLevelStats[key].totalScore / classLevelStats[key].count)
        })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'quiz_results');
      });
      unsubscribes.push(unsubQuizzes);

      // Attendance
      const qAttendance = query(collection(db, 'attendance'), limit(2000));
      const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
        const records = snapshot.docs.map(doc => doc.data());
        const daily: Record<string, { present: number, absent: number }> = {};
        
        // Use last 14 days for more density
        const last14Days = Array.from({ length: 14 }, (_, i) => format(subMonths(new Date(), 0).setDate(new Date().getDate() - i), 'yyyy-MM-dd')).reverse();
        
        last14Days.forEach(day => {
          const dayRecords = records.filter(r => r.date === day);
          if (dayRecords.length > 0) {
              const label = format(new Date(day), 'dd MMM');
              daily[label] = {
                present: dayRecords.filter(r => r.status === 'present').length,
                absent: dayRecords.filter(r => r.status === 'absent').length
              };
          }
        });

        setAttendanceChartData(Object.keys(daily).map(key => ({
          name: key,
          ...daily[key]
        })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      });
      unsubscribes.push(unsubAttendance);
    
    setLoading(false);
    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser?.uid, isAdmin, startDate, endDate]);

  const availableReports = [
    { title: 'Academic Summary', icon: <GraduationCap size={22} />, type: 'ANALYSIS', color: 'primary' },
    { title: 'Institutional Ledger', icon: <Briefcase size={22} />, type: 'RECORDS', color: 'success', page: '/expenses' },
    { title: 'Fee Status Log', icon: <IndianRupee size={22} />, type: 'FINANCE', color: 'warning', page: '/fees' },
    { title: 'Logistics / Assets', icon: <Activity size={22} />, type: 'PDF', color: 'error' }
  ];

  const financialStats = [
    { title: 'Inflow (Fees)', value: `Rs.${counts.fees.toLocaleString()}`, trend: 'Verified Receipts', icon: <Wallet size={24} />, color: 'primary', link: '/fees' },
    { title: 'Other Credits', value: `Rs.${counts.credits.toLocaleString()}`, trend: 'Misc Income', icon: <ArrowUpRight size={24} />, color: 'success', link: '/expenses' },
    { title: 'Outflow (Expenses)', value: `Rs.${counts.debits.toLocaleString()}`, trend: 'Ledger Records', icon: <ArrowDownRight size={24} />, color: 'error', link: '/expenses' },
    { title: 'Total Net Balance', value: `Rs.${(counts.fees + counts.credits - counts.debits).toLocaleString()}`, trend: 'Current Liquidity', icon: <Activity size={24} />, color: 'warning' }
  ];

  const handleExportAll = () => {
    const exportData = revenueData.map(d => ({ Month: d.name, Revenue: d.revenue, Expenses: d.expenses }));
    exportToCSV(exportData, `Institute_Financial_Insight_${startDate}_to_${endDate}`);
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: 8 }}>
      {/* Print Only Header */}
      <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 6, borderBottom: '2pt solid #000', pb: 2 } }}>
        <Typography variant="h3" sx={{ fontWeight: 900, color: '#000', mb: 1 }}>MAKTAB WALI UL ASER</Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Institutional Financial & Academic Report</Typography>
        <Typography variant="body1">Period: {format(new Date(startDate), 'dd MMM yyyy')} to {format(new Date(endDate), 'dd MMM yyyy')}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>Generated on: {format(new Date(), 'dd MMM yyyy HH:mm')}</Typography>
      </Box>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5, fontFamily: 'var(--font-heading)' }}>Reports & Analytics</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
                Data consolidation Dashboard
                </Typography>
                <Chip 
                  label={currentUser?.displayName || 'Admin'} 
                  size="small" 
                  sx={{ fontWeight: 800, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} 
                />
            </Stack>
          </Box>
          
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: { xs: '100%', sm: 'auto' }, '@media print': { display: 'none' } }}>
             <Paper sx={{ p: 1, display: 'flex', gap: 1, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, alignSelf: 'center' }}>
                <TextField
                    type="date"
                    label="From"
                    size="small"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem' } }}
                    InputLabelProps={{ shrink: true }}
                    variant="standard"
                />
                <Divider orientation="vertical" flexItem />
                <TextField
                    type="date"
                    label="To"
                    size="small"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem' } }}
                    InputLabelProps={{ shrink: true }}
                    variant="standard"
                />
             </Paper>
            <Button 
              variant="contained" 
              startIcon={<Printer size={18} />} 
              onClick={() => window.print()}
              sx={{ borderRadius: 2, fontWeight: 900, px: 3, textTransform: 'none' }}
            >
              Print
            </Button>
          </Stack>
        </Box>
      </motion.div>

      <Box sx={{ 
        mb: 4,
        '@media print': { display: 'none' } 
      }}>
        <Tabs 
            value={activeTab} 
            onChange={(_, v) => setActiveTab(v)}
            sx={{ 
                '& .MuiTab-root': { fontWeight: 900, px: 3, textTransform: 'none', fontSize: '1rem' },
                borderBottom: `1px solid ${theme.palette.divider}`
            }}
        >
            <Tab label="Financial Analysis" value="financial" icon={<BarChart3 size={20} />} iconPosition="start" />
            <Tab label="Student & Academic Insights" value="academic" icon={<GraduationCap size={20} />} iconPosition="start" />
        </Tabs>
      </Box>

      <AnimatePresence mode="wait">
        {activeTab === 'financial' ? (
          <motion.div key="financial" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Grid container spacing={3}>
              {/* Financial Stats */}
              {financialStats.map((stat, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                  <Card sx={{ 
                    borderRadius: 4, 
                    border: 'none',
                    bgcolor: 'background.paper',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
                    '&:hover': { transform: 'translateY(-4px)', transition: 'all 0.3s' }
                  }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Avatar sx={{ bgcolor: alpha(theme.palette[stat.color as any].main, 0.1), color: `${stat.color}.main`, borderRadius: 2 }}>
                          {stat.icon}
                        </Avatar>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', opacity: 0.7 }}>{stat.trend}</Typography>
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>{stat.value}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>{stat.title}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}

              {/* Combined Revenue vs Expense Chart */}
              <Grid size={{ xs: 12, lg: 8 }}>
                <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, mb: 3 }}>Health Monitor: Cash Flow</Typography>
          <Box sx={{ height: 400, mt: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={theme.palette.error.main} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={theme.palette.error.main} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: theme.palette.text.secondary, fontWeight: 700, fontSize: 12 }} 
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: theme.palette.text.secondary, fontWeight: 700, fontSize: 12 }} 
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            borderRadius: 16, 
                            border: 'none', 
                            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            fontWeight: 900
                          }} 
                        />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 20, fontWeight: 700 }} />
                        <Area 
                          type="monotone" 
                          name="Inflow (Fees+Misc)" 
                          dataKey="revenue" 
                          stroke={theme.palette.primary.main} 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorRev)" 
                        />
                        <Area 
                          type="monotone" 
                          name="Outflow (Expenses)" 
                          dataKey="expenses" 
                          stroke={theme.palette.error.main} 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorExp)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              {/* Expenditures Chart */}
              <Grid size={{ xs: 12, lg: 4 }}>
                <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${theme.palette.divider}`, height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, mb: 3 }}>Expenditure Core</Typography>
                  <Box sx={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expenseCategories} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value" stroke="none">
                          {expenseCategories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ mt: 4, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.05), borderRadius: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}` }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'warning.dark' }}>
                          * Data represents all institute-level spending records categorized in the financial ledger.
                      </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </motion.div>
        ) : (
          <motion.div key="academic" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
             <Grid container spacing={3}>
                {/* Academic Stats */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                        <CardContent sx={{ p: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>Student Enrollment</Typography>
                            <Box sx={{ height: 350 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={enrollmentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                                            {enrollmentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <RechartsTooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper sx={{ p: 4, borderRadius: 4, height: '100%' }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, mb: 4 }}>Academic Performance (Averages per Level)</Typography>
                        <Box sx={{ height: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={performanceData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontWeight: 800 }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="average" fill={theme.palette.primary.main} radius={[0, 8, 8, 0]} label={{ position: 'right', fontWeight: 900, formatter: val => `${val}%` }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Paper>
                </Grid>

                <Grid size={12}>
                    <Paper sx={{ p: 4, borderRadius: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, mb: 4 }}>Attendance Trends (Last 14 Days)</Typography>
                        <Box sx={{ height: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={attendanceChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 800 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontWeight: 800 }} />
                                    <RechartsTooltip />
                                    <Legend verticalAlign="top" align="right" />
                                    <Bar name="Students Present" dataKey="present" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
                                    <Bar name="Students Absent" dataKey="absent" fill={theme.palette.error.main} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Paper>
                </Grid>
             </Grid>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Access Reports */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: -1 }}>Supporting Documentation</Typography>
        <Grid container spacing={3}>
            {availableReports.map((report, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                    <Paper 
                        onClick={() => report.page && navigate(report.page)}
                        sx={{ 
                            p: 3, 
                            borderRadius: 3, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 2, 
                            cursor: report.page ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: alpha(theme.palette[report.color as any].main, 0.05), transform: 'translateY(-4px)' }
                        }}
                    >
                        <Avatar sx={{ bgcolor: alpha(theme.palette[report.color as any].main, 0.1), color: `${report.color}.main`, borderRadius: 2 }}>
                            {report.icon}
                        </Avatar>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{report.title}</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6 }}>{report.type}</Typography>
                        </Box>
                    </Paper>
                </Grid>
            ))}
        </Grid>
      </Box>
    </Box>
  );
}

