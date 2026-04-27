import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  CircularProgress, IconButton, Chip, Avatar, 
  Divider, Paper, List, ListItem, ListItemText, 
  ListItemAvatar, Tooltip, Select, MenuItem, 
  FormControl, InputLabel,
  Stack, Fade, Zoom
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Download, FileText, TrendingUp, Users, 
  BookOpen, Calendar, DollarSign, Filter,
  BarChart2, PieChart as PieChartIcon, Share2,
  Printer, Mail, FileSpreadsheet, ChevronRight,
  ArrowUpRight, ArrowDownRight, Sparkles,
  GraduationCap, Award, Briefcase, Activity
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend,
  AreaChart, Area
} from 'recharts';
import { collection, query, onSnapshot, orderBy, limit, where, or, and, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '../lib/exportUtils';

const COLORS = ['#0d9488', '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4'];

export default function Reports() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!(window as any)._reportsLoaded);
  const [reportType, setReportType] = useState('attendance');
  const [counts, setCounts] = useState({ students: 0, fees: 0, attendance: 0 });
  
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<any[]>([]);

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const role = currentUser?.role || 'student';
  const isMuntazim = role === 'muntazim' || (role === 'superadmin' && !isSuperAdmin);
  const isAdmin = isSuperAdmin || isMuntazim;

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribes: (() => void)[] = [];

    // 1. Student Enrollment Distribution
    const qTulab = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubStudents = onSnapshot(qTulab, (snapshot) => {
      const students = snapshot.docs.map(doc => doc.data());
      setCounts(prev => ({ ...prev, students: students.length }));

      const distribution: Record<string, number> = {};
      students.forEach(s => {
        const level = s.maktabLevel || 'Unassigned';
        distribution[level] = (distribution[level] || 0) + 1;
      });
      
      setEnrollmentData(Object.keys(distribution).map(key => ({
        name: key,
        value: distribution[key]
      })));
    });
    unsubscribes.push(unsubStudents);

    // 2. Revenue Trends (Monthly)
    if (isAdmin) {
      const qFees = query(collection(db, 'receipts'), where('status', '==', 'approved'));
      const unsubFees = onSnapshot(qFees, (snapshot) => {
        const receipts = snapshot.docs.map(doc => doc.data());
        const totalAmount = receipts.reduce((acc, r) => acc + (r.amount || 0), 0);
        setCounts(prev => ({ ...prev, fees: totalAmount }));

        // Dynamic revenue chart (last 6 months)
        const last6Months = eachMonthOfInterval({
          start: subMonths(new Date(), 5),
          end: new Date()
        });

        const revTrend = last6Months.map(month => {
          const monthStr = format(month, 'MMM yyyy');
          const monthTotal = receipts
            .filter(r => r.date && isSameMonth(new Date(r.date), month))
            .reduce((acc, r) => acc + (r.amount || 0), 0);
          return { name: monthStr, amount: monthTotal };
        });
        setRevenueData(revTrend);
      });
      unsubscribes.push(unsubFees);

      // 3. Performance (Quiz Scores by Level)
      const qQuizzes = query(collection(db, 'quiz_results'), orderBy('timestamp', 'desc'), limit(500));
      const unsubQuizzes = onSnapshot(qQuizzes, (snapshot) => {
        const results = snapshot.docs.map(doc => doc.data());
        const gradeStats: Record<string, { totalScore: number, count: number }> = {};
        
        results.forEach(r => {
          const grade = r.grade || 'N/A';
          if (!gradeStats[grade]) gradeStats[grade] = { totalScore: 0, count: 0 };
          gradeStats[grade].totalScore += r.percentage;
          gradeStats[grade].count += 1;
        });

        setPerformanceData(Object.keys(gradeStats).map(key => ({
          name: key,
          average: Math.round(gradeStats[key].totalScore / gradeStats[key].count)
        })));
      });
      unsubscribes.push(unsubQuizzes);

      // 4. Attendance Trends
      const qAttendance = query(collection(db, 'attendance'), limit(1000));
      const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
        const records = snapshot.docs.map(doc => doc.data());
        const daily: Record<string, { present: number, absent: number }> = {};
        
        // Group by day for the last 7 days
        const last7Days = Array.from({ length: 7 }, (_, i) => format(subMonths(new Date(), 0).setDate(new Date().getDate() - i), 'yyyy-MM-dd')).reverse();
        
        last7Days.forEach(day => {
          const dayName = format(new Date(day), 'EEE');
          const dayRecords = records.filter(r => r.date === day);
          daily[dayName] = {
            present: dayRecords.filter(r => r.status === 'present').length,
            absent: dayRecords.filter(r => r.status === 'absent').length
          };
        });

        setAttendanceChartData(Object.keys(daily).map(key => ({
          name: key,
          ...daily[key]
        })));
      });
      unsubscribes.push(unsubAttendance);
    }

    setLoading(false);
    (window as any)._reportsLoaded = true;
    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser?.uid, isAdmin]);

  const availableReports = [
    { title: 'Tulab Karkardagi Report', icon: <GraduationCap size={22} />, type: 'PDF', size: '2.4 MB', color: 'primary' },
    ...((isAdmin) ? [{ title: 'Fee Jama Summary', icon: <DollarSign size={22} />, type: 'XLSX', size: '1.1 MB', color: 'success', page: '/fees' }] : []),
    { title: 'Mudaris Haziri Log', icon: <Users size={22} />, type: 'CSV', size: '0.8 MB', color: 'warning', page: '/attendance' },
    ...((isAdmin) ? [{ title: 'Asasa Report', icon: <FileText size={22} />, type: 'PDF', size: '3.2 MB', color: 'error' }] : []),
  ];

  const stats = [
    { title: 'Total Tulab-e-Ilm', value: counts.students.toLocaleString(), trend: '+0%', icon: <Users size={24} />, color: 'primary', link: '/users' },
    ...(isAdmin ? [{ title: 'Majmua (MTD)', value: `₹${counts.fees.toLocaleString()}`, trend: '+0%', icon: <DollarSign size={24} />, color: 'success', link: '/fees' }] : []),
    { title: 'Ausat Haziri', value: '94.2%', trend: '94%', icon: <Activity size={24} />, color: 'warning', link: '/attendance' },
    { title: 'Imtihan Kamyabi', value: performanceData.length > 0 ? `${Math.round(performanceData.reduce((acc, p) => acc + p.average, 0) / performanceData.length)}%` : '0%', trend: 'Avg', icon: <Award size={24} />, color: 'error' }
  ];

  const handleExportAll = () => {
    // Collect some data to export
    const exportData = revenueData.map(d => ({ Month: d.name, Revenue: d.amount }));
    exportToCSV(exportData, 'Maktab_Revenue_Report');
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
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Dashbaord Insight</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Real-time analytics for Maktab Wali Ul Aser educational & financial operations
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button 
              variant="outlined" 
              startIcon={<Printer size={18} />} 
              sx={{ 
                borderRadius: 2, 
                fontWeight: 900, 
                px: 4, 
                py: 1.5,
                textTransform: 'none',
                border: 'none',
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: theme.palette.mode === 'dark'
                  ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                  : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
                '&:hover': {
                  bgcolor: 'background.paper',
                  boxShadow: theme.palette.mode === 'dark'
                    ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                    : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                }
              }}
              onClick={() => window.print()}
            >
              Print Report
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Download size={18} />} 
              onClick={handleExportAll}
              sx={{ 
                borderRadius: 2, 
                fontWeight: 900, 
                px: 4, 
                py: 1.5,
                textTransform: 'none',
                boxShadow: theme.palette.mode === 'dark'
                  ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                  : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
              }}
            >
              Export Analytics
            </Button>
          </Stack>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Quick Stats */}
        {stats.map((stat, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => stat.link && navigate(stat.link)}
            >
              <Card sx={{ 
                borderRadius: 2, 
                border: 'none',
                bgcolor: 'background.paper',
                cursor: stat.link ? 'pointer' : 'default',
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
                      icon={stat.trend.startsWith('+') ? <ArrowUpRight size={14} /> : undefined}
                    />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1 }}>{stat.value}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>{stat.title}</Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}

        {/* Financial Area Chart */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ 
            borderRadius: 2, 
            border: 'none',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
              : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Revenue & Growth</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Monthly fee collection trends</Typography>
              </Box>
              <Button size="small" variant="text" startIcon={<TrendingUp size={16} />} onClick={() => navigate('/fees')}>View Details</Button>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ height: 350, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: theme.palette.text.secondary, fontWeight: 700, fontSize: 12 }} 
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
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        padding: '16px',
                        fontWeight: 900
                      }} 
                    />
                    <Area type="monotone" dataKey="amount" stroke={theme.palette.success.main} fillOpacity={1} fill="url(#colorAmount)" activeDot={{ r: 8, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Student Distribution Pie Chart */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ 
            borderRadius: 2, 
            border: 'none',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
              : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
            height: '100%'
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Financial Health</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Students by Maktab Level</Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={enrollmentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      onClick={(data) => navigate(`/users?level=${data.name}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {enrollmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} 
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span style={{ fontWeight: 750, color: theme.palette.text.primary, fontSize: '0.85rem' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ mt: 3, p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ p: 1.2, borderRadius: 2.5, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.15) : 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <Sparkles size={22} color={theme.palette.primary.main} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, lineHeight: 1.5, fontSize: '0.8rem' }}>
                    Click on a slice to view and filter students in that specific Maktab Level.
                  </Typography>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Bar Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ 
            borderRadius: 2, 
            border: 'none',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
              : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Academic Performance</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Average quiz scores per level</Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ height: 320, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={theme.palette.divider} />
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: theme.palette.text.primary, fontWeight: 800, fontSize: 13 }} 
                    />
                    <RechartsTooltip 
                      cursor={{ fill: alpha(theme.palette.primary.main, 0.05) }}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} 
                    />
                    <Bar dataKey="average" fill={theme.palette.primary.main} radius={[0, 10, 10, 0]} barSize={30} label={{ position: 'right', fill: theme.palette.text.primary, fontWeight: 900, formatter: (val: any) => `${val}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Attendance Bar Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ 
            borderRadius: 2, 
            border: 'none',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
              : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
          }}>
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>Attendance Activity</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Daily student attendance activity</Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ height: 320, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontWeight: 800, fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontWeight: 800, fontSize: 12 }} />
                    <RechartsTooltip 
                      cursor={{ fill: alpha(theme.palette.primary.main, 0.05) }}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} 
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" height={30} wrapperStyle={{ fontWeight: 800 }} />
                    <Bar dataKey="present" fill={theme.palette.success.main} radius={[6, 6, 0, 0]} barSize={25} />
                    <Bar dataKey="absent" fill={theme.palette.error.main} radius={[6, 6, 0, 0]} barSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Reports List */}
        <Grid size={12}>
          <Box sx={{ mt: 4, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -1 }}>Quick Reports</Typography>
            <Button variant="text" sx={{ fontWeight: 800 }}>Explore Full Library</Button>
          </Box>
          <Grid container spacing={3}>
            {availableReports.map((report, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => report.page && navigate(report.page)}
                >
                  <Paper 
                    sx={{ 
                      p: 2.5, 
                      borderRadius: 3, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2.5, 
                      border: 'none',
                      bgcolor: 'background.paper',
                      boxShadow: theme.palette.mode === 'dark'
                        ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                        : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': { 
                        transform: 'translateY(-5px)',
                        bgcolor: alpha(theme.palette[report.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.05),
                        cursor: report.page ? 'pointer' : 'default' 
                      } 
                    }}
                  >
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette[report.color as 'primary' | 'success' | 'warning' | 'error'].main, 0.1), 
                        color: `${report.color}.main`, 
                        borderRadius: 2.5,
                        width: 52,
                        height: 52,
                        boxShadow: theme.palette.mode === 'dark'
                          ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                          : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                      }}
                    >
                      {report.icon}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.2 }}>{report.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        {report.type} • {report.size}
                      </Typography>
                    </Box>
                    <IconButton 
                      size="small" 
                      sx={{ 
                        bgcolor: 'background.default',
                        boxShadow: theme.palette.mode === 'dark'
                          ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                          : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportAll();
                      }}
                    >
                      <Download size={18} />
                    </IconButton>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
