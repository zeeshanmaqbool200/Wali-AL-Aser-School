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
  Edit, Trash2, Trash, Sparkles, Zap
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

export default function Dashboard() {
  const { user, instituteSettings, permissions } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hijriDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-u-ca-islamic-uma-nu-latn', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date());
    } catch (e) {
      return '';
    }
  }, []);

  const { 
    users, receipts, notifications, 
    availableCourses, attendance, 
    loading: globalLoading 
  } = useData();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  // Branding Colors from settings
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

  // Derive Stats from DataContext
  const stats = useMemo(() => {
    // Include all students who are not archived or pending verification
    const students = users.filter(u => (u.role === 'student' || !u.role) && u.status !== 'Archived' && !['admin', 'manager', 'superadmin'].includes(u.role || ''));
    const activeStudents = students.filter(u => u.status === 'Active');
    const staff = users.filter(u => ['teacher', 'manager', 'superadmin', 'admin'].includes(u.role || ''));
    
    const now = new Date();
    const currentMonthStr = format(now, 'yyyy-MM');
    // receipts status in types.ts is 'approved' | 'pending' | 'rejected'
    const sortedReceipts = [...receipts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    const monthlyRevenue = receipts
      .filter(r => r.status === 'approved' && (r.month === currentMonthStr || (r.date && r.date.startsWith(currentMonthStr))))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    // Total Revenue Goal (Mock but meaningful)
    const revenueGoal = instituteSettings?.revenueGoal || 500000;
    const revenueProgress = Math.min(Math.round((monthlyRevenue / revenueGoal) * 100), 100);

    const pendingAmount = receipts
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    // Financial trends data for chart
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return format(d, 'yyyy-MM');
    }).reverse();

    const chartData = last6Months.map(month => {
      const amount = receipts
        .filter(r => r.status === 'approved' && r.month === month)
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      return {
        name: format(new Date(month), 'MMM'),
        amount
      };
    });

    const todayStr = format(now, 'yyyy-MM-dd');
    const todayAttendance = attendance.filter(a => {
      const d = a.date?.toDate ? format(a.date.toDate(), 'yyyy-MM-dd') : format(new Date(a.date), 'yyyy-MM-dd');
      return d === todayStr && a.status === 'present';
    }).length;

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
      chartData
    };
  }, [users, receipts, attendance, instituteSettings]);

  const QUICK_ACTIONS = useMemo(() => [
    { label: 'Students', icon: Users, path: '/users', color: theme.palette.primary.main, permission: 'manage_students' },
    { label: 'Attendance', icon: UserCheck, path: '/attendance', color: theme.palette.success.main, permission: 'manage_attendance' },
    { label: 'Payments', icon: CreditCard, path: '/fees', color: theme.palette.warning.main, permission: 'manage_fees' },
    { label: 'Courses', icon: BookOpen, path: '/courses', color: theme.palette.info.main }
  ], [theme.palette]);

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
    <Box sx={{ pb: 16 }}>
      <Stack spacing={5} sx={{ px: { xs: 2, md: 4 } }}>
        {/* Branded Hero Header */}
        <Box sx={{ 
          mt: 10, 
          position: 'relative', 
          borderRadius: 8, 
          overflow: 'hidden',
          minHeight: { xs: 300, md: 380 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          p: { xs: 4, md: 6 },
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.3)',
          bgcolor: 'primary.main',
        }}>
          {/* Background Image / Gradient */}
          {instituteSettings?.bannerUrl ? (
            <>
              <Box 
                component="img"
                src={instituteSettings.bannerUrl}
                alt="Institute Banner"
                sx={{ 
                  position: 'absolute', 
                  inset: 0, 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  filter: 'brightness(0.5) contrast(1.1)'
                }}
              />
              <Box sx={{ 
                position: 'absolute', 
                inset: 0, 
                background: `linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.4) 100%)` 
              }} />
            </>
          ) : (
            <Box sx={{ 
              position: 'absolute', 
              inset: 0, 
              background: instituteColors.gradient,
              opacity: 0.9 
            }} />
          )}

          {/* Content Overlay */}
          <Box sx={{ position: 'relative', zIndex: 1, color: 'white' }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h2" sx={{ 
                  fontWeight: 950, 
                  letterSpacing: -2, 
                  fontSize: { xs: '2.5rem', md: '4rem' },
                  textShadow: '0 4px 12px rgba(0,0,0,0.6)',
                  fontFamily: '"Cinzel Decorative", serif',
                  lineHeight: 1
                }}>
                  Salaam, {user?.displayName?.split(' ')[0] || 'Administrator'}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9, mt: 1, fontWeight: 600, maxWidth: 600, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  Welcome back to the {instituteSettings?.instituteName || 'Digital Campus'}.
                </Typography>
                {randomQuote && (
                  <Typography variant="body2" sx={{ 
                    mt: 2, 
                    opacity: 0.8, 
                    fontStyle: 'italic', 
                    fontWeight: 500, 
                    maxWidth: 500,
                    borderLeft: '2px solid rgba(255,255,255,0.4)',
                    pl: 2,
                    fontSize: '0.8rem',
                    lineHeight: 1.4
                  }}>
                    "{randomQuote}"
                  </Typography>
                )}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Chip 
                icon={<Clock size={16} color="white" />} 
                label={format(currentTime, 'hh:mm:ss a')} 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.15)', 
                  color: 'white', 
                  backdropFilter: 'blur(12px)',
                  fontWeight: 800,
                  px: 1,
                  border: '1px solid rgba(255,255,255,0.2)',
                  '& .MuiChip-icon': { color: 'white' }
                }} 
              />
              <Chip 
                icon={<Calendar size={16} color="white" />} 
                label={format(new Date(), 'EEEE, MMMM do')} 
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.15)', 
                  color: 'white', 
                  backdropFilter: 'blur(12px)',
                  fontWeight: 800,
                  px: 1,
                  border: '1px solid rgba(255,255,255,0.2)',
                  '& .MuiChip-icon': { color: 'white' }
                }} 
              />
              <Chip 
                label={hijriDate} 
                variant="outlined"
                sx={{ 
                  color: 'white', 
                  borderColor: 'rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(8px)',
                  fontWeight: 800,
                  px: 1,
                }} 
              />
            </Box>
          </Box>
        </Box>

        {/* Quick Actions Grid */}
        <Grid container spacing={2}>
          {QUICK_ACTIONS.map((action, i) => (
            (!action.permission || permissions[action.permission]) && (
              <Grid key={i} size={{ xs: 6, md: 3 }} sx={{ display: 'flex' }}>
                <motion.div whileHover={{ y: -4 }} style={{ display: 'flex', width: '100%' }}>
                  <Card 
                    onClick={() => navigate(action.path)}
                    sx={{ 
                      p: 3, cursor: 'pointer', borderRadius: 4, textAlign: 'center',
                      border: '1px solid', borderColor: 'divider',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      width: '100%', flexGrow: 1,
                      '&:hover': { boxShadow: 4, borderColor: action.color }
                    }}
                  >
                    <Box sx={{ 
                      display: 'inline-flex', p: 2, borderRadius: 3, 
                      bgcolor: alpha(action.color, 0.1), 
                      color: action.color, mb: 2 
                    }}>
                      <action.icon size={24} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{action.label}</Typography>
                  </Card>
                </motion.div>
              </Grid>
            )
          ))}
        </Grid>

        {/* Main Activity Stats Summary */}
        <Grid container spacing={3}>
           <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ p: 4, borderRadius: 6, border: '1px solid', borderColor: 'divider' }}>
                 <Typography variant="h6" sx={{ fontWeight: 900, mb: 3 }}>Institutional Metrics</Typography>
                 <Grid container spacing={3} alignItems="stretch">
                   <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex', flexDirection: 'column' }}>
                     <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>TOTAL STUDENTS</Typography>
                     <Typography variant="h4" sx={{ fontWeight: 950 }}>{stats.totalStudents}</Typography>
                     <Box sx={{ mt: 'auto', pt: 1 }}>
                        <LinearProgress variant="determinate" value={stats.activeRate} sx={{ height: 4, borderRadius: 2 }} title={`${stats.activeStudents} Active Students`} />
                     </Box>
                   </Grid>
                   <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex', flexDirection: 'column' }}>
                     <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>ACTIVE STAFF</Typography>
                     <Typography variant="h4" sx={{ fontWeight: 950 }}>{stats.totalStaff}</Typography>
                     <Box sx={{ mt: 'auto', pt: 1 }}>
                        <LinearProgress variant="determinate" value={100} color="success" sx={{ height: 4, borderRadius: 2 }} />
                     </Box>
                   </Grid>
                   <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex', flexDirection: 'column' }}>
                     <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>ATTENDANCE RATE</Typography>
                     <Typography variant="h4" sx={{ fontWeight: 950, color: 'success.main' }}>{stats.attendanceRate}%</Typography>
                     <Box sx={{ mt: 'auto', pt: 1 }}>
                        <LinearProgress variant="determinate" value={stats.attendanceRate} color="success" sx={{ height: 4, borderRadius: 2 }} />
                     </Box>
                   </Grid>
                   <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex', flexDirection: 'column' }}>
                     <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>MONTHLY REVENUE</Typography>
                     <Typography variant="h4" sx={{ fontWeight: 950, color: 'primary.main' }}>₹{(stats.monthlyRevenue / 1000).toFixed(1)}k</Typography>
                     <Box sx={{ mt: 'auto', pt: 1 }}>
                        <LinearProgress variant="determinate" value={stats.revenueProgress} sx={{ height: 4, borderRadius: 2 }} />
                     </Box>
                   </Grid>
                 </Grid>
              </Card>
           </Grid>
           
           <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ p: 4, borderRadius: 6, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                 <Typography variant="button" sx={{ fontWeight: 950, color: 'text.secondary', letterSpacing: 1 }}>INSTITUTE UPDATES</Typography>
                 <List sx={{ mt: 2 }}>
                   {notifications.slice(0, 3).map(n => (
                     <ListItem key={n.id} sx={{ px: 0, py: 1 }}>
                       <ListItemAvatar>
                         <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main', width: 40, height: 40 }}>
                           <Bell size={18} />
                         </Avatar>
                       </ListItemAvatar>
                       <ListItemText 
                         primary={n.title} 
                         secondary={n.message.substring(0, 45) + '...'} 
                         primaryTypographyProps={{ fontWeight: 800, fontSize: '0.9rem', lineHeight: 1.2 }} 
                         secondaryTypographyProps={{ fontSize: '0.75rem' }}
                       />
                     </ListItem>
                   ))}
                   {notifications.length === 0 && <Typography variant="caption" color="text.secondary" sx={{ py: 2, display: 'block' }}>No recent notifications</Typography>}
                 </List>
                 <Button fullWidth onClick={() => navigate('/notifications')} sx={{ mt: 1, borderRadius: 3, fontWeight: 800 }}>View All Updates</Button>
              </Card>
           </Grid>
        </Grid>
        
        {/* Recent Activity Table */}
        <Box>
           <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>Recent Financial Receipts</Typography>
           <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
             <Table>
               <TableHead sx={{ bgcolor: 'background.default' }}>
                 <TableRow>
                   <TableCell sx={{ fontWeight: 900 }}>Member</TableCell>
                   <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
                   <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                   <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                 </TableRow>
               </TableHead>
               <TableBody>
                 {receipts.slice(0, 5).map(r => (
                   <TableRow key={r.id}>
                     <TableCell sx={{ fontWeight: 800 }}>{r.studentName}</TableCell>
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
                 {receipts.length === 0 && (
                   <TableRow>
                     <TableCell colSpan={4} align="center" sx={{ py: 4 }}>No recent receipts</TableCell>
                   </TableRow>
                 )}
               </TableBody>
             </Table>
           </TableContainer>
        </Box>

        {/* Financial Performance Chart */}
        <Grid container spacing={3}>
           <Grid size={{ xs: 12, md: 12 }}>
              <Card sx={{ p: 4, borderRadius: 6, border: '1px solid', borderColor: 'divider' }}>
                 <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                   <Box>
                     <Typography variant="h6" sx={{ fontWeight: 900 }}>Financial Overview</Typography>
                     <Typography variant="caption" color="text.secondary">Revenue trend for the current year</Typography>
                   </Box>
                   <Button size="small" endIcon={<ArrowRight size={16} />} onClick={() => navigate('/reports')}>Full Report</Button>
                 </Stack>
                 <Box sx={{ height: 300, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={stats.chartData}>
                          <defs>
                             <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.1}/>
                                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
                          <RechartsTooltip 
                             contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
                          />
                          <Area type="monotone" dataKey="amount" stroke={theme.palette.primary.main} strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </Box>
              </Card>
           </Grid>
        </Grid>

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
    </Box>
  );
}

