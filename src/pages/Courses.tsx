import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, List, ListItem, ListItemText, ListItemAvatar,
  Divider, InputAdornment, Paper, Tooltip,
  useMediaQuery, Stack, Zoom, Fade, Slide,
  FormControl, InputLabel, Select, MenuItem,
  AppBar, Toolbar, Container, LinearProgress, Skeleton
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Plus, Search, Edit2, Trash2, BookOpen, 
  Clock, User, Users, Filter, CheckCircle,
  MoreVertical, Book, GraduationCap, ArrowRight,
  Star, Share2, Bookmark, Layout, Layers, X,
  ImageIcon, Paperclip, Zap, FileText, Globe,
  Music, Trophy, HelpCircle, ChevronRight, ChevronLeft,
  RotateCcw, Info, Headphones, ArrowLeft, Save, ExternalLink, ClipboardList, Eye, Award, Calendar
} from 'lucide-react';
import { 
  db, collection, query, onSnapshot, doc, orderBy, where, or, and, limit, increment, OperationType, handleFirestoreError,
  smartAddDoc, smartUpdateDoc, smartDeleteDoc 
} from '../firebase';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';
import { Course, CourseSection, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CLASS_LEVELS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { logger } from '../lib/logger';
import SimpleMDE from 'react-simplemde-editor';
import "easymde/dist/easymde.min.css";
import ReactMarkdown from 'react-markdown';

const isRTL = (text: string) => {
  const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  return rtlChars.test(text);
};

export default function Courses() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [courses, setCourses] = useState<Course[]>(() => {
    const cached = localStorage.getItem('courses_data');
    return cached ? JSON.parse(cached) : [];
  });
  const [allTeachers, setAllTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(!(window as any)._coursesLoaded && courses.length === 0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [openReader, setOpenReader] = useState(false);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [readerLoading, setReaderLoading] = useState(false);
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [openTeacherProfile, setOpenTeacherProfile] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);

  const ReaderTeacher = React.useMemo(() => {
    return allTeachers.find(m => m.uid === viewingCourse?.teacherId);
  }, [allTeachers, viewingCourse?.teacherId]);
  
  // ...
  
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllTeachers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleReadCourse = async (course: Course) => {
    setReaderLoading(true);
    setViewingCourse(course);
    setOpenReader(true);
    setActiveSection(0);
    setTimeout(() => setReaderLoading(false), 800);

    // Increment views in Firestore
    try {
      await smartUpdateDoc(doc(db, 'courses', course.id), {
        views: increment(1)
      });
    } catch (e) {
      console.error("Failed to increment views", e);
    }
  };

  const showTeacherProfile = (teacherId: string) => {
    const teacher = allTeachers.find(m => m.uid === teacherId);
    if (teacher) {
      setSelectedTeacher(teacher);
      setOpenTeacherProfile(true);
    }
  };

  const handleSectionChange = (idx: number) => {
    if (idx === activeSection) return;
    setReaderLoading(true);
    setActiveSection(idx);
    setTimeout(() => {
      setReaderLoading(false);
      const contentArea = document.getElementById('reader-content-top');
      if (contentArea) contentArea.scrollIntoView({ behavior: 'smooth' });
    }, 400);
  };
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [classLevelFilter, setClassLevelFilter] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration: '',
    fee: 0, // Hidden in UI but kept in type
    teacherName: currentUser?.displayName || '',
    teacherId: currentUser?.uid || '',
    thumbnailUrl: '',
    sections: [] as CourseSection[],
    isPublished: true,
    classLevelId: 'all',
    assignedTeachers: [] as string[],
    targetClassLevels: [] as string[]
  });

  const [newSection, setNewSection] = useState({
    title: '',
    content: '',
    type: 'text' as 'text' | 'image' | 'video' | 'quiz' | 'file' | 'audio',
    mediaUrl: '',
    quizData: {
      questions: [] as any[],
      passingScore: 70
    }
  });

  const [currentQuizQuestion, setCurrentQuizQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0
  });

  const handleAddQuizQuestion = () => {
    if (!currentQuizQuestion.question || currentQuizQuestion.options.some(o => !o)) return;
    setNewSection(prev => ({
      ...prev,
      quizData: {
        ...prev.quizData,
        questions: [...prev.quizData.questions, { ...currentQuizQuestion, id: Date.now().toString() }]
      }
    }));
    setCurrentQuizQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, target: 'thumbnail' | 'section') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024) {
      logger.error('File too large', new Error('Limit is 100KB for Firestore storage (base64) to ensure stability.'));
      alert('File too large. Please use an image smaller than 100KB or host it elsewhere and paste the URL.');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (target === 'thumbnail') {
          setFormData(prev => ({ ...prev, thumbnailUrl: base64String }));
        } else {
          setNewSection(prev => ({ ...prev, mediaUrl: base64String }));
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      logger.error('File read error', error as Error);
      setIsUploading(false);
    }
  };

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isManagerRole = currentUser?.role === 'manager';
  const isTeacherRole = currentUser?.role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

  useEffect(() => {
    let q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(100));
    
    // Students only see published courses or courses assigned specifically to them/their class
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
    } else if (isTeacherRole && !isSuperAdmin) {
      // Teachers see all courses for reference
      q = query(
        collection(db, 'courses'), 
        orderBy('createdAt', 'desc'),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
      setCourses(docs);
      localStorage.setItem('courses_data', JSON.stringify(docs));
      setLoading(false);
      (window as any)._coursesLoaded = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });
    return () => unsubscribe();
  }, [currentUser, isStaff, isTeacherRole]);

  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const data = {
        ...formData,
        teacherName: formData.teacherName || currentUser.displayName,
        teacherId: formData.teacherId || currentUser.uid,
        updatedAt: Date.now()
      };

      if (editingCourse) {
        await smartUpdateDoc(doc(db, 'courses', editingCourse.id), data);
        setSnackbar({ open: true, message: 'Subject updated successfully! ✨', severity: 'success' });
      } else {
        await smartAddDoc(collection(db, 'courses'), { ...data, createdAt: Date.now() });
        setSnackbar({ open: true, message: 'New Subject added successfully! 🚀', severity: 'success' });
      }
      
      setOpenDialog(false);
      setEditingCourse(null);
      setFormData({ 
        name: '', 
        code: '', 
        description: '', 
        duration: '', 
        fee: 0, 
        teacherName: currentUser?.displayName || '', 
        teacherId: currentUser?.uid || '', 
        thumbnailUrl: '', 
        sections: [], 
        isPublished: true, 
        classLevelId: 'all',
        assignedTeachers: [],
        targetClassLevels: []
      });
    } catch (error) {
      console.error("Error saving course:", error);
      handleFirestoreError(error, OperationType.WRITE, 'courses');
      setSnackbar({ open: true, message: 'Failed to save subject.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSection = () => {
    if (!newSection.title || (!newSection.content && newSection.type !== 'quiz' && !newSection.mediaUrl)) return;
    
    const sections = [...formData.sections];
    
    if (editingSectionIdx !== null) {
      sections[editingSectionIdx] = { 
        ...newSection, 
        id: sections[editingSectionIdx].id, 
        order: editingSectionIdx 
      };
      setEditingSectionIdx(null);
    } else {
      const section: CourseSection = { 
        ...newSection, 
        id: Date.now().toString(), 
        order: formData.sections.length 
      };
      sections.push(section);
    }

    setFormData({
      ...formData,
      sections
    });
    
    setNewSection({ 
      title: '', 
      content: '', 
      type: 'text', 
      mediaUrl: '',
      quizData: { questions: [], passingScore: 70 }
    });
  };

  const handleEditSection = (idx: number) => {
    const s = formData.sections[idx];
    setNewSection({
      title: s.title,
      content: s.content || '',
      type: s.type,
      mediaUrl: s.mediaUrl || '',
      quizData: s.quizData || { questions: [], passingScore: 70 }
    });
    setEditingSectionIdx(idx);
    // Scroll to editor
    const entry = document.getElementById('lesson-editor-entry');
    if (entry) entry.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this subject? This action cannot be undone.')) return;
    try {
      await smartDeleteDoc(doc(db, 'courses', id));
      setSnackbar({ open: true, message: 'Subject deleted successfully.', severity: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${id}`);
      setSnackbar({ open: true, message: 'Failed to delete subject.', severity: 'error' });
    }
  };

  const handleShare = async (course: Course) => {
    const shareData = {
      title: course.name,
      text: course.description,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setSnackbar({ open: true, message: 'Shared successfully! 🌐', severity: 'success' });
      } else {
        await navigator.clipboard.writeText(`${course.name}: ${window.location.href}`);
        setSnackbar({ open: true, message: 'Link copied to clipboard! 📋', severity: 'success' });
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      code: course.code,
      description: course.description,
      duration: course.duration,
      fee: course.fee || 0,
      teacherName: course.teacherName,
      teacherId: course.teacherId,
      thumbnailUrl: course.thumbnailUrl || '',
      sections: course.sections || [],
      isPublished: course.isPublished || false,
      classLevelId: course.classLevelId || '',
      assignedTeachers: course.assignedTeachers || [],
      targetClassLevels: (course as any).targetClassLevels || (course.classLevelId ? [course.classLevelId] : [])
    });
    setOpenDialog(true);
  };

  const filteredCourses = courses.filter(c => {
    const matchesSearch = (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                         (c.code?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesClassLevel = classLevelFilter === 'all' || c.classLevelId === classLevelFilter;
    return matchesSearch && matchesClassLevel;
  });

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const progress = (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100;
    setScrollProgress(progress);
  };

  const isDark = theme.palette.mode === 'dark';

  const genres = [
    { name: 'Islamic', icon: '🌙' },
    { name: 'History', icon: '🏛️' },
    { name: 'Quran', icon: '📖' },
    { name: 'Fiqh', icon: '⚖️' },
    { name: 'Arabic', icon: '🕌' },
    { name: 'Hadees', icon: '📜' },
    { name: 'Tafseer', icon: '💡' }
  ];

  return (
    <Box sx={{ 
      pb: 12,
      pt: 0,
      minHeight: '100vh',
      bgcolor: isDark ? '#050505' : '#F7F3EA', 
      color: 'text.primary'
    }}>
      {/* Search Header Area */}
      <Box sx={{ 
        px: { xs: 2, md: 4 }, 
        pt: { xs: 4, md: 6 }, 
        pb: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Layout size={20} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
             <Paper 
               elevation={0} 
               sx={{ 
                 display: 'flex', 
                 alignItems: 'center', 
                 px: 2, 
                 py: 0.8,
                 borderRadius: '50px', 
                 bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'white',
                 border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                 width: { xs: '180px', sm: '300px' },
                 transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                 '&:focus-within': {
                   width: { xs: '200px', sm: '350px' },
                   borderColor: 'primary.main',
                   boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.08)}`
                 }
               }}
             >
               <Search size={18} style={{ opacity: 0.5, marginRight: 8 }} />
               <Box 
                 component="input" 
                 placeholder="Search a book..." 
                 value={searchQuery}
                 onChange={(e: any) => setSearchQuery(e.target.value)}
                 sx={{ 
                   border: 'none', 
                   outline: 'none', 
                   width: '100%', 
                   fontWeight: 600,
                   fontSize: '0.85rem',
                   bgcolor: 'transparent',
                   color: 'text.primary',
                   '&::placeholder': { color: 'text.disabled' }
                 }} 
               />
             </Paper>
             <Avatar 
               src={currentUser?.photoURL} 
               imgProps={{ referrerPolicy: 'no-referrer' }}
               sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 900, cursor: 'pointer', border: `2px solid ${isDark ? '#333' : '#fff'}` }}
             >
               {currentUser?.displayName?.[0]}
             </Avatar>
          </Box>
        </Box>

        {/* Popular Authors Section */}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, fontFamily: '"Outfit", sans-serif' }}>
            Popular Authors
          </Typography>
          <Stack direction="row" spacing={3} sx={{ overflowX: 'auto', pb: 2, px: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
            {allTeachers.slice(0, 6).map((teacher) => (
              <Box 
                key={teacher.uid} 
                onClick={() => showTeacherProfile(teacher.uid)}
                sx={{ 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  minWidth: 80,
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-5px)' }
                }}
              >
                <Avatar 
                  src={teacher.photoURL} 
                  imgProps={{ referrerPolicy: 'no-referrer' }}
                  sx={{ 
                    width: 80, height: 80, mx: 'auto', mb: 1, 
                    borderRadius: 4, 
                    boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                    border: `2px solid ${isDark ? '#222' : '#fff'}`
                  }}
                >
                  {teacher.displayName?.[0]}
                </Avatar>
                <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.8, display: 'block' }}>
                  {teacher.displayName?.split(' ')[0]}
                </Typography>
              </Box>
            ))}
            {allTeachers.length === 0 && [1, 2, 3, 4].map(i => (
              <Skeleton key={i} variant="rectangular" width={80} height={80} sx={{ borderRadius: 4, minWidth: 80 }} />
            ))}
          </Stack>
        </Box>

        {/* Genre Section */}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, fontFamily: '"Outfit", sans-serif' }}>
            Genre
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 2, px: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
            <Chip 
              label="All" 
              onClick={() => setClassLevelFilter('all')}
              sx={{ 
                height: 48, 
                px: 2, 
                borderRadius: '12px',
                fontWeight: 700, 
                bgcolor: classLevelFilter === 'all' ? '#E9C46A' : (isDark ? 'rgba(255,255,255,0.03)' : 'white'),
                color: classLevelFilter === 'all' ? '#000' : 'text.primary',
                border: classLevelFilter === 'all' ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                '&:hover': { bgcolor: classLevelFilter === 'all' ? '#E9C46A' : alpha(theme.palette.primary.main, 0.1) }
              }}
            />
            {genres.map((g) => (
              <Chip 
                key={g.name}
                label={`${g.icon} ${g.name}`}
                onClick={() => setClassLevelFilter(g.name)}
                sx={{ 
                  height: 48, 
                  px: 2, 
                  borderRadius: '12px',
                  fontWeight: 700, 
                  bgcolor: classLevelFilter === g.name ? '#E9C46A' : (isDark ? 'rgba(255,255,255,0.03)' : 'white'),
                  color: classLevelFilter === g.name ? '#000' : 'text.primary',
                  border: classLevelFilter === g.name ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                  '&:hover': { bgcolor: classLevelFilter === g.name ? '#E9C46A' : alpha(theme.palette.primary.main, 0.1) }
                }}
              />
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Featured Book Section */}
      {filteredCourses.length > 0 && !searchQuery && (
        <Box sx={{ px: { xs: 2, md: 4 }, mb: 6 }}>
          <Box sx={{ 
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
            borderRadius: 8,
            p: { xs: 3, md: 5 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 4,
            alignItems: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              width: { xs: '100%', md: '30%' }, 
              position: 'relative',
              perspective: '1000px'
            }}>
              <Box 
                component="img"
                referrerPolicy="no-referrer"
                src={filteredCourses[0].thumbnailUrl || `https://picsum.photos/seed/${filteredCourses[0].id}/400/600`}
                sx={{ 
                  width: '100%', 
                  aspectRatio: '2/3', 
                  objectFit: 'cover', 
                  borderRadius: 4,
                  boxShadow: '20px 20px 60px rgba(0,0,0,0.3)',
                  transform: 'rotateY(-10deg)',
                  transition: 'all 0.5s',
                  '&:hover': { transform: 'rotateY(0deg) scale(1.02)' }
                }}
              />
              <Box sx={{ 
                position: 'absolute', 
                top: 20, 
                right: 20, 
                bgcolor: 'rgba(0,0,0,0.6)', 
                backdropFilter: 'blur(10px)',
                px: 1.5, 
                py: 0.5, 
                borderRadius: 2, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                color: 'white'
              }}>
                <Star size={14} color="#E9C46A" fill="#E9C46A" />
                <Typography variant="caption" sx={{ fontWeight: 900 }}>4.8</Typography>
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, fontFamily: '"Outfit", sans-serif', letterSpacing: -1.5 }}>
                {filteredCourses[0].name}
              </Typography>
              <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 800, mb: 3 }}>
                Author: {filteredCourses[0].teacherName}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8, maxWidth: 600 }}>
                {filteredCourses[0].description || "Whether you're craving an escape from reality, seeking wisdom, or simply looking for a captivating story to lose yourself in..."}
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button 
                  variant="contained" 
                  onClick={() => handleReadCourse(filteredCourses[0])}
                  sx={{ 
                    bgcolor: '#E9C46A', 
                    color: '#000', 
                    fontWeight: 900, 
                    px: 4, 
                    py: 1.5, 
                    borderRadius: 3,
                    '&:hover': { bgcolor: '#D9B45A' } 
                  }}
                >
                  Read This Book
                </Button>
                <Button variant="outlined" sx={{ fontWeight: 900, px: 3, py: 1.5, borderRadius: 3, color: 'text.primary', borderColor: 'divider' }}>
                   Listen Audiobook
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      )}

      {/* Course Grid Header */}
      <Box sx={{ px: { xs: 2, md: 4 }, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
          {searchQuery ? 'Search Results' : 'New Books'}
        </Typography>
        {isStaff && (
          <Button 
            variant="text" 
            startIcon={<Plus size={18} />} 
            onClick={() => {
              setEditingCourse(null);
              setFormData({
                name: '',
                code: '',
                description: '',
                duration: '',
                fee: 0,
                teacherName: currentUser?.displayName || '',
                teacherId: currentUser?.uid || '',
                thumbnailUrl: '',
                sections: [],
                isPublished: true,
                classLevelId: 'all',
                assignedTeachers: [],
                targetClassLevels: []
              });
              setOpenDialog(true);
            }}
            sx={{ fontWeight: 800, textTransform: 'none', color: 'primary.main' }}
          >
            Add Subject
          </Button>
        )}
      </Box>

      <Box sx={{ px: { xs: 2, md: 4 } }}>
        <Grid container spacing={4}>
          <AnimatePresence mode="popLayout">
            {filteredCourses.map((course, index) => (
              <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={course.id}>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.02 }}
                >
                  <BookCard 
                    course={course} 
                    onRead={() => handleReadCourse(course)}
                    teacherPhoto={allTeachers.find(m => m.uid === course.teacherId)?.photoURL}
                  />
                </motion.div>
              </Grid>
            ))}
          </AnimatePresence>
        </Grid>
      </Box>

      {/* Floating Bottom Nav */}
      <Paper sx={{ 
        position: 'fixed', 
        bottom: 24, 
        left: '50%', 
        transform: 'translateX(-50%)',
        width: { xs: '90%', sm: 400 },
        height: 64,
        borderRadius: '24px',
        bgcolor: '#E9C46A', 
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        px: 2
      }}>
        <IconButton sx={{ color: '#000', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
           <Layout size={22} /><Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Home</Typography>
        </IconButton>
        <IconButton sx={{ color: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
           <Search size={22} /><Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Explore</Typography>
        </IconButton>
        <IconButton sx={{ color: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
           <Bookmark size={22} /><Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Saved</Typography>
        </IconButton>
        <IconButton sx={{ color: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
           <User size={22} /><Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.6rem' }}>Profile</Typography>
        </IconButton>
      </Paper>

      {filteredCourses.length === 0 && (
        <Box sx={{ p: 10, textAlign: 'center' }}>
          <BookOpen size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No subjects found</Typography>
          <Typography variant="body2" color="text.secondary">Try adjusting your search query or add a new subject</Typography>
        </Box>
      )}

      {/* Snackbar for Feedback */}
      <Dialog 
        open={snackbar.open} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        PaperProps={{ sx: { borderRadius: 4, p: 2, textAlign: 'center' } }}
      >
        <DialogContent>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
            <CheckCircle size={48} color={theme.palette.success.main} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>Success / Completion</Typography>
          <Typography variant="body2" color="text.secondary">{snackbar.message}</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button variant="contained" onClick={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: 2, fontWeight: 800, px: 4 }}>
            Okay
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="lg" 
        fullWidth
        fullScreen
        PaperProps={{ 
          sx: { 
            borderRadius: 0,
            bgcolor: 'background.paper',
            backgroundImage: 'none'
          } 
        }}
      >
        <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary' }}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => setOpenDialog(false)} edge="start" sx={{ color: 'text.secondary' }}>
                <X size={24} />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                {editingCourse ? 'Update Subject' : 'Create New Subject'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                onClick={() => setOpenDialog(false)} 
                sx={{ fontWeight: 700, color: 'text.secondary' }}
              >
                Cancel
              </Button>
              <Button 
                variant="contained" 
                onClick={handleSave}
                startIcon={<Save size={18} />}
                sx={{ 
                  borderRadius: 2, 
                  fontWeight: 900, 
                  px: 4,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                  }
                }}
              >
                {editingCourse ? 'Update Subject' : 'Create Subject'}
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: { xs: 2, md: 6 }, position: 'relative' }}>
          {submitting && (
            <Box sx={{ 
              position: 'absolute', 
              inset: 0, 
              zIndex: 10, 
              bgcolor: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              >
                <Zap size={60} color={theme.palette.primary.main} />
              </motion.div>
              <Box sx={{ width: 200 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, textAlign: 'center' }}>Updating Sabq...</Typography>
                <LinearProgress sx={{ borderRadius: 2, height: 6 }} />
              </Box>
            </Box>
          )}
          <Grid container spacing={6}>
            {/* Left Column: Basic Info */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1, display: 'block' }}>
                    Course Identity
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        label="Subject Name"
                        placeholder="e.g. Science"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        variant="filled"
                        sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: alpha(theme.palette.action.hover, 0.4) } }}
                      />
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        label="Subject Code"
                        placeholder="e.g. SCI-101"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        variant="filled"
                        sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: alpha(theme.palette.action.hover, 0.4) } }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1, display: 'block' }}>
                    Branding & Media
                  </Typography>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 3, 
                      borderRadius: 4, 
                      textAlign: 'center',
                      borderStyle: 'dashed',
                      borderColor: formData.thumbnailUrl ? 'primary.main' : 'divider',
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    {formData.thumbnailUrl ? (
                      <Box sx={{ position: 'relative' }}>
                        <Box 
                          component="img" 
                          referrerPolicy="no-referrer"
                          src={formData.thumbnailUrl} 
                          sx={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 3, mb: 2 }} 
                        />
                        <Button 
                          variant="contained" 
                          color="error" 
                          size="small" 
                          onClick={() => setFormData(prev => ({ ...prev, thumbnailUrl: '' }))}
                          sx={{ position: 'absolute', top: 10, right: 10, borderRadius: 2 }}
                        >
                          Remove
                        </Button>
                      </Box>
                    ) : (
                      <Box sx={{ py: 2 }}>
                        <Box sx={{ p: 2, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.05), display: 'inline-flex', mb: 2 }}>
                          <ImageIcon size={40} className="text-primary-500" />
                        </Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Course Thumbnail</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                          Upload a high-quality cover image (Max 2MB)
                        </Typography>
                        <Button 
                          component="label" 
                          variant="outlined" 
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                        >
                          Choose File
                          <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'thumbnail')} />
                        </Button>
                      </Box>
                    )}
                  </Paper>
                </Box>

                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1, display: 'block' }}>
                    Target Classes & Teachers
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>Select Class Levels</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                      {CLASS_LEVELS.filter(l => !l.includes('manager') && !l.includes('superadmin')).map(level => {
                        const isSelected = formData.targetClassLevels.includes(level);
                        return (
                          <Chip 
                            key={level} 
                            label={level} 
                            onClick={() => {
                              const newLevels = isSelected 
                                ? formData.targetClassLevels.filter(g => g !== level)
                                : [...formData.targetClassLevels, level];
                              setFormData({ ...formData, targetClassLevels: newLevels });
                            }}
                            variant={isSelected ? "filled" : "outlined"}
                            color={isSelected ? "primary" : "default"}
                            sx={{ fontWeight: 700, borderRadius: 2 }}
                          />
                        );
                      })}
                    </Box>

                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>Assigned Teachers</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {allTeachers.map(teacher => {
                        const isSelected = formData.assignedTeachers.includes(teacher.uid);
                        return (
                          <Chip 
                            key={teacher.uid} 
                            avatar={<Avatar src={teacher.photoURL} imgProps={{ referrerPolicy: 'no-referrer' }}>{teacher.displayName?.charAt(0)}</Avatar>}
                            label={teacher.displayName} 
                            onClick={() => {
                              const newTeachers = isSelected 
                                ? formData.assignedTeachers.filter(id => id !== teacher.uid)
                                : [...formData.assignedTeachers, teacher.uid];
                              setFormData({ ...formData, assignedTeachers: newTeachers });
                            }}
                            variant={isSelected ? "filled" : "outlined"}
                            color={isSelected ? "primary" : "default"}
                            sx={{ fontWeight: 700, borderRadius: 2 }}
                          />
                        );
                      })}
                    </Box>
                  </Paper>
                </Box>

                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1, display: 'block' }}>
                    Course Logistics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        label="Course Duration"
                        placeholder="e.g. 6 Months, 1 Year"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        variant="filled"
                        sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: alpha(theme.palette.action.hover, 0.4) } }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Stack>
            </Grid>

            {/* Right Column: Content/Modules */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1.5, display: 'block' }}>
                  Educational Content (Modules)
                </Typography>
                
                <Paper 
                  id="lesson-editor-entry" 
                  variant="outlined" 
                  sx={{ 
                    p: { xs: 2.5, sm: 4 }, 
                    borderRadius: 6, 
                    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.4) : '#fff', 
                    mb: 4, 
                    border: `1px solid ${alpha(theme.palette.divider, 0.08)}`, 
                    boxShadow: theme.palette.mode === 'dark' ? 'none' : '0 15px 50px rgba(0,0,0,0.03)',
                    position: 'relative'
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 950, mb: 4, display: 'flex', alignItems: 'center', gap: 2.5, letterSpacing: -1 }}>
                    <Box sx={{ 
                      width: 52, 
                      height: 52, 
                      borderRadius: 2, 
                      bgcolor: alpha(theme.palette.primary.main, 0.1), 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: 'primary.main', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                      {editingSectionIdx !== null ? <Edit2 size={26} /> : <Plus size={26} />}
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 2, lineHeight: 1, mb: 1 }}>
                        Dynamic Module
                      </Typography>
                      {editingSectionIdx !== null ? 'Update Lesson' : 'Add New Lesson'}
                    </Box>
                  </Typography>

                  <Stack spacing={3.5}>
                    <TextField
                      fullWidth
                      label="Lesson Title"
                      placeholder="e.g. Introduction to Quranic Science"
                      value={newSection.title}
                      onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
                      variant="outlined"
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          borderRadius: 4,
                          bgcolor: alpha(theme.palette.action.hover, 0.1),
                          '& fieldset': { borderColor: 'transparent' },
                          '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.2) },
                          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                        } 
                      }}
                    />

                    <Box sx={{ p: 1, bgcolor: alpha(theme.palette.action.hover, 0.1), borderRadius: 4 }}>
                      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
                        {['text', 'audio', 'video', 'image', 'quiz'].map((type) => (
                          <Chip 
                            key={type}
                            label={type.toUpperCase()}
                            onClick={() => setNewSection(prev => ({ ...prev, type: type as any }))}
                            variant={newSection.type === type ? "filled" : "outlined"}
                            color={newSection.type === type ? "primary" : "default"}
                            sx={{ 
                              fontWeight: 900, 
                              borderRadius: 3, 
                              px: 1.5,
                              transition: 'all 0.3s',
                              boxShadow: newSection.type === type ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}` : 'none',
                              fontSize: '0.75rem'
                            }}
                          />
                        ))}
                      </Stack>
                    </Box>

                    {newSection.type !== 'text' && newSection.type !== 'quiz' && (
                      <Box sx={{ p: 2, border: `1px dashed ${alpha(theme.palette.divider, 0.2)}`, borderRadius: 4 }}>
                         <TextField
                            fullWidth
                            label={`${newSection.type.toUpperCase()} URL`}
                            placeholder="https://..."
                            value={newSection.mediaUrl}
                            onChange={(e) => setNewSection({ ...newSection, mediaUrl: e.target.value })}
                            variant="standard"
                            sx={{ mb: 2, '& .MuiInput-underline:before': { borderBottom: 'none' }, '& .MuiInput-underline:after': { borderBottom: 'none' } }}
                          />
                          {(['image', 'file', 'audio'].includes(newSection.type)) && (
                            <Button 
                              component="label" 
                              variant="outlined" 
                              fullWidth 
                              startIcon={<ExternalLink size={18} />}
                              sx={{ py: 1.5, borderRadius: 3, fontWeight: 900, textTransform: 'none', bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                            >
                               {newSection.mediaUrl ? 'Change File' : `Select ${newSection.type} File`}
                              <input type="file" hidden onChange={(e) => handleFileUpload(e, 'section')} />
                            </Button>
                          )}
                      </Box>
                    )}

                    {newSection.type === 'quiz' && (
                      <Box sx={{ p: 3, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 4, border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ClipboardList size={18} /> Build Quiz Questions
                        </Typography>
                        <Stack spacing={2.5} sx={{ mb: 3 }}>
                           <TextField
                              fullWidth
                              label="Question"
                              variant="outlined"
                              value={currentQuizQuestion.question}
                              onChange={(e) => setCurrentQuizQuestion({ ...currentQuizQuestion, question: e.target.value })}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                           />
                            <Grid container spacing={2}>
                              {currentQuizQuestion.options.map((opt, i) => (
                                <Grid size={6} key={i}>
                                  <TextField
                                    fullWidth
                                    label={`Option ${i + 1}`}
                                    value={opt}
                                    variant="outlined"
                                    size="small"
                                    onChange={(e) => {
                                      const newOpts = [...currentQuizQuestion.options];
                                      newOpts[i] = e.target.value;
                                      setCurrentQuizQuestion({ ...currentQuizQuestion, options: newOpts });
                                    }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                                  />
                                </Grid>
                              ))}
                            </Grid>
                            <FormControl fullWidth size="small">
                              <InputLabel>Correct Answer</InputLabel>
                              <Select
                                value={currentQuizQuestion.correctAnswer}
                                label="Correct Answer"
                                onChange={(e) => setCurrentQuizQuestion({ ...currentQuizQuestion, correctAnswer: Number(e.target.value) })}
                                sx={{ borderRadius: 2.5 }}
                              >
                                {[0, 1, 2, 3].map(i => (
                                  <MenuItem key={i} value={i}>Option {i + 1}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Button 
                              variant="contained" 
                              onClick={handleAddQuizQuestion} 
                              startIcon={<Plus size={18} />} 
                              sx={{ borderRadius: 3, fontWeight: 900, py: 1.5, textTransform: 'none', background: 'linear-gradient(45deg, #0d9488, #2dd4bf)' }}
                            >
                              Add to Quiz Pool
                            </Button>
                        </Stack>
                      </Box>
                    )}

                    <Box sx={{ 
                      '& .CodeMirror': { 
                        bgcolor: theme.palette.mode === 'dark' ? '#000' : '#fff',
                      },
                      '& .editor-toolbar': {
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        bgcolor: theme.palette.mode === 'dark' ? alpha('#fff', 0.05) : '#f8f9fa'
                      }
                    }}>
                      <SimpleMDE 
                        value={newSection.content} 
                        onChange={(value) => setNewSection(prev => ({ ...prev, content: value }))} 
                        options={useMemo(() => ({
                          placeholder: "Write lesson content here (Markdown support)...",
                          spellChecker: false,
                          status: false,
                          minHeight: isMobile ? "150px" : "300px",
                          toolbar: isMobile 
                            ? ["bold", "italic", "heading", "|", "unordered-list", "preview"] 
                            : ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen"]
                        }), [isMobile])}
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, pt: 2 }}>
                      <Button 
                        variant="contained" 
                        fullWidth
                        onClick={handleAddSection} 
                        startIcon={editingSectionIdx !== null ? <CheckCircle size={20} /> : <Plus size={20} />}
                        sx={{ 
                          borderRadius: 4, fontWeight: 950, py: 2, 
                          fontSize: '1rem',
                          textTransform: 'none',
                          boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.35)}`,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
                          '&:hover': {
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                            boxShadow: `0 15px 40px ${alpha(theme.palette.primary.main, 0.4)}`,
                          }
                        }}
                      >
                        {editingSectionIdx !== null ? 'Hifz Sabaq Update' : 'Publish as Section'}
                      </Button>
                      
                      {editingSectionIdx !== null && (
                        <Button 
                          variant="outlined" 
                          color="inherit"
                          onClick={() => {
                            setEditingSectionIdx(null);
                            setNewSection({ 
                              title: '', content: '', type: 'text', mediaUrl: '',
                              quizData: { questions: [], passingScore: 70 }
                            });
                          }} 
                          sx={{ fontWeight: 900, borderRadius: 4, px: 4, textTransform: 'none' }}
                        >
                          Discard
                        </Button>
                      )}
                    </Box>
                  </Stack>
                </Paper>

                <Box sx={{ maxHeight: 600, overflow: 'auto', pr: 1, pb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 950, mb: 2.5, px: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Layers size={22} className="text-primary-500" />
                    Course Soundtrack / Lessons ({formData.sections.length})
                  </Typography>
                  {formData.sections.length === 0 ? (
                    <Box sx={{ p: 6, textAlign: 'center', bgcolor: alpha(theme.palette.action.hover, 0.5), borderRadius: 6, border: '2px dashed', borderColor: 'divider' }}>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.secondary' }}>No lessons added yet.</Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1.5}>
                      {formData.sections.map((s, i) => (
                        <Card 
                          key={i} 
                          variant="outlined" 
                          sx={{ 
                            borderRadius: 2, p: 2, 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05), borderColor: 'primary.main', transform: 'scale(1.01)' }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                            <Avatar sx={{ 
                              width: 48, height: 48, 
                              borderRadius: 3, 
                              bgcolor: alpha(theme.palette.primary.main, 0.1), 
                              color: 'primary.main',
                              fontWeight: 900,
                              fontSize: '1.2rem'
                            }}>
                              {i + 1}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>{s.title}</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
                                <Chip 
                                  label={s.type.toUpperCase()} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 900, borderRadius: 1 }} 
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                  {s.content ? `${s.content.substring(0, 40)}...` : 'Media Content'}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <IconButton size="small" color="primary" onClick={() => handleEditSection(i)}>
                               <Edit2 size={18} />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => setFormData({ ...formData, sections: formData.sections.filter((_, idx) => idx !== i) })}>
                              <Trash2 size={18} />
                            </IconButton>
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Full Width Description */}
            <Grid size={12}>
              <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1, display: 'block' }}>
                Course Overview (Bio)
              </Typography>
              <TextField
                fullWidth
                label="Long Description"
                placeholder="Give a detailed overview of the curriculum and what makes it special..."
                multiline
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                variant="filled"
                sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: alpha(theme.palette.action.hover, 0.4) } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <Box sx={{ mt: 6, p: 4, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Info size={24} className="text-primary-500" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Remember to save your changes using the "{editingCourse ? 'Update' : 'Create'} Subject" button in the top right corner.
          </Typography>
        </Box>
      </Dialog>

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
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: -1 }}>{selectedTeacher.displayName}</Typography>
            <Chip 
              icon={<Award size={16} />}
              label={selectedTeacher.role === 'superadmin' ? 'Administrator' : 'Teacher'} 
              color="primary"
              variant="outlined"
              sx={{ mb: 4, fontWeight: 800, borderRadius: 2 }}
            />
            
            <Paper sx={{ p: 3, borderRadius: 4, bgcolor: alpha(theme.palette.action.hover, 0.3), border: '1px solid', borderColor: 'divider', mb: 4 }}>
              <Grid container spacing={3} textAlign="left">
                <Grid size={{ xs: 12 }}>
                   <Stack direction="row" spacing={2} alignItems="center">
                     <Book size={20} color={theme.palette.primary.main} />
                     <Box>
                       <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.6, display: 'block' }}>EXPERTISE</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedTeacher.subject || 'Islamic Theology & Guidance'}</Typography>
                     </Box>
                   </Stack>
                </Grid>
                <Grid size={{ xs: 12 }}>
                   <Stack direction="row" spacing={2} alignItems="center">
                     <Calendar size={20} color={theme.palette.primary.main} />
                     <Box>
                       <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.6, display: 'block' }}>JOINED DATE</Typography>
                       <Typography variant="body2" sx={{ fontWeight: 700 }}>{format(new Date(selectedTeacher.createdAt || Date.now()), 'dd MMM yyyy')}</Typography>
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

      {/* Course Reader Dialog */}
      <Dialog 
        fullScreen 
        open={openReader} 
        onClose={() => setOpenReader(false)} 
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' } as any}
        PaperProps={{ 
          sx: { 
            bgcolor: 'background.default',
            backgroundImage: 'none'
          } 
        }}
      >
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary' }}>
            <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => setOpenReader(false)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) } }}>
                  <X size={20} />
                </IconButton>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1, color: 'primary.main', mb: 0.5 }}>LEARNING HUB</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.8 }} noWrap>{viewingCourse?.name}</Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mr: 2 }}>
                  <Eye size={18} />
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{viewingCourse?.views || 0} Views</Typography>
                </Box>
                <Chip 
                  label={`${activeSection + 1} / ${viewingCourse?.sections?.length || 0}`} 
                  size="small" 
                  sx={{ fontWeight: 900, bgcolor: 'primary.main', color: 'white', px: 1 }} 
                />
              </Stack>
            </Toolbar>
            {readerLoading && <LinearProgress sx={{ height: 3 }} />}
          </AppBar>

          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 0, bgcolor: theme.palette.mode === 'dark' ? '#0a0a0a' : '#f4f7f6' }}>
            <Container maxWidth={false} sx={{ height: '100%', p: 0 }}>
              <Grid container sx={{ minHeight: '100%' }}>
                {/* Visual Rail - Audiobook Style */}
                <Grid size={{ xs: 12, md: 6 }} sx={{ 
                  bgcolor: 'background.paper', 
                  borderRight: '1px solid', 
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: { md: 'calc(100vh - 64px)' },
                  minHeight: { xs: '50vh', md: 'auto' },
                  overflow: 'auto',
                  position: { md: 'sticky' },
                  top: 0
                }}>
                  <Box sx={{ p: { xs: 4, md: 6 }, textAlign: 'center' }}>
                    <motion.div
                      key={activeSection}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', damping: 20 }}
                    >
                      <Card sx={{ 
                        borderRadius: 10, 
                        overflow: 'hidden', 
                        boxShadow: '0 30px 60px rgba(0,0,0,0.15)',
                        aspectRatio: '1/1',
                        mb: 4,
                        position: 'relative'
                      }}>
                        <Box 
                          component="img"
                          referrerPolicy="no-referrer"
                          src={viewingCourse?.sections?.[activeSection]?.mediaUrl || viewingCourse?.thumbnailUrl || `https://picsum.photos/seed/${viewingCourse?.id}/800`}
                          sx={{ 
                            width: '100%', height: '100%', objectFit: 'cover',
                            filter: readerLoading ? 'blur(10px)' : 'none',
                            transition: 'filter 0.4s ease'
                          }}
                        />
                        {viewingCourse?.sections?.[activeSection]?.type === 'audio' && (
                          <Box sx={{ 
                            position: 'absolute', bottom: 20, right: 20,
                            width: 50, height: 50, borderRadius: '50%',
                            bgcolor: 'primary.main', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                          }}>
                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                              <Music size={24} />
                            </motion.div>
                          </Box>
                        )}
                      </Card>
                    </motion.div>

                    <Typography variant="h4" sx={{ fontWeight: 950, mb: 1, letterSpacing: -1.5 }}>
                      {viewingCourse?.sections?.[activeSection]?.title}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 700, mb: 4, opacity: 0.7 }}>
                      {viewingCourse?.name} • Module {activeSection + 1}
                    </Typography>

                    {viewingCourse?.sections?.[activeSection]?.type === 'audio' && viewingCourse?.sections?.[activeSection]?.mediaUrl && (
                      <Box sx={{ mb: 6, p: 3, borderRadius: 5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                        <audio 
                          controls 
                          style={{ width: '100%' }}
                          src={viewingCourse.sections[activeSection].mediaUrl}
                        />
                        <Typography variant="caption" sx={{ mt: 1, display: 'block', fontWeight: 800, color: 'primary.main' }}>
                          Now Playing: Original Audio Lesson
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ textAlign: 'left' }}>
                       <Typography variant="overline" sx={{ fontWeight: 900, color: 'text.disabled', letterSpacing: 2 }}>COURSE TRACKS</Typography>
                       <Stack spacing={1} sx={{ mt: 2 }}>
                         {viewingCourse?.sections?.map((section, idx) => (
                           <Box
                             key={idx}
                             onClick={() => handleSectionChange(idx)}
                             sx={{
                               p: 2, borderRadius: 4, cursor: 'pointer',
                               display: 'flex', alignItems: 'center', gap: 2,
                               transition: 'all 0.2s',
                               bgcolor: activeSection === idx ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                               '&:hover': { bgcolor: activeSection === idx ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.action.hover, 0.5) }
                             }}
                           >
                             <Avatar sx={{ 
                               width: 32, height: 32, fontSize: '0.8rem', fontWeight: 900,
                               bgcolor: activeSection === idx ? 'primary.main' : 'divider',
                               color: activeSection === idx ? 'white' : 'text.secondary'
                             }}>
                               {idx + 1}
                             </Avatar>
                             <Box sx={{ flex: 1 }}>
                               <Typography variant="body2" sx={{ fontWeight: activeSection === idx ? 900 : 700, color: activeSection === idx ? 'primary.main' : 'text.primary' }} noWrap>
                                 {section.title}
                               </Typography>
                               <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.5 }}>{section.type.toUpperCase()}</Typography>
                             </Box>
                             {activeSection === idx && <CheckCircle size={16} style={{ flexShrink: 0 }} className="text-primary-500" />}
                           </Box>
                         ))}
                       </Stack>
                    </Box>
                  </Box>
                </Grid>

                {/* Content Side */}
                <Grid size={{ xs: 12, md: 6 }} sx={{ p: { xs: 4, md: 8, lg: 10 } }}>
                  <Box id="reader-content-top" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSection}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.4 }}
                    >
                      {/* Media Display */}
                      {viewingCourse?.sections?.[activeSection]?.type === 'video' && viewingCourse?.sections?.[activeSection]?.mediaUrl && (
                        <Box sx={{ mb: 6, borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                           <iframe 
                             width="100%" 
                             height="500" 
                             src={viewingCourse.sections[activeSection].mediaUrl.replace('watch?v=', 'embed/')} 
                             title="Lesson Video" 
                             frameBorder="0" 
                             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                             allowFullScreen
                           />
                        </Box>
                      )}

                      {viewingCourse?.sections?.[activeSection]?.type === 'image' && viewingCourse?.sections?.[activeSection]?.mediaUrl && (
                        <Box sx={{ mb: 6, borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                           <Box 
                             component="img" 
                             referrerPolicy="no-referrer"
                             src={viewingCourse.sections[activeSection].mediaUrl} 
                             sx={{ width: '100%', maxHeight: 800, objectFit: 'contain', bgcolor: '#000' }} 
                            />
                        </Box>
                      )}

                      {viewingCourse?.sections?.[activeSection]?.type === 'file' && viewingCourse?.sections?.[activeSection]?.mediaUrl && (
                        <Paper sx={{ mb: 6, p: 4, borderRadius: 6, bgcolor: alpha(theme.palette.primary.main, 0.05), border: '2px dashed', borderColor: 'primary.main', display: 'flex', alignItems: 'center', gap: 3 }}>
                           <Paperclip size={40} style={{ flexShrink: 0 }} className="text-primary-500" />
                           <Box sx={{ flex: 1 }}>
                             <Typography variant="h6" sx={{ fontWeight: 900 }}>Resource Pack Attached</Typography>
                             <Typography variant="body2" sx={{ opacity: 0.7, fontWeight: 600 }}>Download the supplementary material for this lesson.</Typography>
                           </Box>
                           <Button 
                            variant="contained" 
                            href={viewingCourse.sections[activeSection].mediaUrl} 
                            target="_blank" 
                            sx={{ 
                              borderRadius: 3, 
                              fontWeight: 950,
                              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
                              boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
                              '&:hover': {
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                              }
                            }}
                          >
                            Download
                          </Button>
                        </Paper>
                      )}

                      {/* Text Content */}
                      <Box 
                        sx={{ 
                          direction: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 'rtl' : 'ltr',
                          '& p': { 
                            mb: '2.5rem', 
                            lineHeight: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 2.8 : 1.9,
                            fontSize: '1.4rem', 
                            color: 'text.primary',
                            fontFamily: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 'var(--font-urdu)' : 'inherit',
                            textAlign: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 'justify' : 'left',
                            wordSpacing: '0.05em'
                          },
                          '& li': { 
                            mb: '1.2rem', 
                            fontSize: '1.3rem', 
                            color: 'text.primary', 
                            lineHeight: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 2.5 : 1.6 
                          },
                          '& h1, & h2, & h3': { mb: 4, mt: 8, fontWeight: 950, color: 'text.primary', letterSpacing: -1.5, lineHeight: 1.1 },
                          '& blockquote': {
                            borderRight: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? '6px solid' : 'none',
                            borderLeft: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 'none' : '6px solid',
                            borderColor: 'primary.main',
                            pr: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 4 : 0,
                            pl: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 0 : 4,
                            py: 2, my: 6,
                            fontStyle: 'italic',
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            borderRadius: 3,
                            fontSize: '1.5rem',
                            lineHeight: 1.5
                          },
                          '& img': { maxWidth: '100%', borderRadius: 6, my: 4, boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }
                        }}
                      >
                         <div className="markdown-body">
                           <ReactMarkdown>{viewingCourse?.sections?.[activeSection]?.content || ''}</ReactMarkdown>
                         </div>
                      </Box>

                      {activeSection === (viewingCourse?.sections?.length || 0) - 1 && ReaderTeacher && (
                        <Box sx={{ 
                          mt: 10, p: 4, borderRadius: 6, 
                          bgcolor: alpha(theme.palette.primary.main, 0.05), 
                          border: '1px solid', 
                          borderColor: alpha(theme.palette.primary.main, 0.1),
                          display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
                          alignItems: 'center', gap: 3
                        }}>
                          <Avatar 
                            src={ReaderTeacher.photoURL} 
                            sx={{ width: 80, height: 80, border: `3px solid ${theme.palette.primary.main}`, boxShadow: 4 }}
                            imgProps={{ referrerPolicy: 'no-referrer' }}
                          >
                            {ReaderTeacher.displayName?.charAt(0)}
                          </Avatar>
                          <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                            <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', opacity: 0.8 }}>Teacher Portfolio</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 950, mb: 0.5 }}>{ReaderTeacher.displayName}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.7 }}>{ReaderTeacher.subject || 'Islamic Theology & Guidance'}</Typography>
                          </Box>
                          <Button 
                            variant="outlined" 
                            size="small" 
                            onClick={() => showTeacherProfile(ReaderTeacher.uid)}
                            sx={{ 
                              borderRadius: 3, 
                              fontWeight: 900,
                              borderColor: alpha(theme.palette.primary.main, 0.5),
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                borderColor: theme.palette.primary.main
                              }
                            }}
                          >
                            View Bio
                          </Button>
                        </Box>
                      )}

                      {viewingCourse?.sections?.[activeSection]?.quizData?.questions?.length > 0 && (
                        <Box sx={{ mt: 10 }}>
                          <Divider sx={{ mb: 6 }} />
                          <Typography variant="h4" sx={{ fontWeight: 950, mb: 4, letterSpacing: -1 }}>Knowledge Check</Typography>
                          <QuizViewer 
                            quiz={viewingCourse.sections[activeSection].quizData} 
                            sectionId={viewingCourse.sections[activeSection].id || activeSection.toString()} 
                            courseId={viewingCourse?.id || ''}
                            currentUser={currentUser}
                          />
                        </Box>
                      )}

                      <Box sx={{ mt: 15, pt: 6, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                          disabled={activeSection === 0}
                          onClick={() => handleSectionChange(activeSection - 1)}
                          startIcon={<ChevronLeft />}
                          sx={{ borderRadius: 3, fontWeight: 900, px: 4, py: 1.5, fontSize: '1rem' }}
                        >
                          Previous
                        </Button>
                        
                        {activeSection < (viewingCourse?.sections?.length || 0) - 1 ? (
                          <Button
                            variant="contained"
                            onClick={() => handleSectionChange(activeSection + 1)}
                            endIcon={<ChevronRight />}
                            sx={{ 
                              borderRadius: 5, fontWeight: 950, px: 6, py: 2,
                              fontSize: '1.2rem',
                              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
                              boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.35)}`,
                              '&:hover': { 
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                                transform: 'translateY(-3px)',
                                boxShadow: `0 15px 30px ${alpha(theme.palette.primary.main, 0.45)}`,
                              }
                            }}
                          >
                            Next Lesson
                          </Button>
                        ) : (
                          <Box sx={{ 
                            p: 4, borderRadius: 6, bgcolor: alpha(theme.palette.success.main, 0.08), border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.2),
                            display: 'flex', alignItems: 'center', gap: 3
                          }}>
                            <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: 'success.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Trophy size={32} />
                            </Box>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 950, color: 'success.main', lineHeight: 1 }}>Course Track Completed!</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, mt: 0.5 }}>MashAllah, you have successfully finished this curriculum.</Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </motion.div>
                  </AnimatePresence>
                </Grid>
              </Grid>
            </Container>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}

function QuizViewer({ quiz, sectionId, courseId, currentUser }: { quiz: any, sectionId: string, courseId: string, currentUser: any }) {
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSelect = (idx: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentStep] = idx;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = async () => {
    if (currentStep < quiz.questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      let correct = 0;
      quiz.questions.forEach((q: any, i: number) => {
        if (selectedAnswers[i] === q.correctAnswer) correct++;
      });
      
  const percentage = (correct / quiz.questions.length) * 100;
  const passingScore = quiz.passingScore || 70;
  setScore(correct);
  setShowResults(true);

  // Save results to Firestore
  if (currentUser) {
    setSubmitting(true);
    try {
      await smartAddDoc(collection(db, 'quiz_results'), {
        studentId: currentUser.uid,
        studentName: currentUser.displayName,
        courseId,
        sectionId,
        score: correct,
        totalQuestions: quiz.questions.length,
        percentage,
        passed: percentage >= passingScore,
        timestamp: Date.now(),
        classLevel: currentUser.classLevel || 'N/A'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'quiz_results');
    } finally {
      setSubmitting(false);
    }
  }
    }
  };

  if (showResults) {
    const percentage = (score / quiz.questions.length) * 100;
    const passingScore = quiz.passingScore || 70;
    return (
      <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
        <Trophy size={64} color={percentage >= passingScore ? "#FFD700" : "#888"} />
        <Typography variant="h4" sx={{ mt: 2, mb: 1, fontWeight: 900, color: '#fff' }}>
          {percentage >= passingScore ? "Mubarak!" : "Keep Practicing"}
        </Typography>
        <Typography variant="h6" sx={{ mb: 3, color: 'text.secondary' }}>
          Your Score: {score} / {quiz.questions.length} ({Math.round(percentage)}%)
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
           {quiz.questions.map((q: any, i: number) => (
             <Box key={i} sx={{ textAlign: 'left', p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
               <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>{i+1}. {q.question}</Typography>
               <Typography variant="caption" sx={{ color: selectedAnswers[i] === q.correctAnswer ? '#4caf50' : '#f44336' }}>
                 Your Answer: {q.options[selectedAnswers[i]] || 'None'}
                 {selectedAnswers[i] !== q.correctAnswer && ` (Correct: ${q.options[q.correctAnswer]})`}
               </Typography>
             </Box>
           ))}
        </Box>
        <Button 
          variant="contained" 
          sx={{ 
            mt: 4, 
            borderRadius: 3, 
            fontWeight: 950,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
            boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
          }} 
          onClick={() => { setShowResults(false); setCurrentStep(0); setSelectedAnswers([]); }}
        >
          Retry Quiz
        </Button>
      </Box>
    );
  }

  const q = quiz.questions[currentStep];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 900 }}>Question {currentStep + 1} of {quiz.questions.length}</Typography>
        <Chip label={`${Math.floor((currentStep / quiz.questions.length) * 100)}% Complete`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
      </Box>
      <Typography variant="h5" sx={{ mb: 4, fontWeight: 700, color: '#fff' }}>{q.question}</Typography>
      <Stack spacing={2} sx={{ mb: 4 }}>
        {q.options.map((opt: string, idx: number) => (
          <Button 
            key={idx} 
            variant={selectedAnswers[currentStep] === idx ? "contained" : "outlined"} 
            fullWidth 
            onClick={() => handleSelect(idx)}
            sx={{ 
               justifyContent: 'flex-start', 
               py: 2, 
               px: 3, 
               borderRadius: 2,
               textTransform: 'none',
               fontSize: '1rem',
               borderColor: 'rgba(255,255,255,0.2)',
               color: selectedAnswers[currentStep] === idx ? '#000' : '#fff',
               bgcolor: selectedAnswers[currentStep] === idx ? '#fff' : 'transparent',
               '&:hover': { bgcolor: selectedAnswers[currentStep] === idx ? '#eee' : 'rgba(255,255,255,0.05)' }
            }}
          >
            {opt}
          </Button>
        ))}
      </Stack>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)} sx={{ color: 'rgba(255,255,255,0.6)' }}>Back</Button>
        <Button 
          variant="contained" 
          onClick={handleNext} 
          disabled={selectedAnswers[currentStep] === undefined || submitting}
          sx={{
            borderRadius: 3,
            fontWeight: 950,
            px: 4,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
            boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
            '&:disabled': {
              background: alpha(theme.palette.action.disabledBackground, 0.12)
            }
          }}
        >
          {submitting ? <CircularProgress size={20} color="inherit" /> : (currentStep === quiz.questions.length - 1 ? "Submit Quiz" : "Next Question")}
        </Button>
      </Box>
    </Box>
  );
}


function BookCard({ 
  course, 
  onRead, 
  teacherPhoto 
}: { 
  course: Course, 
  onRead: () => void, 
  teacherPhoto?: string 
}) {
  const theme = useTheme();
  
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box 
        onClick={onRead}
        sx={{ 
          width: '100%', 
          aspectRatio: '2/3', 
          borderRadius: '4px 12px 12px 4px', 
          overflow: 'hidden', 
          cursor: 'pointer',
          position: 'relative',
          boxShadow: '0 5px 15px rgba(0,0,0,0.2), 10px 10px 20px rgba(0,0,0,0.1)',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          perspective: '1000px',
          '&:hover': {
            transform: 'rotateY(-15deg) translateY(-8px)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25), 15px 15px 30px rgba(0,0,0,0.1)',
            '& .overlay': { opacity: 1 },
            '& .book-spine': { opacity: 1 }
          }
        }}
      >
        {/* Book Spine Detail */}
        <Box className="book-spine" sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          background: 'linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.3) 100%)',
          zIndex: 5,
          opacity: 0.8,
          transition: 'opacity 0.3s'
        }} />
        
        <Box 
          component="img"
          referrerPolicy="no-referrer"
          src={course.thumbnailUrl || `https://picsum.photos/seed/${course.id}/300/450`}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        
        <Box className="overlay" sx={{ 
          position: 'absolute', inset: 0, 
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
          opacity: 0, transition: 'opacity 0.4s',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          pb: 4
        }}>
           <Box sx={{ 
             width: 48, height: 48, borderRadius: '50%', bgcolor: 'white', 
             display: 'flex', alignItems: 'center', justifyContent: 'center',
             color: 'primary.main', boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
             transform: 'scale(0.8)', transition: 'transform 0.4s',
             '.overlay:hover &': { transform: 'scale(1)' }
           }}>
              <BookOpen size={24} />
           </Box>
        </Box>
        
        <Box sx={{ 
          position: 'absolute', top: 12, right: 12, 
          bgcolor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
          px: 1.2, py: 0.5, borderRadius: 2, display: 'flex', 
          alignItems: 'center', gap: 0.5, color: '#E9C46A',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 6
        }}>
          <Star size={12} fill="#E9C46A" />
          <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '0.7rem' }}>Premium</Typography>
        </Box>
      </Box>
      <Typography noWrap variant="body2" sx={{ mt: 2, fontWeight: 900, fontFamily: '"Outfit", sans-serif', fontSize: '0.95rem' }}>
        {course.name}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {course.teacherName || "Instructed"}
      </Typography>
    </Box>
  );
}

function CourseCard({ course, isTeacher, isSuperAdmin, onEdit, onDelete, onRead, onShare, viewMode, onShowTeacher, teacherPhoto }: any) {
  return <BookCard course={course} onRead={() => onRead(course)} teacherPhoto={teacherPhoto} />;
}
