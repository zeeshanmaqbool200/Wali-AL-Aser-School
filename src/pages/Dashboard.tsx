import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Avatar, Chip, Divider, List, ListItem, ListItemText, 
  ListItemAvatar, CircularProgress, IconButton, Tooltip as MuiTooltip,
  Paper, useMediaQuery, Fab, Zoom, Stack, Skeleton, Container,
  Dialog
} from '@mui/material';
import LoadingScreen from '../components/LoadingScreen';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  Users, BookOpen, Calendar, CreditCard, Bell, 
  Check, X, Plus, ArrowRight, TrendingUp, Clock, 
  AlertCircle, Send, FileText, ClipboardList, UserCheck,
  MoreVertical, ExternalLink, Phone, MessageCircle, MessageSquare,
  UserPlus, BarChart3, User, GraduationCap, Award, Book, CheckCircle, XCircle
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, where, limit, updateDoc, doc, getDocs, arrayUnion, or, and, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, FeeReceipt, Notification as NotificationType, Course, InstituteSettings } from '../types';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

import { logger } from '../lib/logger';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!(window as any)._dashboardLoaded && !localStorage.getItem(`dashboard_stats_${user.uid}`));
  const [stats, setStats] = useState<any>(() => {
    // Try to recover cached stats to prevent white flicker
    const cached = localStorage.getItem(`dashboard_stats_${user.uid}`);
    return cached ? JSON.parse(cached) : {
      totalStudents: 0,
      totalFeesMonth: 0,
      pendingFees: 0,
      todayAttendance: 0,
      attendanceRate: 0,
      recentFees: [],
      availableCourses: [],
      recentAdmissions: []
    };
  });
  const [jafariDate, setJafariDate] = useState<string>('');
  const [recentNotifications, setRecentNotifications] = useState<NotificationType[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<FeeReceipt[]>([]);
  const [pendingStudents, setPendingStudents] = useState<UserProfile[]>([]);
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);
  const [instituteData, setInstituteData] = useState<Partial<InstituteSettings>>({
    instituteName: 'Wali Ul Aser Institute',
    tagline: 'Simple Learning for Everyone'
  });

  const isSuperAdmin = user.email?.toLowerCase() === 'zeeshanmaqbool200@gmail.com' || user.uid === 'sZUiAgoSF8MTPBQAOtj6jbFkot93';
  const role = user.role || 'student';
  const isManagerRole = role === 'manager' || (role === 'superadmin' && !isSuperAdmin);
  const isTeacherRole = role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isSuperAdmin || isManagerRole || isTeacherRole;
  const isPendingTeacher = user.role === 'pending_teacher';

  // Real data for charts will be fetched from Firestore
  const [collectionTrendData, setCollectionTrendData] = useState<{name: string, value: number}[]>([]);
  const [attendanceTrendData, setAttendanceTrendData] = useState<{name: string, value: number}[]>([]);
  const [subjectsTrendData, setSubjectsTrendData] = useState<{name: string, value: number}[]>([]);

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [openTeacherProfile, setOpenTeacherProfile] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);

  useEffect(() => {
    let unsubscribeNotifs = () => {};
    let unsubscribeReceipts = () => {};
    let unsubscribeStudents = () => {};
    let unsubscribeEvents = () => {};
    let unsubscribeStudentsCount = () => {};
    let unsubscribePendingFees = () => {};
    let unsubscribeApprovedFees = () => {};
    let unsubscribeAttendance = () => {};
    let unsubscribeUserAttendance = () => {};
    let unsubscribeStudentCourses = () => {};
    let unsubscribeStaff = () => {};
    let unsubscribeRecentAdmissions = () => {};

    const fetchData = async () => {
      try {
        // Only show full loading if we haven't loaded before
        if (!(window as any)._dashboardLoaded) {
          setLoading(true);
        }

        // Fetch Institute Settings for the banner and Jafari offset
        const instDoc = await getDoc(doc(db, 'settings', 'institute'));
        let offset = 0;
          if (instDoc.exists()) {
            const instData = instDoc.data() as any;
            setInstituteData({
              instituteName: instData.instituteName || 'Institute Name',
              tagline: instData.tagline || 'Education for Excellence',
              bannerUrl: instData.bannerUrl || ''
            });
            offset = instData.jafariOffset || 0;
          }

        // Fetch Jafari Date with offset adjustment
        try {
          const adjustedDate = new Date();
          if (offset !== 0) {
            adjustedDate.setDate(adjustedDate.getDate() + offset);
            console.log('Adjusting Jafari date with offset:', offset, 'Resulting Date:', adjustedDate);
          }
          const dateStr = format(adjustedDate, 'dd-MM-yyyy');
          // Fetch Jafari Date (Method 8 is for Jafari/Ithna Ashari)
          const response = await fetch(`https://api.aladhan.com/v1/gToH/${dateStr}?method=8`); 
          const jDate = await response.json();
          if (jDate?.data?.hijri) {
            const h = jDate.data.hijri;
            setJafariDate(`${h.day} ${h.month.en} ${h.year} AH`);
            console.log('Fetched Jafari Date:', `${h.day} ${h.month.en} ${h.year} AH`);
          }
        } catch (e) {
          console.error('Failed to fetch Jafari date', e);
        }

        // Sequence listeners with small delays to avoid request bursts
        const initSequentially = async () => {
          // 1. Core user stats
          if (isStaff) {
            const studentsQuery = isAdmin 
              ? query(collection(db, 'users'), where('role', '==', 'student'))
              : query(collection(db, 'users'), and(
                  where('role', '==', 'student'), 
                  or(
                    where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']),
                    where('classLevel', '==', 'Example'),
                    where('classLevel', '==', 'Example')
                  )
                ));
              
            unsubscribeStudentsCount = onSnapshot(studentsQuery, (studentsSnap) => {
              setStats(prev => {
                const newState = { ...prev, totalStudents: studentsSnap.size };
                localStorage.setItem(`dashboard_stats_${user.uid}`, JSON.stringify(newState));
                return newState;
              });
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

            const todayAttendanceQuery = isAdmin 
              ? query(collection(db, 'attendance'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), where('status', '==', 'present'))
              : query(
                  collection(db, 'attendance'), 
                  where('date', '==', format(new Date(), 'yyyy-MM-dd')), 
                  where('status', '==', 'present'),
                  where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])
                );
                
            unsubscribeAttendance = onSnapshot(todayAttendanceQuery, (snap) => {
              setStats(prev => ({ ...prev, todayAttendance: snap.size }));
            });
          } else {
            unsubscribeUserAttendance = onSnapshot(query(collection(db, 'attendance'), where('studentId', '==', user.uid)), (snap) => {
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
                where('targetId', '==', user.classLevel || 'none')
              ),
              orderBy('createdAt', 'desc'), 
              limit(10)
            );
          }
          
          unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationType[];
            setRecentNotifications(data);
          });

          // 3. Events & Staff - Hide if expired (more than 1 day old)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const yesterdayLimit = new Date(today);
          yesterdayLimit.setDate(yesterdayLimit.getDate() - 1);
          const yesterdayStr = format(yesterdayLimit, 'yyyy-MM-dd');

          unsubscribeEvents = onSnapshot(query(collection(db, 'events'), where('date', '>=', yesterdayStr), orderBy('date', 'asc'), limit(10)), (snapshot) => {
            const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Secondary client-side filter to be absolutely sure about "1 day expiry"
            const filtered = allEvents.filter((e: any) => {
              const eventDate = new Date(e.date);
              eventDate.setHours(23, 59, 59, 999); // Allow it to stay for 24 hours of that day
              return eventDate >= yesterdayLimit;
            });
            setUpcomingEvents(filtered);
          });

          // Fetch recent admissions for staff - simplified to avoid index requirement
          if (isStaff) {
            // Fetch last 50 users (to ensure we find students in staff's classes)
            const recentQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
            unsubscribeRecentAdmissions = onSnapshot(recentQuery, (snap) => {
              const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
              let admissions = allUsers.filter((u: any) => u.role === 'student');
              
              if (!isAdmin) {
                // Filter for Teacher specific classes
                const classes = user.assignedClasses || [];
                admissions = admissions.filter((u: any) => 
                  classes.includes(u.classLevel) || u.classLevel === 'Example'
                );
              }
              
              const finalAdmissions = admissions.slice(0, 5);
              setStats(prev => {
                const newState = { ...prev, recentAdmissions: finalAdmissions };
                localStorage.setItem(`dashboard_stats_${user.uid}`, JSON.stringify(newState));
                return newState;
              });
            }, (err) => {
              console.error("Recent admissions snapshot error:", err);
            });
          }

    const staffQuery = query(collection(db, 'users'), where('role', 'in', ['teacher', 'manager', 'superadmin']));
          unsubscribeStaff = onSnapshot(staffQuery, (snap) => {
            setStaffMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserProfile[]);
            setLoading(false);
            (window as any)._dashboardLoaded = true;
          });

          // Fetch recent published lessons (Subjects)
          const lessonsQuery = query(collection(db, 'courses'), where('isPublished', '==', true), orderBy('createdAt', 'desc'), limit(6));
          const lessonsSnap = await getDocs(lessonsQuery);
          setStats(prev => ({ ...prev, availableCourses: lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() })) }));

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
                    where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']),
                    where('classLevel', '==', 'Example')
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
              pendingQuery = query(collection(db, 'users'), where('pendingClassLevel', '!=', null));
            } else {
              pendingQuery = query(
                collection(db, 'users'), 
                and(
                  where('pendingClassLevel', '!=', null),
                  or(
                    where('pendingClassLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']),
                    where('pendingClassLevel', '==', 'Example')
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
      unsubscribeStudentsCount();
      unsubscribePendingFees();
      unsubscribeApprovedFees();
      unsubscribeAttendance();
      unsubscribeUserAttendance();
      unsubscribeStudentCourses();
      unsubscribeStaff();
      unsubscribeRecentAdmissions();
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
        classLevel: student.pendingClassLevel,
        pendingClassLevel: null,
        status: 'Active'
      });
    } catch (error) {
      console.error("Approve student failed:", error);
    }
  };

  const handleRejectStudent = async (student: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        pendingClassLevel: null
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

  const showTeacherProfile = (teacher: UserProfile) => {
    setSelectedTeacher(teacher);
    setOpenTeacherProfile(true);
  };

  if (loading && !(window as any)._dashboardLoaded && !localStorage.getItem(`dashboard_stats_${user.uid}`)) return <LoadingScreen />;

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
      {/* Shia Islamic Orientation Ornament */}
      <Box sx={{ 
        position: 'absolute', 
        top: -10, 
        left: '50%', 
        transform: 'translateX(-50%)', 
        zIndex: 5,
        opacity: 0.3,
        pointerEvents: 'none',
        display: { xs: 'none', md: 'block' }
      }}>
        <svg width="200" height="40" viewBox="0 0 200 40">
          <path d="M0 0 Q100 60 200 0" fill="transparent" stroke={theme.palette.primary.main} strokeWidth="1" />
          <circle cx="100" cy="25" r="3" fill="transparent" stroke={theme.palette.primary.main} strokeWidth="0.5" />
          <path d="M100 21 L100 29 M96 25 L104 25" stroke={theme.palette.primary.main} strokeWidth="0.5" />
        </svg>
      </Box>

      {/* Decorative Border Layer - Shia Theme Inspired */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`, m: 1, borderRadius: 4, zIndex: 100 }} />

      {/* Hero Welcome Section */}
      <Box 
        sx={{ 
          position: 'relative',
          borderRadius: { xs: 0, md: 8 },
          overflow: 'hidden',
          mb: 6,
          minHeight: { xs: '65vh', md: '550px' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          p: { xs: 4, md: 10 },
          bgcolor: 'black',
          backgroundImage: instituteData.bannerUrl 
            ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url(${instituteData.bannerUrl})` 
            : 'radial-gradient(circle at center, #0f766e 0%, #000 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`
        }}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {jafariDate && (
             <Chip 
              icon={<Clock size={16} />}
              label={jafariDate} 
              sx={{ 
                mb: 4, 
                bgcolor: alpha(theme.palette.primary.main, 0.25), 
                color: 'primary.light', 
                fontWeight: 950,
                fontSize: { xs: '0.85rem', md: '1.1rem' },
                backdropFilter: 'blur(20px)',
                border: `1.5px solid ${alpha(theme.palette.primary.main, 0.6)}`,
                px: 2.5,
                py: 2.8,
                boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.2)}`,
                '& .MuiChip-icon': { color: 'inherit' }
              }} 
            />
          )}
          <Typography 
            variant={isMobile ? "h3" : "h2"} 
            sx={{ 
              fontFamily: 'var(--font-display)', 
              fontWeight: 950, 
              mb: 2, 
              color: 'primary.main', 
              textTransform: 'uppercase', 
              letterSpacing: { xs: 2, md: 4 },
              textShadow: '0 0 30px rgba(13, 148, 136, 0.4)',
              lineHeight: 1.1,
              fontSize: { xs: '2.5rem', md: '4.5rem' }
            }}
          >
            Greetings, {user.displayName}!
          </Typography>
          <Typography 
            variant={isMobile ? "h5" : "h4"} 
            sx={{ 
              fontFamily: 'var(--font-display)',
              fontWeight: 950, 
              color: 'white', 
              mb: 4, 
              opacity: 1,
              textShadow: '2px 4px 10px rgba(0,0,0,0.5)',
              letterSpacing: 0.5
            }}
          >
            Welcome to {instituteData.instituteName || 'The Institute'}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              maxWidth: 850, 
              mx: 'auto', 
              color: 'rgba(255,255,255,1)', 
              fontWeight: 800, 
              mb: 10,
              fontSize: { xs: '1.1rem', md: '1.4rem' },
              lineHeight: 1.8,
              textShadow: '2px 2px 10px rgba(0,0,0,0.9)',
              fontStyle: 'italic',
              background: 'rgba(0,0,0,0.4)',
              p: 2,
              borderRadius: 4,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            "{instituteData.tagline || 'Your daily guide to religious learning and growth'}"
          </Typography>
          
          <Stack 
            direction={isMobile ? "column" : "row"} 
            spacing={3} 
            justifyContent="center" 
            sx={{ width: '100%', maxWidth: '750px', mx: 'auto' }}
          >
            {isStaff && (
              <>
                <Button 
                  variant="contained" 
                  size="large" 
                  startIcon={<Users size={24} />}
                  onClick={() => navigate('/users')}
                  fullWidth={isMobile}
                  sx={{ 
                    borderRadius: 4, 
                    fontWeight: 950, 
                    px: 6, 
                    py: 2.5, 
                    bgcolor: 'primary.main', 
                    fontSize: '1.1rem',
                    boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.5)}`,
                    transition: 'all 0.3s ease',
                    '&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-4px)' } 
                  }}
                >
                  Manage Students
                </Button>
                <Button 
                  variant="outlined" 
                  size="large" 
                  startIcon={<BookOpen size={24} />}
                  onClick={() => navigate('/courses')}
                  fullWidth={isMobile}
                  sx={{ 
                    borderRadius: 4, 
                    fontWeight: 950, 
                    px: 6, 
                    py: 2.5, 
                    color: 'white', 
                    borderColor: 'rgba(255,255,255,0.6)', 
                    fontSize: '1.1rem',
                    borderWidth: 2,
                    backdropFilter: 'blur(12px)',
                    transition: 'all 0.3s ease',
                    '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'rgba(255,255,255,0.05)', transform: 'translateY(-4px)' } 
                  }}
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
                  startIcon={<BookOpen size={24} />}
                  onClick={() => navigate('/courses')}
                  fullWidth={isMobile}
                  sx={{ 
                    borderRadius: 4, 
                    fontWeight: 950, 
                    px: 8, 
                    py: 2.5,
                    fontSize: '1.1rem',
                    boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.4)}`,
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}
                >
                  My Lessons
                </Button>
                <Button 
                  variant="outlined" 
                  size="large" 
                  startIcon={<CreditCard size={24} />}
                  onClick={() => navigate('/fees')}
                  fullWidth={isMobile}
                  sx={{ 
                    borderRadius: 4, 
                    fontWeight: 950, 
                    px: 8, 
                    py: 2.5, 
                    color: 'white', 
                    borderColor: 'rgba(255,255,255,0.6)',
                    fontSize: '1.1rem',
                    borderWidth: 2,
                    backdropFilter: 'blur(12px)',
                    '&:hover': { transform: 'translateY(-4px)', bgcolor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  Fee Record
                </Button>
              </>
            )}
          </Stack>
        </motion.div>
      </Box>

      {/* Side Scrolling Events with Tilted BG */}
      {upcomingEvents.length > 0 && (
        <Box 
          sx={{ 
            py: 4, 
            overflow: 'hidden', 
            position: 'relative',
            mb: 6,
            bgcolor: 'background.paper',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              transform: 'skewY(-1deg) translateY(-20px)',
              zIndex: 0
            }
          }}
        >
          <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Calendar size={20} className="text-teal-600" /> Upcoming Events
              </Typography>
              <Button size="small" onClick={() => navigate('/schedule')} sx={{ fontWeight: 900 }}>View All</Button>
            </Box>
            <Box 
              component={motion.div} 
              sx={{ 
                display: 'flex', 
                gap: 3, 
                overflowX: 'auto', 
                pb: 2,
                px: 1,
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none'
              }}
            >
              {upcomingEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card 
                    sx={{ 
                      minWidth: 280, 
                      borderRadius: 4, 
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      transition: '0.3s',
                      '&:hover': { transform: 'scale(1.02)' }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Chip 
                        label={event.date} 
                        size="small" 
                        color="secondary" 
                        sx={{ mb: 2, fontWeight: 900, borderRadius: 1.5, fontSize: '0.7rem' }} 
                      />
                      <Typography variant="subtitle1" sx={{ fontWeight: 950, mb: 1, lineHeight: 1.2 }}>{event.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>{event.location || 'Institute Campus'}</Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </Box>
          </Container>
        </Box>
      )}

      <Container maxWidth="xl">
        <Grid container spacing={4}>
          {isStaff ? (
            <>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatBox title="Total Students" value={stats.totalStudents} icon={<Users size={32} />} color="#3b82f6" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatBox title="Current Collections" value={`₹${stats.totalFeesMonth.toLocaleString()}`} icon={<TrendingUp size={32} />} color="#10b981" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatBox title="Action Required" value={stats.pendingFees} icon={<Clock size={32} />} color="#f59e0b" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatBox title="Present Today" value={stats.todayAttendance} icon={<UserCheck size={32} />} color="#06b6d4" />
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
                <StatBox title="My Class Level" value={user.classLevel || 'Level 1'} icon={<Check size={32} />} color="#f59e0b" subtitle="Level of Study" />
              </Grid>
            </>
          )}

          {/* Detailed Content */}
          <Grid size={{ xs: 12, md: 8 }}>
             {/* Pending Actions for Staff */}
            {isStaff && (pendingReceipts.length > 0 || pendingStudents.length > 0) && (
              <Box sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'warning.main' }}>
                  Actions Needed
                </Typography>
                <Paper sx={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`, bgcolor: alpha(theme.palette.warning.main, 0.02) }}>
                  <List sx={{ p: 0 }}>
                    {pendingReceipts.map(receipt => {
                      const actions: ActionMenuItem[] = [
                        { label: 'Approve Fee', icon: <CheckCircle size={18} />, color: 'success.main', onClick: () => handleApproveFee(receipt.id) },
                        { label: 'Reject Fee', icon: <XCircle size={18} />, color: 'error.main', onClick: () => handleRejectFee(receipt.id) },
                        { label: 'View Receipt', icon: <ExternalLink size={18} />, onClick: () => navigate('/fees') }
                      ];

                      return (
                        <ListItem key={receipt.id} divider sx={{ py: 2.5, px: 4 }}>
                          <ListItemText 
                            primary={`${receipt.studentName} - Fee Request`}
                            secondary={`₹${receipt.amount} • ${format(new Date(receipt.date), 'MMMM yyyy')}`}
                            primaryTypographyProps={{ fontWeight: 800, fontSize: '1rem' }}
                            secondaryTypographyProps={{ fontWeight: 600 }}
                          />
                          <ActionMenu items={actions} />
                        </ListItem>
                      );
                    })}
                    {pendingStudents.map(student => {
                      const actions: ActionMenuItem[] = [
                        { label: 'Approve Student', icon: <UserCheck size={18} />, color: 'success.main', onClick: () => handleApproveStudent(student) },
                        { label: 'Reject Student', icon: <XCircle size={18} />, color: 'error.main', onClick: () => handleRejectStudent(student) },
                        { label: 'View Details', icon: <ExternalLink size={18} />, onClick: () => { setSelectedTeacher(student); setOpenTeacherProfile(true); } }
                      ];

                      return (
                        <ListItem key={student.uid} divider sx={{ py: 2.5, px: 4 }}>
                          <ListItemText 
                            primary={`${student.displayName} - New Admission`}
                            secondary={`Level: ${student.pendingClassLevel || 'N/A'}`}
                            primaryTypographyProps={{ fontWeight: 800, fontSize: '1rem' }}
                            secondaryTypographyProps={{ fontWeight: 600 }}
                          />
                          <ActionMenu items={actions} />
                        </ListItem>
                      );
                    })}
                  </List>
                </Paper>
              </Box>
            )}

            {/* Recent Admissions (Recent Students) */}
            {isStaff && stats.recentAdmissions && stats.recentAdmissions.length > 0 && (
              <Box sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Users size={28} />
                  Recently Registered Students
                </Typography>
                <Paper 
                  elevation={0}
                  sx={{ 
                    borderRadius: 4, 
                    overflow: 'hidden', 
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    boxShadow: theme.palette.mode === 'dark'
                      ? '4px 4px 12px rgba(0,0,0,0.5)'
                      : '0 4px 20px rgba(0,0,0,0.03)'
                  }}
                >
                   <List sx={{ p: 0 }}>
                    {stats.recentAdmissions.map((student: any, idx: number) => (
                      <ListItem 
                        key={student.uid} 
                        divider={idx !== stats.recentAdmissions.length - 1}
                        onClick={() => navigate('/users')}
                        sx={{ 
                          py: 2.5, 
                          px: 3, 
                          cursor: 'pointer', 
                          transition: 'all 0.2s ease',
                          '&:hover': { 
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            paddingLeft: 4,
                            '& .MuiAvatar-root': {
                              transform: 'scale(1.1)',
                              boxShadow: `0 0 15px ${alpha(theme.palette.primary.main, 0.3)}`
                            }
                          } 
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar 
                            src={student.photoURL} 
                            imgProps={{ referrerPolicy: 'no-referrer' }}
                            sx={{ 
                              width: 48, 
                              height: 48, 
                              transition: 'all 0.3s ease',
                              border: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`
                            }}
                          >
                            {student.displayName?.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText 
                          primary={student.displayName}
                          secondary={
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                              Admission No: <Box component="span" sx={{ color: 'primary.main', fontWeight: 800 }}>{student.admissionNo || 'N/A'}</Box> • Level: <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>{student.classLevel || 'N/A'}</Box>
                            </Typography>
                          }
                          primaryTypographyProps={{ fontWeight: 900, fontSize: '1.05rem', mb: 0.2 }}
                        />
                        <Chip 
                          label="Active" 
                          color="success" 
                          size="small" 
                          variant="outlined" 
                          sx={{ 
                            fontWeight: 900, 
                            borderRadius: 1.5,
                            borderWidth: 2,
                            fontSize: '0.65rem',
                            textTransform: 'uppercase'
                          }} 
                        />
                        <IconButton size="small" sx={{ ml: 2, color: 'text.disabled' }}>
                          <ArrowRight size={18} />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            )}

            {/* Featured Lessons */}
            {stats.availableCourses.length > 0 && (
              <Box sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'primary.main' }}>
                  Educational Resources
                </Typography>
                <Grid container spacing={3}>
                  {stats.availableCourses.map((course: any, idx: number) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={course.id || idx}>
                      <Card 
                        onClick={() => navigate(`/courses/${course.id}`)}
                        sx={{ 
                          borderRadius: 6, 
                          overflow: 'hidden', 
                          cursor: 'pointer',
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, 
                          transition: 'all 0.3s', 
                          '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } 
                        }}
                      >
                        <Box sx={{ height: 160, bgcolor: 'primary.dark', backgroundImage: course.thumbnailUrl ? `url(${course.thumbnailUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.9 }} />
                        <CardContent sx={{ p: 4 }}>
                          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>{course.name}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{course.description}</Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <Chip label="Start Learning" size="small" variant="outlined" color="primary" sx={{ fontWeight: 800 }} />
                             <ArrowRight size={20} className="text-teal-600" />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Grid>

          {/* Right Column: Events & Staff */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 3, color: 'primary.main' }}>
                Quick Stats
              </Typography>
              <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Stack spacing={2}>
                  <ProfileItem label="My Status" value={user.status || 'Active'} icon={<Check size={16} />} />
                  <ProfileItem label="Current Level" value={user.classLevel || 'N/A'} icon={<GraduationCap size={16} />} />
                </Stack>
              </Paper>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 3, color: 'primary.main' }}>
                Staff Members
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: 'transparent' }}>
                <List sx={{ p: 0 }}>
                  {staffMembers.map((staff, idx) => (
                    <ListItem 
                      key={staff.uid} 
                      divider={idx !== staffMembers.length - 1}
                      onClick={() => showTeacherProfile(staff)}
                      secondaryAction={
                        staff.phone && (
                          <IconButton 
                            size="small" 
                            color="success"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://wa.me/${staff.phone.replace(/[^0-9]/g, '')}`, '_blank');
                            }}
                            sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.2) } }}
                          >
                            <MessageSquare size={16} />
                          </IconButton>
                        )
                      }
                      sx={{ py: 1, px: 2, cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) } }}
                    >
                      <ListItemAvatar sx={{ minWidth: 44 }}>
                        <Avatar src={staff.photoURL} sx={{ width: 32, height: 32, borderRadius: 1 }} imgProps={{ referrerPolicy: 'no-referrer' }}>{staff.displayName?.charAt(0)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={staff.displayName} 
                        secondary={staff.classLevel || (staff.role === 'superadmin' ? 'Administrator' : staff.role)} 
                        primaryTypographyProps={{ fontWeight: 800, fontSize: '0.8rem' }}
                        secondaryTypographyProps={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Teacher Profile Dialog */}
      <Dialog 
        open={openTeacherProfile} 
        onClose={() => setOpenTeacherProfile(false)}
        PaperProps={{
          sx: { 
            borderRadius: 8, 
            p: { xs: 3, md: 5 }, 
            minWidth: { xs: '90%', sm: 400 },
            background: theme.palette.mode === 'dark' 
              ? 'linear-gradient(145deg, #0f172a, #1e293b)' 
              : 'linear-gradient(145deg, #f8fafc, #f1f5f9)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: theme.shadows[24],
            overflow: 'visible'
          }
        }}
      >
        <IconButton 
          onClick={() => setOpenTeacherProfile(false)}
          sx={{ position: 'absolute', top: -15, right: -15, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' }, boxShadow: 4 }}
        >
          <X size={20} />
        </IconButton>
        {selectedTeacher && (
          <Box sx={{ textAlign: 'center' }}>
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Avatar 
                src={selectedTeacher.photoURL} 
                sx={{ 
                  width: 140, height: 140, mx: 'auto', mb: 3, 
                  border: `6px solid ${theme.palette.primary.main}`,
                  boxShadow: theme.shadows[10],
                  bgcolor: 'primary.main',
                  fontSize: '3rem',
                  fontWeight: 900
                }}
                imgProps={{ referrerPolicy: 'no-referrer' }}
              >
                {selectedTeacher.displayName?.charAt(0)}
              </Avatar>
            </motion.div>
            <Typography variant="h4" sx={{ fontWeight: 950, mb: 1, letterSpacing: -1.5 }}>{selectedTeacher.displayName}</Typography>
            <Chip 
              icon={<Award size={16} />}
              label={selectedTeacher.role === 'superadmin' ? 'Administrator' : 'Staff Teacher'} 
              color="primary"
              variant="outlined"
              sx={{ mb: 4, fontWeight: 900, borderRadius: 2 }}
            />
            
            <Paper sx={{ p: 3, borderRadius: 4, bgcolor: alpha(theme.palette.action.hover, 0.3), border: '1px solid', borderColor: 'divider', mb: 4 }}>
              <Grid container spacing={3} textAlign="left">
                <Grid size={{ xs: 12 }}>
                   <Stack direction="row" spacing={2} alignItems="center">
                     <Book size={20} color={theme.palette.primary.main} />
                     <Box>
                       <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.6, display: 'block' }}>EXPERTISE</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 800 }}>{selectedTeacher.subject || 'Islamic Theology & Guidance'}</Typography>
                     </Box>
                   </Stack>
                </Grid>
                <Grid size={{ xs: 12 }}>
                   <Stack direction="row" spacing={2} alignItems="center">
                     <Calendar size={20} color={theme.palette.primary.main} />
                     <Box>
                       <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.6, display: 'block' }}>JOINED DATE</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 800 }}>{format(new Date(selectedTeacher.createdAt || Date.now()), 'dd MMM yyyy')}</Typography>
                     </Box>
                   </Stack>
                </Grid>
              </Grid>
            </Paper>

            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => setOpenTeacherProfile(false)}
              sx={{ borderRadius: 4, py: 2, fontWeight: 900, fontSize: '1rem', boxShadow: '0 10px 20px rgba(15, 118, 110, 0.3)' }}
            >
              OK
            </Button>
          </Box>
        )}
      </Dialog>
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
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
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
