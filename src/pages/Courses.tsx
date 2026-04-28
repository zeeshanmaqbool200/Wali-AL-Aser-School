import React, { useState, useEffect } from 'react';
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
  Image as ImageIcon, Paperclip, Zap, FileText, Globe,
  Music, Trophy, HelpCircle, ChevronRight, ChevronLeft,
  RotateCcw, Info, Headphones, ArrowLeft, Save, ExternalLink, ClipboardList, Eye, Award, Calendar
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, or, and, limit, increment } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Course, CourseSection, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CLASS_LEVELS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
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
      await updateDoc(doc(db, 'courses', course.id), {
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

  const handleSave = async () => {
    if (!currentUser) return;
    try {
      const data = {
        ...formData,
        teacherName: formData.teacherName || currentUser.displayName,
        teacherId: formData.teacherId || currentUser.uid,
        updatedAt: Date.now()
      };

      if (editingCourse) {
        await updateDoc(doc(db, 'courses', editingCourse.id), data);
        setSnackbar({ open: true, message: 'Subject updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'courses'), { ...data, createdAt: Date.now() });
        setSnackbar({ open: true, message: 'New Subject added successfully!', severity: 'success' });
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
      handleFirestoreError(error, OperationType.WRITE, 'courses');
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
    try {
      await deleteDoc(doc(db, 'courses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${id}`);
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
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         c.code.toLowerCase().includes(searchQuery.toLowerCase());
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

  return (
    <Box sx={{ 
      pb: 8,
      minHeight: '100vh',
      background: theme.palette.mode === 'dark' 
        ? `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`
        : `linear-gradient(135deg, ${theme.palette.background.default} 0%, #f0f7f7 100%)`
    }}>
      <Box sx={{ p: 2 }}>
        <Button 
          variant="text" 
          startIcon={<ArrowLeft size={20} />} 
          onClick={() => navigate(-1)}
          sx={{ fontWeight: 800, color: 'text.secondary' }}
        >
          Back
        </Button>
      </Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Subjects</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Manage Islamic curriculum, Student enrollment, and learning paths
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end', alignItems: 'center' }}>
            <Box sx={{ 
              display: 'flex', 
              bgcolor: 'background.default', 
              p: 0.6, 
              borderRadius: 3,
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 2px 2px 4px #060a12, inset -2px -2px 4px #182442'
                : 'inset 2px 2px 4px #d1d9e6, inset -2px -2px 4px #ffffff',
            }}>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('grid')}
                sx={{ 
                  borderRadius: 2.5, 
                  p: 1,
                  bgcolor: viewMode === 'grid' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'grid' 
                    ? (theme.palette.mode === 'dark' ? '2px 2px 4px #060a12, -2px -2px 4px #182442' : '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff')
                    : 'none',
                  color: viewMode === 'grid' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layout size={isMobile ? 16 : 18} />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('list')}
                sx={{ 
                  borderRadius: 2.5, 
                  p: 1,
                  bgcolor: viewMode === 'list' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'list' 
                    ? (theme.palette.mode === 'dark' ? '2px 2px 4px #060a12, -2px -2px 4px #182442' : '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff')
                    : 'none',
                  color: viewMode === 'list' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layers size={isMobile ? 16 : 18} />
              </IconButton>
            </Box>
            {isStaff && (
              <Button 
                variant="contained" 
                startIcon={<Plus size={isMobile ? 18 : 22} />} 
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
                sx={{ 
                  borderRadius: 2, 
                  fontWeight: 800, 
                  px: isMobile ? 2 : 3, 
                  py: isMobile ? 1 : 1.2,
                  minHeight: isMobile ? 40 : 48,
                  textTransform: 'none',
                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '4px 4px 10px #060a12, -4px -4px 10px #182442'
                    : '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.palette.mode === 'dark'
                      ? '6px 6px 14px #060a12, -6px -6px 14px #182442'
                      : '6px 6px 14px #cbd5e1, -6px -6px 14px #ffffff',
                  }
                }}
              >
                {isMobile ? "Add" : "Add Subject"}
              </Button>
            )}
          </Stack>
        </Box>
      </motion.div>

      <Box sx={{ mb: 4 }}>
        <Paper 
          elevation={0} 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            px: 2, 
            borderRadius: 3, 
            border: 'none',
            bgcolor: 'background.default',
            boxShadow: theme.palette.mode === 'dark'
              ? 'inset 3px 3px 6px #060a12, inset -3px -3px 6px #182442'
              : 'inset 3px 3px 6px #d1d9e6, inset -3px -3px 6px #ffffff',
            gap: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, px: 1 }}>
            <Search size={22} color={theme.palette.text.secondary} />
            <Box 
              component="input" 
              placeholder="Search subjects by name, code, or teacher..." 
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              sx={{ 
                border: 'none', 
                outline: 'none', 
                p: 2.5, 
                width: '100%', 
                fontWeight: 800,
                fontSize: '1rem',
                bgcolor: 'transparent',
                color: 'text.primary',
                '&::placeholder': { color: 'text.disabled' }
              }} 
            />
          </Box>
          
          <FormControl size="small" sx={{ minWidth: 200, mr: 2 }}>
            <InputLabel sx={{ fontWeight: 800 }}>Class Level</InputLabel>
            <Select
              value={classLevelFilter}
              label="Class Level"
              onChange={(e) => setClassLevelFilter(e.target.value)}
              sx={{ 
                borderRadius: 2,
                fontWeight: 800,
                bgcolor: alpha(theme.palette.background.default, 0.5),
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                boxShadow: theme.palette.mode === 'dark'
                  ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                  : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
              }}
            >
              <MenuItem value="all" sx={{ fontWeight: 700 }}>All Levels</MenuItem>
              {CLASS_LEVELS.filter(level => !level.includes('manager') && !level.includes('superadmin')).map(g => (
                <MenuItem key={g} value={g} sx={{ fontWeight: 700 }}>{g}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
      </Box>

      <Grid container spacing={3}>
        <AnimatePresence mode="popLayout">
          {filteredCourses.map((course, index) => (
            <Grid size={{ xs: 12, sm: viewMode === 'list' ? 12 : 6, md: viewMode === 'list' ? 12 : 4 }} key={course.id}>
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <CourseCard 
                  course={course} 
                  isTeacher={isStaff} 
                  isSuperAdmin={isSuperAdmin}
                  onEdit={() => handleEdit(course)} 
                  onDelete={() => handleDelete(course.id)}
                  onRead={handleReadCourse}
                  viewMode={viewMode}
                  onShowTeacher={showTeacherProfile}
                  teacherPhoto={allTeachers.find(m => m.uid === course.teacherId)?.photoURL}
                />
              </motion.div>
            </Grid>
          ))}
        </AnimatePresence>
      </Grid>

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
                sx={{ borderRadius: 2, fontWeight: 900, px: 4 }}
              >
                {editingCourse ? 'Update Subject' : 'Create Subject'}
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: { xs: 2, md: 6 } }}>
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
                      }
                    }}>
                      <SimpleMDE 
                        key={editingSectionIdx ?? 'new'}
                        value={newSection.content} 
                        onChange={(value) => setNewSection({ ...newSection, content: value })} 
                        options={{
                          placeholder: "Write lesson content here (Markdown support)...",
                          spellChecker: false,
                          status: false,
                          minHeight: isMobile ? "150px" : "300px",
                          toolbar: isMobile 
                            ? ["bold", "italic", "heading", "|", "unordered-list", "preview"] 
                            : ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "|", "preview", "side-by-side", "fullscreen"]
                        }}
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
                          boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.3)}`,
                          background: `linear-gradient(to right, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
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
                <IconButton onClick={() => setOpenReader(false)} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>
                  <ArrowLeft size={20} />
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
                           <Button variant="contained" href={viewingCourse.sections[activeSection].mediaUrl} target="_blank" sx={{ borderRadius: 3, fontWeight: 900 }}>Download</Button>
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
                            sx={{ borderRadius: 3, fontWeight: 900 }}
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
                              bgcolor: 'primary.main',
                              boxShadow: `0 10px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                              '&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-3px)' }
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
      setScore(correct);
      setShowResults(true);

      // Save results to Firestore
      if (currentUser) {
        setSubmitting(true);
        try {
          await addDoc(collection(db, 'quiz_results'), {
            studentId: currentUser.uid,
            studentName: currentUser.displayName,
            courseId,
            sectionId,
            score: correct,
            totalQuestions: quiz.questions.length,
            percentage,
            passed: percentage >= quiz.passingScore,
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
    return (
      <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
        <Trophy size={64} color={percentage >= quiz.passingScore ? "#FFD700" : "#888"} />
        <Typography variant="h4" sx={{ mt: 2, mb: 1, fontWeight: 900, color: '#fff' }}>
          {percentage >= quiz.passingScore ? "Mubarak!" : "Keep Practicing"}
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
        <Button variant="contained" sx={{ mt: 4, borderRadius: 3 }} onClick={() => { setShowResults(false); setCurrentStep(0); setSelectedAnswers([]); }}>Retry Quiz</Button>
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
        <Button variant="contained" onClick={handleNext} disabled={selectedAnswers[currentStep] === undefined || submitting}>
          {submitting ? <CircularProgress size={20} color="inherit" /> : (currentStep === quiz.questions.length - 1 ? "Submit Quiz" : "Next Question")}
        </Button>
      </Box>
    </Box>
  );
}

import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';

function CourseCard({ course, isTeacher, isSuperAdmin, onEdit, onDelete, onRead, viewMode, onShowTeacher, teacherPhoto }: any) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const teacherActions: ActionMenuItem[] = [
    { label: 'Edit Subject', icon: <Edit2 size={16} />, onClick: onEdit },
    { label: 'Delete Subject', icon: <Trash2 size={16} />, color: 'error.main', onClick: onDelete, disabled: !isSuperAdmin }
  ];
  
  if (viewMode === 'list') {
    return (
      <Card sx={{ 
        borderRadius: 7, 
        mb: 3, 
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        border: 'none',
        bgcolor: 'background.paper',
        boxShadow: isDark 
          ? '2px 2px 6px #060a12, -2px -2px 6px #182442'
          : '2px 2px 6px #d1d9e6, -2px -2px 6px #ffffff',
        '&:hover': { 
          transform: 'translateX(10px)', 
          boxShadow: isDark 
            ? '4px 4px 10px #060a12, -4px -4px 10px #182442'
            : '4px 4px 10px #d1d9e6, -4px -4px 10px #ffffff',
        }
      }}>
        <CardContent sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Avatar 
            src={teacherPhoto}
            onClick={() => onShowTeacher(course.teacherId)}
            sx={{ 
              bgcolor: 'background.default', 
              color: 'primary.main', 
              borderRadius: 4, 
              width: 80, 
              height: 80,
              cursor: 'pointer',
              boxShadow: isDark
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
              '&:hover': { transform: 'scale(1.05)', transition: '0.3s' }
            }}
            imgProps={{ referrerPolicy: 'no-referrer' }}
          >
            {course.teacherName?.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -1 }}>{course.name}</Typography>
              <Chip label={course.code} size="small" sx={{ fontWeight: 900, height: 24, fontSize: '0.75rem', border: 'none', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {course.description}
            </Typography>
            <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
               <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                 <Eye size={16} />
                 <Typography variant="caption" sx={{ fontWeight: 800 }}>{course.views || 0} Views</Typography>
               </Box>
               <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled' }}>•</Typography>
               <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>{course.teacherName}</Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={4} sx={{ px: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', letterSpacing: 1.5, mb: 1 }}>TIME</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{course.duration}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', letterSpacing: 1.5, mb: 1 }}>SECTIONS</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: 'primary.main' }}>{course.sections?.length || 0}</Typography>
            </Box>
          </Stack>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {isTeacher && <ActionMenu items={teacherActions} />}
            <IconButton 
              aria-label="Read course"
              size="large" 
              onClick={() => onRead(course)}
              sx={{ 
                bgcolor: 'primary.main', 
                color: 'white', 
                boxShadow: '0 8px 16px rgba(15, 118, 110, 0.3)',
                '&:hover': { bgcolor: 'primary.dark' },
                p: 2
              }}
            >
              <ArrowRight size={24} />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ 
      borderRadius: 8, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      border: 'none',
      bgcolor: 'background.paper',
      boxShadow: isDark 
        ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
        : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
      '&:hover': { 
        transform: 'translateY(-16px)', 
        boxShadow: isDark 
          ? '20px 20px 40px #060a12, -20px -20px 40px #182442'
          : '20px 20px 40px #d1d9e6, -20px -20px 40px #ffffff',
        '& .course-image': { transform: 'scale(1.15)' }
      }
    }}>
      <Box sx={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        <Box 
          className="course-image" 
          component="img" 
          src={course.thumbnailUrl || `https://picsum.photos/seed/${course.code}/600/400`} 
          alt={course.name} 
          loading="lazy" 
          decoding="async" 
          sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }} 
        />
        <Box sx={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: 1.5 }}>
          <Chip 
            label={course.code} 
            size="small" 
            sx={{ 
              bgcolor: alpha('#000', 0.6), 
              backdropFilter: 'blur(12px)', 
              fontWeight: 900, 
              color: 'white', 
              border: `1px solid ${alpha('#fff', 0.2)}`,
              px: 1.5
            }} 
          />
        </Box>
        <Box sx={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          p: 2, 
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'white' }}>
              <Eye size={14} />
              <Typography variant="caption" sx={{ fontWeight: 800 }}>{course.views || 0}</Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

      <CardContent sx={{ p: 4.5, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1, letterSpacing: -1.2, color: 'text.primary' }}>{course.name}</Typography>
          {isTeacher && <ActionMenu items={teacherActions} />}
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 60, lineHeight: 1.6 }}>
          {course.description}
        </Typography>

        <Stack direction="row" spacing={4} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
            <Clock size={20} color={theme.palette.primary.main} />
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{course.duration}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
            <Users size={20} color={theme.palette.primary.main} />
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{(course.sections?.length || 0) * 12 + 10} Students</Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 4, borderStyle: 'dashed', opacity: 0.6 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box 
            sx={{ display: 'flex', alignItems: 'center', gap: 2.5, cursor: 'pointer' }}
            onClick={() => onShowTeacher(course.teacherId)}
          >
            <Avatar 
              src={teacherPhoto}
              sx={{ 
                width: 44, height: 44, fontSize: '1rem', fontWeight: 900, 
                bgcolor: 'primary.main', color: 'white',
                boxShadow: theme.shadows[4],
                transition: '0.3s',
                '&:hover': { transform: 'scale(1.1)' }
              }}
              imgProps={{ referrerPolicy: 'no-referrer' }}
            >
              {course.teacherName?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'text.primary', display: 'block', mb: -0.5 }}>{course.teacherName}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Instructor</Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', letterSpacing: 1.5, fontSize: '0.65rem' }}>MODULES</Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, color: 'primary.main', lineHeight: 1 }}>{course.sections?.length || 0}</Typography>
          </Box>
        </Box>
      </CardContent>
      
      <Button 
        fullWidth 
        variant="contained" 
        onClick={() => onRead(course)}
        endIcon={<ArrowRight size={22} />}
        sx={{ 
          borderRadius: 0, 
          py: 3, 
          fontWeight: 900, 
          bgcolor: isDark ? 'background.default' : 'grey.900', 
          color: 'white',
          textTransform: 'none',
          fontSize: '1.05rem',
          letterSpacing: 0.5,
          '&:hover': { bgcolor: 'primary.main', color: 'white' } 
        }}
      >
        Read Subject
      </Button>
    </Card>
  );
}
