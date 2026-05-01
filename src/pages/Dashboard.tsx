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
  UserPlus, BarChart3, User, GraduationCap, Award, Book, CheckCircle, XCircle,
  Wallet, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, where, limit, updateDoc, doc, getDocs, arrayUnion, or, and, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
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
  const { instituteSettings } = useAuth();
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
  const [quote, setQuote] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Real data for charts will be fetched from Firestore
  const [collectionTrendData, setCollectionTrendData] = useState<{name: string, value: number}[]>([]);
  const [attendanceTrendData, setAttendanceTrendData] = useState<{name: string, value: number}[]>([]);
  const [subjectsTrendData, setSubjectsTrendData] = useState<{name: string, value: number}[]>([]);

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [openTeacherProfile, setOpenTeacherProfile] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    // Real-time listener for institute settings to ensure branding photo is always up to date
    unsubscribes.push(onSnapshot(doc(db, 'settings', 'institute'), (docSnap) => {
      if (docSnap.exists() && isMounted) {
        setInstituteData(docSnap.data());
      }
    }));

    const fetchData = async () => {
      try {
        let offset = instituteSettings?.jafariOffset || 0;

        try {
          const adjustedDate = new Date();
          if (offset !== 0) {
            adjustedDate.setDate(adjustedDate.getDate() + offset);
          }
          const dateStr = format(adjustedDate, 'dd-MM-yyyy');
          const response = await fetch(`https://api.aladhan.com/v1/gToH/${dateStr}?method=8`); 
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
            : query(collection(db, 'users'), and(
                where('role', '==', 'student'), 
                or(
                  where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']),
                  where('classLevel', '==', 'Example')
                )
              ));
            
          unsubscribes.push(onSnapshot(studentsQuery, (studentsSnap) => {
            if (!isMounted) return;
            setStats(prev => ({ ...prev, totalStudents: studentsSnap.size }));
          }));

          if (isAdmin) {
            unsubscribes.push(onSnapshot(query(collection(db, 'receipts'), where('status', '==', 'pending')), (snap) => {
              if (!isMounted) return;
              setStats(prev => ({ ...prev, pendingFees: snap.size }));
            }));

            unsubscribes.push(onSnapshot(query(collection(db, 'receipts'), where('status', '==', 'approved')), (snap) => {
              if (!isMounted) return;
              const currentMonthStart = format(new Date(), 'yyyy-MM-01');
              const receipts = snap.docs.map(doc => doc.data());
              const totalAllTime = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              const monthAmount = receipts.filter(r => r.date >= currentMonthStart).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              setStats(prev => ({ ...prev, totalFeesMonth: monthAmount, totalFeesAllTime: totalAllTime }));
            }));

            unsubscribes.push(onSnapshot(collection(db, 'expenses'), (snap) => {
              if (!isMounted) return;
              const exps = snap.docs.map(doc => doc.data());
              const totalDebit = exps.filter(e => e.type === 'debit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
              const totalCredit = exps.filter(e => e.type === 'credit').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
              setStats(prev => ({ ...prev, totalExpenses: totalDebit, totalCredits: totalCredit }));
            }));
          }

          unsubscribes.push(onSnapshot(isAdmin 
            ? query(collection(db, 'attendance'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), where('status', '==', 'present'))
            : query(collection(db, 'attendance'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), where('status', '==', 'present'), where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])), 
            (snap) => {
              if (!isMounted) return;
              setStats(prev => ({ ...prev, todayAttendance: snap.size }));
            }
          ));
        } else {
          unsubscribes.push(onSnapshot(query(collection(db, 'attendance'), where('studentId', '==', user.uid)), (snap) => {
            if (!isMounted) return;
            const totalAt = snap.docs.length;
            const presentAt = snap.docs.filter(d => d.data().status === 'present').length;
            setStats(prev => ({ ...prev, attendanceRate: totalAt > 0 ? Math.round((presentAt / totalAt) * 100) : 0 }));
          }));
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
          }));
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
        }));

        // 4. Events
        const todayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        unsubscribes.push(onSnapshot(query(collection(db, 'events'), where('date', '>=', todayStr), orderBy('date', 'asc'), limit(10)), (snapshot) => {
          if (!isMounted) return;
          const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUpcomingEvents(allEvents);
        }));

        // 5. Staff & Admissions
        if (isStaff) {
          unsubscribes.push(onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
            if (!isMounted) return;
            const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            let admissions = allUsers.filter((u: any) => u.role === 'student');
            if (!isAdmin) {
              const classes = user.assignedClasses || [];
              admissions = admissions.filter((u: any) => classes.includes(u.classLevel) || u.classLevel === 'Example');
            }
            setStats(prev => ({ ...prev, recentAdmissions: admissions.slice(0, 5) }));
          }));

          unsubscribes.push(onSnapshot(query(collection(db, 'users'), where('role', 'in', ['teacher', 'manager', 'superadmin'])), (snap) => {
            if (!isMounted) return;
            setStaffMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserProfile[]);
            setLoading(false);
            (window as any)._dashboardLoaded = true;
          }));
        }

        // 6. Lessons & Queues
        const lessonsSnap = await getDocs(query(collection(db, 'courses'), where('isPublished', '==', true), orderBy('createdAt', 'desc'), limit(6)));
        if (isMounted) {
          setStats(prev => ({ ...prev, availableCourses: lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        }

        if (isStaff) {
          const receiptsQuery = isAdmin 
            ? query(collection(db, 'receipts'), where('status', '==', 'pending'), limit(5))
            : query(collection(db, 'receipts'), and(where('status', '==', 'pending'), or(where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']), where('classLevel', '==', 'Example'))), limit(5));
          
          unsubscribes.push(onSnapshot(receiptsQuery, (snapshot) => {
            if (!isMounted) return;
            setPendingReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[]);
          }));

          const pendingQuery = isAdmin 
            ? query(collection(db, 'users'), where('pendingClassLevel', '!=', null))
            : query(collection(db, 'users'), and(where('pendingClassLevel', '!=', null), or(where('pendingClassLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__']), where('pendingClassLevel', '==', 'Example'))));
          
          unsubscribes.push(onSnapshot(pendingQuery, (snapshot) => {
            if (!isMounted) return;
            setPendingStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
          }));
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

      {/* Hero Welcome Section */}
      <Box 
        sx={{ 
          position: 'relative',
          borderRadius: { xs: 8, md: 32 }, // Significantly rounded corners
          overflow: 'hidden',
          mb: 4,
          minHeight: { xs: '40vh', md: '440px' }, // Increased height by 100px
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          p: { xs: 3, md: 5 },
          pt: { xs: 10, md: 5 },
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundImage: instituteData.bannerUrl 
            ? `url(${instituteData.bannerUrl})` 
            : 'linear-gradient(135deg, #0f172a 0%, #032d29 100%)',
          backgroundClip: 'padding-box', 
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 30px 60px rgba(0,0,0,0.8)' 
            : '0 20px 50px rgba(13, 148, 136, 0.2)',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0, 
            background: 'linear-gradient(rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.7) 100%)',
            zIndex: 1,
            borderRadius: 'inherit'
          },
          mx: { xs: 0, md: 0 }
        }}
      >
        {/* Institute Logo in Hero - Positioned top-left with better visibility and green mark background */}
        {instituteData.logoUrl && (
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ 
              position: 'absolute', 
              top: isMobile ? '12px' : '40px', 
              left: isMobile ? '12px' : '40px', 
              zIndex: 30 
            }}
          >
            {/* Green Mark Ornament */}
            <Box sx={{
              position: 'absolute',
              inset: { xs: -8, md: -12 },
              borderRadius: '50%',
              bgcolor: alpha('#0d9488', 0.2),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha('#0d9488', 0.3)}`,
              zIndex: -1,
              animation: 'pulse 3s infinite'
            }} />

            <Box 
              sx={{ 
                width: { xs: 50, md: 90 }, 
                height: { xs: 50, md: 90 }, 
                bgcolor: 'white', 
                borderRadius: { xs: '16px', md: '24px' }, 
                p: isMobile ? 1 : 1.5,
                boxShadow: '0 15px 45px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid',
                borderColor: '#0d9488',
                position: 'relative'
              }}
            >
              <img 
                src={instituteData.logoUrl} 
                alt="Logo" 
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e: any) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<div style="color:#0f766e"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>';
                }}
              />
            </Box>
          </motion.div>
        )}

        {/* Top Info Bar - Islamic Date Priority */}
        <Box sx={{ 
          position: 'absolute', 
          top: { xs: 12, sm: 32 }, 
          right: { xs: 12, sm: 32 },
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'flex-end', 
          gap: 1.2,
          zIndex: 20,
          pointerEvents: 'none'
        }}>
          <Stack 
            direction="row" 
            spacing={1.2} 
            alignItems="center" 
            sx={{ 
              bgcolor: 'rgba(0,0,0,0.5)', 
              px: { xs: 1.5, md: 2.2 }, 
              py: { xs: 0.8, md: 1.2 }, 
              borderRadius: 100, 
              backdropFilter: 'blur(20px)', 
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              pointerEvents: 'auto'
            }}
          >
            <Calendar size={isMobile ? 12 : 16} style={{ color: theme.palette.primary.main }} />
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 900, fontSize: { xs: '0.65rem', md: '0.9rem' }, letterSpacing: 1, fontFamily: 'var(--font-sans)' }}>
              {jafariDate ? jafariDate.toUpperCase() : 'ISLAMIC DATE'}
            </Typography>
          </Stack>
        </Box>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}
        >
          <Typography 
            variant="h2" 
            sx={{ 
              fontFamily: 'var(--font-heading)', 
              fontWeight: 950, 
              mb: 0.5, 
              color: 'primary.main', 
              textTransform: 'uppercase', 
              letterSpacing: { xs: 1.5, md: 7 },
              textShadow: '0 8px 30px rgba(0,0,0,1)',
              lineHeight: 1,
              fontSize: { xs: '1.4rem', sm: '2.2rem', md: '3.5rem' }
            }}
          >
            {instituteData.instituteName?.toUpperCase() || 'INSTITUTE DASHBOARD'}
          </Typography>
          <Typography 
            variant="h4" 
            sx={{ 
              fontFamily: 'var(--font-serif)',
              fontWeight: 900, 
              color: 'white', 
              mb: { xs: 1.5, md: 3 }, 
              textShadow: '0 4px 15px rgba(0,0,0,1)',
              letterSpacing: 1,
              opacity: 1,
              fontSize: { xs: '0.9rem', sm: '1.4rem', md: '1.8rem' }
            }}
          >
            Assalam-o-Alaikum, {user.displayName}
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              maxWidth: { xs: '90%', md: 700 }, 
              mx: 'auto', 
              color: 'white', 
              fontWeight: 700, 
              mb: { xs: 2, md: 4 },
              fontSize: { xs: '0.75rem', md: '1.1rem' },
              lineHeight: { xs: 1.5, md: 1.8 },
              textShadow: '2px 4px 12px rgba(0,0,0,1)',
              background: 'rgba(0,0,0,0.6)',
              px: { xs: 2, md: 7 },
              py: { xs: 1.5, md: 2.2 },
              borderRadius: { xs: 4, md: 6 },
              backdropFilter: 'blur(25px)',
              border: '1px solid rgba(255,255,255,0.15)',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            {quote ? `"${quote}"` : `"${instituteData.tagline || 'Religious and Academic Excellence'}"`}
          </Typography>
          
          <Stack 
            direction={isMobile ? "column" : "row"} 
            spacing={2} 
            justifyContent="center" 
            sx={{ width: '100%', maxWidth: '550px', mx: 'auto' }}
          >
            {isStaff ? (
              <>
                <Button 
                  variant="contained" 
                  size="medium" 
                  startIcon={<Users size={18} />}
                  onClick={() => navigate('/users')}
                  fullWidth={isMobile}
                  sx={{ 
                    borderRadius: 2, 
                    fontWeight: 700, 
                    px: 4, 
                    py: 1.2, 
                    bgcolor: 'primary.main', 
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-heading)',
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
                    '&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-1px)' } 
                  }}
                >
                  Naya Talib-e-Ilm
                </Button>
                <Button 
                  variant="outlined" 
                  size="medium" 
                  startIcon={<BookOpen size={18} />}
                  onClick={() => navigate('/courses')}
                  fullWidth={isMobile}
                  sx={{ 
                    borderRadius: 2, 
                    fontWeight: 700, 
                    px: 4, 
                    py: 1.2, 
                    color: 'white', 
                    borderColor: 'rgba(255,255,255,0.3)', 
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-heading)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'rgba(255,255,255,0.05)', transform: 'translateY(-1px)' } 
                  }}
                >
                  Sabq (Lessons)
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="contained" 
                  size={isMobile ? "small" : "medium"} 
                  startIcon={<BookOpen size={isMobile ? 14 : 18} />}
                  onClick={() => navigate('/courses')}
                  fullWidth={isMobile}
                  sx={{ 
                    borderRadius: 2, 
                    fontWeight: 800, 
                    px: isMobile ? 3 : 5, 
                    py: isMobile ? 1 : 1.2,
                    fontSize: isMobile ? '0.75rem' : '0.9rem',
                    fontFamily: 'var(--font-heading)',
                    boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
                    '&:hover': { transform: 'translateY(-1px)' }
                  }}
                >
                  Sabq (Lessons)
                </Button>
                <Button 
                  variant="outlined" 
                  size={isMobile ? "small" : "medium"} 
                  startIcon={<CreditCard size={isMobile ? 14 : 18} />}
                  onClick={() => navigate('/fees')}
                  fullWidth={isMobile}
                  sx={{ 
                    borderRadius: 2, 
                    fontWeight: 800, 
                    px: isMobile ? 3 : 5, 
                    py: isMobile ? 1 : 1.2, 
                    color: 'white', 
                    borderColor: 'rgba(255,255,255,0.3)',
                    fontSize: isMobile ? '0.75rem' : '0.9rem',
                    fontFamily: 'var(--font-heading)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': { transform: 'translateY(-1px)', bgcolor: 'rgba(255,255,255,0.05)' }
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
                <StatBox title="Net Balance" value={`Rs.${((stats.totalFeesAllTime || 0) + (stats.totalCredits || 0) - (stats.totalExpenses || 0)).toLocaleString()}`} icon={<Wallet size={32} />} color="#8b5cf6" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatBox title="Kul Aamdani" value={`Rs.${((stats.totalFeesAllTime || 0) + (stats.totalCredits || 0)).toLocaleString()}`} icon={<ArrowUpRight size={32} />} color="#10b981" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatBox title="Expenditure" value={`Rs.${(stats.totalExpenses || 0).toLocaleString()}`} icon={<ArrowDownRight size={32} />} color="#ef4444" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatBox title="Haziri Today" value={stats.todayAttendance} icon={<UserCheck size={32} />} color="#06b6d4" />
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
                <StatBox title="My Class Level" value={user.classLevel || 'Mubtadi'} icon={<Check size={32} />} color="#f59e0b" subtitle="Level of Study" />
              </Grid>
            </>
          )}

          {/* Detailed Content */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Financial Overview for Admins */}
            {isAdmin && collectionTrendData.length > 0 && (
              <Box sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <TrendingUp size={28} />
                  Institutional Financial Health
                </Typography>
                <Paper 
                  sx={{ 
                    p: 4, 
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
                          formatter={(value: any) => [`${value.toLocaleString()}`, 'Amount']}
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Card 
      elevation={0}
      sx={{ 
        p: 2.2, 
        borderRadius: 3, 
        position: 'relative', 
        overflow: 'hidden', 
        border: `1px solid ${alpha(color, 0.15)}`,
        bgcolor: alpha(color, 0.02),
        transition: 'all 0.3s ease',
        '&:hover': { transform: 'translateY(-2px)', bgcolor: alpha(color, 0.04) }
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ color: color, mb: isMobile ? 0.8 : 1.2, display: 'flex' }}>
          {React.cloneElement(icon, { size: isMobile ? 20 : 24 })}
        </Box>
        <Typography variant={isMobile ? "h6" : "h5"} sx={{ 
          fontWeight: 900, 
          letterSpacing: -0.5, 
          mb: 0.1,
          fontFamily: 'var(--font-heading)'
        }}>{value}</Typography>
        <Typography variant="caption" sx={{ 
          fontWeight: 800, 
          color: 'text.secondary', 
          textTransform: 'uppercase', 
          letterSpacing: 1,
          fontFamily: 'var(--font-heading)',
          fontSize: isMobile ? '0.55rem' : '0.6rem',
          opacity: 0.8
        }}>{title}</Typography>
        {subtitle && <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.disabled', display: 'block', mt: 0.2, fontSize: isMobile ? '0.55rem' : '0.6rem' }}>{subtitle}</Typography>}
      </Box>
      <Box sx={{ position: 'absolute', top: -10, right: -10, color: color, opacity: 0.03 }}>
        {React.cloneElement(icon, { size: isMobile ? 50 : 80 })}
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
