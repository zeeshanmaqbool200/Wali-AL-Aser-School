import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Avatar, Chip, Divider, List, ListItem, ListItemText, 
  ListItemAvatar, CircularProgress, IconButton, Tooltip as MuiTooltip,
  Paper, useMediaQuery, Fab, Zoom, Stack, Skeleton, Container,
  Dialog, Badge, Alert
} from '@mui/material';
import LoadingScreen from '../components/LoadingScreen';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  Users, BookOpen, Calendar, CreditCard, Bell, 
  Check, X, Plus, ArrowRight, TrendingUp, Clock, 
  AlertCircle, Send, FileText, ClipboardList, UserCheck,
  MoreVertical, ExternalLink, Phone, MessageCircle, MessageSquare,
  UserPlus, BarChart3, User, GraduationCap, Award, Book, CheckCircle, XCircle,
  Wallet, ArrowUpRight, ArrowDownRight, Smartphone, Layout
} from 'lucide-react';
import { 
  db, OperationType, handleFirestoreError,
  collection, query, onSnapshot, orderBy, where, limit, updateDoc, doc, getDocs, arrayUnion, or, and, getDoc 
} from '../firebase';
import { UserProfile, FeeReceipt, Notification as NotificationType, Course, InstituteSettings } from '../types';
import { useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

import { logger } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  const { instituteSettings, permissions } = useAuth();
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
  const [collectionTrendData, setCollectionTrendData] = useState<{name: string, value: number}[]>([]);
  const [attendanceTrendData, setAttendanceTrendData] = useState<{name: string, value: number}[]>([]);
  const [subjectsTrendData, setSubjectsTrendData] = useState<{name: string, value: number}[]>([]);
  const [jafariDate, setJafariDate] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quote, setQuote] = useState('');
  const [showVerificationAlert, setShowVerificationAlert] = useState(true);

  const format12H = (date: Date) => {
    return format(date, 'hh:mm:ss a');
  };

  const quotes = [
    "Knowledge is a treasure, but practice is the key to it. — Imam Ali (AS)",
    "The most complete gift of God is a life based on knowledge. — Imam Ali (AS)",
    "Patience is to victory what the head is to the body. — Imam Ali (AS)",
    "Be like a flower that gives its fragrance even to the hand that crushes it. — Imam Ali (AS)",
    "Seek knowledge from the cradle to the grave. — Prophet Muhammad (SAWW)",
    "A person who knows himself knows his Lord. — Imam Ali (AS)",
    "Silence is the best reply to a fool. — Imam Ali (AS)",
    "The best wealth is the abandonment of desires. — Imam Ali (AS)"
  ];

  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [activeStatIndex, setActiveStatIndex] = useState(0);
  const instituteStats = [
    { 
      label: 'Total Tulab', 
      value: stats.totalStudents || 0, 
      unit: 'Students', 
      icon: <Users size={18} />, 
      color: '#ffcf52', 
      chart: [40, 70, 50, 90, 60, 100, 80] // Placeholder for growth trend
    },
    { 
      label: 'Monthly Fund', 
      value: stats.totalFeesMonth ? `${(stats.totalFeesMonth/1000).toFixed(1)}k` : '0', 
      unit: 'INR', 
      icon: <Wallet size={18} />, 
      color: '#4ade80', 
      chart: collectionTrendData.length > 0 ? collectionTrendData.map(d => (d.value / Math.max(...collectionTrendData.map(v => v.value || 1))) * 100) : [60, 40, 80, 50, 90, 70, 100]
    },
    { 
      label: 'Academic Levels', 
      value: stats.totalCourses || 42, 
      unit: 'Classes', 
      icon: <GraduationCap size={18} />, 
      color: '#60a5fa', 
      chart: [30, 60, 40, 80, 50, 100, 70] 
    },
    { 
      label: 'Haziri Score', 
      value: stats.attendanceRate ? `${stats.attendanceRate}%` : '98%', 
      unit: 'Avg', 
      icon: <CheckCircle size={18} />, 
      color: '#f87171', 
      chart: [80, 90, 85, 100, 95, 98, 99] 
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStatIndex((prev) => (prev + 1) % instituteStats.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [stats]);

  const currentStat = instituteStats[activeStatIndex];
  const [recentNotifications, setRecentNotifications] = useState<NotificationType[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<FeeReceipt[]>([]);
  const [pendingStudents, setPendingStudents] = useState<UserProfile[]>([]);
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);
  const [instituteData, setInstituteData] = useState<Partial<InstituteSettings>>(instituteSettings || {
    instituteName: 'Wali Ul Aser Institute',
    tagline: 'Simple Learning for Everyone'
  });

  useEffect(() => {
    if (instituteSettings) {
      setInstituteData(instituteSettings);
    }
  }, [instituteSettings]);

  const isSuperAdmin = user.email?.toLowerCase() === 'zeeshanmaqbool200@gmail.com' || user.uid === 'sZUiAgoSF8MTPBQAOtj6jbFkot93';
  const role = user.role || 'student';
  const isManagerRole = role === 'manager' || (role === 'superadmin' && !isSuperAdmin);
  const isTeacherRole = role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isSuperAdmin || isManagerRole || isTeacherRole;
  const isPendingTeacher = user.role === 'pending_teacher';

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [openTeacherProfile, setOpenTeacherProfile] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    const handleSnapshotError = (error: any, path: string) => {
      console.error(`Snapshot error for ${path}:`, error);
      // We log but don't strictly throw to avoid "Assertion Failed: Unexpected state" in Firebase SDK
      // which can happen if errors bubble up from snapshot callbacks in certain versions.
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        path,
        operation: 'onSnapshot'
      };
      console.warn('Dashboard Firestore Warning: ', JSON.stringify(errInfo));
    };

    // Real-time listener for institute settings to ensure branding photo is always up to date
    unsubscribes.push(onSnapshot(doc(db, 'settings', 'institute'), (docSnap) => {
      if (docSnap.exists() && isMounted) {
        setInstituteData(docSnap.data());
      }
    }, (err) => handleSnapshotError(err, 'settings/institute')));

    const fetchData = async () => {
      try {
        let offset = instituteSettings?.jafariOffset || 0;

        try {
          const adjustedDate = new Date();
          if (offset !== 0) {
            adjustedDate.setDate(adjustedDate.getDate() + offset);
          }
          const dateStr = format(adjustedDate, 'dd-MM-yyyy');
          const response = await fetch(`https://api.aladhan.com/v1/gToH/${dateStr}?method=0`); 
          const jDate = await response.json();
          if (isMounted && jDate?.data?.hijri) {
            const h = jDate.data.hijri;
            setJafariDate(`${h.day} ${h.month.en} ${h.year} AH`);
          }
        } catch (e) {
          console.error('Failed to fetch Jafari date', e);
        }

        if (!isMounted) return;

        // Sequence listeners
        if (isStaff) {
          const studentsQuery = isAdmin 
            ? query(collection(db, 'users'), where('role', '==', 'student'))
            : query(collection(db, 'users'), 
                and(
                  where('role', '==', 'student'), 
                  where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])
                )
              );
            
          unsubscribes.push(onSnapshot(studentsQuery, (studentsSnap) => {
            if (!isMounted) return;
            setStats(prev => ({ ...prev, totalStudents: studentsSnap.size }));
          }, (err) => handleSnapshotError(err, 'stats/students')));

          if (isAdmin) {
            unsubscribes.push(onSnapshot(query(collection(db, 'receipts'), where('status', '==', 'pending')), (snap) => {
              if (!isMounted) return;
              setStats(prev => ({ ...prev, pendingFees: snap.size }));
            }, (err) => handleSnapshotError(err, 'stats/pendingFees')));

            unsubscribes.push(onSnapshot(query(collection(db, 'receipts'), where('status', '==', 'approved')), (snap) => {
              if (!isMounted) return;
              const currentMonthStart = format(new Date(), 'yyyy-MM-01');
              const receipts = snap.docs.map(doc => doc.data()).filter((r: any) => ![10000, 20000, 50000].includes(Number(r.amount)));
              const totalAllTime = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              const monthAmount = receipts.filter(r => r.date >= currentMonthStart).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              setStats(prev => ({ ...prev, totalFeesMonth: monthAmount, totalFeesAllTime: totalAllTime }));

              // Calculate trend for last 7 days
              const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return format(d, 'yyyy-MM-dd');
              });

              const trend = last7DaysDates.map(date => {
                const dayAmount = receipts
                  .filter(r => r.date === date)
                  .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                return { name: date, value: dayAmount };
              });
              setCollectionTrendData(trend);
            }, (err) => handleSnapshotError(err, 'stats/approvedFees')));

            unsubscribes.push(onSnapshot(collection(db, 'expenses'), (snap) => {
              if (!isMounted) return;
              const exps = snap.docs.map(doc => doc.data()).filter((e: any) => ![10000, 20000, 50000].includes(Number(e.amount)));
              const totalDebit = exps.filter(e => e.type === 'debit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
              const totalCredit = exps.filter(e => e.type === 'credit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
              setStats(prev => ({ ...prev, totalExpenses: totalDebit, totalCredits: totalCredit }));
            }, (err) => handleSnapshotError(err, 'stats/expenses')));
          }

          unsubscribes.push(onSnapshot(isAdmin 
            ? query(collection(db, 'attendance'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), where('status', '==', 'present'))
            : query(collection(db, 'attendance'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), where('status', '==', 'present'), where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])), 
            (snap) => {
              if (!isMounted) return;
              setStats(prev => ({ ...prev, todayAttendance: snap.size }));
            }, (err) => handleSnapshotError(err, 'stats/todayAttendance')
          ));
        } else {
          unsubscribes.push(onSnapshot(query(collection(db, 'attendance'), where('studentId', '==', user.uid)), (snap) => {
            if (!isMounted) return;
            const totalAt = snap.docs.length;
            const presentAt = snap.docs.filter(d => d.data().status === 'present').length;
            setStats(prev => ({ ...prev, attendanceRate: totalAt > 0 ? Math.round((presentAt / totalAt) * 100) : 0 }));
          }, (err) => handleSnapshotError(err, 'stats/studentAttendance')));
        }

        // 2. Trend Data for Admin
        if (isAdmin) {
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return format(d, 'yyyy-MM-dd');
          }).reverse();

          const qTrend = query(
            collection(db, 'receipts'), 
            where('status', '==', 'approved'),
            where('date', '>=', last7Days[0])
          );

          unsubscribes.push(onSnapshot(qTrend, (snap) => {
            if (!isMounted) return;
            const receipts = snap.docs.map(doc => doc.data());
            const trend = last7Days.map(day => {
              const dayAmount = receipts
                .filter(r => r.date === day)
                .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              return { name: format(new Date(day), 'EEE'), value: dayAmount };
            });
            setCollectionTrendData(trend);
          }, (err) => handleSnapshotError(err, 'stats/trend')));
        }

        // 3. Notifications
        const notifQuery = isStaff 
          ? query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(10))
          : query(
              collection(db, 'notifications'), 
              or(
                where('targetType', '==', 'all'),
                where('targetId', '==', user.uid),
                where('targetId', '==', user.classLevel || 'none')
              ),
              orderBy('createdAt', 'desc'), 
              limit(10)
            );
        
        unsubscribes.push(onSnapshot(notifQuery, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationType[];
          setRecentNotifications(data);
        }, (err) => handleSnapshotError(err, 'notifications')));

        // 4. Events
        const todayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        unsubscribes.push(onSnapshot(query(collection(db, 'events'), where('date', '>=', todayStr), orderBy('date', 'asc'), limit(10)), (snapshot) => {
          if (!isMounted) return;
          const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUpcomingEvents(allEvents);
        }, (err) => handleSnapshotError(err, 'events')));

        // 5. Staff & Admissions
        if (isStaff) {
          unsubscribes.push(onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
            if (!isMounted) return;
            const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            let admissions = allUsers.filter((u: any) => u.role === 'student');
            if (!isAdmin) {
              const classes = user.assignedClasses || [];
              admissions = admissions.filter((u: any) => classes.includes(u.classLevel));
            }
            setStats(prev => ({ ...prev, recentAdmissions: admissions.slice(0, 5) }));
          }, (err) => handleSnapshotError(err, 'users/admissions')));

          unsubscribes.push(onSnapshot(query(collection(db, 'users'), where('role', 'in', ['teacher', 'manager', 'superadmin'])), (snap) => {
            if (!isMounted) return;
            setStaffMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserProfile[]);
            setLoading(false);
            (window as any)._dashboardLoaded = true;
          }, (err) => handleSnapshotError(err, 'users/staff')));
        }

        // 6. Lessons & Queues
        const lessonsSnap = await getDocs(query(collection(db, 'courses'), where('isPublished', '==', true), orderBy('createdAt', 'desc'), limit(6)));
        if (isMounted) {
          setStats(prev => ({ ...prev, availableCourses: lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        }

        if (isStaff) {
          const receiptsQuery = isAdmin 
            ? query(collection(db, 'receipts'), where('status', '==', 'pending'), limit(5))
            : query(collection(db, 'receipts'), and(where('status', '==', 'pending'), where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])), limit(5));
          
          unsubscribes.push(onSnapshot(receiptsQuery, (snapshot) => {
            if (!isMounted) return;
            setPendingReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[]);
          }, (err) => handleSnapshotError(err, 'receipts/pending')));

          const pendingQuery = isAdmin 
            ? query(collection(db, 'users'), where('pendingClassLevel', '!=', null))
            : query(collection(db, 'users'), and(where('pendingClassLevel', '!=', null), where('pendingClassLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])));
          
          unsubscribes.push(onSnapshot(pendingQuery, (snapshot) => {
            if (!isMounted) return;
            setPendingStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
          }, (err) => handleSnapshotError(err, 'users/pendingClasses')));
        }
      } catch (error) {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
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

      {/* Hero Welcome Section - Mockup Styles applied */}
      <Box 
        sx={{ 
          position: 'relative',
          borderRadius: { xs: 4, md: 8 }, 
          overflow: 'hidden',
          mb: 6,
          minHeight: { xs: 400, md: 520 }, 
          display: 'flex',
          bgcolor: '#f1f5f9', // Light gray background from image
          transition: 'all 0.5s ease',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          border: '1px solid rgba(0,0,0,0.05)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            opacity: 0.03, // Subtle "in stitch" texture
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1v38h38V1H1z' fill='%23000' fill-rule='evenodd' opacity='.1'/%3E%3C/svg%3E")`,
            zIndex: 1
          }
        }}
      >
        {/* Left Side: Photo (smiling woman as requested) */}
        <Box sx={{ 
          position: 'absolute', 
          inset: 0, 
          zIndex: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          pointerEvents: 'none'
        }}>
          <img 
            src={instituteData.bannerUrl || ""} 
            alt="Hero Profile" 
            style={{ 
              height: '100%', 
              width: '100%', 
              objectFit: 'cover',
              filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.2))',
              display: instituteData.bannerUrl ? 'block' : 'none'
            }} 
          />
          {!instituteData.bannerUrl && (
            <Box sx={{ 
              width: '100%', 
              height: '100%', 
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${alpha(theme.palette.primary.main, 0.8)} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
               <Typography variant="h2" sx={{ color: 'white', opacity: 0.1, fontWeight: 900, fontFamily: 'var(--font-serif)', letterSpacing: -2 }}>
                {instituteData.name?.toUpperCase()}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Top Left: Badges (Time & Hijri Date) */}
        <Box sx={{ position: 'absolute', top: 32, left: 32, zIndex: 10, textAlign: 'left' }}>
          <Stack direction="column" spacing={1}>
             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)', px: 1.5, py: 0.8, borderRadius: 3, border: '1px solid rgba(0,0,0,0.05)', width: 'fit-content' }}>
               <Clock size={14} className="text-blue-500" />
               <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                 {format12H(currentTime)}
               </Typography>
             </Box>
             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)', px: 1.5, py: 0.8, borderRadius: 3, border: '1px solid rgba(0,0,0,0.05)', width: 'fit-content' }}>
               <span style={{ fontSize: '14px' }}>☪️</span>
               <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '0.7rem' }}>{jafariDate || 'Islamic Date'}</Typography>
             </Box>
          </Stack>
        </Box>

        {/* Right Side Card: Graph Info Card - Dynamic Stats pulse */}
        <Box sx={{ position: 'absolute', bottom: { xs: 120, md: 100 }, right: { xs: 16, md: 32 }, zIndex: 40 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStatIndex}
              initial={{ scale: 0.8, opacity: 0, x: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.8, opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <Card sx={{ 
                bgcolor: currentStat.color, 
                color: 'black', 
                borderRadius: 4, 
                p: { xs: 1.5, md: 2.5 }, 
                width: { xs: 140, md: 200 },
                boxShadow: `0 15px 35px ${alpha(currentStat.color, 0.4)}`,
                border: 'none',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <Stack spacing={0.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <div style={{ padding: 4, borderRadius: 8, background: 'rgba(0,0,0,0.1)' }}>
                      {currentStat.icon}
                    </div>
                    <Typography variant="caption" sx={{ fontWeight: 900, fontSize: { xs: '0.6rem', md: '0.75rem' } }}>{currentStat.label}</Typography>
                  </Box>
                  <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: -2, fontSize: { xs: '1.5rem', md: '3rem' } }}>{currentStat.value}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.7, fontSize: { xs: '0.5rem', md: '0.75rem' } }}>{currentStat.unit} • Current</Typography>
                  
                  {/* Tiny graph visual */}
                  <Box sx={{ pt: 1, height: { xs: 20, md: 40 }, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
                     {currentStat.chart.map((h, i) => (
                       <motion.div 
                         key={i} 
                         initial={{ height: 0 }}
                         animate={{ height: `${h}%` }}
                         transition={{ delay: i * 0.05, duration: 0.5 }}
                         style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '2px 2px 0 0' }} 
                       />
                     ))}
                  </Box>
                </Stack>
              </Card>
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* Bottom Left: Greeting, Name, Title - Smoother blur and updated text */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: 10,
          p: { xs: 3, md: 4 },
          pb: { xs: 2.5, md: 3 }, // Very little bottom padding to ground text
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          textAlign: 'left',
          background: 'linear-gradient(to top, rgba(241, 245, 249, 1) 0%, rgba(241, 245, 249, 0.95) 15%, rgba(241, 245, 249, 0.8) 35%, rgba(241, 245, 249, 0.4) 65%, rgba(241, 245, 249, 0) 100%)',
          backdropFilter: 'blur(6px)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 950, letterSpacing: 2, textTransform: 'uppercase', mb: 0.5 }}>
            Salaam {user.displayName?.split(' ')[0]}
          </Typography>
          <Typography variant="h2" sx={{ fontWeight: 950, color: 'text.primary', letterSpacing: -2, mb: 0, fontSize: { xs: '2.2rem', md: '3.8rem' }, lineHeight: 0.9 }}>
            {user.displayName}
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.secondary', opacity: 0.9, letterSpacing: 0.5 }}>
            {(user.role === 'superadmin') ? 'Muntazim-e-Aala (Admin)' : (isTeacherRole ? 'Ustad (Teacher)' : (isManagerRole ? 'Muntazim' : 'Talib-e-Ilm (Student)'))} @ {instituteData.instituteName || 'Wali Ul Aser'} 
          </Typography>
        </Box>
      </Box>

      {/* Verification Warning for Students */}
      {!user.isVerified && user.role.includes('student') && showVerificationAlert && (
        <Container maxWidth="lg" sx={{ mt: 2, mb: -4, position: 'relative', zIndex: 30 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert 
              severity="warning" 
              icon={<AlertCircle size={24} />}
              onClose={() => setShowVerificationAlert(false)}
              sx={{ 
                borderRadius: 4, 
                fontWeight: 700,
                border: '1px solid',
                borderColor: 'warning.light',
                boxShadow: '0 8px 20px rgba(234, 179, 8, 0.1)',
                '& .MuiAlert-message': { width: '100%' }
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1, justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Your profile is currently under verification. Some features like Fee Payments and Grade Reports will be available once the administration verifies your account.
                </Typography>
                <Button 
                  size="small" 
                  color="warning" 
                  variant="outlined" 
                  onClick={() => navigate('/settings')}
                  sx={{ fontWeight: 900, borderRadius: 2, textTransform: 'none', px: 2, whiteSpace: 'nowrap' }}
                >
                  Complete Profile
                </Button>
              </Box>
            </Alert>
          </motion.div>
        </Container>
      )}

      {/* Quick Action Section - Adjusted for blur change and responsiveness */}
      <Box sx={{ mb: 6, mt: { xs: 8, md: 10 }, position: 'relative', zIndex: 25 }}>
        <Container maxWidth="lg">
          <Grid container spacing={1.5} justifyContent="center">
            {isStaff ? (
              <>
                <Grid size={{ xs: 4, sm: 2.4 }}>
                  <Button 
                    variant="contained" 
                    fullWidth
                    startIcon={<UserPlus size={isMobile ? 12 : 20} />}
                    onClick={() => navigate('/users')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: { xs: 1, sm: 1.5 }, 
                      bgcolor: 'primary.main', 
                      fontSize: { xs: '0.65rem', sm: '0.9rem' },
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 0.5, sm: 0 },
                      boxShadow: '0 10px 25px rgba(13, 148, 136, 0.2)',
                      '&:hover': { transform: 'translateY(-2px)' } 
                    }}
                  >
                    Naya Tulab
                  </Button>
                </Grid>
                <Grid size={{ xs: 4, sm: 2.4 }}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<UserCheck size={isMobile ? 12 : 20} />}
                    onClick={() => navigate('/attendance')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: { xs: 1, sm: 1.5 }, 
                      fontSize: { xs: '0.65rem', sm: '0.9rem' },
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 0.5, sm: 0 },
                      borderWidth: 2,
                      '&:hover': { borderWidth: 2, transform: 'translateY(-2px)' } 
                    }}
                  >
                    Haziri
                  </Button>
                </Grid>
                <Grid size={{ xs: 4, sm: 2.4 }}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Wallet size={isMobile ? 12 : 20} />}
                    onClick={() => navigate('/fees')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: { xs: 1, sm: 1.5 }, 
                      fontSize: { xs: '0.65rem', sm: '0.9rem' },
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 0.5, sm: 0 },
                      borderWidth: 2,
                      '&:hover': { borderWidth: 2, transform: 'translateY(-2px)' } 
                    }}
                  >
                    Maliyat
                  </Button>
                </Grid>
                <Grid size={{ xs: 6, sm: 2.4 }}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<BookOpen size={isMobile ? 12 : 20} />}
                    onClick={() => navigate('/courses')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: { xs: 1, sm: 1.5 }, 
                      fontSize: { xs: '0.65rem', sm: '0.9rem' },
                      borderWidth: 2,
                      '&:hover': { borderWidth: 2, transform: 'translateY(-2px)' } 
                    }}
                  >
                    Nisab
                  </Button>
                </Grid>
                <Grid size={{ xs: 6, sm: 2.4 }}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Bell size={isMobile ? 12 : 20} />}
                    onClick={() => navigate('/notifications')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: { xs: 1, sm: 1.5 }, 
                      fontSize: { xs: '0.65rem', sm: '0.9rem' },
                      borderWidth: 2,
                      '&:hover': { borderWidth: 2, transform: 'translateY(-2px)' } 
                    }}
                  >
                    Ittelaát
                  </Button>
                </Grid>
              </>
            ) : (
              <>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Button 
                    variant="contained" 
                    fullWidth
                    startIcon={<Book size={isMobile ? 16 : 20} />}
                    onClick={() => navigate('/courses')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: 1.5,
                      fontSize: { xs: '0.75rem', sm: '0.9rem' },
                      boxShadow: '0 10px 25px rgba(13, 148, 136, 0.2)',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}
                  >
                    Sabq
                  </Button>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<CreditCard size={isMobile ? 16 : 20} />}
                    onClick={() => navigate('/fees')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: 1.5, 
                      fontSize: { xs: '0.75rem', sm: '0.9rem' },
                      borderWidth: 2,
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}
                  >
                    Fees
                  </Button>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Layout size={isMobile ? 16 : 20} />}
                    onClick={() => navigate('/dashboard')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: 1.5, 
                      fontSize: { xs: '0.75rem', sm: '0.9rem' },
                      borderWidth: 2,
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}
                  >
                    Dashboard
                  </Button>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Calendar size={isMobile ? 16 : 20} />}
                    onClick={() => navigate('/schedule')}
                    sx={{ 
                      borderRadius: 3, 
                      fontWeight: 900, 
                      py: 1.5, 
                      fontSize: { xs: '0.75rem', sm: '0.9rem' },
                      borderWidth: 2,
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}
                  >
                    Table
                  </Button>
                </Grid>
              </>
            )}
          </Grid>
        </Container>
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
              {(isAdmin || permissions.manage_fees) && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatBox title="Revenue" value={`INR ${((stats.totalFeesAllTime || 0) + (stats.totalCredits || 0)).toLocaleString()}`} icon={<ArrowUpRight size={32} />} color="#10b981" />
                </Grid>
              )}
              {(isAdmin || permissions.manage_expenses) && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatBox title="Total Expenses" value={`INR ${(stats.totalExpenses || 0).toLocaleString()}`} icon={<ArrowDownRight size={32} />} color="#ef4444" />
                </Grid>
              )}
              {(isAdmin || permissions.manage_fees) && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatBox title="Net Balance" value={`INR ${((stats.totalFeesAllTime || 0) + (stats.totalCredits || 0) - (stats.totalExpenses || 0)).toLocaleString()}`} icon={<Wallet size={32} />} color="#8b5cf6" />
                </Grid>
              )}
              {(isAdmin || permissions.manage_attendance) && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatBox title="Haziri Today" value={stats.todayAttendance} icon={<UserCheck size={32} />} color="#06b6d4" />
                </Grid>
              )}
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
                <StatBox title="My Class Level" value={user.classLevel || 'Mubtadi'} icon={<Check size={32} />} color="#f59e0b" subtitle="Level of Study" />
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
                            secondary={`Rs.${receipt.amount} • ${format(new Date(receipt.date), 'MMMM yyyy')}`}
                            primaryTypographyProps={{ fontWeight: 800, fontSize: '1rem' }}
                            secondaryTypographyProps={{ fontWeight: 600 }}
                          />
                          <ActionMenu items={actions} />
                        </ListItem>
                      );
                    })}
                    {pendingStudents.map(student => {
                      const actions: ActionMenuItem[] = [
                        { label: 'Approve Tulab', icon: <UserCheck size={18} />, color: 'success.main', onClick: () => handleApproveStudent(student) },
                        { label: 'Reject Tulab', icon: <XCircle size={18} />, color: 'error.main', onClick: () => handleRejectStudent(student) },
                        { label: 'View Details', icon: <ExternalLink size={18} />, onClick: () => { setSelectedTeacher(student); setOpenTeacherProfile(true); } }
                      ];

                      return (
                        <ListItem key={student.uid} divider sx={{ py: 2.5, px: 4 }}>
                          <ListItemText 
                            primary={`${student.displayName} - Naya Tulab`}
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

            {/* Recently Registered Students */}
            {isStaff && stats.recentAdmissions && stats.recentAdmissions.length > 0 && (
              <Box sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Users size={28} />
                  Recently Registered Tulab
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
                Tasdeeq (Status)
              </Typography>
              <Paper sx={{ p: 3, borderRadius: 4, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                <Stack spacing={2}>
                  <ProfileItem label="My Status" value={user.status || 'Active'} icon={<Check size={16} />} />
                  {isAdmin ? (
                    <ProfileItem label="Zimadari (Role)" value={user.role === 'superadmin' ? 'Muntazim-e-Aala' : 'Muntazim'} icon={<Award size={16} />} />
                  ) : (
                    <ProfileItem label="Haziri Score" value={`${stats.attendanceRate}%`} icon={<GraduationCap size={16} />} />
                  )}
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
                        <Stack direction="row" spacing={0.5}>
                          {staff.phone && (
                            <IconButton 
                              size="small" 
                              color="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://wa.me/${staff.phone.replace(/[^0-9]/g, '')}`, '_blank');
                              }}
                              sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.2) } }}
                            >
                              <MessageSquare size={14} />
                            </IconButton>
                          )}
                          <IconButton size="small" onClick={() => showTeacherProfile(staff)}>
                            <ExternalLink size={14} />
                          </IconButton>
                        </Stack>
                      }
                      sx={{ py: 1.5, px: 2, cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) } }}
                    >
                      <ListItemAvatar sx={{ minWidth: 44 }}>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          variant="dot"
                          color="success"
                        >
                          <Avatar src={staff.photoURL} sx={{ width: 36, height: 36, borderRadius: 1.5 }} imgProps={{ referrerPolicy: 'no-referrer' }}>{staff.displayName?.charAt(0)}</Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={staff.displayName} 
                        secondary={
                          <Stack direction="column">
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                              {staff.role === 'superadmin' ? 'Muntazim-e-Aala' : (staff.role === 'teacher' ? 'Ustad' : (staff.role === 'manager' ? 'Muntazim' : 'Zimadar'))}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                              {staff.phone || 'No Contact'}
                            </Typography>
                          </Stack>
                        }
                        primaryTypographyProps={{ fontWeight: 900, fontSize: '0.85rem' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Box>
          </Grid>
        </Grid>

        {/* Bottom Section: Institutional Financial Health (Moved to Bottom) */}
        {isAdmin && collectionTrendData.length > 0 && (
          <Box sx={{ mt: 8, mb: 6 }}>
            <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TrendingUp size={28} />
              Institutional Financial Health
            </Typography>
            <Paper 
              sx={{ 
                p: { xs: 2, md: 4 }, 
                borderRadius: 6, 
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                bgcolor: 'background.paper',
                boxShadow: theme.palette.mode === 'dark' ? '0 20px 40px rgba(0,0,0,0.4)' : '0 10px 30px rgba(0,0,0,0.03)'
              }}
            >
              <Box sx={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={collectionTrendData}>
                    <defs>
                      <linearGradient id="dashboardColorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: theme.palette.text.secondary, fontWeight: 700, fontSize: 11 }} 
                    />
                    <YAxis hide />
                    <RechartsTooltip 
                      contentStyle={{ 
                        borderRadius: 12, 
                        border: 'none', 
                        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                        fontWeight: 900,
                        fontSize: '0.8rem'
                      }} 
                      formatter={(value: any) => [`${value.toLocaleString()}`, 'Amount (INR)']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={theme.palette.primary.main} 
                      strokeWidth={4} 
                      fillOpacity={1} 
                      fill="url(#dashboardColorRev)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Approved funds collected over final 7 business days
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
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
              label={selectedTeacher.role === 'superadmin' ? 'Muntazim-e-Aala' : (selectedTeacher.role === 'teacher' ? 'Ustad' : 'Muntazim')} 
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Card 
      elevation={0}
      sx={{ 
        p: { xs: 2.5, md: 3 }, 
        borderRadius: 4, 
        position: 'relative', 
        overflow: 'hidden', 
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        height: '100%',
        boxShadow: theme.palette.mode === 'dark' 
          ? '0 10px 30px rgba(0,0,0,0.5)' 
          : '0 8px 30px rgba(0,0,0,0.03)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': { 
          transform: 'translateY(-5px)', 
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 15px 40px rgba(0,0,0,0.6)' 
            : '0 15px 40px rgba(13, 148, 136, 0.1)',
          '& .stat-icon-bg': { transform: 'scale(1.1) rotate(10deg)', opacity: 0.08 }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '4px',
          bgcolor: color
        }
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ 
          p: 1.2, 
          borderRadius: 2.5, 
          bgcolor: alpha(color, 0.1), 
          color: color, 
          mb: 2, 
          display: 'inline-flex',
          boxShadow: `0 8px 16px ${alpha(color, 0.2)}`
        }}>
          {React.cloneElement(icon, { size: isMobile ? 20 : 24 })}
        </Box>
        <Typography variant={isMobile ? "h5" : "h4"} sx={{ 
          fontWeight: 950, 
          letterSpacing: -1, 
          mb: 0.1,
          fontFamily: 'var(--font-heading)',
          color: 'text.primary'
        }}>{value}</Typography>
        <Typography variant="caption" sx={{ 
          fontWeight: 900, 
          color: 'text.secondary', 
          textTransform: 'uppercase', 
          letterSpacing: 1.5,
          fontFamily: 'var(--font-heading)',
          fontSize: isMobile ? '0.6rem' : '0.7rem',
          opacity: 0.8
        }}>{title}</Typography>
        {subtitle && <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.disabled', display: 'block', mt: 0.5, fontSize: isMobile ? '0.6rem' : '0.7rem' }}>{subtitle}</Typography>}
      </Box>
      <Box className="stat-icon-bg" sx={{ 
        position: 'absolute', 
        bottom: -20, 
        right: -20, 
        color: color, 
        opacity: 0.04,
        transition: 'all 0.5s ease',
        transformOrigin: 'center'
      }}>
        {React.cloneElement(icon, { size: isMobile ? 80 : 120 })}
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
