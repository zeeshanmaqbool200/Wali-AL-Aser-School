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

  const handleReadCourse = async (course: Course) => {
    setReaderLoading(true);
    setViewingCourse(course);
    setOpenReader(true);
    setActiveSection(0);
    setTimeout(() => setReaderLoading(false), 800);

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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [classLevelFilter, setClassLevelFilter] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration: '',
    fee: 0,
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

    if (file.size > 200 * 1024) {
      alert('File too large. Please use an image smaller than 200KB or host it elsewhere and paste the URL.');
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
      console.error('File read error', error);
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
      handleFirestoreError(error, OperationType.WRITE, 'courses');
      setSnackbar({ open: true, message: 'Failed to save subject.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSection = () => {
    // Auto-add pending quiz question if user has started typed it but not clicked "Add to Pool"
    if (newSection.type === 'quiz' && currentQuizQuestion.question && !currentQuizQuestion.options.some(o => !o)) {
      setNewSection(prev => {
        const updated = {
          ...prev,
          quizData: {
            ...prev.quizData,
            questions: [...prev.quizData.questions, { ...currentQuizQuestion, id: Date.now().toString() }]
          }
        };
        // Now use this updated newSection for the handleAddSection logic
        performAddSection(updated);
        return updated;
      });
      setCurrentQuizQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
    } else {
      performAddSection(newSection);
    }
  };

  const performAddSection = (sectionToUse = newSection) => {
    if (!sectionToUse.title || (!sectionToUse.content && sectionToUse.type !== 'quiz' && !sectionToUse.mediaUrl && sectionToUse.type !== 'audio')) return;
    
    // Safety check for quiz questions
    if (sectionToUse.type === 'quiz' && sectionToUse.quizData.questions.length === 0) {
      alert('Please add at least one question to the quiz before saving.');
      return;
    }

    const sections = [...formData.sections];
    
    // Deep clone to ensure quizData is persisted correctly
    const finalSection = JSON.parse(JSON.stringify(sectionToUse));
    
    if (editingSectionIdx !== null) {
      sections[editingSectionIdx] = { 
        ...finalSection, 
        id: sections[editingSectionIdx].id, 
        order: editingSectionIdx 
      };
      setEditingSectionIdx(null);
    } else {
      const section: CourseSection = { 
        ...finalSection, 
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
    setCurrentQuizQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
    setSnackbar({ open: true, message: 'Module saved to subject draft.', severity: 'success' });
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

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ 
      pb: 12,
      minHeight: '100vh',
      bgcolor: isDark ? '#050505' : '#F7F3EA', 
      color: 'text.primary'
    }}>
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
              <Book size={20} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', display: { xs: 'none', sm: 'block' } }}>Library</Typography>
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
                 width: { xs: '160px', sm: '300px' },
                 transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                 '&:focus-within': {
                   width: { xs: '180px', sm: '350px' },
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

        {/* Library Stats Row */}
        {!searchQuery && (
          <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1, mt: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {[
              { label: 'Books', value: courses.length, icon: <Book size={18} />, color: '#E9C46A' },
              { label: 'Classes', value: new Set(courses.map(c => c.classLevelId)).size, icon: <GraduationCap size={18} />, color: '#2A9D8F' },
              { label: 'Total Read', value: courses.reduce((sum, c) => sum + (c.views || 0), 0), icon: <Eye size={18} />, color: '#F4A261' }
            ].map((stat, i) => (
              <Box 
                key={i}
                component={motion.div}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                sx={{ 
                  p: 2, 
                  borderRadius: 4, 
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'}`,
                  minWidth: 120,
                  flex: { xs: '0 0 auto', sm: 1 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                }}
              >
                <Box sx={{ color: stat.color, mb: 0.5 }}>{stat.icon}</Box>
                <Typography variant="h6" sx={{ fontWeight: 950, lineHeight: 1 }}>{stat.value}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>{stat.label}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {filteredCourses.length > 0 && !searchQuery && (
        <Box sx={{ px: { xs: 2, md: 4 }, mb: 6 }}>
          <Box sx={{ 
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
            borderRadius: 8,
            p: { xs: 3, md: 4 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 4,
            alignItems: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              width: { xs: '120px', md: '140px' }, 
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
                  borderRadius: 2.5,
                  boxShadow: '10px 10px 30px rgba(0,0,0,0.2)',
                  transform: 'rotateY(-8deg)',
                  transition: 'all 0.5s',
                  '&:hover': { transform: 'rotateY(0deg) scale(1.02)' }
                }}
              />
            </Box>
            <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
              <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5, fontFamily: '"Outfit", sans-serif', letterSpacing: -0.5 }}>
                {filteredCourses[0].name}
              </Typography>
              {filteredCourses[0].teacherName && !filteredCourses[0].teacherName.toLowerCase().includes('admin') && (
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, mb: 1.5, display: 'block' }}>
                  Author: {filteredCourses[0].teacherName}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.5, maxWidth: 600, fontSize: '0.85rem' }}>
                {filteredCourses[0].description || "Explore this unique curriculum designed for excellence."}
              </Typography>
              <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-start' }}>
                <Button 
                  variant="contained" 
                  onClick={() => handleReadCourse(filteredCourses[0])}
                  sx={{ 
                    bgcolor: '#E9C46A', 
                    color: '#000', 
                    fontWeight: 900, 
                    px: 4, 
                    py: 1.2, 
                    borderRadius: 2.5,
                    fontSize: '0.9rem',
                    '&:hover': { bgcolor: '#D9B45A' } 
                  }}
                >
                  Start Learning
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      )}

      <Box sx={{ px: { xs: 2, md: 4 }, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
          {searchQuery ? 'Search Results' : 'New Library'}
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
                    onEdit={() => handleEdit(course)}
                    isAdmin={isAdmin}
                    teacherPhoto={allTeachers.find(m => m.uid === course.teacherId)?.photoURL}
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

      <Dialog 
        open={snackbar.open} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        PaperProps={{ sx: { borderRadius: 4, p: 2, textAlign: 'center' } }}
      >
        <DialogContent>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
            <CheckCircle size={48} color={theme.palette.success.main} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>Success</Typography>
          <Typography variant="body2" color="text.secondary">{snackbar.message}</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button variant="contained" onClick={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: 2, fontWeight: 800, px: 4 }}>
            Okay
          </Button>
        </DialogActions>
      </Dialog>

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
              <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 700, color: 'text.secondary' }}>Cancel</Button>
              <Button 
                variant="contained" 
                onClick={handleSave}
                startIcon={<Save size={18} />}
                sx={{ 
                  borderRadius: 2, fontWeight: 900, px: 4,
                  background: alpha(theme.palette.primary.main, 1),
                  '&:hover': { background: theme.palette.primary.dark }
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
              position: 'absolute', inset: 0, zIndex: 10, 
              bgcolor: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', 
              alignItems: 'center', justifyContent: 'center', gap: 3
            }}>
              <CircularProgress />
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Saving Sabq...</Typography>
            </Box>
          )}
          <Grid container spacing={6}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1, display: 'block' }}>Course Identity</Typography>
                  <Grid container spacing={2}>
                    <Grid size={12}>
                      <TextField fullWidth label="Subject Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} variant="filled" />
                    </Grid>
                    <Grid size={isAdmin ? 6 : 12}>
                      <TextField fullWidth label="Subject Code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} variant="filled" />
                    </Grid>
                    {isAdmin && (
                      <Grid size={6}>
                        <FormControl fullWidth variant="filled">
                          <InputLabel>Lead Instructor</InputLabel>
                          <Select
                            value={formData.teacherId}
                            onChange={(e) => {
                              const teacher = allTeachers.find(t => t.uid === e.target.value);
                              setFormData({ ...formData, teacherId: e.target.value as string, teacherName: teacher?.displayName || '' });
                            }}
                          >
                            <MenuItem value={currentUser?.uid}>{currentUser?.displayName} (Me)</MenuItem>
                            {allTeachers.filter(t => t.uid !== currentUser?.uid).map(t => (
                              <MenuItem key={t.uid} value={t.uid}>{t.displayName}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                  </Grid>
                </Box>

                <Box>
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1, display: 'block' }}>Media</Typography>
                  <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, textAlign: 'center', borderStyle: 'dashed' }}>
                    {formData.thumbnailUrl ? (
                      <Box sx={{ position: 'relative' }}>
                        <Box component="img" src={formData.thumbnailUrl} sx={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 3, mb: 2 }} />
                        <Button variant="contained" color="error" size="small" onClick={() => setFormData(p => ({ ...p, thumbnailUrl: '' }))}>Remove</Button>
                      </Box>
                    ) : (
                      <Button component="label" variant="outlined">
                        Upload Thumbnail
                        <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'thumbnail')} />
                      </Button>
                    )}
                  </Paper>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <Box sx={{ mb: 4 }}>
                <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 1.5, display: 'block' }}>Modules</Typography>
                <Paper id="lesson-editor-entry" variant="outlined" sx={{ p: 4, borderRadius: 6, mb: 4 }}>
                  <Stack spacing={3}>
                    <TextField fullWidth label="Lesson Title" value={newSection.title} onChange={(e) => setNewSection(p => ({ ...p, title: e.target.value }))} variant="outlined" />
                    <FormControl fullWidth>
                      <InputLabel>Type</InputLabel>
                      <Select value={newSection.type} label="Type" onChange={(e) => setNewSection(p => ({ ...p, type: e.target.value as any, mediaUrl: '' }))}>
                        <MenuItem value="text">Text Based</MenuItem>
                        <MenuItem value="audio">AudioBook</MenuItem>
                        <MenuItem value="video">Video Lesson</MenuItem>
                        <MenuItem value="image">Illustrated Guide</MenuItem>
                        <MenuItem value="quiz">Interactive Quiz</MenuItem>
                        <MenuItem value="file">Downloadable Resources</MenuItem>
                      </Select>
                    </FormControl>

                    {newSection.type !== 'text' && newSection.type !== 'quiz' && (
                       <Box>
                         <TextField fullWidth label="Media URL" value={newSection.mediaUrl} onChange={(e) => setNewSection(p => ({ ...p, mediaUrl: e.target.value }))} variant="outlined" sx={{ mb: 2 }} />
                         <Button component="label" variant="outlined" fullWidth sx={{ borderRadius: 2 }}>
                            Upload Asset
                            <input type="file" hidden onChange={(e) => handleFileUpload(e, 'section')} />
                         </Button>
                       </Box>
                    )}

                    {newSection.type === 'quiz' && (
                      <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 3 }}>
                         <Stack spacing={2}>
                           <TextField fullWidth label="Question" value={currentQuizQuestion.question} onChange={(e) => setCurrentQuizQuestion({ ...currentQuizQuestion, question: e.target.value })} />
                           <Grid container spacing={1}>
                             {currentQuizQuestion.options.map((opt, i) => (
                               <Grid size={6} key={i}>
                                 <TextField fullWidth label={`Opt ${i+1}`} value={opt} size="small" onChange={(e) => {
                                   const n = [...currentQuizQuestion.options]; n[i] = e.target.value; setCurrentQuizQuestion({ ...currentQuizQuestion, options: n });
                                 }} />
                               </Grid>
                             ))}
                           </Grid>
                           <FormControl fullWidth size="small">
                              <InputLabel>Answer</InputLabel>
                              <Select value={currentQuizQuestion.correctAnswer} onChange={(e) => setCurrentQuizQuestion({ ...currentQuizQuestion, correctAnswer: Number(e.target.value) })}>
                                {[0,1,2,3].map(i => <MenuItem key={i} value={i}>Option {i+1}</MenuItem>)}
                              </Select>
                           </FormControl>
                           <Button variant="contained" onClick={handleAddQuizQuestion} disabled={!currentQuizQuestion.question || currentQuizQuestion.options.some(o => !o)}>
                             Add to Pool
                           </Button>
                           {newSection.quizData.questions.length > 0 && (
                             <Box sx={{ mt: 2 }}>
                               <Typography variant="caption" sx={{ fontWeight: 800 }}>Pool Preview</Typography>
                           <List>
                                 {newSection.quizData.questions.map((q, i) => (
                                   <ListItem key={i} secondaryAction={<IconButton size="small" onClick={() => setNewSection(p => ({ ...p, quizData: { ...p.quizData, questions: p.quizData.questions.filter((_, idx) => idx !== i) } }))}><Trash2 size={14} /></IconButton>}>
                                      <ListItemText primary={q.question} primaryTypographyProps={{ variant: 'caption', fontWeight: 700 }} />
                                   </ListItem>
                                 ))}
                               </List>
                             </Box>
                           )}
                         </Stack>
                      </Box>
                    )}

                    <SimpleMDE value={newSection.content} onChange={(v) => setNewSection(p => ({ ...p, content: v }))} options={{ placeholder: "Lesson content...", minHeight: "200px", status: false }} />
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button variant="contained" fullWidth onClick={handleAddSection} sx={{ borderRadius: 6 }}>{editingSectionIdx !== null ? 'Update' : 'Add Module'}</Button>
                      {editingSectionIdx !== null && <Button onClick={() => { setEditingSectionIdx(null); setNewSection({ title: '', content: '', type: 'text', mediaUrl: '', quizData: { questions: [], passingScore: 70 } }); }}>Cancel</Button>}
                    </Box>
                  </Stack>
                </Paper>

                <Stack spacing={1}>
                   {formData.sections.map((s, i) => (
                      <Paper key={i} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{i+1}. {s.title} ({s.type})</Typography>
                        <Box>
                          <IconButton onClick={() => handleEditSection(i)} color="primary"><Edit2 size={16} /></IconButton>
                          <IconButton onClick={() => setFormData(p => ({ ...p, sections: p.sections.filter((_, idx) => idx !== i) }))} color="error"><Trash2 size={16} /></IconButton>
                        </Box>
                      </Paper>
                   ))}
                </Stack>
              </Box>
            </Grid>

            <Grid size={12}>
               <TextField fullWidth label="Bio" multiline rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} variant="filled" />
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>

      <Dialog open={openTeacherProfile} onClose={() => setOpenTeacherProfile(false)}>
         {selectedTeacher && (
           <Box sx={{ p: 4, textAlign: 'center' }}>
             <Avatar src={selectedTeacher.photoURL} sx={{ width: 100, height: 100, mx: 'auto', mb: 2 }} imgProps={{ referrerPolicy: 'no-referrer' }} />
             <Typography variant="h5" sx={{ fontWeight: 900 }}>{selectedTeacher.displayName}</Typography>
             <Paper sx={{ p: 3, mt: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <Typography variant="body2">{(selectedTeacher as any).bio || "No bio."}</Typography>
             </Paper>
             <Button fullWidth onClick={() => setOpenTeacherProfile(false)} sx={{ mt: 3 }}>Close</Button>
           </Box>
         )}
      </Dialog>

      <Dialog fullScreen open={openReader} onClose={() => setOpenReader(false)} TransitionComponent={Slide} TransitionProps={{ direction: 'up' } as any}>
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}>
              <IconButton onClick={() => setOpenReader(false)} sx={{ color: 'error.main' }}><X size={24} /></IconButton>
              <Typography 
                variant="h6" 
                noWrap 
                sx={{ 
                  fontWeight: 900, 
                  maxWidth: { xs: '150px', sm: '300px', md: '500px' },
                  fontSize: { xs: '0.9rem', sm: '1.25rem' } 
                }}
              >
                {viewingCourse?.name}
              </Typography>
              <Chip 
                size="small" 
                label={`${activeSection + 1} / ${viewingCourse?.sections?.length || 0}`} 
                sx={{ fontWeight: 800 }} 
              />
            </Toolbar>
          </AppBar>

          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <Grid container sx={{ height: '100%' }}>
              <Grid 
                size={{ xs: 12, md: 3 }} 
                sx={{ 
                  borderRight: '1px solid divider', 
                  display: { xs: activeSection === -1 ? 'block' : 'none', md: 'block' },
                  overflow: 'auto', 
                  height: '100%',
                  bgcolor: alpha(theme.palette.background.paper, 0.5)
                }}
              >
                {/* List of sections */}
                <List sx={{ p: 0 }}>
                  {viewingCourse?.sections?.map((section, idx) => (
                    <ListItem 
                      key={idx} 
                      onClick={() => handleSectionChange(idx)} 
                      sx={{ 
                        cursor: 'pointer', 
                        py: 2,
                        bgcolor: activeSection === idx ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        borderLeft: '4px solid',
                        borderColor: activeSection === idx ? 'primary.main' : 'transparent',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: 40 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: activeSection === idx ? 'primary.main' : 'divider' }}>
                          {idx + 1}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={section.title} 
                        primaryTypographyProps={{ 
                          variant: 'body2', 
                          fontWeight: activeSection === idx ? 800 : 600,
                          color: activeSection === idx ? 'primary.main' : 'text.primary'
                        }} 
                      />
                      {activeSection === idx && <CheckCircle size={14} color={theme.palette.primary.main} />}
                    </ListItem>
                  ))}
                </List>
              </Grid>

              <Grid 
                size={{ xs: 12, md: 9 }} 
                sx={{ 
                  p: { xs: 2.5, md: 6 }, 
                  pb: 15, 
                  overflowY: 'auto', 
                  height: '100%',
                  display: { xs: activeSection === -1 ? 'none' : 'block', md: 'block' }
                }}
              >
                <Box sx={{ display: { xs: 'flex', md: 'none' }, mb: 2 }}>
                  <Button 
                    startIcon={<ArrowLeft />} 
                    size="small" 
                    onClick={() => setActiveSection(-1)}
                    sx={{ fontWeight: 800 }}
                  >
                    Index
                  </Button>
                </Box>
                <Box id="reader-content-top" />
                <AnimatePresence mode="wait">
                  <motion.div key={activeSection} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {(viewingCourse?.sections?.[activeSection]?.type === 'audio') && (
                        <Paper sx={{ mb: 6, p: 0, borderRadius: 6, overflow: 'hidden', maxWidth: 500, mx: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                           <Box sx={{ position: 'relative', height: 400 }}>
                             <Box component="img" src={viewingCourse?.sections?.[activeSection]?.mediaUrl || viewingCourse?.thumbnailUrl || `https://picsum.photos/seed/${viewingCourse.id}/500/800`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7))' }} />
                             <Box sx={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', color: 'white', p: 2 }}>
                               <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>{viewingCourse.sections[activeSection].title}</Typography>
                               <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Now Playing • Audiobook</Typography>
                             </Box>
                           </Box>
                           <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper', borderTop: '4px solid', borderColor: 'primary.main' }}>
                              <audio 
                                controls 
                                controlsList="nodownload" 
                                style={{ width: '100%', height: 48, borderRadius: 12 }} 
                                src={viewingCourse.sections[activeSection].mediaUrl} 
                              />
                              <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary', fontWeight: 600 }}>Use headphones for better experience</Typography>
                           </Box>
                        </Paper>
                      )}

                      {viewingCourse?.sections?.[activeSection]?.type === 'video' && viewingCourse?.sections?.[activeSection]?.mediaUrl && (
                        <Box sx={{ mb: 6, borderRadius: 4, overflow: 'hidden', aspectRatio: '16/9', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
                           <iframe width="100%" height="100%" src={viewingCourse.sections[activeSection].mediaUrl.replace('watch?v=', 'embed/')} frameBorder="0" allowFullScreen />
                        </Box>
                      )}

                      <Box sx={{ 
                        direction: isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 'rtl' : 'ltr',
                        px: { xs: 0, md: 4 }
                      }}>
                        <div className="markdown-body" style={{ fontSize: '0.98rem', lineHeight: '1.9', color: isDark ? '#e5e5e5' : '#333' }}>
                          <ReactMarkdown>{viewingCourse?.sections?.[activeSection]?.content || ''}</ReactMarkdown>
                        </div>
                      </Box>

                     {viewingCourse?.sections?.[activeSection]?.quizData?.questions?.length > 0 && (
                        <Box sx={{ mt: 6 }}>
                           <Typography variant="h5" sx={{ mb: 4, fontWeight: 900 }}>Module Quiz</Typography>
                           <QuizViewer quiz={viewingCourse.sections[activeSection].quizData} sectionId={viewingCourse.sections[activeSection].id} courseId={viewingCourse.id} currentUser={currentUser} />
                        </Box>
                     )}
                  </motion.div>
                </AnimatePresence>
                
                <Box sx={{ mt: 8, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', pt: 4 }}>
                   <Button 
                     size={isMobile ? 'small' : 'medium'}
                     disabled={activeSection <= 0} 
                     onClick={() => activeSection > 0 && handleSectionChange(activeSection - 1)} 
                     startIcon={<ChevronLeft />}
                     sx={{ fontWeight: 800 }}
                   >
                     {isMobile ? 'Back' : 'Previous Module'}
                   </Button>
                   {activeSection < (viewingCourse?.sections?.length || 0) - 1 && (
                      <Button 
                        variant="contained" 
                        size={isMobile ? 'small' : 'medium'}
                        onClick={() => handleSectionChange(activeSection + 1)} 
                        endIcon={<ChevronRight />} 
                        sx={{ px: { xs: 2, md: 4 }, borderRadius: 2, fontWeight: 900 }}
                      >
                        {isMobile ? 'Next' : 'Next Module'}
                      </Button>
                   )}
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}

function QuizViewer({ quiz, sectionId, courseId, currentUser }: any) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const handleNext = async () => {
    if (currentStep < quiz.questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      let correct = 0;
      quiz.questions.forEach((q: any, i: number) => { if (selectedAnswers[i] === q.correctAnswer) correct++; });
      setScore(correct);
      setShowResults(true);
      if (currentUser) {
        try {
          await smartAddDoc(collection(db, 'quiz_results'), {
            studentId: currentUser.uid, studentName: currentUser.displayName, courseId, sectionId,
            score: correct, totalQuestions: quiz.questions.length, timestamp: Date.now()
          });
        } catch (e) { console.error(e); }
      }
    }
  };

  if (showResults) return (
    <Box sx={{ p: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 4, bgcolor: 'background.paper' }}>
       <Trophy size={48} style={{ opacity: 0.8 }} />
       <Typography variant="h5" sx={{ mt: 2, fontWeight: 900 }}>Score: {score} / {quiz.questions.length}</Typography>
       <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{score >= (quiz.passingScore || 70) ? 'Congratulations! You passed.' : 'Keep practicing to improve.'}</Typography>
       <Button variant="contained" size="small" sx={{ borderRadius: 2, fontWeight: 800 }} onClick={() => { setShowResults(false); setCurrentStep(0); setSelectedAnswers([]); }}>Try Again</Button>
    </Box>
  );

  const q = quiz.questions[currentStep];
  return (
    <Box sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 4, bgcolor: 'background.paper' }}>
      <Typography variant="subtitle1" sx={{ mb: 3, fontWeight: 800, fontSize: '1rem' }}>{currentStep + 1}. {q.question}</Typography>
      <Stack spacing={1.5} sx={{ mb: 4 }}>
        {q.options.map((opt: string, idx: number) => (
          <Button 
            key={idx} 
            variant={selectedAnswers[currentStep] === idx ? "contained" : "outlined"} 
            fullWidth 
            size="small"
            onClick={() => { const n = [...selectedAnswers]; n[currentStep] = idx; setSelectedAnswers(n); }}
            sx={{ borderRadius: 2, py: 1.5, justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600 }}
          >
            {opt}
          </Button>
        ))}
      </Stack>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button size="small" onClick={() => setCurrentStep(p => p - 1)} disabled={currentStep === 0} sx={{ fontWeight: 800 }}>Back</Button>
        <Button variant="contained" size="small" onClick={handleNext} disabled={selectedAnswers[currentStep] === undefined} sx={{ fontWeight: 800, borderRadius: 2, px: 4 }}>
          {currentStep === quiz.questions.length - 1 ? 'Finish' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
}

function BookCard({ course, onRead, onEdit, isAdmin }: any) {
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
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: 0, transition: '0.4s', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5,
            pointerEvents: 'none', '& > *': { pointerEvents: 'auto' }
          }}
        >
           <Button 
             variant="contained" 
             size="small" 
             onClick={onRead}
             startIcon={<BookOpen size={16} />}
             sx={{ bgcolor: 'white', color: 'black', fontWeight: 900, borderRadius: 2, '&:hover': { bgcolor: '#f0f0f0' } }}
           >
             Read
           </Button>
           {isAdmin && (
             <Button 
               variant="contained" 
               size="small" 
               onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
               startIcon={<Edit2 size={16} />}
               sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 900, borderRadius: 2 }}
             >
               Edit
             </Button>
           )}
        </Box>
      </Box>
      <Typography noWrap variant="body2" sx={{ mt: 1.5, fontWeight: 900, fontSize: '0.8rem' }}>{course.name}</Typography>
      {course.teacherName && 
       !course.teacherName.toLowerCase().includes('admin') && 
       !course.teacherName.toLowerCase().includes('maqbool') && (
        <Typography noWrap variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, fontSize: '0.65rem' }}>
           By {course.teacherName}
        </Typography>
      )}
    </Box>
  );
}
