import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Avatar, Chip, Divider, List, ListItem, ListItemText, 
  ListItemAvatar, CircularProgress, IconButton, Tooltip as MuiTooltip,
  Paper, useMediaQuery, Fab, Zoom, Stack, Skeleton, Container
} from '@mui/material';
import LoadingScreen from '../components/LoadingScreen';
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
  const [loading, setLoading] = useState(!(window as any)._dashboardLoaded);
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
  const [instituteData, setInstituteData] = useState<Partial<InstituteSettings>>({
    maktabName: 'Maktab Wali Ul Aser',
    tagline: 'Simple Learning for Everyone'
  });

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

        // Fetch Institute Settings for the banner
        const instDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (instDoc.exists()) {
          setInstituteData(instDoc.data());
        }

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
            });

            if (isAdmin) {
              unsubscribePendingFees = onSnapshot(query(collection(db, 'receipts'), where('status', '==', 'pending')), (snap) => {
                setStats(prev => ({ ...prev, pendingFees: snap.size }));
              });

              const currentMonthStart = format(new Date(), 'yyyy-MM-01');
              unsubscribeApprovedFees = onSnapshot(query(
                collection(db, 'receipts'), 
                where('status', '==', 'approved'),
                where('date', '>=', currentMonthStart)
              ), (snap) => {
                const amount = snap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
                setStats(prev => ({ ...prev, totalFeesMonth: amount }));
              });
            }

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
            });
          } else {
            unsubscribeStudentHaziri = onSnapshot(query(collection(db, 'attendance'), where('studentId', '==', user.uid)), (snap) => {
              const totalAt = snap.docs.length;
              const presentAt = snap.docs.filter(d => d.data().status === 'present').length;
              const attendanceRate = totalAt > 0 ? Math.round((presentAt / totalAt) * 100) : 0;
              setStats(prev => ({ ...prev, attendanceRate }));
            });

            unsubscribeStudentCourses = onSnapshot(query(collection(db, 'courses'), where('isPublished', '==', true), limit(3)), (snap) => {
              setStats(prev => ({ ...prev, availableCourses: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
            });
          }

          // 2. Notifications & Staff
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
          });

          // 3. Events & Staff
          unsubscribeEvents = onSnapshot(query(collection(db, 'events'), where('date', '>=', format(new Date(), 'yyyy-MM-dd')), orderBy('date', 'asc'), limit(5)), (snapshot) => {
            setUpcomingEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          });

          const staffQuery = query(collection(db, 'users'), where('role', 'in', ['mudaris', 'muntazim', 'superadmin']));
          unsubscribeStaff = onSnapshot(staffQuery, (snap) => {
            setStaffMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserProfile[]);
            setLoading(false);
            (window as any)._dashboardLoaded = true;
          });

          // 4. Background task Queues for Staff
          if (isStaff) {
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
            });

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
            });
          }
        };

        initSequentially();
      } catch (error) {
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
  }, [user?.uid, isStaff, isAdmin]);

  const handleApproveFee = async (id: string) => {
    try {
      await updateDoc(doc(db, 'receipts', id), {
        status: 'approved',
        approvedBy: user.uid,
        approvedByName: user.displayName,
        approvedAt: Date.now()
      });
    } catch (error) {
      console.error("Approve fee failed:", error);
    }
  };

  const handleRejectFee = async (id: string) => {
    try {
      await updateDoc(doc(db, 'receipts', id), {
        status: 'rejected',
        approvedBy: user.uid,
        approvedByName: user.displayName,
        approvedAt: Date.now()
      });
    } catch (error) {
      console.error("Reject fee failed:", error);
    }
  };

  const handleApproveStudent = async (student: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        maktabLevel: student.pendingMaktabLevel,
        pendingMaktabLevel: null,
        status: 'Active'
      });
    } catch (error) {
      console.error("Approve student failed:", error);
    }
  };

  const handleRejectStudent = async (student: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        pendingMaktabLevel: null
      });
    } catch (error) {
      console.error("Reject student failed:", error);
    }
  };

  const handleNotificationClick = async (notif: NotificationType) => {
    if (!notif.readBy.includes(user.uid)) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), {
          readBy: arrayUnion(user.uid)
        });
      } catch (error) {
        console.error("Mark read failed:", error);
      }
    }
    
    if (notif.type === 'fee_request') {
      navigate('/fees');
    } else {
      navigate('/notifications');
    }
  };

  if (loading) return <LoadingScreen />;

  const instanceTextVisibilityColor = () => {
    if (!instituteData.bannerUrl) return 'text.primary';
    return theme.palette.mode === 'dark' ? 'white' : 'primary.contrastText';
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      sx={{ pb: 8, position: 'relative' }}
    >
      {/* Decorative Border Layer - Shia Theme Inspired */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`, m: 1, borderRadius: 4, zIndex: 100 }} />

      {/* Hero Welcome Section */}
      <Box 
        sx={{ 
          position: 'relative',
          borderRadius: { xs: 0, md: 8 },
          overflow: 'hidden',
          mb: 6,
          minHeight: '50vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          p: 6,
          bgcolor: 'black',
          backgroundImage: instituteData.bannerUrl 
            ? `linear-gradient(rgba(0,0,0,0.73), rgba(0,0,0,0.92)), url(${instituteData.bannerUrl})` 
            : 'radial-gradient(circle at center, #0f766e 0%, #000 80%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          borderBottom: `6px double ${alpha(theme.palette.primary.main, 0.3)}`
        }}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <Typography variant="h3" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 900, mb: 2, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 2 }}>
            Salam, {user.displayName}!
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'white', mb: 3, opacity: 0.9 }}>
            Welcome to {instituteData.maktabName || 'Wali Ul Aser'}
          </Typography>
          <Typography variant="body1" sx={{ maxWidth: 600, mx: 'auto', color: 'rgba(255,255,255,0.7)', fontWeight: 600, mb: 4 }}>
            {instituteData.tagline || 'Your daily guide to religious learning and growth'}
          </Typography>
          
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
            {isStaff && (
              <>
                <Button 
                  variant="contained" 
                  size="large" 
                  startIcon={<Users size={20} />}
                  onClick={() => navigate('/users')}
                  sx={{ borderRadius: 4, fontWeight: 900, px: 4, py: 1.5, bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
                >
                  Manage Students
                </Button>
                <Button 
                  variant="outlined" 
                  size="large" 
                  startIcon={<BookOpen size={20} />}
                  onClick={() => navigate('/courses')}
                  sx={{ borderRadius: 4, fontWeight: 900, px: 4, py: 1.5, color: 'white', borderColor: 'white', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
                >
                  All Courses
                </Button>
              </>
            )}
            {!isStaff && (
              <>
                <Button 
                  variant="contained" 
                  size="large" 
                  startIcon={<BookOpen size={20} />}
                  onClick={() => navigate('/courses')}
                  sx={{ borderRadius: 4, fontWeight: 900, px: 4, py: 1.5 }}
                >
                  My Lessons
                </Button>
                <Button 
                  variant="outlined" 
                  size="large" 
                  startIcon={<CreditCard size={20} />}
                  onClick={() => navigate('/fees')}
                  sx={{ borderRadius: 4, fontWeight: 900, px: 4, py: 1.5, color: 'white', borderColor: 'white' }}
                >
                  Fee Record
                </Button>
              </>
            )}
          </Stack>
        </motion.div>
      </Box>

      <Container maxWidth="xl">
        <Grid container spacing={4}>
          {isStaff ? (
            <>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatBox title="Total Students" value={stats.totalTulab} icon={<Users size={32} />} color="#3b82f6" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatBox title="Current Month Fees" value={`₹${stats.totalFeesMonth.toLocaleString()}`} icon={<TrendingUp size={32} />} color="#10b981" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatBox title="Approvals Pending" value={stats.pendingFees} icon={<Clock size={32} />} color="#f59e0b" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatBox title="Present Today" value={stats.todayHaziri} icon={<UserCheck size={32} />} color="#06b6d4" />
              </Grid>
            </>
          ) : (
            <>
              <Grid size={{ xs: 12, md: 4 }}>
                <StatBox title="My Attendance" value={`${stats.attendanceRate}%`} icon={<TrendingUp size={32} />} color="#10b981" subtitle="Regularity Score" />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <StatBox title="Active Lessons" value={user.subjectsEnrolled?.length || 0} icon={<BookOpen size={32} />} color="#3b82f6" subtitle="Current Topics" />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <StatBox title="Maktab Grade" value={user.grade || 'Awal'} icon={<Check size={32} />} color="#f59e0b" subtitle="Level of Study" />
              </Grid>
            </>
          )}

          {/* Detailed Content */}
          <Grid size={{ xs: 12, md: 8 }}>
             {/* Pending Actions for Staff */}
            {isStaff && (pendingReceipts.length > 0 || pendingStudents.length > 0) && (
              <Box sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'warning.main' }}>
                  Fauri Tawajjo (Actions Needed)
                </Typography>
                <Paper sx={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`, bgcolor: alpha(theme.palette.warning.main, 0.02) }}>
                  <List sx={{ p: 0 }}>
                    {pendingReceipts.map(receipt => (
                      <ListItem key={receipt.id} divider sx={{ py: 3, px: 4 }}>
                        <ListItemText 
                          primary={`${receipt.studentName} - Fee Request`}
                          secondary={`₹${receipt.amount} • ${format(new Date(receipt.date), 'MMMM yyyy')}`}
                          primaryTypographyProps={{ fontWeight: 900 }}
                        />
                        <Stack direction="row" spacing={1}>
                          <IconButton color="success" onClick={() => handleApproveFee(receipt.id)}><Check size={20} /></IconButton>
                          <IconButton color="error" onClick={() => handleRejectFee(receipt.id)}><X size={20} /></IconButton>
                        </Stack>
                      </ListItem>
                    ))}
                    {pendingStudents.map(student => (
                      <ListItem key={student.uid} divider sx={{ py: 3, px: 4 }}>
                        <ListItemText 
                          primary={`${student.displayName} - New Admission`}
                          secondary={`Level: ${student.pendingMaktabLevel}`}
                          primaryTypographyProps={{ fontWeight: 900 }}
                        />
                        <Stack direction="row" spacing={1}>
                          <IconButton color="success" onClick={() => handleApproveStudent(student)}><Check size={20} /></IconButton>
                          <IconButton color="error" onClick={() => handleRejectStudent(student)}><X size={20} /></IconButton>
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            )}

            {/* Recent Lessons */}
            <Box sx={{ mb: 6 }}>
              <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'primary.main' }}>
                New Lessons
              </Typography>
              <Grid container spacing={3}>
                {(stats.availableCourses.length > 0 ? stats.availableCourses : [1, 2]).map((course: any, idx: number) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={course.id || idx}>
                    <Card sx={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, transition: 'all 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 15px 35px rgba(0,0,0,0.2)' } }}>
                      <Box sx={{ height: 160, bgcolor: 'primary.dark', backgroundImage: course.thumbnailUrl ? `url(${course.thumbnailUrl})` : 'none', backgroundSize: 'cover' }} />
                      <CardContent sx={{ p: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>{course.name || 'Intro to Tajweed'}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontWeight: 600 }}>{course.description || 'Start your journey with fundamental rules of recitation'}</Typography>
                        <Button fullWidth onClick={() => navigate('/courses')} variant="outlined" sx={{ borderRadius: 3, fontWeight: 800, py: 1 }}>Continue Course</Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Notifications Section */}
            <Box>
              <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'primary.main' }}>
                Quick News
              </Typography>
              <Stack spacing={2}>
                {recentNotifications.map(notif => (
                  <Paper 
                    key={notif.id}
                    elevation={0}
                    onClick={() => handleNotificationClick(notif)}
                    sx={{ 
                      p: 3, 
                      borderRadius: 4, 
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                      cursor: 'pointer',
                      transition: '0.2s',
                      display: 'flex',
                      gap: 2,
                      alignItems: 'flex-start',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                    }}
                  >
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.main', color: 'white' }}>
                      <Bell size={24} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5 }}>{notif.title}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>{notif.message}</Typography>
                    </Box>
                  </Paper>
                ))}
                {recentNotifications.length === 0 && (
                  <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.disabled', textAlign: 'center', py: 4 }}>No new updates yet</Typography>
                )}
              </Stack>
            </Box>
          </Grid>

          {/* Right Column: Events & Profile Wrap */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 6, p: 4, mb: 4, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`, bgcolor: 'rgba(15, 118, 110, 0.05)' }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Avatar 
                  src={user.photoURL} 
                  sx={{ width: 100, height: 100, mx: 'auto', mb: 2, border: `3px solid ${theme.palette.primary.main}` }} 
                />
                <Typography variant="h6" sx={{ fontWeight: 900 }}>{user.displayName}</Typography>
                <Chip label={role.toUpperCase()} color="primary" size="small" sx={{ mt: 1, fontWeight: 900, borderRadius: 1.5 }} />
              </Box>
              <Divider sx={{ my: 3, opacity: 0.5 }} />
              <Stack spacing={2}>
                <ProfileItem label="Phone" value={user.phone || '0300-1234567'} icon={<Phone size={16} />} />
                <ProfileItem label="Status" value={user.status || 'Active Member'} icon={<Check size={16} />} />
                <ProfileItem label="Joined" value={format(user.createdAt || Date.now(), 'MMM yyyy')} icon={<Calendar size={16} />} />
              </Stack>
            </Card>

            <Box>
              <Typography variant="h6" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 3, color: 'primary.main' }}>
                Upcoming Events
              </Typography>
              <Stack spacing={2}>
                {upcomingEvents.map(event => (
                  <Box key={event.id} sx={{ p: 2, borderRadius: 3, borderLeft: `4px solid ${theme.palette.secondary.main}`, bgcolor: 'background.paper' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{event.title}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.main' }}>{event.date}</Typography>
                  </Box>
                ))}
                {upcomingEvents.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>No events planned soon</Typography>
                )}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

// Sub-components
function StatCard({ title, value, icon, color }: any) {
  const theme = useTheme();
  return (
    <Card variant="outlined" sx={{ 
      borderRadius: 1.5, 
      height: '100%', 
      transition: 'all 0.3s ease',
      bgcolor: 'background.paper',
      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      '&:hover': { borderColor: color },
    }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ p: 1.2, borderRadius: 0.5, bgcolor: alpha(color, 0.05), color: color }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>{title}</Typography>
      </CardContent>
    </Card>
  );
}

function StatBox({ title, value, icon, color, subtitle }: any) {
  return (
    <Card 
      elevation={0}
      sx={{ 
        p: 4, 
        borderRadius: 6, 
        position: 'relative', 
        overflow: 'hidden', 
        border: `1px solid ${alpha(color, 0.2)}`,
        bgcolor: alpha(color, 0.03) 
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ color: color, mb: 2 }}>{icon}</Box>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1, mb: 0.5 }}>{value}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.disabled', display: 'block', mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      <Box sx={{ position: 'absolute', top: -20, right: -20, color: color, opacity: 0.05 }}>
        {React.cloneElement(icon, { size: 120 })}
      </Box>
    </Card>
  );
}

function ProfileItem({ label, value, icon }: any) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ color: 'primary.main', p: 1, borderRadius: 2, bgcolor: alpha('#10b981', 0.1) }}>{icon}</Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, display: 'block', lineHeight: 1 }}>{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}</Typography>
      </Box>
    </Box>
  );
}
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
        color={color as any} 
        onClick={onClick}
        sx={{ 
          border: `1px solid ${alpha(theme.palette[color as 'primary' | 'secondary' | 'success'].main, 0.2)}`,
          '&:hover': {
            transform: 'scale(1.05)',
          },
          boxShadow: `0 2px 8px ${alpha(theme.palette[color as 'primary' | 'secondary' | 'success'].main, 0.25)}`
        }}
      >
        {React.cloneElement(icon as React.ReactElement<any>, { size: isMobile ? 18 : 22 })}
      </Fab>
    </motion.div>
  );
}
