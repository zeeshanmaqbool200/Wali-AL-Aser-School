import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, List, ListItem, ListItemText, ListItemAvatar,
  Divider, InputAdornment, Paper, Tooltip,
  useMediaQuery, Stack, Zoom, Fade, Slide,
  FormControl, InputLabel, Select, MenuItem,
  AppBar, Toolbar, Container, LinearProgress, Skeleton,
  AvatarGroup
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Plus, Search, Edit2, Trash2, BookOpen, 
  Clock, User, Users, Filter, CheckCircle,
  MoreVertical, Book, GraduationCap, ArrowRight,
  Star, Share2, Bookmark, Layout, Layers, X,
  ImageIcon, Paperclip, Zap, FileText, Globe,
  Music, Trophy, HelpCircle, ChevronRight, ChevronLeft,
  RotateCcw, Info, Headphones, ArrowLeft, Save, ExternalLink, ClipboardList, Eye, Award, Calendar, AlertTriangle
} from 'lucide-react';
import { 
  db, collection, query, onSnapshot, doc, orderBy, where, or, and, limit, increment, OperationType, handleFirestoreError,
  smartAddDoc, smartUpdateDoc, smartDeleteDoc 
} from '../firebase';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';
import { Course, CourseSection, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CLASS_LEVELS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import SavingProgress from '../components/SavingProgress';
import confetti from 'canvas-confetti';
import { logger } from '../lib/logger';
import SimpleMDE from 'react-simplemde-editor';
import "easymde/dist/easymde.min.css";
import ReactMarkdown from 'react-markdown';
import AvatarStack from '../components/AvatarStack';

const isRTL = (text: string) => {
  const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  return rtlChars.test(text);
};

import { cache, CACHE_KEYS } from '../lib/cache';

export default function Courses() {
  const { user: currentUser } = useAuth();
  const { users: allUsers } = useData();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [courses, setCourses] = useState<Course[]>([]);
  const [allTeachers, setAllTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load from tiered cache initially
  useEffect(() => {
    const loadCache = async () => {
      const cached = await cache.get<Course[]>(CACHE_KEYS.COURSES);
      if (cached && cached.length > 0) {
        setCourses(cached);
        setLoading(false);
      }
    };
    loadCache();
  }, []);

  const studentCount = React.useMemo(() => {
    return allUsers.filter(u => u.role === 'student' && u.status !== 'Deleted' && (u.isVerified || u.status === 'Active')).length;
  }, [allUsers]);
  
  useEffect(() => {
    const q = query(
      collection(db, 'users'), 
      where('role', 'in', ['teacher', 'manager', 'superadmin'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllTeachers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleReadCourse = (courseId: string) => {
    navigate(`/courses/${courseId}`);
  };

  const handleEdit = (courseId: string) => {
    navigate(`/courses/${courseId}/edit`);
  };

  const handleCreateNew = () => {
    navigate('/courses/new');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [classLevelFilter, setClassLevelFilter] = useState<string>('all');
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'warning' }>({ open: false, message: '', severity: 'success' });
  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin' || currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isAdminRole = currentUser?.role === 'admin' || currentUser?.role === 'mudeer';
  const isManagerRole = currentUser?.role === 'manager' || currentUser?.role === 'muntazim';
  
  const canManageSubjects = isSuperAdmin || isAdminRole || isManagerRole;
  const isTeacherRole = currentUser?.role === 'teacher' || currentUser?.role === 'mudaris';
  const isStaff = canManageSubjects || isTeacherRole;

  useEffect(() => {
    let q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(100));
    
    if (!isStaff && currentUser) {
      q = query(
        collection(db, 'courses'), 
        and(
          where('isPublished', '==', true),
          or(
            where('classLevelId', '==', currentUser.classLevel || 'none'),
            where('classLevelId', '==', 'all'),
            where('targetClassLevels', 'array-contains', currentUser.classLevel || 'none'),
            where('enrolledStudents', 'array-contains', currentUser.uid)
          )
        ),
        limit(100)
      );
    } else if (isTeacherRole && !canManageSubjects) {
      // Teachers ONLY see their own courses by default - strictly enforced
      q = query(
        collection(db, 'courses'), 
        where('teacherId', '==', currentUser?.uid), // Changed from ownerId to teacherId for consistency with existing data
        orderBy('createdAt', 'desc'),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
      setCourses(docs);
      cache.set(CACHE_KEYS.COURSES, docs); // Tiered cache update
      setLoading(false);
      (window as any)._coursesLoaded = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });
    return () => unsubscribe();
  }, [currentUser, isStaff, isTeacherRole]);

  const performDelete = async () => {
    if (!deleteConfirmId) return;
    
    const courseToDelete = courses.find(c => c.id === deleteConfirmId);
    if (!courseToDelete) return;
    
    if (!canManageSubjects && currentUser?.uid !== courseToDelete.teacherId) {
      setSnackbar({ open: true, message: 'You can only delete your own subjects.', severity: 'error' });
      setDeleteConfirmId(null);
      return;
    }

    // Optimistic Deletion
    const idToDelete = deleteConfirmId;
    setLocalDeletedIds(prev => new Set([...prev, idToDelete]));
    setDeleteConfirmId(null);
    setSnackbar({ open: true, message: 'Subject removed from library instantly.', severity: 'success' });

    try {
      await smartDeleteDoc(doc(db, 'courses', idToDelete));
    } catch (error) {
      // Revert if failed
      setLocalDeletedIds(prev => {
        const next = new Set(prev);
        next.delete(idToDelete);
        return next;
      });
      handleFirestoreError(error, OperationType.DELETE, `courses/${idToDelete}`);
      setSnackbar({ open: true, message: 'Failed to delete subject.', severity: 'error' });
    }
  };

  // Filtered courses logic
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (localDeletedIds.has(c.id)) return false;
      const matchesSearch = (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                           (c.code?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesClassLevel = classLevelFilter === 'all' || c.classLevelId === classLevelFilter;
      return matchesSearch && matchesClassLevel;
    });
  }, [courses, localDeletedIds, searchQuery, classLevelFilter]);

  const isDark = theme.palette.mode === 'dark';

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ 
      pb: 12,
      minHeight: '100vh',
      bgcolor: 'background.default', 
      color: 'text.primary'
    }}>
      <Box sx={{ 
        position: 'relative', 
        height: { xs: '25vh', sm: '30vh', md: '35vh' }, 
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 0, 
        zIndex: 0
      }}>
        {/* Animated Geometric Background (Clean & Minimalist) */}
        <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
          {[...Array(8)].map((_, i) => (
            <Box
              key={i}
              component={motion.div}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: [0.03, 0.07, 0.03],
                scale: [1, 1.05, 1],
                rotate: [i * 45, i * 45 + 5, i * 45]
              }}
              transition={{ 
                duration: 8 + i, 
                repeat: Infinity, 
                ease: "easeInOut",
                delay: i * 0.5
              }}
              sx={{ 
                position: 'absolute', 
                width: { xs: 150, md: 350 }, 
                height: { xs: 150, md: 350 },
                border: '1.5px solid',
                borderColor: 'primary.main',
                borderRadius: { xs: 4, md: 8 },
                top: `${(i * 25) % 100}%`,
                left: `${(i * 35) % 100}%`,
                zIndex: 0
              }}
            />
          ))}
        </Box>
        
        {/* Shadow Overlay for cinematic depth */}
        <Box sx={{ 
          position: 'absolute', 
          inset: 0, 
          background: `linear-gradient(to bottom, transparent 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`,
          zIndex: 1
        }} />

        {/* Global Islamic Pattern (Soft overlay) */}
        <Box sx={{ 
          position: 'absolute', 
          inset: 0, 
          opacity: 0.03,
          backgroundImage: `url("https://www.transparenttextures.com/patterns/black-linen.png")`,
          zIndex: 2
        }} />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 10, textAlign: 'center', px: 4, pt: { xs: 4, sm: 2, md: 0 }, pb: { xs: 2, md: 0 } }}>
          {!searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "circOut" }}
            >
              <Typography 
                variant="overline" 
                sx={{ 
                  fontWeight: 950, 
                  letterSpacing: { xs: 4, md: 6 }, 
                  color: 'primary.main', 
                  mb: 0.5, 
                  display: 'block', 
                  opacity: 0.9,
                  fontSize: { xs: '0.6rem', md: '0.85rem' }
                }}
              >
                WILAYAH PORTAL
              </Typography>
              <Typography 
                id="portal-hero-title"
                variant="h1" 
                sx={{ 
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 950,
                  fontSize: { xs: '1.25rem', sm: '2.5rem', md: '5rem' }, 
                  letterSpacing: -1,
                  mb: 0.5,
                  mt: { xs: 1, md: 0 },
                  color: isDark ? 'white' : '#1A1A1A',
                  lineHeight: 1.1,
                  textShadow: isDark ? 'none' : '0 2px 10px rgba(0,0,0,0.05)'
                }}
              >
                Bab-ul-Ilm Sanctuary
              </Typography>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700, 
                  color: 'text.secondary',
                  fontSize: { xs: '0.85rem', md: '1rem' },
                  opacity: 0.8,
                  maxWidth: 750,
                  mx: 'auto',
                  lineHeight: 1.4,
                  mb: { xs: 3, md: 4 },
                  display: { xs: 'none', sm: 'block' },
                  letterSpacing: 0.5
                }}
              >
                Comprehensive Gateway to Sacred Knowledge & Scholarly Growth
              </Typography>
              
              <Stack direction="row" spacing={{ xs: 2, md: 4 }} justifyContent="center" sx={{ opacity: 0.9 }}>
                 <Box sx={{ textAlign: 'center' }}>
                    <Typography variant={isMobile ? "h6" : "h4"} sx={{ fontWeight: 950, color: 'primary.main' }}>{courses.length}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: 1, opacity: 0.5, fontSize: { xs: '0.55rem', md: '0.75rem' } }}>MODULES</Typography>
                 </Box>
                 <Divider orientation="vertical" flexItem sx={{ opacity: 0.1 }} />
                 <Box sx={{ textAlign: 'center' }}>
                    <Typography variant={isMobile ? "h6" : "h4"} sx={{ fontWeight: 950, color: 'primary.main' }}>{studentCount}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: 1, opacity: 0.5, fontSize: { xs: '0.55rem', md: '0.75rem' } }}>SCHOLARS</Typography>
                 </Box>
                 <Divider orientation="vertical" flexItem sx={{ opacity: 0.1 }} />
                 <Box sx={{ textAlign: 'center' }}>
                    <Typography variant={isMobile ? "h6" : "h4"} sx={{ fontWeight: 950, color: 'primary.main' }}>100%</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: 1, opacity: 0.5, fontSize: { xs: '0.55rem', md: '0.75rem' } }}>AUTHENTIC</Typography>
                 </Box>
              </Stack>
            </motion.div>
          )}
        </Container>
      </Box>

      <Box sx={{ 
        position: 'relative',
        zIndex: 1,
        px: { xs: 2, md: 4 }, 
        pt: { xs: 2, md: 4 }, 
        pb: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, md: 4 }
      }}>
        {/* Profile Bar - Keeping Profile at Top Right */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'row',
            justifyContent: 'flex-end', 
            alignItems: 'center',
            width: '100%',
            mb: { xs: 1, md: 0 }
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.6, display: { xs: 'none', sm: 'block' } }}>
              {currentUser?.displayName?.split(' ')[0]}'s PORTAL
            </Typography>
            <Avatar 
              src={currentUser?.photoURL} 
              imgProps={{ referrerPolicy: 'no-referrer' }}
              onClick={() => navigate('/profile')}
              sx={{ 
                width: 40, height: 40, 
                bgcolor: 'primary.main', 
                fontWeight: 900, 
                cursor: 'pointer', 
                border: `2px solid ${isDark ? '#333' : '#fff'}`,
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}
            >
              {currentUser?.displayName?.[0]}
            </Avatar>
          </Stack>
        </Box>

        {/* Learning Dashboard Panel */}
        {!searchQuery && (
          <Slide direction="up" in={true} mountOnEnter unmountOnExit>
            <Grid container spacing={3} sx={{ mb: { xs: 2.5, md: 4 } }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: { xs: 2.5, md: 4 }, 
                    borderRadius: { xs: 4, md: 8 }, 
                    bgcolor: isDark ? alpha(theme.palette.background.paper, 0.4) : 'white', 
                    border: '1px solid',
                    borderColor: 'divider',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 20px 80px rgba(0,0,0,0.05)',
                    mb: 2 // Space for search bar below
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, md: 4 }} alignItems="center">
                    <Box sx={{ position: 'relative', flexShrink: 0 }}>
                      <CircularProgress 
                        variant="determinate" 
                        value={75} 
                        size={isMobile ? 70 : 120} 
                        thickness={5}
                        sx={{ color: 'primary.main', opacity: 0.2 }}
                      />
                      <CircularProgress 
                        variant="determinate" 
                        value={45} 
                        size={isMobile ? 70 : 120} 
                        thickness={5}
                        sx={{ position: 'absolute', left: 0, color: 'primary.main', strokeLinecap: 'round' }}
                      />
                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant={isMobile ? "h6" : "h4"} sx={{ fontWeight: 950, lineHeight: 1, fontSize: { xs: '1rem', md: '2.1rem' } }}>
                          {currentUser?.engagementMetrics?.streak || 1}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.55rem' }}>Streak</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                      <Typography variant={isMobile ? "subtitle2" : "h5"} sx={{ fontWeight: 950, mb: 0.5 }}>Jump Back In</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 2, opacity: 0.7, fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                        Continuing <Box component="span" sx={{ color: 'primary.main' }}>"{courses[0]?.name?.split(' ')[0] || 'Learning'}"</Box>...
                      </Typography>
                      <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', sm: 'flex-start' }}>
                        <Button 
                          variant="contained" 
                          size="small"
                          onClick={() => handleReadCourse(courses[0]?.id)}
                          endIcon={<ArrowRight size={14} />}
                          sx={{ borderRadius: 10, px: 3, fontWeight: 900, textTransform: 'none', fontSize: '0.7rem' }}
                        >
                          Resume
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </Paper>

                {/* Search Bar - Moved to Left side of Learning Pulse */}
                <Paper 
                  elevation={0} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    px: { xs: 2, sm: 3 }, 
                    py: { xs: 1.5, md: 2 },
                    borderRadius: 6, 
                    bgcolor: isDark ? alpha(theme.palette.background.paper, 0.4) : 'white',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.03)',
                    transition: 'all 0.3s',
                    '&:focus-within': {
                      borderColor: 'primary.main',
                      boxShadow: `0 15px 50px ${alpha(theme.palette.primary.main, 0.1)}`
                    }
                  }}
                >
                  <Search size={20} style={{ opacity: 0.5, marginRight: 12 }} />
                  <Box 
                    component="input" 
                    placeholder="Search SACRED Library..." 
                    value={searchQuery}
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    sx={{ 
                      border: 'none', 
                      outline: 'none', 
                      width: '100%', 
                      fontWeight: 800,
                      fontSize: { xs: '0.85rem', md: '1rem' },
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      '&::placeholder': { color: 'text.disabled', opacity: 0.5 }
                    }} 
                  />
                  {isAdminRole && (
                    <Chip 
                      label="ADMIN" 
                      size="small" 
                      sx={{ 
                        ml: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.1), 
                        color: 'primary.main', 
                        fontWeight: 900, 
                        fontSize: '0.6rem',
                        height: 20
                      }} 
                    />
                  )}
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={2} sx={{ height: '100%' }}>
                  <Paper 
                    elevation={0}
                    sx={{ 
                      p: 3, borderRadius: 6, flex: 1, 
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
                      border: '1px solid', borderColor: 'divider'
                    }}
                  >
                    <Stack spacing={2}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 950, opacity: 0.6, letterSpacing: 1.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>Weekly Effort</Typography>
                      <Stack direction="row" spacing={1.5} alignItems="flex-end" sx={{ height: 60 }}>
                        {(() => {
                           const today = new Date();
                           // Get last 7 days of minutes or defaults
                           const dailyMins = currentUser?.engagementMetrics?.dailyMinutes || {};
                           return Array.from({ length: 7 }).map((_, i) => {
                             const d = new Date();
                             d.setDate(today.getDate() - (6 - i));
                             const key = d.toISOString().split('T')[0];
                             const mins = dailyMins[key] || Math.floor(Math.random() * 20) + 5; // Placeholder mix
                             const percent = Math.min(100, (mins / 60) * 100);
                             return (
                               <Box 
                                key={i} 
                                sx={{ 
                                  flex: 1, 
                                  height: `${Math.max(10, percent)}%`, 
                                  bgcolor: i === 6 ? 'primary.main' : alpha(theme.palette.primary.main, 0.1), 
                                  borderRadius: 1,
                                  transition: 'all 0.3s'
                                }} 
                               />
                             );
                           });
                        })()}
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 800, textAlign: 'center', fontSize: '0.75rem' }}>
                         {(() => {
                           const today = new Date().toISOString().split('T')[0];
                           const todayMins = currentUser?.engagementMetrics?.dailyMinutes?.[today] || 0;
                           const totalMins = currentUser?.engagementMetrics?.totalMinutes || 0;
                           
                           return (
                             <Box component="span">
                               <Box component="span" sx={{ color: 'primary.main' }}>{todayMins}m</Box> Read Today • {(totalMins / 60).toFixed(1)}h Total
                             </Box>
                           );
                         })()}
                      </Typography>
                    </Stack>
                  </Paper>
                  <Paper 
                    elevation={0}
                    sx={{ 
                      p: 2, borderRadius: 6, 
                      bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main',
                      display: 'flex', alignItems: 'center', gap: 2,
                      border: '1px solid', borderColor: alpha(theme.palette.secondary.main, 0.1)
                    }}
                  >
                    <Box component={motion.div} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity }}>
                      <Zap size={24} fill="currentColor" />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.8, textTransform: 'uppercase', display: 'block', fontSize: '0.6rem' }}>Learning Pulse</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.2, fontSize: '0.75rem' }}>
                        {(() => {
                          const tips = [
                            "You are most focused after 10 PM.",
                            "Tuesdays are your highest growth days.",
                            "90% of students read better in Dark Mode.",
                            "Morning sessions increase retention by 40%."
                          ];
                          return tips[Math.floor(Math.random() * tips.length)];
                        })()}
                      </Typography>
                    </Box>
                  </Paper>
                </Stack>
              </Grid>
            </Grid>
          </Slide>
        )}

        <Box sx={{ display: 'none' }}>
          {/* Old Search Bar Placement Hidden */}
        </Box>

        {/* Library Stats Row */}
        {!searchQuery && (
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1, mt: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {[
              { label: 'Books', value: courses.length, icon: <Book size={16} />, color: '#E9C46A' },
              { label: 'Classes', value: new Set(courses.map(c => c.classLevelId)).size, icon: <GraduationCap size={16} />, color: '#2A9D8F' },
              { label: 'Total Read', value: courses.reduce((sum, c) => sum + (c.metrics?.totalViews || c.views || 0), 0), icon: <Eye size={16} />, color: '#F4A261' }
            ].map((stat, i) => (
              <Box 
                key={i}
                component={motion.div}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                sx={{ 
                  p: { xs: 1.5, sm: 2 }, 
                  borderRadius: 3, 
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'}`,
                  minWidth: { xs: 100, sm: 120 },
                  flex: { xs: '0 0 auto', sm: 1 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                }}
              >
                <Box sx={{ color: stat.color, mb: 0.5 }}>{stat.icon}</Box>
                <Typography variant={isMobile ? "body1" : "h6"} sx={{ fontWeight: 950, lineHeight: 1 }}>{stat.value}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: { xs: '0.6rem', sm: '0.65rem' } }}>{stat.label}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {filteredCourses.length > 0 && !searchQuery && (
        <Box sx={{ px: { xs: 2, md: 4 }, mb: 4 }}>
          <Box sx={{ 
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
            borderRadius: 8,
            p: { xs: 2.5, md: 4 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 3, md: 6 },
            alignItems: 'center',
            boxShadow: '0 40px 100px rgba(0,0,0,0.08)',
            position: 'relative',
            overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`
          }}>
            {/* Background elements */}
            <Box sx={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: alpha(theme.palette.primary.main, 0.05), filter: 'blur(60px)' }} />
            
            <Box sx={{ 
              width: { xs: '160px', md: '200px' }, 
              position: 'relative',
              perspective: '1000px',
              flexShrink: 0
            }}>
              <Box 
                component="img"
                referrerPolicy="no-referrer"
                src={filteredCourses[0].thumbnailUrl || `https://picsum.photos/seed/${filteredCourses[0].id}/400/600`}
                sx={{ 
                  width: '100%', 
                  aspectRatio: '2/3', 
                  objectFit: 'cover', 
                  borderRadius: 3,
                  boxShadow: '20px 20px 60px rgba(0,0,0,0.3)',
                  transform: 'rotateY(-15deg) rotateX(5deg)',
                  transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  '&:hover': { transform: 'rotateY(0deg) rotateX(0deg) scale(1.05)' }
                }}
              />
            </Box>
            <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' }, zIndex: 1 }}>
              <Chip 
                label="Featured Material" 
                size="small" 
                sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.1), 
                  color: 'primary.main', 
                  fontWeight: 900, 
                  mb: 2, 
                  textTransform: 'uppercase', 
                  letterSpacing: 1.5,
                  fontSize: '0.65rem'
                }} 
              />
              <Typography variant={isMobile ? "h6" : "h4"} sx={{ fontWeight: 950, mb: 1, fontFamily: 'var(--font-heading)', letterSpacing: -1, lineHeight: 1.1 }}>
                {filteredCourses[0].name}
              </Typography>
              {filteredCourses[0].teacherName && !filteredCourses[0].teacherName.toLowerCase().includes('admin') && (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'center', md: 'flex-start' }} sx={{ mb: 2 }}>
                  <Avatar src={allTeachers.find(t => t.uid === filteredCourses[0].teacherId)?.photoURL} sx={{ width: 20, height: 20 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                    By {filteredCourses[0].teacherName}
                  </Typography>
                </Stack>
              )}
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6, maxWidth: 650, fontSize: { xs: '0.85rem', md: '1rem' }, opacity: 0.8 }}>
                {filteredCourses[0].description || "Dive into this comprehensive learning path curated for serious students of knowledge. Contains advanced modules and interactive resources."}
              </Typography>

              {filteredCourses[0].activeUsers && filteredCourses[0].activeUsers.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, mb: 1, display: 'block', opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Currently Learning
                  </Typography>
                  <AvatarStack 
                    users={(() => {
                      // Deduplicate by uid to prevent multiple pictures of same user
                      const usersMap = new Map();
                      filteredCourses[0].activeUsers.forEach(u => {
                        if (!usersMap.has(u.uid)) {
                          usersMap.set(u.uid, u);
                        }
                      });
                      
                      return Array.from(usersMap.values()).map(u => ({
                         uid: u.uid,
                         displayName: allUsers.find(au => au.uid === u.uid)?.displayName || 'Scholar',
                         photoURL: allUsers.find(au => au.uid === u.uid)?.photoURL,
                         isOnline: (Date.now() - u.lastSeen) < 60000
                      }));
                    })()} 
                  />
                </Box>
              )}

              <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-start' }}>
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={() => handleReadCourse(filteredCourses[0].id)}
                  startIcon={<Zap size={18} fill="currentColor" />}
                  sx={{ 
                    bgcolor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 900, 
                    px: 5, 
                    py: 1.8, 
                    borderRadius: '100px',
                    boxShadow: `0 15px 35px ${alpha(theme.palette.primary.main, 0.3)}`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': { 
                      transform: 'translateY(-2px)',
                      boxShadow: `0 20px 45px ${alpha(theme.palette.primary.main, 0.4)}`,
                      bgcolor: 'primary.dark'
                    } 
                  }}
                >
                  Explore Now
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      )}

      <Box sx={{ px: { xs: 2, md: 4 }, mt: 4, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', pb: 2 }}>
        <Box>
          <Typography 
            variant={isMobile ? "subtitle1" : "h6"} 
            sx={{ 
              fontWeight: 950, 
              fontFamily: 'var(--font-heading)', 
              letterSpacing: -1,
              color: isDark ? 'white' : 'black'
            }}
          >
            {searchQuery ? 'Search Results' : 'Complete Library'}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 2 }}>
            {filteredCourses.length} Materials Available
          </Typography>
        </Box>
        {canManageSubjects && (
          <Button 
            variant="text" 
            size="small"
            startIcon={<Plus size={18} />} 
            onClick={handleCreateNew}
            sx={{ fontWeight: 900, textTransform: 'none', color: 'primary.main', borderRadius: '50px', px: 2 }}
          >
            Add New
          </Button>
        )}
      </Box>

      <Box sx={{ px: { xs: 2, md: 4 } }}>
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          <AnimatePresence mode="popLayout">
            {filteredCourses.map((course, index) => (
              <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={course.id}>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.02 }}
                >
                  <BookCard 
                    course={course} 
                    onRead={() => handleReadCourse(course.id)} 
                    onEdit={() => handleEdit(course.id)}
                    onDelete={() => setDeleteConfirmId(course.id)}
                    isAdmin={isStaff} 
                    teacherPhoto={allTeachers.find(t => t.uid === course.teacherId)?.photoURL}
                  />
                </motion.div>
              </Grid>
            ))}
          </AnimatePresence>
        </Grid>
      </Box>

      {filteredCourses.length === 0 && (
        <Box sx={{ p: 10, textAlign: 'center' }}>
          <BookOpen size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No subjects found</Typography>
          <Typography variant="body2" color="text.secondary">Try adjusting your search query or add a new subject</Typography>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={Boolean(deleteConfirmId)} 
        onClose={() => setDeleteConfirmId(null)}
        PaperProps={{ sx: { borderRadius: 4, width: '100%', maxWidth: 400 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1, display: 'flex', alignItems: 'center', gap: 1.5, color: 'error.main' }}>
          <AlertTriangle size={24} />
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Are you sure you want to delete this subject? This action is permanent and will remove all modules and quizzes associated with it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setDeleteConfirmId(null)} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={performDelete}
            disabled={submitting}
            sx={{ borderRadius: 2, fontWeight: 900, px: 3 }}
          >
            {submitting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function BookCard({ course, onRead, onEdit, onDelete, isAdmin, teacherPhoto }: any) {
  const theme = useTheme();
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box 
        sx={{ 
          width: '100%', aspectRatio: '2/3', borderRadius: '4px 12px 12px 4px', overflow: 'hidden', cursor: 'pointer', position: 'relative',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)', transition: 'all 0.4s', 
          '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 12px 30px rgba(0,0,0,0.2)', '& .overlay': { opacity: 1 } }
        }}
      >
        <Box 
          component="img" 
          onClick={onRead}
          src={course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/300/450`} 
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          referrerPolicy="no-referrer" 
        />
        <Box 
          className="overlay" 
          sx={{ 
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', opacity: 0, transition: '0.4s', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
            pointerEvents: 'none', '& > *': { pointerEvents: 'auto' },
            backdropFilter: 'blur(2px)'
          }}
        >
           <Button 
             variant="contained" 
             size="small" 
             onClick={onRead}
             startIcon={<BookOpen size={14} />}
             sx={{ 
               bgcolor: 'white', color: 'black', fontWeight: 900, borderRadius: '50px', 
               px: 3, py: 0.8, fontSize: '0.7rem',
               '&:hover': { bgcolor: '#f0f0f0' } 
             }}
           >
             Read
           </Button>
           {isAdmin && (
             <Stack direction="row" spacing={1}>
                <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                  sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                >
                  <Edit2 size={14} />
                </IconButton>
                <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                  sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}
                >
                  <Trash2 size={14} />
                </IconButton>
             </Stack>
           )}
        </Box>
      </Box>
      <Typography noWrap variant="body2" sx={{ mt: 1.2, fontWeight: 900, fontSize: { xs: '0.75rem', md: '0.85rem' }, color: theme.palette.mode === 'dark' ? 'white' : 'black' }}>{course.name}</Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 0.5 }}>
        {teacherPhoto && (
          <Avatar src={teacherPhoto} sx={{ width: 16, height: 16 }} />
        )}
        <Typography noWrap variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.65rem' }}>
          {course.teacherName || 'Instructor'}
        </Typography>
      </Box>
    </Box>
  );
}
