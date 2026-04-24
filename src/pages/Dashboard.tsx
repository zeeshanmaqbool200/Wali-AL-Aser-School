import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Avatar, Chip, Divider, List, ListItem, ListItemText, 
  ListItemAvatar, CircularProgress, IconButton, Tooltip as MuiTooltip,
  Paper, useMediaQuery, Fab, Zoom, Stack, Skeleton
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  Users, BookOpen, Calendar, CreditCard, Bell, 
  Check, X, Plus, ArrowRight, TrendingUp, Clock, 
  AlertCircle, Send, FileText, ClipboardList, UserCheck,
  MoreVertical, ExternalLink, Phone, MessageCircle,
  UserPlus, BarChart3, User
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, where, limit, updateDoc, doc, getDocs, arrayUnion, or, and, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, FeeReceipt, Notification as NotificationType, Course, InstituteSettings } from '../types';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
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
  const [stats, setStats] = useState<any>({
    totalTulab: 0,
    totalFeesMonth: 0,
    pendingFees: 0,
    todayHaziri: 0,
    attendanceRate: 0,
    recentFees: [],
    availableCourses: []
  });
  const [recentNotifications, setRecentNotifications] = useState<NotificationType[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<FeeReceipt[]>([]);
  const [pendingStudents, setPendingStudents] = useState<UserProfile[]>([]);
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);
  const [instituteData, setInstituteData] = useState<Partial<InstituteSettings>>({});

  const isSuperAdmin = user.email === 'zeeshanmaqbool200@gmail.com';
  const role = user.role || 'student';
  const isMuntazim = role === 'muntazim' || (role === 'superadmin' && !isSuperAdmin);
  const isMudarisRole = role === 'mudaris';
  const isAdmin = isSuperAdmin || isMuntazim;
  const isStaff = isSuperAdmin || isMuntazim || isMudarisRole;
  const isPendingMudaris = user.role === 'pending_mudaris';

  // Real data for charts will be fetched from Firestore
  const [collectionTrendData, setCollectionTrendData] = useState<{name: string, value: number}[]>([]);
  const [haziriTrendData, setHaziriTrendData] = useState<{name: string, value: number}[]>([]);
  const [subjectsTrendData, setSubjectsTrendData] = useState<{name: string, value: number}[]>([]);

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribeNotifs = () => {};
    let unsubscribeReceipts = () => {};
    let unsubscribeStudents = () => {};
    let unsubscribeEvents = () => {};
    let unsubscribeTulab = () => {};
    let unsubscribePendingFees = () => {};
    let unsubscribeApprovedFees = () => {};
    let unsubscribeHaziri = () => {};
    let unsubscribeStudentHaziri = () => {};
    let unsubscribeStudentCourses = () => {};
    let unsubscribeStaff = () => {};

    const fetchData = async () => {
      try {
        setLoading(true);

        // Sequence listeners with small delays to avoid request bursts
        const initSequentially = async () => {
          // 1. Core user stats
          if (isStaff) {
            const tulabQuery = isAdmin 
              ? query(collection(db, 'users'), where('role', '==', 'student'))
              : query(collection(db, 'users'), and(
                  where('role', '==', 'student'), 
                  or(
                    where('grade', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']),
                    where('grade', '==', 'Example'),
                    where('maktabLevel', '==', 'Example')
                  )
                ));
              
            unsubscribeTulab = onSnapshot(tulabQuery, (tulabSnap) => {
              setStats(prev => ({ ...prev, totalTulab: tulabSnap.size }));
            }, (error) => console.error("Tulab fetch failed:", error));

            if (isAdmin) {
              await new Promise(r => setTimeout(r, 100));
              unsubscribePendingFees = onSnapshot(query(collection(db, 'receipts'), where('status', '==', 'pending')), (snap) => {
                setStats(prev => ({ ...prev, pendingFees: snap.size }));
              }, (error) => console.error("Pending fees fetch failed:", error));

              const currentMonthStart = format(new Date(), 'yyyy-MM-01');
              unsubscribeApprovedFees = onSnapshot(query(
                collection(db, 'receipts'), 
                where('status', '==', 'approved'),
                where('date', '>=', currentMonthStart)
              ), (snap) => {
                const amount = snap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
                setStats(prev => ({ ...prev, totalFeesMonth: amount }));
              }, (error) => console.error("Approved fees fetch failed:", error));
            }

            await new Promise(r => setTimeout(r, 100));
            const todayHaziriQuery = isAdmin 
              ? query(collection(db, 'attendance'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), where('status', '==', 'present'))
              : query(
                  collection(db, 'attendance'), 
                  where('date', '==', format(new Date(), 'yyyy-MM-dd')), 
                  where('status', '==', 'present'),
                  where('grade', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])
                );
                
            unsubscribeHaziri = onSnapshot(todayHaziriQuery, (snap) => {
              setStats(prev => ({ ...prev, todayHaziri: snap.size }));
            }, (error) => console.error("Haziri fetch failed:", error));
          } else {
            unsubscribeStudentHaziri = onSnapshot(query(collection(db, 'attendance'), where('studentId', '==', user.uid)), (snap) => {
              const totalAt = snap.docs.length;
              const presentAt = snap.docs.filter(d => d.data().status === 'present').length;
              const attendanceRate = totalAt > 0 ? Math.round((presentAt / totalAt) * 100) : 0;
              setStats(prev => ({ ...prev, attendanceRate }));
            }, (error) => console.error("Student haziri fetch failed:", error));

            await new Promise(r => setTimeout(r, 100));
            unsubscribeStudentCourses = onSnapshot(query(collection(db, 'courses'), where('isPublished', '==', true), limit(3)), (snap) => {
              setStats(prev => ({ ...prev, availableCourses: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
            }, (error) => console.error("Student courses fetch failed:", error));
          }

          // 2. Notifications & Staff
          await new Promise(r => setTimeout(r, 200));
          let notifQuery;
          if (isStaff) {
            notifQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(10));
          } else {
            notifQuery = query(
              collection(db, 'notifications'), 
              or(
                where('targetType', '==', 'all'),
                where('targetId', '==', user.uid),
                where('targetId', '==', user.grade || 'none'),
                where('targetId', '==', user.maktabLevel || 'none')
              ),
              orderBy('createdAt', 'desc'), 
              limit(10)
            );
          }
          
          unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationType[];
            setRecentNotifications(data);
          }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

          // 3. Events & Staff
          await new Promise(r => setTimeout(r, 300));
          unsubscribeEvents = onSnapshot(query(collection(db, 'events'), where('date', '>=', format(new Date(), 'yyyy-MM-dd')), orderBy('date', 'asc'), limit(5)), (snapshot) => {
            setUpcomingEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }, (error) => console.error("Events fetch failed:", error));

          const staffQuery = query(collection(db, 'users'), where('role', 'in', ['mudaris', 'muntazim', 'superadmin']));
          unsubscribeStaff = onSnapshot(staffQuery, (snap) => {
            setStaffMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserProfile[]);
            setLoading(false); // Done loading when we have the basic layout data
          }, (error) => {
            console.error("Staff fetch failed:", error);
            setLoading(false);
          });

          // 4. Background task Queues for Staff
          if (isStaff) {
            await new Promise(r => setTimeout(r, 400));
            let receiptsQuery;
            if (isAdmin) {
              receiptsQuery = query(collection(db, 'receipts'), where('status', '==', 'pending'), limit(5));
            } else {
              receiptsQuery = query(
                collection(db, 'receipts'), 
                and(
                  where('status', '==', 'pending'), 
                  or(
                    where('grade', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']),
                    where('grade', '==', 'Example')
                  )
                ),
                limit(5)
              );
            }
            
            unsubscribeReceipts = onSnapshot(receiptsQuery, (snapshot) => {
              setPendingReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[]);
            }, (error) => handleFirestoreError(error, OperationType.LIST, 'receipts'));

            await new Promise(r => setTimeout(r, 100));
            let pendingQuery;
            if (isAdmin) {
              pendingQuery = query(collection(db, 'users'), where('pendingMaktabLevel', '!=', null));
            } else {
              pendingQuery = query(
                collection(db, 'users'), 
                and(
                  where('pendingMaktabLevel', '!=', null),
                  or(
                    where('pendingMaktabLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']),
                    where('pendingMaktabLevel', '==', 'Example')
                  )
                )
              );
            }
            
            unsubscribeStudents = onSnapshot(pendingQuery, (snapshot) => {
              setPendingStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
            }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
          }
        };

        // Start initialization
        initSequentially();
      } catch (error) {
        logger.error('Dashboard Data Fetch Failed', error);
        handleFirestoreError(error, OperationType.LIST, 'dashboard_data');
        setLoading(false);
      }
    };

    if (user?.uid) {
      fetchData();
    }

    return () => {
      unsubscribeNotifs();
      unsubscribeReceipts();
      unsubscribeStudents();
      unsubscribeEvents();
      unsubscribeTulab();
      unsubscribePendingFees();
      unsubscribeApprovedFees();
      unsubscribeHaziri();
      unsubscribeStudentHaziri();
      unsubscribeStudentCourses();
      unsubscribeStaff();
    };
  }, [user?.uid, isStaff, isAdmin]); // Added isAdmin to deps

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

  const handleApproveStudent = async (student: UserProfile) => {
    try {
      logger.db('Approving Student Class', `users/${student.uid}`);
      await updateDoc(doc(db, 'users', student.uid), {
        maktabLevel: student.pendingMaktabLevel,
        pendingMaktabLevel: null,
        status: 'Active'
      });
      logger.success(`Student ${student.displayName} approved for ${student.pendingMaktabLevel}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${student.uid}`);
    }
  };

  const handleRejectStudent = async (student: UserProfile) => {
    try {
      logger.db('Rejecting Student Class', `users/${student.uid}`);
      await updateDoc(doc(db, 'users', student.uid), {
        pendingMaktabLevel: null
      });
      logger.info(`Student ${student.displayName} selection rejected`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${student.uid}`);
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
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map((i) => (
          <Grid size={{ xs: 6, sm: 3 }} key={i}>
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 4 }} />
          </Grid>
        ))}
        <Grid size={{ xs: 12, md: 8 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 4, mb: 3 }} />
          <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 4 }} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Skeleton variant="rectangular" height={600} sx={{ borderRadius: 4 }} />
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      sx={{ pb: 8, position: 'relative', px: { xs: 1, sm: 0 } }}
    >
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
        <Box 
          sx={{ 
            mb: isMobile ? 3 : 6, 
            textAlign: 'center',
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            p: { xs: 3, md: 6 },
            bgcolor: instituteData.bannerUrl ? 'transparent' : 'action.hover',
            backgroundImage: instituteData.bannerUrl ? `linear-gradient(${alpha('#000000', 0.5)}, ${alpha('#000000', 0.5)}), url(${instituteData.bannerUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: instituteData.bannerUrl ? 'white' : 'text.primary',
            boxShadow: instituteData.bannerUrl ? '0 10px 30px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          <Typography variant={isMobile ? "h4" : "h3"} sx={{ fontFamily: 'var(--font-serif)', fontWeight: 500, mb: 1, color: 'inherit', letterSpacing: -0.5 }}>
            Asslamualikum, {user.displayName.split(' ')[0]}! 👋
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, letterSpacing: 0.5, opacity: 0.9 }}>
            {isMuntazim ? 'Muntazim Portal (Intizamiya)' : isSuperAdmin ? 'Super Admin Portal' : isMudarisRole ? 'Mudaris Portal (Asatiza)' : `Talib-e-Ilm Portal • ${user.grade || 'Not Assigned'}`}
          </Typography>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box 
              sx={{ 
                px: 2, 
                py: 0.5, 
                borderRadius: 1, 
                bgcolor: instituteData.bannerUrl ? alpha('#ffffff', 0.1) : alpha(theme.palette.primary.main, 0.05),
                color: instituteData.bannerUrl ? 'white' : 'primary.main', 
                fontWeight: 700,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                border: `1px solid ${instituteData.bannerUrl ? alpha('#ffffff', 0.2) : alpha(theme.palette.primary.main, 0.1)}`,
                textTransform: 'uppercase',
                letterSpacing: 1,
                backdropFilter: instituteData.bannerUrl ? 'blur(10px)' : 'none'
              }}
            >
              <Calendar size={14} />
              {format(new Date(), 'EEEE, do MMMM')}
            </Box>
          </Box>

          {/* Quick Actions in Header */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {(() => {
              const actions = {
                superadmin: [
                  { label: 'Naya Talib', icon: <UserPlus size={18} />, color: 'primary' as const, path: '/users?action=add' },
                  { label: 'Fees', icon: <CreditCard size={18} />, color: 'info' as const, path: '/fees' },
                  { label: 'Reports', icon: <BarChart3 size={18} />, color: 'secondary' as const, path: '/reports' },
                ],
                muntazim: [
                  { label: 'Naya Talib', icon: <UserPlus size={18} />, color: 'primary' as const, path: '/users?action=add' },
                  { label: 'Fees', icon: <CreditCard size={18} />, color: 'info' as const, path: '/fees' },
                ],
                mudaris: [
                  { label: 'Haziri', icon: <ClipboardList size={18} />, color: 'success' as const, path: '/attendance' },
                  { label: 'Payments', icon: <CreditCard size={18} />, color: 'info' as const, path: '/fees' },
                ],
                pending_mudaris: [],
                student: [
                  { label: 'Fees', icon: <CreditCard size={18} />, color: 'success' as const, path: '/fees' },
                  { label: 'Time Table', icon: <Calendar size={18} />, color: 'info' as const, path: '/schedule' },
                ]
              };
              const currentActions = actions[user.role as keyof typeof actions] || [];
              return currentActions.map((action) => (
                <Button
                  key={action.label}
                  variant="contained"
                  color={action.color}
                  size="small"
                  startIcon={action.icon}
                  onClick={() => navigate(action.path)}
                  sx={{ 
                    borderRadius: 1.5, 
                    fontWeight: 800, 
                    px: 2, 
                    py: 1,
                    textTransform: 'none',
                    fontSize: '0.8rem',
                    boxShadow: 'none',
                    '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                  }}
                >
                  {action.label}
                </Button>
              ));
            })()}
          </Box>
        </Box>
      </motion.div>

      {/* Stats Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3, mb: 6 }}>
        {isStaff ? (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard title="Kul Tulab-e-Ilm" value={stats.totalTulab} icon={<Users size={20} />} color="#3b82f6" />
            </motion.div>
            {isAdmin && (
              <>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <StatCard title="Mahana Majmua" value={`₹${stats.totalFeesMonth.toLocaleString()}`} icon={<TrendingUp size={20} />} color="#10b981" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <StatCard title="Baqaya Fees" value={stats.pendingFees} icon={<CreditCard size={20} />} color="#f59e0b" />
                </motion.div>
              </>
            )}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <StatCard title="Aaj ki Haziri" value={stats.todayHaziri} icon={<UserCheck size={20} />} color="#06b6d4" />
            </motion.div>
          </>
        ) : (
          <>
            <Box sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 1, 
                  background: theme.palette.mode === 'dark' ? '#0a0a0a' : '#ffffff',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <CardContent sx={{ p: isMobile ? 3 : 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 2 : 3, mb: 4 }}>
                      <Avatar 
                        src={user.photoURL} 
                        sx={{ width: isMobile ? 56 : 64, height: isMobile ? 56 : 64, border: `1px solid ${theme.palette.divider}` }} 
                      />
                      <Box>
                        <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 800, letterSpacing: -1 }}>{user.displayName}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                          ID: {user.studentId || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>Maktab Level</Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{user.grade || user.maktabLevel || 'N/A'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>Wali (Father)</Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{user.fatherName || 'N/A'}</Typography>
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
              <StatCard title="Haziri Rate" value={`${stats.attendanceRate}%`} icon={<TrendingUp size={20} />} color="#10b981" />
            </motion.div>
          </>
        )}
      </Box>

      <Grid container spacing={4}>
        {/* Left Column: Notifications & Pending Tasks */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Quick Actions (Staff Only) */}
          {isStaff && (
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
          {isAdmin && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 2, 
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

          {/* Pending Fee Approvals (Staff) */}
          {isStaff && pendingReceipts.length > 0 && (
            <Card variant="outlined" sx={{ borderRadius: 2, mb: 4, overflow: 'hidden' }}>
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

          {/* Pending Student Approvals (Staff) */}
          {isStaff && pendingStudents.length > 0 && (
            <Card variant="outlined" sx={{ borderRadius: 2, mb: 6, overflow: 'hidden' }}>
              <Box sx={{ 
                p: 2.5, 
                bgcolor: alpha(theme.palette.info.main, 0.05), 
                color: 'info.main', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: `1px solid ${theme.palette.divider}`
              }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <UserCheck size={18} /> Pending Student Approvals
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => navigate('/users')} 
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Manage Users
                </Button>
              </Box>
              <List sx={{ p: 0 }}>
                {pendingStudents.map((student, index) => (
                  <ListItem 
                    key={student.uid} 
                    divider={index !== pendingStudents.length - 1}
                    sx={{ py: 2, px: 3 }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton 
                          size="small" 
                          sx={{ color: 'success.main', border: `1px solid ${theme.palette.divider}` }} 
                          onClick={() => handleApproveStudent(student)}
                        >
                          <Check size={16} />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          sx={{ color: 'error.main', border: `1px solid ${theme.palette.divider}` }} 
                          onClick={() => handleRejectStudent(student)}
                        >
                          <X size={16} />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={student.photoURL} sx={{ bgcolor: 'action.hover' }}>
                        {student.displayName.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={student.displayName} 
                      secondary={`Requesting: ${student.pendingMaktabLevel}`} 
                      primaryTypographyProps={{ fontWeight: 700 }}
                      secondaryTypographyProps={{ fontWeight: 500, fontSize: '0.75rem' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Card>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <Card variant="outlined" sx={{ borderRadius: 2, mb: 4, overflow: 'hidden' }}>
              <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.secondary.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Calendar size={18} /> Agli Ittela'at (Upcoming Events)
                </Typography>
                <Button size="small" onClick={() => navigate('/schedule')} sx={{ fontWeight: 800 }}>Daikhein</Button>
              </Box>
              <List sx={{ p: 0 }}>
                {upcomingEvents.map((event, idx) => (
                  <ListItem key={event.id} divider={idx < upcomingEvents.length - 1} sx={{ py: 2, px: 3 }}>
                    <Box sx={{ 
                      width: 48, height: 54, borderRadius: 2, bgcolor: 'background.default', 
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${theme.palette.divider}`, mr: 3
                    }}>
                      <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                        {format(new Date(event.date), 'MMM')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1 }}>
                        {format(new Date(event.date), 'dd')}
                      </Typography>
                    </Box>
                    <ListItemText 
                      primary={event.title} 
                      secondary={`${event.time} • ${event.type}`} 
                      primaryTypographyProps={{ fontWeight: 800, fontSize: '1rem' }}
                      secondaryTypographyProps={{ fontWeight: 600, fontSize: '0.8rem' }}
                    />
                    <Chip 
                      label={event.type} 
                      size="small" 
                      sx={{ 
                        bgcolor: alpha(event.color || theme.palette.primary.main, 0.1), 
                        color: event.color || theme.palette.primary.main,
                        fontWeight: 800,
                        borderRadius: 1
                      }} 
                    />
                  </ListItem>
                ))}
              </List>
            </Card>
          )}

          {/* Recent Notifications */}
          <Card variant="outlined" sx={{ borderRadius: 2, mb: 4 }}>
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

          {/* Student Courses (Only for students) */}
          {!isMudarisRole && stats.availableCourses?.length > 0 && (
            <Card variant="outlined" sx={{ borderRadius: 2, mb: 4, overflow: 'hidden' }}>
              <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <BookOpen size={18} /> Courses For You
                </Typography>
                <Button size="small" onClick={() => navigate('/courses')} sx={{ fontWeight: 800 }}>Daikhein</Button>
              </Box>
              <Grid container spacing={0}>
                {stats.availableCourses.map((course: any, idx: number) => (
                  <Grid size={{ xs: 12, sm: 4 }} key={course.id}>
                    <Box sx={{ p: 2.5, borderRight: idx < stats.availableCourses.length - 1 ? `1px solid ${theme.palette.divider}` : 'none', textAlign: 'center' }}>
                      <Box sx={{ width: 48, height: 48, mx: 'auto', mb: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main' }}>
                        <BookOpen size={24} />
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{course.code}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Card>
          )}
        </Grid>

        {/* Right Column: Profile & Team */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Profile Card */}
          <Card variant="outlined" sx={{ borderRadius: 2, mb: 4, overflow: 'hidden' }}>
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
                {isMuntazim ? 'Muntazim' : isMudarisRole ? 'Mudaris' : 'Talib-e-Ilm'}
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

          {/* Teachers & Mudaris Section (Real-time) */}
          <Card variant="outlined" sx={{ borderRadius: 2, mb: 4, overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
                <Users size={16} /> Hamari Team (Staff)
              </Typography>
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Stack spacing={1.5}>
                {staffMembers.length === 0 ? (
                  <Typography variant="caption" sx={{ textAlign: 'center', py: 2, color: 'text.secondary', display: 'block' }}>
                    No staff members found.
                  </Typography>
                ) : (
                  staffMembers.map((staff) => (
                    <Paper 
                      key={staff.uid} 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5, 
                        borderRadius: 1.5, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        transition: '0.2s',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) }
                      }}
                    >
                      <Avatar 
                        src={staff.photoURL} 
                        sx={{ 
                          width: 40, 
                          height: 40, 
                          border: `1px solid ${theme.palette.divider}`,
                          bgcolor: 'primary.main',
                          fontSize: '0.9rem',
                          fontWeight: 800
                        }}
                      >
                        {staff.displayName.charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
                          {staff.displayName}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.2 }}>
                          <Chip 
                            label={staff.role === 'superadmin' ? 'Super Admin' : staff.role === 'muntazim' ? 'Muntazim' : 'Mudaris'} 
                            size="small" 
                            sx={{ 
                              height: 16, 
                              fontSize: '0.6rem', 
                              fontWeight: 900, 
                              bgcolor: staff.role === 'superadmin' ? 'error.main' : staff.role === 'muntazim' ? 'secondary.main' : 'primary.main', 
                              color: 'white' 
                            }} 
                          />
                          <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.65rem' }}>
                            {staff.assignedClasses?.join(', ') || staff.grade || 'General'}
                          </Typography>
                        </Box>
                        {staff.phone && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            <Box component="a" href={`tel:${staff.phone}`} sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}>
                              <Phone size={10} />
                              <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.65rem' }}>{staff.phone}</Typography>
                            </Box>
                            {staff.whatsapp && (
                              <Box component="a" href={`https://wa.me/${staff.whatsapp}`} target="_blank" sx={{ color: '#25D366', display: 'flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}>
                                <MessageCircle size={10} />
                                <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.65rem' }}>WA</Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  ))
                )}
              </Stack>
            </Box>
          </Card>
        </Grid>
      </Grid>

    </Box>
  );
}

const StatCard = React.memo(({ title, value, icon, color }: any) => {
  const theme = useTheme();
  return (
    <Card variant="outlined" sx={{ 
      borderRadius: 1.5, 
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
            borderRadius: 0.5, 
            bgcolor: alpha(color, 0.05), 
            color: color, 
            display: 'flex',
            border: `1px solid ${alpha(color, 0.1)}`
          }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 600, fontFamily: 'var(--font-serif)', mb: 0.5, letterSpacing: -1 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7, fontSize: '0.65rem' }}>{title}</Typography>
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
          borderRadius: 1.5, 
          px: 4, 
          py: isMobile ? 1.5 : 2, 
          border: `1.5px solid ${alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main, 0.2)}`,
          bgcolor: alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main, 0.02),
          '&:hover': { 
            bgcolor: alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main, 0.1),
            transform: 'translateY(-2px)',
            borderColor: theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main,
            boxShadow: `0 4px 12px ${alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'info'].main, 0.1)}`
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
          px: 2, 
          py: 0.8, 
          borderRadius: 1, 
          fontWeight: 800, 
          fontSize: '0.75rem',
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: 0.5
        }}
      >
        {label}
      </Paper>
      <Fab 
        size={isMobile ? "small" : "medium"} 
        color={color} 
        onClick={onClick}
        sx={{ 
          border: `1px solid ${alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'error' | 'warning'].main, 0.2)}`,
          '&:hover': {
            transform: 'scale(1.05)',
          },
          boxShadow: `0 2px 8px ${alpha(theme.palette[color as 'primary' | 'secondary' | 'success' | 'error' | 'warning'].main, 0.25)}`
        }}
      >
        {React.cloneElement(icon as React.ReactElement<any>, { size: isMobile ? 18 : 22 })}
      </Fab>
    </motion.div>
  );
}
