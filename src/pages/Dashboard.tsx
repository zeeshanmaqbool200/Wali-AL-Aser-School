import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Avatar, Chip, Divider, List, ListItem, ListItemText, 
  ListItemAvatar, CircularProgress, IconButton, Tooltip as MuiTooltip,
  Paper, useTheme, useMediaQuery, Fab, Zoom, alpha, Stack
} from '@mui/material';
import { 
  Users, BookOpen, Calendar, CreditCard, Bell, 
  Check, X, Plus, ArrowRight, TrendingUp, Clock, 
  AlertCircle, Send, FileText, ClipboardList, UserCheck,
  MoreVertical, ExternalLink, Phone, MessageCircle
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, where, limit, updateDoc, doc, getDocs, arrayUnion } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, FeeReceipt, Notification as NotificationType, Course } from '../types';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

import { logger } from '../lib/logger';

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTulab: 0,
    totalFeesMonth: 0,
    pendingFees: 0,
    todayHaziri: 0
  });
  const [recentNotifications, setRecentNotifications] = useState<NotificationType[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<FeeReceipt[]>([]);
  const [fabOpen, setFabOpen] = useState(false);

  const isMudaris = user.role === 'teacher' || user.role === 'admin' || user.role === 'super-admin';
  const isMuntazim = user.role === 'admin' || user.role === 'super-admin';

  // Real data for charts will be fetched from Firestore
  const [collectionTrendData, setCollectionTrendData] = useState<{name: string, value: number}[]>([]);
  const [haziriTrendData, setHaziriTrendData] = useState<{name: string, value: number}[]>([]);
  const [subjectsTrendData, setSubjectsTrendData] = useState<{name: string, value: number}[]>([]);

  useEffect(() => {
    let unsubscribeNotifs = () => {};
    let unsubscribeReceipts = () => {};

    const fetchData = async () => {
      try {
        logger.info('Dashboard Initializing...');
        // Stats
        if (isMudaris) {
          const tulabSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
          const pendingFeesSnap = await getDocs(query(collection(db, 'receipts'), where('status', '==', 'pending')));
          const todayHaziriSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), where('status', '==', 'present')));
          
          setStats({
            totalTulab: tulabSnap.size,
            totalFeesMonth: 45000, // Mock or calculate
            pendingFees: pendingFeesSnap.size,
            todayHaziri: todayHaziriSnap.size
          });
          logger.success('Dashboard Stats Loaded');
        }

        // Notifications
        const notifQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(5));
        unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationType[];
          setRecentNotifications(data.filter(n => {
            if (isMudaris) return true;
            if (n.targetType === 'all') return true;
            if (n.targetType === 'individual' && n.targetId === user.uid) return true;
            if (n.targetType === 'class' && n.targetId === user.grade) return true;
            return false;
          }));
          logger.db('Recent Notifications Updated', 'notifications', { count: snapshot.size });
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'notifications');
        });

        // Pending Receipts for Mudaris
        if (isMudaris) {
          const receiptsQuery = query(collection(db, 'receipts'), where('status', '==', 'pending'), limit(5));
          unsubscribeReceipts = onSnapshot(receiptsQuery, (snapshot) => {
            setPendingReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[]);
            logger.db('Pending Fee Receipts Updated', 'receipts', { count: snapshot.size });
          }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'receipts');
          });
        }

        setLoading(false);
      } catch (error) {
        logger.error('Dashboard Data Fetch Failed', error);
        handleFirestoreError(error, OperationType.LIST, 'dashboard_data');
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }

    return () => {
      unsubscribeNotifs();
      unsubscribeReceipts();
    };
  }, [user, isMudaris]);

  const handleApproveFee = async (id: string) => {
    try {
      logger.db('Approving Fee', `receipts/${id}`);
      await updateDoc(doc(db, 'receipts', id), {
        status: 'approved',
        approvedBy: user.uid,
        approvedByName: user.displayName,
        approvedAt: Date.now()
      });
      logger.success('Fee Approved Successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `receipts/${id}`);
    }
  };

  const handleRejectFee = async (id: string) => {
    try {
      logger.db('Rejecting Fee', `receipts/${id}`);
      await updateDoc(doc(db, 'receipts', id), {
        status: 'rejected',
        approvedBy: user.uid,
        approvedByName: user.displayName,
        approvedAt: Date.now()
      });
      logger.success('Fee Rejected Successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `receipts/${id}`);
    }
  };

  const handleNotificationClick = async (notif: NotificationType) => {
    if (!notif.readBy.includes(user.uid)) {
      try {
        logger.db('Marking Notification as Read', `notifications/${notif.id}`);
        await updateDoc(doc(db, 'notifications', notif.id), {
          readBy: arrayUnion(user.uid)
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `notifications/${notif.id}`);
      }
    }
    
    if (notif.type === 'fee_request') {
      navigate('/fees');
    } else if (notif.type === 'class_timing') {
      navigate('/schedule');
    } else {
      navigate('/notifications');
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: { xs: 4, sm: 6, md: 8 }, position: 'relative', px: { xs: 1.5, sm: 2, md: 3 } }}>
      {/* Animated Background Blobs */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: -1, pointerEvents: 'none' }}>
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            position: 'absolute',
            top: '10%',
            left: '5%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            position: 'absolute',
            bottom: '20%',
            right: '10%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.08)} 0%, transparent 70%)`,
            filter: 'blur(50px)',
          }}
        />
      </Box>

      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: { xs: 3, sm: 4, md: 6 }, textAlign: 'center' }}>
          <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontFamily: 'var(--font-serif)', fontWeight: 500, mb: 1, color: 'text.primary', letterSpacing: -0.5 }}>
            Asslamualikum, {user.displayName.split(' ')[0]}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500, letterSpacing: 0.5, opacity: 0.8 }}>
            {isMuntazim ? 'Muntazim Portal (Intizamiya)' : isMudaris ? 'Mudaris Portal (Asatiza)' : `Talib-e-Ilm Portal • ${user.grade || 'Not Assigned'}`}
          </Typography>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Box 
              sx={{ 
                px: 2, 
                py: 0.5, 
                borderRadius: 1, 
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                color: 'primary.main', 
                fontWeight: 700,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                textTransform: 'uppercase',
                letterSpacing: 1
              }}
            >
              <Calendar size={14} />
              {format(new Date(), 'EEEE, do MMMM')}
            </Box>
          </Box>
        </Box>
      </motion.div>

      {/* Stats Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3, mb: 6 }}>
        {isMudaris ? (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard title="Kul Tulab-e-Ilm" value={stats.totalTulab} icon={<Users size={20} />} color="#3b82f6" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <StatCard title="Mahana Majmua" value={`₹${stats.totalFeesMonth.toLocaleString()}`} icon={<TrendingUp size={20} />} color="#10b981" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <StatCard title="Baqaya Fees" value={stats.pendingFees} icon={<CreditCard size={20} />} color="#f59e0b" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <StatCard title="Aaj ki Haziri" value={stats.todayHaziri} icon={<UserCheck size={20} />} color="#06b6d4" />
            </motion.div>
          </>
        ) : (
          <>
            <Box sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 4, 
                  background: theme.palette.mode === 'dark' ? '#0a0a0a' : '#ffffff',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                      <Avatar 
                        src={user.photoURL} 
                        sx={{ width: 64, height: 64, border: `1px solid ${theme.palette.divider}` }} 
                      />
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -1 }}>{user.displayName}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Admission No: {user.studentId || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Maktab Level</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{user.grade}</Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Father's Name</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{user.fatherName}</Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </motion.div>
            </Box>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <StatCard title="Subjects" value={user.subjectsEnrolled?.length || 0} icon={<BookOpen size={20} />} color="#3b82f6" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <StatCard title="Haziri Rate" value="94%" icon={<TrendingUp size={20} />} color="#10b981" />
            </motion.div>
          </>
        )}
      </Box>

      <Grid container spacing={4}>
        {/* Left Column: Notifications & Pending Tasks */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Quick Actions (Mudaris Only) */}
          {isMudaris && (
            <Box sx={{ mb: 6 }}>
              <Typography variant="h6" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
                <ActionButton label="Send Notification" icon={<Send size={18} />} onClick={() => navigate('/notifications')} color="primary" />
                <ActionButton label="Mark Attendance" icon={<ClipboardList size={18} />} onClick={() => navigate('/attendance')} color="success" />
                <ActionButton label="Record Fee" icon={<CreditCard size={18} />} onClick={() => navigate('/fees')} color="info" />
              </Box>
            </Box>
          )}

          {/* Charts Section */}
          {isMudaris && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 6, 
                  bgcolor: 'background.paper',
                }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 600, letterSpacing: -0.5 }}>Mahana Adaigi ka Rujhan (Majmua)</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, opacity: 0.7 }}>Revenue analysis for Maktab Wali Ul Aser</Typography>
                  </Box>
                  <CardContent>
                    <Box sx={{ height: 300, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={collectionTrendData}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 700 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 700 }} />
                          <RechartsTooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontWeight: 700 }} />
                          <Area type="monotone" dataKey="value" stroke={theme.palette.primary.main} strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Pending Fee Approvals (Mudaris Only) */}
          {isMudaris && pendingReceipts.length > 0 && (
            <Card variant="outlined" sx={{ borderRadius: 4, mb: 6, overflow: 'hidden' }}>
              <Box sx={{ 
                p: 2.5, 
                bgcolor: alpha(theme.palette.warning.main, 0.05), 
                color: 'warning.main', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: `1px solid ${theme.palette.divider}`
              }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AlertCircle size={18} /> Pending Fee Approvals
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => navigate('/fees')} 
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  View All
                </Button>
              </Box>
              <List sx={{ p: 0 }}>
                {pendingReceipts.map((receipt, index) => (
                  <ListItem 
                    key={receipt.id} 
                    divider={index !== pendingReceipts.length - 1}
                    sx={{ py: 2, px: 3 }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton 
                          size="small" 
                          sx={{ color: 'success.main', border: `1px solid ${theme.palette.divider}` }} 
                          onClick={() => handleApproveFee(receipt.id)}
                        >
                          <Check size={16} />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          sx={{ color: 'error.main', border: `1px solid ${theme.palette.divider}` }} 
                          onClick={() => handleRejectFee(receipt.id)}
                        >
                          <X size={16} />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary', fontWeight: 700, fontSize: '0.875rem' }}>
                        {receipt.studentName.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={receipt.studentName} 
                      secondary={`₹${receipt.amount} • ${receipt.feeHead}`} 
                      primaryTypographyProps={{ fontWeight: 700 }}
                      secondaryTypographyProps={{ fontWeight: 500, fontSize: '0.75rem' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Card>
          )}

          {/* Recent Notifications */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>Recent Notifications</Typography>
              <Button 
                size="small" 
                onClick={() => navigate('/notifications')} 
                endIcon={<ArrowRight size={16} />}
                sx={{ fontWeight: 700, textTransform: 'none', opacity: 0.8 }}
              >
                See All
              </Button>
            </Box>
            <List sx={{ p: 0 }}>
              {recentNotifications.map((notif, index) => (
                <ListItem 
                  key={notif.id} 
                  divider={index !== recentNotifications.length - 1}
                  onClick={() => handleNotificationClick(notif)}
                  sx={{ 
                    py: 2, 
                    px: 3, 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }, 
                    opacity: notif.readBy.includes(user.uid) ? 0.5 : 1
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'action.hover', color: notif.type === 'fee_request' ? 'warning.main' : 'primary.main' }}>
                      {notif.type === 'fee_request' ? <CreditCard size={18} /> : <Bell size={18} />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={notif.title} 
                    secondary={notif.message} 
                    primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ noWrap: true, fontWeight: 500, fontSize: '0.75rem' }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2, fontWeight: 600 }}>
                    {format(notif.createdAt, 'HH:mm')}
                  </Typography>
                </ListItem>
              ))}
              {recentNotifications.length === 0 && (
                <Box sx={{ p: 6, textAlign: 'center' }}>
                  <Bell size={40} color={theme.palette.divider} style={{ marginBottom: 12 }} />
                  <Typography color="text.secondary" sx={{ fontWeight: 600 }}>No recent notifications</Typography>
                </Box>
              )}
            </List>
          </Card>
        </Grid>

        {/* Right Column: Profile & Team */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Profile Card */}
          <Card variant="outlined" sx={{ borderRadius: 4, mb: 4, overflow: 'hidden' }}>
            <Box sx={{ height: 80, bgcolor: 'primary.main', opacity: 0.1 }} />
            <CardContent sx={{ pt: 0, pb: 4, textAlign: 'center', mt: -5 }}>
              <Avatar 
                src={user.photoURL} 
                sx={{ 
                  width: 80, height: 80, 
                  mx: 'auto',
                  border: `4px solid ${theme.palette.background.paper}`,
                  mb: 2
                }} 
              />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{user.displayName}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 3 }}>
                {isMuntazim ? 'Muntazim' : isMudaris ? 'Mudaris' : 'Talib-e-Ilm'}
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 4, flexWrap: 'wrap' }}>
                {user.subjectsEnrolled?.map(sub => (
                  <Chip 
                    key={sub} 
                    label={sub} 
                    size="small" 
                    variant="outlined"
                    sx={{ fontWeight: 600, borderRadius: 1 }} 
                  />
                ))}
              </Box>

              <Divider sx={{ mb: 3 }} />
              
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Admission No</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.studentId || 'N/A'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Maktab Level</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.grade || 'N/A'}</Typography>
                </Box>
              </Stack>

              <Button 
                fullWidth 
                variant="outlined" 
                sx={{ mt: 4, borderRadius: 2, fontWeight: 700 }} 
                onClick={() => navigate('/settings')}
              >
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3 }}>Idarah Team</Typography>
              <Stack spacing={2}>
                {[
                  { name: 'Shabir Ahmad', role: 'Chairman' },
                  { name: 'Bashir Ahmad', role: 'Finance Manager' },
                  { name: 'Irfan Hussain', role: 'Supervisor' },
                ].map((member, idx) => (
                  <Box 
                    key={idx} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      border: `1px solid ${theme.palette.divider}`,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.75rem', fontWeight: 800 }}>
                      {member.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{member.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>{member.role}</Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Mudaris Quick Action FAB */}
      {isMudaris && (
        <Box sx={{ position: 'fixed', bottom: { xs: 80, md: 32 }, right: 32, zIndex: 1000 }}>
          <Zoom in={true}>
              <Fab 
                color="primary" 
                aria-label="add" 
                onClick={() => setFabOpen(!fabOpen)}
                sx={{ 
                  width: 64, 
                  height: 64, 
                  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.4)}`,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)'
                }}
              >
              <Plus size={32} />
            </Fab>
          </Zoom>
          
          <AnimatePresence>
            {fabOpen && (
              <Box sx={{ position: 'absolute', bottom: 80, right: 0, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                <FabAction label="Haziri Lagayein" icon={<ClipboardList size={20} />} color="success" onClick={() => navigate('/attendance')} delay={0.1} />
                <FabAction label="Adaigi Darj Karein" icon={<CreditCard size={20} />} color="info" onClick={() => navigate('/fees')} delay={0.2} />
                <FabAction label="Ittila Bhejein" icon={<Send size={20} />} color="primary" onClick={() => navigate('/notifications')} delay={0.3} />
              </Box>
            )}
          </AnimatePresence>
        </Box>
      )}
    </Box>
  );
}

const StatCard = React.memo(({ title, value, icon, color }: any) => {
  const theme = useTheme();
  return (
    <Card variant="outlined" sx={{ 
      borderRadius: 2, 
      height: '100%', 
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
      bgcolor: 'background.paper',
      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      '&:hover': { 
        borderColor: color,
        transform: 'translateY(-4px)',
      },
    }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ 
            p: 1.2, 
            borderRadius: 1, 
            bgcolor: alpha(color, 0.03), 
            color: color, 
            display: 'flex',
            border: `1px solid ${alpha(color, 0.08)}`
          }}>
            {icon}
          </Box>
          <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700, fontSize: '0.65rem', letterSpacing: 1 }}>
            +12%
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 500, fontFamily: 'var(--font-serif)', mb: 0.5 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>{title}</Typography>
      </CardContent>
    </Card>
  );
});

const ActionButton = React.memo(({ label, icon, onClick, color }: any) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Button
      variant="outlined"
      color={color}
      onClick={onClick}
      startIcon={icon}
      fullWidth={isMobile}
      sx={{ 
        borderRadius: 100, 
        px: 4, 
        py: isMobile ? 1.5 : 2, 
        border: `1.5px solid ${alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main, 0.2)}`,
        bgcolor: alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main, 0.02),
        '&:hover': { 
          bgcolor: alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main, 0.1),
          transform: 'translateY(-2px)',
          borderColor: theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main,
          boxShadow: `0 8px 20px ${alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main, 0.15)}`
        },
        fontWeight: 800,
        textTransform: 'none',
        fontSize: '0.9rem',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {label}
    </Button>
  );
});

function FabAction({ label, icon, color, onClick, delay }: any) {
  const theme = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.8 }}
      transition={{ delay, duration: 0.2 }}
      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <Paper 
        elevation={0} 
        sx={{ 
          px: 3, 
          py: 1.2, 
          borderRadius: 100, 
          fontWeight: 800, 
          fontSize: '0.875rem',
          bgcolor: alpha(theme.palette.background.paper, 0.9),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        {label}
      </Paper>
      <Fab 
        size="medium" 
        color={color} 
        onClick={onClick}
        sx={{ 
          border: `1px solid ${theme.palette.divider}`,
          '&:hover': {
            transform: 'scale(1.1)',
          }
        }}
      >
        {icon}
      </Fab>
    </motion.div>
  );
}
