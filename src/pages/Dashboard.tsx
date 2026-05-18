import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, Button, 
  Avatar, Chip, Divider, List, ListItem, ListItemText, 
  ListItemAvatar, CircularProgress, IconButton, Tooltip as MuiTooltip,
  Paper, useMediaQuery, Fab, Zoom, Stack, Skeleton, Container,
  Dialog, DialogTitle, DialogContent, DialogActions, Badge, Alert, TextField, Tooltip,
  keyframes
} from '@mui/material';
import LoadingScreen from '../components/LoadingScreen';
import { useTheme, alpha, styled } from '@mui/material/styles';
import { 
  Users, BookOpen, Calendar, CreditCard, Bell, 
  Check, X, Plus, ArrowRight, TrendingUp, Clock, 
  AlertCircle, Send, FileText, ClipboardList, UserCheck, Megaphone, AlertTriangle,
  MoreVertical, ExternalLink, Phone, MessageCircle, MessageSquare,
  UserPlus, BarChart3, User, GraduationCap, Award, Book, CheckCircle, XCircle,
  Wallet, ArrowUpRight, ArrowDownRight, Smartphone, Layout, IndianRupee, RefreshCw,
  Edit, Trash2, Trash, Sparkles, Zap
} from 'lucide-react';
import ImportantNotificationBanner from '../components/ImportantNotificationBanner';
import { 
  db, OperationType, handleFirestoreError,
  collection, query, onSnapshot, orderBy, where, limit, updateDoc, doc, getDocs, arrayUnion, or, and, getDoc, addDoc, deleteDoc
} from '../firebase';
import { UserProfile, FeeReceipt, Notification as NotificationType, Course, InstituteSettings } from '../types';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { safelyFormatDate } from '../lib/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import gsap from 'gsap';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

import { logger } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  const { logout, instituteSettings, permissions } = useAuth();
  const { instituteColors } = useThemeContext();
  const { users: allUsers, receipts: allReceipts, notifications: allNotifs, availableCourses: allCourses, loading: globalLoading, isSyncing } = useData();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const getActionIcon = (icon: React.ReactNode, size: number) => {
    return React.cloneElement(icon as any, { size });
  };

  const [loading, setLoading] = useState(() => {
    if ((window as any)._dashboardLoaded) return false;
    return globalLoading && !localStorage.getItem(`dashboard_stats_${user.uid}`);
  });
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
  const [author, setAuthor] = useState('');
  const [showVerificationAlert, setShowVerificationAlert] = useState(true);

  const format12H = (date: Date) => {
    return format(date, 'hh:mm:ss a');
  };

  const quotes = [];

  const [instituteData, setInstituteData] = useState<Partial<InstituteSettings>>(instituteSettings || {});

  useEffect(() => {
    if (instituteSettings) {
      setInstituteData(instituteSettings);
    }
  }, [instituteSettings]);

  const availableQuotes = useMemo(() => {
    // If instituteData.quotes is an empty array but WAS defined, it means the user cleared it.
    // However, if it's undefined, it's a fresh app or fallback state.
    if (instituteData?.quotes !== undefined && instituteData.quotes !== null) {
      if (Array.isArray(instituteData.quotes)) {
        const filtered = instituteData.quotes.flatMap(q => typeof q === 'string' ? q.split('\n') : [q]).map(q => q.trim()).filter(q => q.length > 0);
        if (filtered.length > 0) return filtered;
        // If it's an empty array, return a default single quote or empty
        return ["Welcome to our Institute Portal."]; 
      }
      if (typeof instituteData.quotes === 'string') {
        const filtered = (instituteData.quotes as string).split('\n').map(q => q.trim()).filter(q => q.length > 0);
        if (filtered.length > 0) return filtered;
      }
    }
    return quotes.length > 0 ? quotes : ["Welcome to our Institute Portal."];
  }, [instituteData.quotes, quotes]);

  const parseQuote = (q: string) => {
    const parts = q.split('—');
    let authorPart = parts[1]?.trim() || '';
    if (authorPart.toLowerCase() === 'unknown') authorPart = '';
    return {
      text: parts[0]?.trim() || '',
      author: authorPart
    };
  };

  const [activeStatIndex, setActiveStatIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (availableQuotes.length > 0) {
      const initial = parseQuote(availableQuotes[activeStatIndex % availableQuotes.length]);
      setQuote(initial.text);
      setAuthor(initial.author);
    }
  }, [activeStatIndex, availableQuotes]);
  
  const instituteStats = useMemo(() => [
    { 
      label: 'Total Students', 
      value: stats.totalStudents || 0, 
      unit: 'Students', 
      icon: <Users size={18} />, 
      color: instituteData.accentColors?.[0] || '#ffcf52', 
      chart: [40, 70, 50, 90, 60, 100, 80] 
    },
    { 
      label: 'Monthly Fund', 
      value: stats.totalFeesMonth ? `${(stats.totalFeesMonth/1000).toFixed(1)}k` : '0', 
      unit: 'INR', 
      icon: <Wallet size={18} />, 
      color: instituteData.accentColors?.[1] || '#4ade80', 
      chart: collectionTrendData.length > 0 ? collectionTrendData.map(d => (d.value / Math.max(...collectionTrendData.map(v => v.value || 1))) * 100) : [60, 40, 80, 50, 90, 70, 100]
    },
    { 
      label: 'Academic Levels', 
      value: stats.totalCourses || 0, 
      unit: 'Classes', 
      icon: <GraduationCap size={18} />, 
      color: instituteData.accentColors?.[2] || '#60a5fa', 
      chart: [30, 60, 40, 80, 50, 100, 70] 
    },
    { 
      label: 'Attendance Rate', 
      value: stats.attendanceRate ? `${stats.attendanceRate}%` : '0%', 
      unit: 'Avg', 
      icon: <CheckCircle size={18} />, 
      color: instituteData.accentColors?.[3] || '#f87171', 
      chart: [80, 90, 85, 100, 95, 98, 99] 
    }
  ], [stats, collectionTrendData, instituteData.accentColors]);

  useEffect(() => {
    if (!allUsers && !allReceipts) return;

    const currentMonthStart = format(new Date(), 'yyyy-MM-01');
    const filteredReceipts = allReceipts;
    const monthAmount = filteredReceipts
      .filter(r => r.status === 'approved' && r.date >= currentMonthStart)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    const students = allUsers.filter(u => u.role === 'student' && u.status !== 'Deleted');
    const staff = allUsers.filter(u => ['teacher', 'manager', 'superadmin'].includes(u.role) && u.status !== 'Deleted');
    
    setStats(prev => {
      const newStats = {
        ...prev,
        totalStudents: students.length,
        totalFeesMonth: monthAmount,
        pendingFees: filteredReceipts.filter(r => r.status === 'pending').length,
        recentAdmissions: students.slice(0, 5),
        availableCourses: allCourses.slice(0, 6)
      };
      localStorage.setItem(`dashboard_stats_${user.uid}`, JSON.stringify(newStats));
      return newStats;
    });
    
    setStaffMembers(staff as UserProfile[]);
    setRecentNotifications(allNotifs.slice(0, 10));
    setPendingReceipts(filteredReceipts.filter(r => r.status === 'pending').slice(0, 5));
    
    if (loading && !globalLoading) setLoading(false);
  }, [allUsers, allReceipts, allNotifs, allCourses, globalLoading]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStatIndex((prev) => (prev + 1) % 4); 
    }, 45000); // Very slow rotation (45 seconds) as requested
    return () => clearInterval(timer);
  }, []);

  const currentStat = instituteStats[activeStatIndex];
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<UserProfile[]>([]);
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);

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
      console.warn(`Snapshot warning for ${path}:`, error);
    };

    unsubscribes.push(onSnapshot(doc(db, 'settings', 'institute'), (docSnap) => {
      if (docSnap.exists() && isMounted) {
        setInstituteData(docSnap.data());
      }
    }, (err) => handleSnapshotError(err, 'settings/institute')));

    const fetchData = async () => {
      try {
        const offset = instituteSettings?.jafariOffset || 0;

        // 1. Hijri Date
        try {
          const adjustedDate = new Date();
          if (offset !== 0) adjustedDate.setDate(adjustedDate.getDate() + offset);
          const dateStr = format(adjustedDate, 'dd-MM-yyyy');
          const response = await fetch(`https://api.aladhan.com/v1/gToH/${dateStr}?method=0`);
          const jDate = await response.json();
          if (isMounted && jDate?.data?.hijri) {
            const h = jDate.data.hijri;
            setJafariDate(`${h.day} ${h.month.en} ${h.year} AH`);
          }
        } catch (e) { console.error('Hijri fetch error', e); }

        if (!isMounted) return;

        // 2. Global Context Data Sync
        if (allUsers.length > 0) {
          const students = allUsers.filter(u => u.role === 'student' && u.status === 'Active');
          const staff = allUsers.filter(u => ['teacher', 'manager', 'superadmin'].includes(u.role));
          setStaffMembers(staff as UserProfile[]);
          setStats(prev => ({ ...prev, totalStudents: students.length, recentAdmissions: students.slice(0, 5) }));
        }

        if (allReceipts.length > 0) {
          const receipts = allReceipts.filter(r => r.status === 'approved');
          const now = new Date();
          const monthAmount = receipts
            .filter(r => {
              const rDate = new Date(r.date);
              return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
            })
            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          
          setStats(prev => ({ 
            ...prev, 
            totalFeesMonth: monthAmount, 
            pendingFees: allReceipts.filter(r => r.status === 'pending').length 
          }));

          const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return format(d, 'yyyy-MM-dd');
          });

          const trend = last7DaysDates.map(date => {
            const dayAmount = allReceipts
              .filter(r => r.date === date && r.status === 'approved')
              .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
            return { name: safelyFormatDate(date, 'EEE'), value: dayAmount };
          });
          setCollectionTrendData(trend);
        }

        // 3. Attendance & Staff Logic
        if (isStaff) {
          unsubscribes.push(onSnapshot(query(collection(db, 'attendance'), where('date', '==', format(new Date(), 'yyyy-MM-dd')), where('status', '==', 'present')), (snap) => {
            if (!isMounted) return;
            setStats(prev => ({ ...prev, todayAttendance: snap.size }));
            const totalActiveStudents = allUsers.filter(u => u.role === 'student' && u.status === 'Active').length;
            const rate = totalActiveStudents > 0 ? Math.round((snap.size / totalActiveStudents) * 100) : 0;
            setStats(prev => ({ ...prev, attendanceRate: rate }));
          }));

          // Pending Receipts & Students for Staff View
          const receiptsQuery = isAdmin 
            ? query(collection(db, 'receipts'), where('status', '==', 'pending'), limit(5))
            : query(collection(db, 'receipts'), and(where('status', '==', 'pending'), where('classLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])), limit(5));
          
          unsubscribes.push(onSnapshot(receiptsQuery, (snap) => {
            if (isMounted) setPendingReceipts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[]);
          }));

          const pendingStudentsQuery = isAdmin 
            ? query(collection(db, 'users'), where('pendingClassLevel', '!=', null))
            : query(collection(db, 'users'), and(where('pendingClassLevel', '!=', null), where('pendingClassLevel', 'in', (user.assignedClasses && user.assignedClasses.length > 0) ? user.assignedClasses : ['__none__'])));
          
          unsubscribes.push(onSnapshot(pendingStudentsQuery, (snap) => {
            if (isMounted) setPendingStudents(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
          }));
        }

        // 4. Lessons & Events
        const lessonsSnap = await getDocs(query(collection(db, 'courses'), where('isPublished', '==', true), orderBy('createdAt', 'desc'), limit(6)));
        if (isMounted) {
          setStats(prev => ({ ...prev, availableCourses: lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() })) }));
          setLoading(false);
          (window as any)._dashboardLoaded = true;
        }

        const todayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        unsubscribes.push(onSnapshot(query(collection(db, 'events'), where('date', '>=', todayStr), orderBy('date', 'asc'), limit(10)), (snap) => {
          if (isMounted) setUpcomingEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }));

      } catch (error) {
        if (isMounted) setLoading(false);
        console.error('fetchData error', error);
      }
    };

    fetchData();
    return () => { isMounted = false; unsubscribes.forEach(u => u()); };
  }, [user?.uid, isStaff, isAdmin, allUsers, allReceipts]);

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
    if (!notif.readBy || !notif.readBy.includes(user.uid)) {
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
    return 'white'; // Default to white for banner overlays with shadows
  };

  const textShadow = '0 2px 4px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)';

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      sx={{ pb: 8, position: 'relative' }}
    >
      <ImportantNotificationBanner />
      {/* Hero Welcome Section - Refined for clarity and design quality */}
      <Box 
        sx={{ 
          position: 'relative',
          borderRadius: { xs: 4, md: 6 }, 
          overflow: 'hidden',
          mb: 0,
          mt: { xs: 8, md: 10, lg: 12 }, // Normalized spacing
          minHeight: { xs: 240, md: 320, xl: 380 }, // Reduced for compact layout
          display: 'flex',
          bgcolor: isDark ? '#050505' : '#f8fafc', 
          transition: 'all 0.5s ease',
          boxShadow: '0 30px 60px rgba(0,0,0,0.12)',
          border: isDark ? '1px solid rgba(255,255,255,0.03)' : 'none',
          maxWidth: '1440px',
          mx: 'auto'
        }}
      >
        {/* Banner Image with better scaling and presence */}
        <Box sx={{ 
          position: 'absolute', 
          inset: 0, 
          zIndex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <img 
            src={instituteData.bannerUrl || ""} 
            alt="Institute Banner" 
            width="100%"
            height="100%"
            loading="eager"
            style={{ 
              height: '100%', 
              width: '100%', 
              objectFit: 'cover',
              objectPosition: 'center 20%',
              opacity: 0.7,
              display: instituteData.bannerUrl ? 'block' : 'none',
            }} 
          />
          
          {/* Multi-layer Gradient Overlay for maximum readability */}
          <Box sx={{ 
            position: 'absolute', 
            inset: 0, 
            background: `linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.8) 100%)`,
            zIndex: 2 
          }} />
          <Box sx={{ 
            position: 'absolute', 
            inset: 0, 
            background: `linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 60%)`,
            zIndex: 2 
          }} />
        </Box>

        {/* Left Content Stack - TOP LEFT to BOTTOM LEFT */}
        <Box sx={{ 
          position: 'absolute', 
          top: { xs: 24, md: 48, xl: 64 },
          bottom: { xs: 24, md: 48, xl: 64 },
          left: { xs: 16, md: 48, xl: 64 },
          zIndex: 40,
          width: { xs: 'calc(100% - 32px)', md: '65%' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          pointerEvents: 'none'
        }}>
          {/* Top Section: Date/Time & Quotes */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5, 
              background: 'rgba(0,0,0,0.6)', 
              px: 2.5, 
              py: 1, 
              borderRadius: 3, 
              backdropFilter: 'blur(10px)',
              whiteSpace: 'nowrap'
            }}>
              <Clock size={16} color="#ffffff" />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 1000, fontFamily: '"JetBrains Mono", monospace', color: 'white', letterSpacing: 0.5, fontSize: { xs: '0.75rem', md: '1rem' } }}>
                  {format(currentTime, 'hh:mm:ss a')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 1000, fontFamily: '"JetBrains Mono", monospace', color: alpha('#ffffff', 0.6), fontSize: { xs: '0.75rem', md: '0.9rem' } }}>
                  |
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 1000, fontFamily: '"JetBrains Mono", monospace', color: 'white', letterSpacing: 0.5, fontSize: { xs: '0.75rem', md: '1rem' } }}>
                  {format(currentTime, 'EEE, MMM d, yyyy')}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ width: '100%', maxWidth: 1000 }}>
              <AnimatePresence mode="wait">
                 <motion.div
                   key={quote}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 20 }}
                   transition={{ duration: 1.2 }}
                 >
                   <Typography 
                     variant="h5" 
                     sx={{ 
                       fontWeight: 800, 
                       color: 'white', 
                       fontStyle: 'italic',
                       lineHeight: 1.4,
                       display: '-webkit-box',
                       WebkitLineClamp: 2, // Limit to 2 paragraphs/lines as requested
                       WebkitBoxOrient: 'vertical',
                       overflow: 'hidden',
                       fontFamily: '"Cinzel Decorative", serif',
                       fontSize: { xs: '0.9rem', md: '1.5rem' },
                       textAlign: 'left',
                       textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                     }}
                   >
                     "{quote}"
                   </Typography>
                   <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 1000, letterSpacing: 2, textTransform: 'uppercase', mt: 1, display: 'block', textAlign: 'left' }}>
                     — {author}
                   </Typography>
                 </motion.div>
              </AnimatePresence>
            </Box>
          </Box>

          {/* Bottom Section: Welcome Greeting */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 1000, 
              color: 'white', 
              letterSpacing: -0.5, 
              fontSize: { xs: '1.2rem', md: '2.5rem' },
              lineHeight: 1.1,
              fontFamily: '"Cinzel Decorative", serif',
              mb: 0.5,
              textAlign: 'left'
            }}>
              {instituteData.greeting ? instituteData.greeting.replace('{name}', user.displayName?.split(' ')[0] || '') : `Salaam, ${user.displayName?.split(' ')[0]}`}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: alpha('#fff', 0.9), 
              fontWeight: 800, 
              fontFamily: '"Cinzel Decorative", serif',
              letterSpacing: 2,
              fontSize: { xs: '0.65rem', md: '0.9rem' },
              textTransform: 'uppercase',
              opacity: 0.8,
              textAlign: 'left'
            }}>
              {instituteData.tagline || ''}
            </Typography>
          </motion.div>
        </Box>

        {/* Stats Card - BOTTOM RIGHT */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: { xs: 24, md: 48, xl: 64 },
          right: { xs: 16, md: 48, xl: 64 },
          zIndex: 40,
          width: { xs: 180, sm: 280 },
          display: { xs: 'none', sm: 'flex' }, // Hide on mobile for better greeting space
          flexDirection: 'column',
          gap: 2,
          alignItems: 'flex-end',
          pointerEvents: 'none'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStatIndex}
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -10 }}
              transition={{ duration: 1.2 }}
              style={{ width: '100%', pointerEvents: 'auto' }}
            >
              <Card sx={{ 
                bgcolor: 'rgba(0,0,0,0.85)', 
                color: 'white', 
                borderRadius: 4, 
                p: { xs: 1.5, md: 2 }, 
                width: '100%',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                justifyContent: 'space-between',
                boxShadow: 'none', // Removed shadow
                '&:hover': { transform: 'none', boxShadow: 'none' } // Removed hover
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: 2, 
                    background: alpha(currentStat.color, 0.2),
                    color: currentStat.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {React.cloneElement(currentStat.icon as React.ReactElement<any>, { size: 16 })}
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 950, fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 2 }}>
                      {currentStat.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 1000, letterSpacing: -0.5, fontSize: '1.2rem', fontFamily: '"Cinzel", serif', lineHeight: 1, mt: 0.2 }}>
                      {currentStat.value}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </motion.div>
          </AnimatePresence>
        </Box>

      </Box>

      {/* Verification or Profile Completion Warning for Students */}
      {user.role === 'student' && showVerificationAlert && (instituteSettings?.portalSettings?.student?.showNotifications ?? true) && (!user.isVerified || !(user.dob && user.fatherName && user.motherName && user.address && user.phone)) && (
        <Container maxWidth="lg" sx={{ mt: 2, mb: -4, position: 'relative', zIndex: 30 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert 
              severity={(!user.dob || !user.fatherName || !user.motherName) ? "info" : "warning"} 
              icon={<AlertCircle size={24} />}
              onClose={() => setShowVerificationAlert(false)}
              sx={{ 
                borderRadius: 4, 
                fontWeight: 700,
                border: '1px solid',
                borderColor: (!user.dob || !user.fatherName || !user.motherName) ? 'info.light' : 'warning.light',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.05)',
                '& .MuiAlert-message': { width: '100%' }
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1, justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {!user.isVerified 
                    ? "Your profile is under verification. Once approved, your Admission No. will be generated." 
                    : "Please complete your profile details (DOB, parent names, address) for official records."}
                </Typography>
                <Button 
                  size="small" 
                  color={(!user.dob || !user.fatherName) ? "info" : "warning"}
                  variant="contained" 
                  onClick={() => navigate('/profile')}
                  sx={{ fontWeight: 900, borderRadius: 2, textTransform: 'none', px: 2, whiteSpace: 'nowrap', boxShadow: 'none' }}
                >
                  COMPLETE PROFILE
                </Button>
              </Box>
            </Alert>
          </motion.div>
        </Container>
      )}

      {/* Quick Action Section - Adjusted for blur change and responsiveness */}
      <Box sx={{ mb: 4, mt: { xs: 4, md: 6 }, position: 'relative', zIndex: 25 }}>
        <Container maxWidth="lg">
          <Grid container spacing={2} justifyContent="center">
            {isAdmin ? (
              // Manager/Admin Actions
              <>
                {[
                  { label: 'Users', path: '/users', icon: <Users size={18} /> },
                  { label: 'Fees', path: '/fees', icon: <IndianRupee size={18} /> },
                  { label: 'Expenses', path: '/expenses', icon: <TrendingUp size={18} /> },
                  { label: 'Reports', path: '/reports', icon: <BarChart3 size={18} /> },
                  { label: 'Courses', path: '/courses', icon: <BookOpen size={18} /> },
                  { label: 'Settings', path: '/settings', icon: <Layout size={18} /> },
                ].map((action, i) => (
                  <Grid key={i} size={{ xs: 4, sm: 2 }}>
                    <Button 
                      variant="contained"
                      fullWidth
                      onClick={() => navigate(action.path)}
                      sx={{ 
                        borderRadius: 1, 
                        fontWeight: 950, 
                        py: { xs: 1.5, sm: 3 }, 
                        flexDirection: 'column',
                        gap: { xs: 1, sm: 1.5 },
                        color: 'white',
                        background: [
                          `linear-gradient(135deg, ${instituteColors.primary} 0%, ${alpha(instituteColors.primary, 0.8)} 100%)`,
                          `linear-gradient(135deg, ${instituteColors.accent1} 0%, ${alpha(instituteColors.accent1, 0.9)} 100%)`,
                          `linear-gradient(135deg, ${instituteColors.accent2} 0%, ${alpha(instituteColors.accent2, 0.8)} 100%)`,
                          'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                          'linear-gradient(135deg, #db2777 0%, #9d174d 100%)',
                          'linear-gradient(135deg, #0891b2 0%, #155e75 100%)'
                        ][i % 6],
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        fontSize: { xs: '0.65rem', sm: '0.85rem' },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': { 
                          filter: 'none',
                          transform: 'none',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                        },
                        '&:active': { transform: 'scale(1)' }
                      }}
                    >
                      <Box sx={{ 
                        p: { xs: 0.6, sm: 1 }, 
                        borderRadius: 1, 
                        bgcolor: 'rgba(255,255,255,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                       }}>
                         {getActionIcon(action.icon, isMobile ? 14 : 18)}
                      </Box>
                      {action.label}
                    </Button>
                  </Grid>
                ))}
              </>
            ) : isTeacherRole ? (
              // Teacher Actions
              (instituteSettings?.portalSettings?.teacher?.showQuickActions ?? true) && (
              <>
                {[
                  { label: 'Attendance', path: '/attendance', icon: <UserCheck size={18} /> },
                  { label: 'Courses', path: '/courses', icon: <BookOpen size={18} /> },
                  { label: 'Exams', path: '/exams', icon: <FileText size={18} /> },
                  { label: 'Schedule', path: '/schedule', icon: <Calendar size={18} /> },
                  { label: 'Forms', path: '/forms', icon: <ClipboardList size={18} /> },
                  { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
                ].map((action, i) => (
                  <Grid key={i} size={{ xs: 4, sm: 2 }}>
                    <Button 
                      variant="contained"
                      fullWidth
                      onClick={() => navigate(action.path)}
                      sx={{ 
                        borderRadius: 1, 
                        fontWeight: 950, 
                        py: { xs: 1.5, sm: 3 }, 
                        flexDirection: 'column',
                        gap: { xs: 1, sm: 1.5 },
                        color: 'white',
                        background: [
                          `linear-gradient(135deg, ${instituteColors.primary} 0%, ${alpha(instituteColors.primary, 0.8)} 100%)`,
                          `linear-gradient(135deg, ${instituteColors.accent1} 0%, ${alpha(instituteColors.accent1, 0.9)} 100%)`,
                          `linear-gradient(135deg, ${instituteColors.accent2} 0%, ${alpha(instituteColors.accent2, 0.8)} 100%)`,
                          `linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)`,
                          `linear-gradient(135deg, #db2777 0%, #9d174d 100%)`,
                          `linear-gradient(135deg, #0891b2 0%, #155e75 100%)`
                        ][i % 6],
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        fontSize: { xs: '0.65rem', sm: '0.85rem' },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': { 
                          filter: 'none',
                          transform: 'none',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                        },
                        '&:active': { transform: 'scale(1)' }
                      }}
                    >
                      <Box sx={{ 
                        p: { xs: 0.6, sm: 1 }, 
                        borderRadius: 1, 
                        bgcolor: 'rgba(255,255,255,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                       }}>
                         {getActionIcon(action.icon, isMobile ? 14 : 18)}
                      </Box>
                      {action.label}
                    </Button>
                  </Grid>
                ))}
              </>
              )
            ) : (
              // Student Actions
              (instituteSettings?.portalSettings?.student?.showQuickActions ?? true) && (
              <>
                {[
                  { label: 'My Courses', path: '/courses', icon: <BookOpen size={18} /> },
                  { label: 'Exams', path: '/exams', icon: <FileText size={18} /> },
                  { label: 'My Fees', path: '/fees', icon: <IndianRupee size={18} /> },
                  { label: 'Schedule', path: '/schedule', icon: <Calendar size={18} /> },
                  { label: 'Forms', path: '/forms', icon: <ClipboardList size={18} /> },
                  { label: 'My Profile', path: '/profile', icon: <User size={18} /> },
                ].map((action, i) => (
                  <Grid key={i} size={{ xs: 4, sm: 2 }}>
                    <Button 
                      variant="contained"
                      fullWidth
                      onClick={() => navigate(action.path)}
                      sx={{ 
                        borderRadius: 1, 
                        fontWeight: 950, 
                        py: { xs: 1.5, sm: 3 }, 
                        flexDirection: 'column',
                        gap: { xs: 1, sm: 1.5 },
                        color: 'white',
                        background: [
                          `linear-gradient(135deg, ${instituteColors.primary} 0%, ${alpha(instituteColors.primary, 0.8)} 100%)`,
                          `linear-gradient(135deg, ${instituteColors.accent1} 0%, ${alpha(instituteColors.accent1, 0.9)} 100%)`,
                          `linear-gradient(135deg, ${instituteColors.accent2} 0%, ${alpha(instituteColors.accent2, 0.8)} 100%)`,
                          'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                          'linear-gradient(135deg, #db2777 0%, #9d174d 100%)',
                          'linear-gradient(135deg, #0891b2 0%, #155e75 100%)',
                          'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                          'linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)',
                          'linear-gradient(135deg, #06b6d4 0%, #155e75 100%)'
                        ][i % 9],
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        fontSize: { xs: '0.65rem', sm: '0.85rem' },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': { 
                          filter: 'none',
                          transform: 'none',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                        },
                        '&:active': { transform: 'scale(1)' }
                      }}
                    >
                      <Box sx={{ 
                        p: { xs: 0.6, sm: 1 }, 
                        borderRadius: 1, 
                        bgcolor: 'rgba(255,255,255,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                       }}>
                         {getActionIcon(action.icon, isMobile ? 14 : 18)}
                      </Box>
                      {action.label}
                    </Button>
                  </Grid>
                ))}
              </>
              )
            )}
          </Grid>
        </Container>
      </Box>

      {/* Institutional Financial Health (Moved to Top as per user request) */}
      {isAdmin && collectionTrendData.length > 0 && (
        <Container maxWidth="lg" sx={{ mb: 6, mt: 4 }}>
          <Typography variant="h6" sx={{ fontFamily: '"Cinzel Decorative", serif', fontWeight: 900, mb: 4, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TrendingUp size={28} />
            Financial Health
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
                      <stop offset="5%" stopColor={instituteData.accentColors?.[1] || theme.palette.primary.main} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={instituteData.accentColors?.[1] || theme.palette.primary.main} stopOpacity={0}/>
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
                    stroke={instituteData.accentColors?.[1] || theme.palette.primary.main} 
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
        </Container>
      )}

      {/* Reports / Actions Needed Section */}
      <Container maxWidth="lg" sx={{ mb: 6 }}>
        {isStaff && (isAdmin || (instituteSettings?.portalSettings?.teacher?.showPendingActions ?? true)) && (pendingReceipts.length > 0 || pendingStudents.length > 0) && (
          <Box sx={{ mb: 6 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 4, color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AlertTriangle size={28} />
              Reports & Pending Actions
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
                        secondary={`Rs.${receipt.amount} • ${safelyFormatDate(receipt.date, 'MMMM yyyy')}`}
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
                        primary={`${student.displayName} - New Student`}
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
      </Container>

      {/* Staff Members Section */}
      <Container maxWidth="lg" sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ fontFamily: '"Cinzel Decorative", serif', fontWeight: 900, mb: 4, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <User size={28} />
            Staff Members
          </Typography>
        <Paper 
          sx={{ 
            borderRadius: 4, 
            overflow: 'hidden', 
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: 'background.paper',
            p: 1
          }}
        >
          <Grid container spacing={1}>
            {staffMembers.map((staff) => (
              <Grid key={staff.uid} size={{ xs: 12, sm: 6, md: 4 }}>
                <ListItem 
                  onClick={() => showTeacherProfile(staff)}
                  sx={{ 
                    py: 1.5, 
                    px: 2, 
                    cursor: 'pointer', 
                    borderRadius: 2,
                    transition: '0.2s',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) } 
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 50 }}>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      variant="dot"
                      color="success"
                    >
                      <Avatar 
                        src={staff.photoURL} 
                        sx={{ width: 40, height: 40, borderRadius: 1.5, border: `2px solid ${alpha(theme.palette.primary.main, 0.1)}` }} 
                        imgProps={{ referrerPolicy: 'no-referrer' }}
                      >
                        {staff.displayName?.charAt(0)}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={staff.displayName} 
                    secondary={staff.role === 'superadmin' ? 'Head of Institute' : (staff.role === 'teacher' ? 'Teacher' : 'Staff')}
                    primaryTypographyProps={{ fontWeight: 900, fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.7rem', fontWeight: 700, color: 'primary.main', textTransform: 'uppercase' }}
                  />
                  <IconButton size="small">
                    <ExternalLink size={14} />
                  </IconButton>
                </ListItem>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Container>

      {/* Recently Registered Students Section */}
      <Container maxWidth="lg" sx={{ mb: 6 }}>
        {isStaff && stats.recentAdmissions && stats.recentAdmissions.length > 0 && (
          <Box>
            <Typography variant="h6" sx={{ fontFamily: '"Cinzel Decorative", serif', fontWeight: 900, mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <UserPlus size={24} />
              Recent Registrations
            </Typography>
            <Paper 
              elevation={0}
              sx={{ 
                borderRadius: 4, 
                overflow: 'hidden', 
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: theme.palette.mode === 'dark' ? '4px 4px 12px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)'
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
                      } 
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar src={student.photoURL} sx={{ width: 44, height: 44, borderRadius: 1.5 }} imgProps={{ referrerPolicy: 'no-referrer' }}>{student.displayName?.charAt(0)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={student.displayName}
                      secondary={`Admission No: ${student.admissionNo || 'N/A'} • Level: ${student.classLevel || 'N/A'}`}
                      primaryTypographyProps={{ fontWeight: 900, fontSize: '1rem' }}
                      secondaryTypographyProps={{ fontWeight: 700, fontSize: '0.75rem' }}
                    />
                    <IconButton size="small">
                      <ArrowRight size={18} />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}
      </Container>

      {/* Subject-Specific Classes / Educational Resources Section */}
      <Container maxWidth="lg" sx={{ mb: 6 }}>
        {isTeacherRole && user.assignedClasses && user.assignedClasses.length > 0 && (
          <Box sx={{ mb: 6 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Cinzel Decorative", serif', fontWeight: 900, mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Layout size={24} />
              My Assigned Classes
            </Typography>
            <Grid container spacing={2}>
              {user.assignedClasses.map((cls, idx) => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={idx}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      borderRadius: 4, 
                      p: 2, 
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      bgcolor: alpha(theme.palette.primary.main, 0.02),
                      '&:hover': {
                         bgcolor: alpha(theme.palette.primary.main, 0.05),
                         transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.2s'
                    }}
                    onClick={() => navigate('/attendance')}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 900, color: 'primary.main' }}>{cls}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.7 }}>CLASS LEVEL</Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {!isStaff && (instituteSettings?.portalSettings?.student?.showEnrolledSubjects ?? true) && user.subjectsEnrolled && user.subjectsEnrolled.length > 0 && (
          <Box sx={{ mb: 6 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Cinzel Decorative", serif', fontWeight: 900, mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <BookOpen size={24} />
              My Enrolled Subjects
            </Typography>
            <Grid container spacing={2}>
              {user.subjectsEnrolled.map((subject, idx) => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={idx}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      borderRadius: 4, 
                      p: 2, 
                      textAlign: 'center',
                      border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                      bgcolor: alpha(theme.palette.secondary.main, 0.02),
                      '&:hover': {
                         bgcolor: alpha(theme.palette.secondary.main, 0.05),
                      },
                      transition: '0.2s'
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, color: 'secondary.main' }}>{subject}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.7 }}>CORE SUBJECT</Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {stats.availableCourses.length > 0 && (
          <Box>
            <Typography variant="h6" sx={{ fontFamily: '"Cinzel Decorative", serif', fontWeight: 900, mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <BookOpen size={24} />
              Subject Resources
            </Typography>
            <Grid container spacing={3}>
              {stats.availableCourses.map((course: any) => (
                <Grid size={{ xs: 12, sm: 4 }} key={course.id}>
                  <Card 
                    onClick={() => navigate(`/courses/${course.id}`)}
                    sx={{ 
                      borderRadius: 4, 
                      overflow: 'hidden', 
                      cursor: 'pointer',
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, 
                      transition: '0.2s', 
                      '&:hover': { boxShadow: '0 8px 20px rgba(0,0,0,0.1)' } 
                    }}
                  >
                    <Box sx={{ height: 120, bgcolor: 'primary.main', backgroundImage: course.thumbnailUrl ? `url(${course.thumbnailUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5 }}>{course.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{course.description}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Container>

      {/* Side Scrolling Events (Keep with normal tilt) */}
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
              zIndex: 0
            }
          }}
        >
          <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Calendar size={20} className="text-teal-600" /> Upcoming Events ({upcomingEvents.length})
              </Typography>
              <Button 
                size="small" 
                onClick={() => navigate('/schedule')} 
                sx={{ 
                  fontWeight: 900,
                  color: 'primary.main',
                  borderRadius: 2,
                  px: 2,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1)
                  }
                }}
              >
                View All
              </Button>
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
                      transition: '0.2s',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Chip 
                        label={safelyFormatDate(event.date)} 
                        size="small" 
                        color="secondary" 
                        sx={{ 
                          mb: 2, 
                          fontWeight: 900, 
                          borderRadius: 1.5, 
                          fontSize: '0.7rem',
                          background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${alpha(theme.palette.secondary.main, 0.8)} 100%)`
                        }} 
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
        <Grid container spacing={4} sx={{ mb: 4 }}>
          {isStaff ? (
            <>
              {(isAdmin || (instituteSettings?.portalSettings?.teacher?.showRevenueStats ?? true) || permissions.manage_fees) && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatBox isMobile={isMobile} title="Revenue" value={`INR ${(stats.totalCredits || 0).toLocaleString()}`} icon={<ArrowUpRight size={32} />} color={instituteData.accentColors?.[0] || "#10b981"} />
                </Grid>
              )}
              {(isAdmin || permissions.manage_expenses) && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatBox isMobile={isMobile} title="Total Expenses" value={`INR ${(stats.totalExpenses || 0).toLocaleString()}`} icon={<ArrowDownRight size={32} />} color={instituteData.accentColors?.[3] || "#ef4444"} />
                </Grid>
              )}
              {(isAdmin || (instituteSettings?.portalSettings?.teacher?.showRevenueStats ?? true) || permissions.manage_fees) && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatBox isMobile={isMobile} title="Net Balance" value={`INR ${((stats.totalCredits || 0) - (stats.totalExpenses || 0)).toLocaleString()}`} icon={<Wallet size={32} />} color={instituteData.accentColors?.[2] || "#8b5cf6"} />
                </Grid>
              )}
              {(isAdmin || (instituteSettings?.portalSettings?.teacher?.showAttendanceStats ?? true) || permissions.manage_attendance) && (
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatBox isMobile={isMobile} title="Attendance Today" value={stats.todayAttendance} icon={<UserCheck size={32} />} color={instituteData.accentColors?.[1] || "#06b6d4"} />
                </Grid>
              )}
            </>
          ) : (
            <>
              {(instituteSettings?.portalSettings?.student?.showDashboardStats ?? true) && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <StatBox isMobile={isMobile} title="My Attendance" value={`${stats.attendanceRate}%`} icon={<TrendingUp size={32} />} color={instituteData.accentColors?.[0] || "#10b981"} subtitle="Regularity Score" />
                </Grid>
              )}
              <Grid size={{ xs: 12, md: 4 }}>
                <StatBox isMobile={isMobile} title="Active Lessons" value={user.subjectsEnrolled?.length || 0} icon={<BookOpen size={32} />} color={instituteData.accentColors?.[1] || "#3b82f6"} subtitle="Current Topics" />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <StatBox isMobile={isMobile} title="My Class Level" value={user.classLevel || 'Intermediate'} icon={<Check size={32} />} color={instituteData.accentColors?.[2] || "#f59e0b"} subtitle="Level of Study" />
              </Grid>
            </>
          )}
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
              ? 'linear-gradient(145deg, #050505, #0d0d0d)' 
              : 'linear-gradient(145deg, #f8fafc, #f1f5f9)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: theme.shadows[24],
            overflow: 'visible'
          }
        }}
      >
        <Box sx={{ position: 'absolute', top: -15, right: -15, zIndex: 10 }}>
          <IconButton 
            onClick={() => setOpenTeacherProfile(false)}
            sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' }, boxShadow: 6, width: 44, height: 44 }}
          >
            <X size={20} />
          </IconButton>
        </Box>

        {selectedTeacher && (
          <Box sx={{ position: 'relative' }}>
            {/* Header / Background Cover */}
            <Box sx={{ 
              height: 120, 
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              borderRadius: '24px 24px 0 0',
              opacity: 0.9,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Box sx={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
            </Box>

            <Box sx={{ px: 4, pb: 4, mt: -7, textAlign: 'center' }}>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                <Avatar 
                  src={selectedTeacher.photoURL} 
                  sx={{ 
                    width: 120, height: 120, mx: 'auto', mb: 2, 
                    border: `6px solid ${theme.palette.background.paper}`,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                    bgcolor: 'primary.main',
                    fontSize: '3rem',
                    fontWeight: 950
                  }}
                  imgProps={{ referrerPolicy: 'no-referrer' }}
                >
                  {selectedTeacher.displayName?.charAt(0)}
                </Avatar>
              </motion.div>

              <Typography variant="h5" sx={{ fontWeight: 950, mb: 0.5, letterSpacing: -1 }}>
                {selectedTeacher.displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, mb: 3 }}>
                @{selectedTeacher.role === 'superadmin' ? 'Head of Institute' : (selectedTeacher.role === 'teacher' ? 'Faculty Member' : 'System Manager')}
              </Typography>

              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 4 }}>
                <Chip icon={<Award size={14} />} label={selectedTeacher.subject || 'Theology'} size="small" sx={{ fontWeight: 900, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', border: 'none' }} />
                <Chip icon={<UserCheck size={14} />} label="Verified" size="small" color="success" sx={{ fontWeight: 900, borderRadius: 1.5 }} />
              </Stack>

              <Grid container spacing={1.5} sx={{ mb: 4 }}>
                {[
                  { label: 'Specialization', value: selectedTeacher.subject || 'Islamic Sciences', icon: <Book size={18} /> },
                  { label: 'Member Since', value: format(new Date(selectedTeacher.createdAt || Date.now()), 'MMMM yyyy'), icon: <Calendar size={18} /> },
                  { label: 'Contact Access', value: selectedTeacher.email, icon: <MessageSquare size={18} /> }
                ].map((item, idx) => (
                  <Grid size={{ xs: 12 }} key={idx}>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                      <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                        {item.icon}
                      </Box>
                      <Box textAlign="left">
                        <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>{item.label}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.value}</Typography>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Button 
                fullWidth 
                variant="contained" 
                onClick={() => setOpenTeacherProfile(false)}
                sx={{ 
                  borderRadius: 3, py: 1.5, fontWeight: 950, fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: `0 10px 20px ${alpha(theme.palette.primary.main, 0.3)}`
                }}
              >
                Done
              </Button>
            </Box>
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
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>{title}</Typography>
      </CardContent>
    </Card>
  );
}

function StatBox({ title, value, icon, color, subtitle, isMobile }: any) {
  const theme = useTheme();
  return (
    <Card 
      elevation={0}
      sx={{ 
        p: { xs: 2.2, md: 3 }, 
        borderRadius: 4, 
        position: 'relative', 
        overflow: 'hidden', 
        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        height: '100%',
        boxShadow: theme.palette.mode === 'dark' 
          ? '0 6px 20px rgba(0,0,0,0.4)' 
          : '0 4px 15px rgba(0,0,0,0.02)',
        transition: 'all 0.2s ease',
        '&:hover': { 
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 12px 30px rgba(0,0,0,0.5)' 
            : '0 10px 30px rgba(13, 148, 136, 0.08)',
          '& .stat-icon-bg': { transform: 'scale(1.1) rotate(10deg)', opacity: 0.07 }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '3px',
          bgcolor: color
        }
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ 
          p: 1.1, 
          borderRadius: 2, 
          bgcolor: alpha(color, 0.1), 
          color: color, 
          mb: 1.5, 
          display: 'inline-flex',
          boxShadow: `0 6px 12px ${alpha(color, 0.15)}`
        }}>
          {React.cloneElement(icon, { size: isMobile ? 18 : 22 })}
        </Box>
        <Typography variant={isMobile ? "subtitle1" : "h5"} sx={{ 
          fontWeight: 950, 
          letterSpacing: -0.5, 
          mb: 0.1,
          fontFamily: '"Cinzel Decorative", serif',
          color: 'text.primary'
        }}>{value}</Typography>
        <Typography variant="caption" sx={{ 
          fontWeight: 800, 
          color: 'text.secondary', 
          textTransform: 'uppercase', 
          letterSpacing: 1,
          fontFamily: '"Cinzel Decorative", serif',
          fontSize: isMobile ? '0.55rem' : '0.65rem',
          opacity: 0.8
        }}>{title}</Typography>
        {subtitle && <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.disabled', display: 'block', mt: 0.3, fontSize: isMobile ? '0.55rem' : '0.65rem' }}>{subtitle}</Typography>}
      </Box>
      <Box className="stat-icon-bg" sx={{ 
        position: 'absolute', 
        bottom: -15, 
        right: -15, 
        color: color, 
        opacity: 0.03,
        transition: 'all 0.5s ease',
        transformOrigin: 'center'
      }}>
        {React.cloneElement(icon, { size: isMobile ? 60 : 100 })}
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
function FabAction({ label, icon, color, onClick, delay, isMobile }: any) {
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

function PendingApprovals({ users, onRefresh }: { users: UserProfile[], onRefresh: () => void }) {
  const theme = useTheme();
  const pendingTeachers = users.filter(u => u.role === 'teacher' && u.pendingProfileChanges);

  const handleApprove = async (userId: string, changes: any) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...changes,
        pendingProfileChanges: null,
        updatedAt: new Date().toISOString()
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to approve changes", err);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        pendingProfileChanges: null,
        updatedAt: new Date().toISOString()
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to reject changes", err);
    }
  };

  if (pendingTeachers.length === 0) return null;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: 'var(--font-serif)', fontWeight: 800, mb: 3, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
        <AlertCircle size={20} /> Pending Approvals
      </Typography>
      <Stack spacing={2}>
        {pendingTeachers.map((teacher) => (
          <Paper 
            key={teacher.uid} 
            sx={{ 
              p: 2.5, 
              borderRadius: 3, 
              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
              bgcolor: alpha(theme.palette.error.main, 0.02)
            }}
          >
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Avatar src={teacher.photoURL} sx={{ width: 44, height: 44, borderRadius: 1.5 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{teacher.displayName}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1.5 }}>
                  Requested profile updates:
                </Typography>
                <Stack spacing={1}>
                  {teacher.pendingProfileChanges?.profession && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip label="Profession" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{teacher.pendingProfileChanges.profession}</Typography>
                    </Box>
                  )}
                  {teacher.pendingProfileChanges?.expertise && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip label="Expertise" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{teacher.pendingProfileChanges.expertise}</Typography>
                    </Box>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button 
                    size="small" 
                    variant="contained" 
                    color="success"
                    onClick={() => handleApprove(teacher.uid, teacher.pendingProfileChanges)}
                    sx={{ borderRadius: 1.5, fontWeight: 800, textTransform: 'none', px: 2 }}
                  >
                    Approve
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    color="error"
                    onClick={() => handleReject(teacher.uid)}
                    sx={{ borderRadius: 1.5, fontWeight: 800, textTransform: 'none', px: 2 }}
                  >
                    Reject
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
