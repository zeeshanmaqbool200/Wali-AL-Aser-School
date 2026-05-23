import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Avatar, Chip, Divider, List, ListItem, ListItemText, 
  ListItemAvatar, CircularProgress, IconButton, Tooltip as MuiTooltip,
  Paper, useMediaQuery, Fab, Zoom, Stack, Skeleton, Container,
  Dialog, DialogTitle, DialogContent, DialogActions, Badge, Alert, TextField, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  Users, BookOpen, Calendar, CreditCard, Bell, 
  Check, X, Plus, ArrowRight, TrendingUp, Clock, 
  AlertCircle, Send, FileText, ClipboardList, UserCheck, Megaphone, AlertTriangle,
  MoreVertical, ExternalLink, Phone, MessageCircle, MessageSquare,
  UserPlus, BarChart3, User as UserIcon, GraduationCap, Award, Book, CheckCircle, XCircle,
  Wallet, ArrowUpRight, ArrowDownRight, Smartphone, Layout, IndianRupee, RefreshCw,
  Edit, Trash2, Trash, Sparkles, Zap, Activity
} from 'lucide-react';
import IDCardModal from '../components/IDCardModal';
import RevenueChart from '../components/RevenueChart';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isStudent, isTeacher, isPrincipal, hasPermission } from '../lib/rbac';

export default function Dashboard() {
  const { user, instituteSettings } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  const [activeStatIndex, setActiveStatIndex] = useState(0);

  const isUserStudent = isStudent(user?.role);
  const isUserTeacher = isTeacher(user?.role);
  const isUserPrincipal = isPrincipal(user?.role);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const statTimer = setInterval(() => {
      setActiveStatIndex(prev => (prev + 1) % 3);
    }, 4000);
    return () => {
      clearInterval(timer);
      clearInterval(statTimer);
    };
  }, []);

  const hijriDate = useMemo(() => {
    try {
      const date = new Date();
      if (instituteSettings?.jafariOffset) {
        date.setDate(date.getDate() + instituteSettings.jafariOffset);
      }
      return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return '';
    }
  }, [instituteSettings?.jafariOffset]);

  const { 
    users, receipts, notifications, 
    availableCourses, attendance, expenses,
    loading: globalLoading 
  } = useData();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const instituteColors = useMemo(() => {
    const pk = instituteSettings?.primaryColor || '#0d9488';
    const sk = instituteSettings?.secondaryColor || '#0284c7';
    return {
      primary: pk,
      secondary: sk,
      accent: instituteSettings?.accentColor || '#f59e0b',
      gradient: `linear-gradient(135deg, ${pk} 0%, ${sk} 100%)`,
      gradientSoft: `linear-gradient(135deg, ${alpha(pk, 0.1)} 0%, ${alpha(sk, 0.1)} 100%)`
    };
  }, [instituteSettings]);

  const [idCardOpen, setIdCardOpen] = useState(false);

  const stats = useMemo(() => {
    const students = users.filter(u => (u.role === 'student' || !u.role) && u.status !== 'Archived' && !['admin', 'manager', 'superadmin'].includes(u.role || ''));
    const activeStudents = students.filter(u => u.status === 'Active');
    const staff = users.filter(u => ['teacher', 'manager', 'superadmin', 'admin'].includes(u.role || ''));
    
    const now = new Date();
    const currentMonthStr = format(now, 'yyyy-MM');
    
    const monthlyRevenue = receipts
      .filter(r => r.status === 'approved' && (r.month === currentMonthStr || (r.date && r.date.startsWith(currentMonthStr))))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    const revenueGoal = instituteSettings?.revenueGoal || 500000;
    const revenueProgress = Math.min(Math.round((monthlyRevenue / revenueGoal) * 100), 100);

    const pendingAmount = receipts
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return format(d, 'yyyy-MM');
    }).reverse();

    const chartData = last6Months.map(month => {
      const revenue = receipts
        .filter(r => r.status === 'approved' && (r.month === month || (r.date && r.date.startsWith(month))))
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      
      const expense = expenses
        .filter(e => e.date && e.date.startsWith(month))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return {
        name: format(new Date(month + '-01'), 'MMM'),
        revenue,
        expense
      };
    });

    const todayStr = format(now, 'yyyy-MM-dd');
    const todayAttendance = attendance.filter(a => {
      const d = a.date?.toDate ? format(a.date.toDate(), 'yyyy-MM-dd') : format(new Date(a.date), 'yyyy-MM-dd');
      return d === todayStr && a.status === 'present';
    }).length;

    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = format(prevMonth, 'yyyy-MM');
    
    const prevRevenue = receipts
      .filter(r => r.status === 'approved' && (r.month === prevMonthStr || (r.date && r.date.startsWith(prevMonthStr))))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const revenueTrend = prevRevenue > 0 ? ((monthlyRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : '0%';
    
    const prevStudents = users.filter(u => 
      (u.role === 'student' || !u.role) && 
      u.status !== 'Archived' && 
      !['admin', 'manager', 'superadmin'].includes(u.role || '') &&
      u.createdAt && format(new Date(u.createdAt), 'yyyy-MM') <= prevMonthStr
    ).length;
    const studentsTrend = prevStudents > 0 ? (((students.length - prevStudents) / prevStudents) * 100).toFixed(1) : '0%';

    const attendanceRate = students.length > 0 ? Math.round((todayAttendance / students.length) * 100) : 0;
    const activeRate = students.length > 0 ? Math.round((activeStudents.length / students.length) * 100) : 0;

    return {
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      totalStaff: staff.length,
      monthlyRevenue,
      revenueProgress,
      pendingAmount,
      todayAttendance,
      attendanceRate,
      activeRate,
      pendingFeesCount: receipts.filter(r => r.status === 'pending').length,
      chartData,
      revenueTrend: Number(revenueTrend) > 0 ? `+${revenueTrend}%` : `${revenueTrend}%`,
      studentsTrend: Number(studentsTrend) > 0 ? `+${studentsTrend}%` : `${studentsTrend}%`
    };
  }, [users, receipts, expenses, attendance, instituteSettings]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { 
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.45 } 
    }
  };

  const dynamicStats = useMemo(() => [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, color: theme.palette.success.light },
    { label: 'Today Attendance', value: `${stats.attendanceRate}%`, icon: UserCheck, color: theme.palette.info.light },
    { label: 'Monthly Revenue', value: `₹${(stats.monthlyRevenue/1000).toFixed(1)}k`, icon: Wallet, color: theme.palette.warning.light }
  ], [stats, theme.palette]);

  const QUICK_GRID = useMemo(() => {
    const items = [
      { label: 'Users', icon: Users, path: '/users', color: '#f39c12', hideForStudent: true },
      { label: 'Fees', icon: IndianRupee, path: '/fees', color: '#27ae60' },
      { label: 'Expenses', icon: TrendingUp, path: '/expenses', color: '#3498db', hideForStudent: true },
      { label: 'Reports', icon: FileText, path: '/reports', color: '#8e44ad', hideForStudent: true },
      { label: 'Courses', icon: BookOpen, path: '/courses', color: '#e74c3c' },
      { label: 'Settings', icon: Layout, path: '/settings', color: '#16a085' }
    ];
    return isUserStudent ? items.filter(i => !i.hideForStudent) : items;
  }, [isUserStudent]);

  const randomQuote = useMemo(() => {
    if (!instituteSettings?.quotes || instituteSettings.quotes.length === 0) return null;
    return instituteSettings.quotes[Math.floor(Math.random() * instituteSettings.quotes.length)];
  }, [instituteSettings?.quotes]);

  if (globalLoading) return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Skeleton variant="text" width={200} height={40} />
      <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 4 }} />
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {[1, 2, 3, 4].map(i => <Grid key={i} size={{ xs: 6, md: 3 }}><Skeleton variant="rectangular" height={120} sx={{ borderRadius: 4 }} /></Grid>)}
      </Grid>
    </Container>
  );

  return (
    <Box sx={{ 
      pb: 12, 
      bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#f8f9fa',
      minHeight: '100vh',
      pt: { xs: 12, sm: 14, md: 16 }
    }}>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Stack spacing={4} sx={{ px: { xs: 2, md: 6 }, pb: 4 }}>
          {/* Branded Hero Header */}
          <motion.div variants={itemVariants}>
            <Box id="dashboard-hero-container" sx={{ 
              position: 'relative', 
              borderRadius: 1.5, 
              overflow: 'hidden',
              minHeight: { xs: 200, sm: 240, md: 280 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              p: { xs: 2, sm: 3, md: 5 },
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              background: '#000'
            }}>
              {instituteSettings?.heroImageUrl || instituteSettings?.bannerUrl ? (
                <Box id="hero-background-image" sx={{ position: 'absolute', inset: 0 }}>
                  <img 
                    src={instituteSettings.heroImageUrl || instituteSettings.bannerUrl} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} 
                    alt="Institute"
                    referrerPolicy="no-referrer"
                  />
                  <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.8) 100%)' }} />
                </Box>
              ) : (
                <Box id="hero-background-gradient" sx={{ position: 'absolute', inset: 0, background: theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #000 0%, #111 100%)' : instituteColors.gradient, opacity: 0.95 }} />
              )}
              <Box id="hero-content-wrapper" sx={{ position: 'relative', zIndex: 1, color: 'white', h: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                <Box id="hero-time-section">
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                    <Box id="hero-clock-badge" sx={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      bgcolor: 'rgba(0,0,0,0.45)', 
                      backdropFilter: 'blur(10px)',
                      px: 1.2, 
                      py: 0.6, 
                      borderRadius: 0.5,
                      mb: { xs: 2, md: 3 },
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      <Clock size={12} color={theme.palette.primary.light} />
                      <Typography variant="caption" sx={{ fontWeight: 950, letterSpacing: 0.8, fontFamily: 'monospace', fontSize: { xs: '0.55rem', sm: '0.65rem' } }}>
                        {format(currentTime, 'hh:mm:ss a')} | {format(currentTime, 'EEE, MMM dd, yyyy')} | {hijriDate}
                      </Typography>
                    </Box>
                  </motion.div>
                </Box>
    
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
                  {randomQuote && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                      <Box id="hero-quote-box" sx={{ maxWidth: { xs: '100%', md: '80%', lg: '70%' } }}>
                        <Typography 
                          id="hero-quote-text"
                          variant="body2" 
                          sx={{ 
                            fontStyle: 'italic', 
                            fontWeight: 900, 
                            opacity: 0.8, 
                            maxWidth: 550, 
                            lineHeight: 1.1,
                            fontSize: { xs: '0.65rem', sm: '0.8rem', md: '0.95rem' },
                            textTransform: 'uppercase',
                            letterSpacing: 0.3,
                            textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                            textAlign: 'left'
                          }}
                        >
                          "{randomQuote}"
                        </Typography>
                        <Box sx={{ width: 25, height: 1.5, bgcolor: theme.palette.primary.main, mt: 0.8, borderRadius: 0.25 }} />
                      </Box>
                    </motion.div>
                  )}

                  <Box id="hero-footer-section" sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'flex-end', gap: { xs: 3, md: 4 } }}>
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ textAlign: 'left', width: '100%' }}>
                      <Typography id="hero-main-greeting" variant="h1" sx={{ 
                        fontFamily: '"Cinzel Decorative", serif',
                        fontWeight: 900, 
                        fontSize: { xs: '1.5rem', sm: '2.1rem', md: '3.1rem' }, 
                        textShadow: '0 6px 16px rgba(0,0,0,0.7)', 
                        mb: 0,
                        letterSpacing: { xs: -0.5, md: -1.5 }, 
                        lineHeight: 0.85,
                        textTransform: 'uppercase'
                      }}>
                        ASSLAMUALIKUM
                      </Typography>
                      <Typography id="hero-institute-name" variant="h5" sx={{ 
                        opacity: 0.7, 
                        fontWeight: 800, 
                        letterSpacing: { xs: 1.2, md: 1.5 }, 
                        textTransform: 'uppercase',
                        fontSize: { xs: '0.5rem', sm: '0.65rem', md: '0.75rem' },
                        mt: { xs: 0.5, md: 1 }
                      }}>
                        {instituteSettings?.instituteName || 'Maktab For Imam Mahdi A.J'}
                      </Typography>
                    </motion.div>
      
                    <Box id="hero-dynamic-stats-module" sx={{ position: 'relative', width: { xs: '100%', md: 130 }, mt: { xs: 1, md: 0 } }}>
                      <AnimatePresence mode="wait">
                        <motion.div 
                          key={activeStatIndex}
                          initial={{ opacity: 0, scale: 0.98, y: 5 }} 
                          animate={{ opacity: 1, scale: 1, y: 0 }} 
                          exit={{ opacity: 0, scale: 0.98, y: -5 }}
                          transition={{ duration: 0.4 }}
                        >
                          <Box sx={{ 
                            bgcolor: 'rgba(0,0,0,0.75)', 
                            backdropFilter: 'blur(20px)',
                            p: { xs: 0.8, md: 1 }, 
                            borderRadius: 0.25,
                            border: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            boxShadow: '0 8px 25px rgba(0,0,0,0.4)'
                          }}>
                            <Box sx={{ 
                              p: 0.5, 
                              borderRadius: 0.25, 
                              bgcolor: alpha(dynamicStats[activeStatIndex].color, 0.15), 
                              color: dynamicStats[activeStatIndex].color,
                              display: 'flex'
                            }}>
                              {React.createElement(dynamicStats[activeStatIndex].icon, { size: 12 })}
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 950, opacity: 0.6, letterSpacing: 1, display: 'block', textTransform: 'uppercase', mb: 0, fontSize: { xs: '0.45rem', md: '0.5rem' } }}>
                                {dynamicStats[activeStatIndex].label}
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 950, lineHeight: 1, fontSize: { xs: '1rem', md: '1.2rem' }, letterSpacing: -0.5 }}>
                                {dynamicStats[activeStatIndex].value}
                              </Typography>
                            </Box>
                          </Box>
                        </motion.div>
                      </AnimatePresence>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.6, justifyContent: 'flex-end', px: 0.5 }}>
                         {dynamicStats.map((_, i) => (
                            <Box 
                              key={i} 
                              sx={{ 
                                width: i === activeStatIndex ? 10 : 3, 
                                height: 1.2, 
                                borderRadius: 0.1, 
                                bgcolor: i === activeStatIndex ? 'primary.main' : 'rgba(255,255,255,0.15)',
                                transition: 'all 0.4s ease'
                              }} 
                            />
                         ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </motion.div>

          {/* Quick Access Grid - From Image */}
          <Grid container spacing={2} justifyContent="center" sx={{ mt: 2 }}>
            {QUICK_GRID.map((item, i) => (
              <Grid key={i} size={{ xs: 4, sm: 2 }}>
                 <motion.div variants={itemVariants}>
                   <Paper 
                    elevation={0}
                    onClick={() => navigate(item.path)}
                    sx={{ 
                      aspectRatio: '1/1',
                      bgcolor: item.color,
                      color: 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: `0 8px 32px ${alpha(item.color, 0.2)}`,
                      '&:hover': {
                        transform: 'scale(1.05)',
                        boxShadow: `0 12px 48px ${alpha(item.color, 0.4)}`,
                      }
                    }}
                  >
                    <item.icon size={20} strokeWidth={2.5} />
                    <Typography variant="caption" sx={{ fontWeight: 950, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {item.label}
                    </Typography>
                  </Paper>
                 </motion.div>
              </Grid>
            ))}
          </Grid>

          {/* Global Stats Grid - Optional for Students */}
          {!isUserStudent && (
            <Grid container spacing={3}>
              {[
                { label: 'Total Students', value: stats.totalStudents, icon: Users, color: theme.palette.primary.main, trend: stats.studentsTrend, sub: 'vs last month' },
                { label: 'Monthly Revenue', value: `₹${(stats.monthlyRevenue/1000).toFixed(1)}k`, icon: Wallet, color: theme.palette.success.main, trend: stats.revenueTrend, sub: 'collection status' },
                { label: 'Attendance', value: `${stats.attendanceRate}%`, icon: UserCheck, color: theme.palette.secondary.main, trend: 'Daily', sub: 'today status' },
                { label: 'Active Staff', value: stats.totalStaff, icon: Award, color: theme.palette.warning.main, trend: 'Stable', sub: 'working now' }
              ].map((stat, i) => (
                <Grid key={i} size={{ xs: 6, md: 3 }} sx={{ display: 'flex' }}>
                  <motion.div variants={itemVariants} style={{ width: '100%', display: 'flex' }}>
                    <Card sx={{ 
                      p: 2, borderRadius: 1.5, width: '100%', display: 'flex', flexDirection: 'column', 
                      justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: theme.shadows[4] }
                    }}>
                    <Box>
                      <Box sx={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2
                      }}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(stat.color, 0.1), color: stat.color, display: 'flex' }}>
                          <stat.icon size={16} />
                        </Box>
                        <Chip label={stat.trend} size="small" sx={{ fontWeight: 950, height: 18, bgcolor: alpha(stat.color, 0.1), color: stat.color, fontSize: '0.6rem' }} />
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>{stat.label}</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 950, my: 0.5 }}>{stat.value}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.5 }}>{stat.sub}</Typography>
                    <Box sx={{ 
                       position: 'absolute', bottom: -20, right: -20, opacity: 0.05, 
                       transform: 'rotate(-15deg)', color: stat.color 
                    }}>
                      <stat.icon size={100} strokeWidth={4} />
                    </Box>
                  </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Action Center & Financial Overview - Hidden for Students */}
          {!isUserStudent && (
            <motion.div variants={itemVariants}>
              <Grid container spacing={4}>
                 <Grid size={{ xs: 12, md: 12 }} sx={{ display: 'flex' }}>
                  <Card sx={{ p: 0, borderRadius: 4, width: '100%', display: 'flex', flexDirection: 'column' }}>
                     <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>Financial Performance</Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                           <Button size="small" variant="contained" sx={{ borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', boxShadow: 'none', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } }}>Recent Activity</Button>
                           <Button size="small" sx={{ borderRadius: 1.5 }} onClick={() => navigate('/reports')}>View Reports</Button>
                        </Box>
                     </Box>
                     <Box sx={{ flexGrow: 1, p: 3, position: 'relative' }}>
                        <RevenueChart data={stats.chartData} />
                     </Box>
                  </Card>
               </Grid>
            </Grid>
            </motion.div>
          )}
          
          {/* Recent Activity Table - User specific for students */}
          <motion.div variants={itemVariants}>
             <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>{isUserStudent ? 'My Recent Payments' : 'Recent Financial Receipts'}</Typography>
             <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
               <Table>
                 <TableHead sx={{ bgcolor: 'background.default' }}>
                   <TableRow>
                     <TableCell sx={{ fontWeight: 900 }}>{isUserStudent ? 'Fee Category' : 'Member'}</TableCell>
                     <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
                     <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                     <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {receipts
                     .filter(r => isUserStudent ? r.studentId === user?.uid : true)
                     .slice(0, 5).map(r => (
                     <TableRow key={r.id}>
                       <TableCell sx={{ fontWeight: 800 }}>{isUserStudent ? r.feeHead : r.studentName}</TableCell>
                       <TableCell>₹{r.amount}</TableCell>
                       <TableCell>
                          <Chip 
                            size="small" 
                            label={r.status} 
                            color={r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'error'} 
                            sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }} 
                          />
                       </TableCell>
                       <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {r.date ? format(new Date(r.date), 'dd/MM/yyyy') : 'N/A'}
                       </TableCell>
                     </TableRow>
                   ))}
                   {receipts.filter(r => isUserStudent ? r.studentId === user?.uid : true).length === 0 && (
                     <TableRow>
                       <TableCell colSpan={4} align="center" sx={{ py: 4 }}>No recent receipts</TableCell>
                     </TableRow>
                   )}
                 </TableBody>
               </Table>
             </TableContainer>
          </motion.div>

          {/* Staff & Faculty Section */}
          <Box>
             <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -1 }}>Institute Faculty</Typography>
                  <Typography variant="body2" color="text.secondary">Active staff members and administrators</Typography>
                </Box>
                <Button variant="outlined" sx={{ borderRadius: 3 }} onClick={() => navigate('/users')}>Manage Staff</Button>
             </Stack>
             <Grid container spacing={3}>
               {users.filter(u => ['superadmin', 'manager', 'teacher'].includes(u.role || '')).slice(0, 4).map((staff) => (
                  <Grid key={staff.uid} size={{ xs: 12, sm: 6, md: 3 }}>
                     <Card sx={{ p: 3, borderRadius: 5, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
                        <Avatar 
                          src={staff.photoURL} 
                          sx={{ width: 64, height: 64, mx: 'auto', mb: 2, border: `2px solid ${theme.palette.primary.main}` }}
                        >
                          {staff.displayName?.charAt(0)}
                        </Avatar>
                        <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{staff.displayName}</Typography>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1 }}>
                          {staff.role?.replace('_', ' ')}
                        </Typography>
                        <Chip 
                          label={staff.status} 
                          size="small" 
                          color={staff.status === 'Active' ? 'success' : 'warning'} 
                          sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }} 
                        />
                     </Card>
                  </Grid>
               ))}
             </Grid>
          </Box>

          {/* Sync Status Alert */}
          <Alert icon={<Zap size={20} />} severity="info" sx={{ borderRadius: 4, opacity: 0.8 }}>
            Dashboard synced in real-time. Last update: {format(new Date(), 'HH:mm:ss')}
          </Alert>
        </Stack>
      </motion.div>

      <IDCardModal 
        open={idCardOpen} 
        onClose={() => setIdCardOpen(false)} 
        user={user} 
      />
    </Box>
  );
}
