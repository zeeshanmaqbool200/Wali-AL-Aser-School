import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, List, ListItem, ListItemText, ListItemAvatar,
  Divider, InputAdornment, Paper, Tooltip,
  useMediaQuery, Stack, Zoom, Fade,
  FormControl, InputLabel, Select, MenuItem,
  AppBar, Toolbar, Container
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Plus, Search, Edit2, Trash2, BookOpen, 
  Clock, User, Users, Filter, CheckCircle,
  MoreVertical, Book, GraduationCap, ArrowRight,
  Star, Share2, Bookmark, Layout, Layers, X,
  Image as ImageIcon, Paperclip, Zap, FileText, Globe,
  Music, Trophy, HelpCircle, ChevronRight, ChevronLeft,
  RotateCcw, Info, Headphones, ArrowLeft, Save
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, or, and, limit } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Course, CourseSection, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MAKTAB_LEVELS } from '../constants';
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(!(window as any)._coursesLoaded);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [openReader, setOpenReader] = useState(false);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);

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
    gradeId: 'all'
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
  const isMuntazim = currentUser?.role === 'muntazim';
  const isMudarisRole = currentUser?.role === 'mudaris';
  const isAdmin = isSuperAdmin || isMuntazim;
  const isStaff = isAdmin || isMudarisRole;

  useEffect(() => {
    let q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(100));
    
    // Students only see published courses or courses assigned specifically to them/their class
    // For now, let's just filter by isPublished and gradeId
    if (!isStaff && currentUser) {
      q = query(
        collection(db, 'courses'), 
        and(
          where('isPublished', '==', true),
          or(
            where('gradeId', '==', currentUser.maktabLevel || 'none'),
            where('gradeId', '==', 'all'),
            where('enrolledStudents', 'array-contains', currentUser.uid)
          )
        ),
        limit(100)
      );
    } else if (isMudarisRole && !isSuperAdmin) {
      // Mudaris sees courses assigned to them
      q = query(
        collection(db, 'courses'), 
        or(
          where('teacherId', '==', currentUser.uid),
          where('assignedMudaris', 'array-contains', currentUser.uid)
        ),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[]);
      setLoading(false);
      (window as any)._coursesLoaded = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });
    return () => unsubscribe();
  }, [currentUser, isStaff, isMudarisRole]);

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
      } else {
        await addDoc(collection(db, 'courses'), { ...data, createdAt: Date.now() });
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
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
        gradeId: 'all' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
  };

  const handleAddSection = () => {
    if (!newSection.title || (!newSection.content && newSection.type !== 'quiz')) return;
    const section: CourseSection = { 
      ...newSection, 
      id: Date.now().toString(), 
      order: formData.sections.length 
    };
    setFormData({
      ...formData,
      sections: [...formData.sections, section]
    });
    setNewSection({ 
      title: '', 
      content: '', 
      type: 'text', 
      mediaUrl: '',
      quizData: { questions: [], passingScore: 70 }
    });
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
      gradeId: course.gradeId || ''
    });
    setOpenDialog(true);
  };

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         c.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = gradeFilter === 'all' || c.gradeId === gradeFilter;
    return matchesSearch && matchesGrade;
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
          Back / Wapis
        </Button>
      </Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Mazameen (Subjects)</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Manage Islamic curriculum, Tulab enrollment, and learning paths
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
                    gradeId: 'all'
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
                {isMobile ? "Add" : "Add Mazmoon"}
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
              placeholder="Search mazameen by name, code, or Mudaris..." 
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
            <InputLabel sx={{ fontWeight: 800 }}>Maktab Level</InputLabel>
            <Select
              value={gradeFilter}
              label="Maktab Level"
              onChange={(e) => setGradeFilter(e.target.value)}
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
              {MAKTAB_LEVELS.filter(level => !level.includes('muntazim') && !level.includes('superadmin')).map(g => (
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
                  onRead={(c: Course) => {
                    setViewingCourse(c);
                    setOpenReader(true);
                  }}
                  viewMode={viewMode}
                />
              </motion.div>
            </Grid>
          ))}
        </AnimatePresence>
      </Grid>

      {filteredCourses.length === 0 && (
        <Box sx={{ p: 10, textAlign: 'center' }}>
          <BookOpen size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No mazameen found</Typography>
          <Typography variant="body2" color="text.secondary">Try adjusting your search query or add a new mazmoon</Typography>
        </Box>
      )}

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
                {editingCourse ? 'Update Mazmoon' : 'Create New Mazmoon'}
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
                {editingCourse ? 'Update Mazmoon' : 'Create Mazmoon'}
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
                        label="Mazmoon Name"
                        placeholder="e.g. Quran with Tajweed"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        variant="filled"
                        sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: alpha(theme.palette.action.hover, 0.4) } }}
                      />
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        label="Mazmoon Code"
                        placeholder="e.g. QRN-101"
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
                    <Grid size={12}>
                      <FormControl fullWidth variant="filled" sx={{ '& .MuiFilledInput-root': { borderRadius: 3, bgcolor: alpha(theme.palette.action.hover, 0.4) } }}>
                        <InputLabel>Mapped Class Level</InputLabel>
                        <Select
                          value={formData.gradeId}
                          label="Mapped Class Level"
                          onChange={(e) => setFormData({ ...formData, gradeId: e.target.value })}
                        >
                          <MenuItem value="all">All Levels</MenuItem>
                          {MAKTAB_LEVELS.filter(l => !l.includes('muntazim') && !l.includes('superadmin')).map(level => (
                            <MenuItem key={level} value={level}>{level}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
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
                
                <Paper variant="outlined" sx={{ p: 4, borderRadius: 4, bgcolor: alpha(theme.palette.background.default, 0.3), mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Zap size={20} className="text-amber-500" />
                    Quick Add Module
                  </Typography>
                  <Stack spacing={3}>
                    <TextField 
                      fullWidth 
                      label="Module Title" 
                      variant="outlined"
                      value={newSection.title} 
                      onChange={(e) => setNewSection({ ...newSection, title: e.target.value })} 
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                    
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <FormControl sx={{ minWidth: 160 }}>
                        <InputLabel>Content Type</InputLabel>
                        <Select 
                          value={newSection.type} 
                          label="Content Type" 
                          onChange={(e) => setNewSection({ ...newSection, type: e.target.value as any })}
                          sx={{ borderRadius: 3 }}
                        >
                          <MenuItem value="text">Rich Text / Notes</MenuItem>
                          <MenuItem value="image">Diagram / Image</MenuItem>
                          <MenuItem value="video">Lecture Video</MenuItem>
                          <MenuItem value="audio">Audio Lesson</MenuItem>
                          <MenuItem value="file">Manual / Document</MenuItem>
                          <MenuItem value="quiz">Interactive Quiz</MenuItem>
                        </Select>
                      </FormControl>
                      
                      {newSection.type !== 'quiz' && (
                        <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
                          <TextField 
                            fullWidth 
                            placeholder={newSection.type === 'video' ? "YouTube / Cloud Video URL" : "Paste URL or upload file"} 
                            value={newSection.mediaUrl} 
                            onChange={(e) => setNewSection({ ...newSection, mediaUrl: e.target.value })} 
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          />
                          {(['image', 'file', 'audio'].includes(newSection.type)) && (
                            <IconButton 
                              component="label" 
                              sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', borderRadius: 2 }}
                            >
                              <Paperclip size={20} />
                              <input type="file" hidden accept={newSection.type === 'audio' ? 'audio/*' : newSection.type === 'image' ? 'image/*' : '*'} onChange={(e) => handleFileUpload(e, 'section')} />
                            </IconButton>
                          )}
                        </Box>
                      )}
                    </Box>

                    {newSection.type === 'quiz' ? (
                      <Box sx={{ p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }}>
                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <HelpCircle size={18} /> Quiz Builder
                        </Typography>
                        <Stack spacing={2}>
                          <TextField 
                            fullWidth 
                            label="Question" 
                            size="small"
                            value={currentQuizQuestion.question}
                            onChange={(e) => setCurrentQuizQuestion({ ...currentQuizQuestion, question: e.target.value })}
                          />
                          <Grid container spacing={1}>
                            {currentQuizQuestion.options.map((opt, idx) => (
                              <Grid size={6} key={idx}>
                                <TextField 
                                  fullWidth 
                                  label={`Option ${idx + 1}`} 
                                  size="small"
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...currentQuizQuestion.options];
                                    newOpts[idx] = e.target.value;
                                    setCurrentQuizQuestion({ ...currentQuizQuestion, options: newOpts });
                                  }}
                                  InputProps={{
                                    endAdornment: (
                                      <IconButton size="small" onClick={() => setCurrentQuizQuestion({ ...currentQuizQuestion, correctAnswer: idx })}>
                                        {currentQuizQuestion.correctAnswer === idx ? <CheckCircle size={16} color="green" /> : <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid gray' }} />}
                                      </IconButton>
                                    )
                                  }}
                                />
                              </Grid>
                            ))}
                          </Grid>
                          <Button variant="outlined" size="small" onClick={handleAddQuizQuestion} disabled={!currentQuizQuestion.question}>
                            Add Question to Quiz ({newSection.quizData.questions.length})
                          </Button>
                        </Stack>
                        
                        {newSection.quizData.questions.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Divider sx={{ mb: 1 }} />
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>Questions Added:</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                              {newSection.quizData.questions.map((q, i) => (
                                <Chip key={i} size="small" label={`Q${i+1}`} onDelete={() => {
                                  const newQuestions = [...newSection.quizData.questions];
                                  newQuestions.splice(i, 1);
                                  setNewSection({ ...newSection, quizData: { ...newSection.quizData, questions: newQuestions } });
                                }} />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ 
                        '& .editor-toolbar': { borderColor: theme.palette.divider, borderRadius: '12px 12px 0 0' },
                        '& .CodeMirror': { 
                          borderColor: theme.palette.divider, 
                          borderRadius: '0 0 12px 12px',
                          bgcolor: alpha(theme.palette.background.default, 0.4),
                          color: theme.palette.text.primary,
                          fontFamily: 'var(--font-urdu), var(--font-sans)',
                          fontSize: '1.25rem'
                        },
                        '& .CodeMirror-cursor': { borderLeft: `2px solid ${theme.palette.primary.main}` }
                      }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, display: 'block' }}>Module Content (Markdown & HTML supported)</Typography>
                        <SimpleMDE 
                          value={newSection.content} 
                          onChange={(value) => setNewSection({ ...newSection, content: value })} 
                          options={{
                            placeholder: "Enter course content in Urdu (Nastaliq enabled)...",
                            autofocus: false,
                            spellChecker: false,
                            status: false,
                            minHeight: "200px"
                          }}
                        />
                      </Box>
                    )}
                    
                    <Button 
                      variant="contained" 
                      color="primary" 
                      onClick={handleAddSection} 
                      startIcon={<Plus size={20} />}
                      disabled={newSection.type === 'quiz' ? newSection.quizData.questions.length === 0 : !newSection.content}
                      sx={{ borderRadius: 3, fontWeight: 800, py: 1.5, textTransform: 'none', fontSize: '1rem' }}
                    >
                      Add Module to Course
                    </Button>
                  </Stack>
                </Paper>

                <Box sx={{ maxHeight: 400, overflow: 'auto', pr: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    Course Path Preview ({formData.sections.length} Modules)
                  </Typography>
                  {formData.sections.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 3, border: '1px dashed divider' }}>
                      <Typography variant="body2" color="text.disabled">No modules added yet. Start by adding one above.</Typography>
                    </Box>
                  ) : (
                    <Stack spacing={2}>
                      {formData.sections.map((s, i) => (
                        <Card key={i} variant="outlined" sx={{ borderRadius: 3, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ 
                              width: 32, height: 32, 
                              borderRadius: 1, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              bgcolor: 'primary.main', 
                              color: 'white',
                              fontWeight: 900
                            }}>
                              {i + 1}
                            </Box>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1 }}>{s.title}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{s.type} content</Typography>
                            </Box>
                          </Box>
                          <IconButton size="small" color="error" onClick={() => setFormData({ ...formData, sections: formData.sections.filter((_, idx) => idx !== i) })}>
                            <Trash2 size={18} />
                          </IconButton>
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
            Remember to save your changes using the "{editingCourse ? 'Update' : 'Create'} Mazmoon" button in the top right corner.
          </Typography>
        </Box>
      </Dialog>

      {/* Course Reader Dialog */}
      <Dialog
        fullScreen
        open={openReader}
        onClose={() => setOpenReader(false)}
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 500 }}
      >
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100%', height: 4, zIndex: 3000, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <motion.div 
            style={{ 
              height: '100%', 
              backgroundColor: theme.palette.primary.main, 
              width: `${scrollProgress}%`,
              boxShadow: `0 0 10px ${theme.palette.primary.main}` 
            }}
            initial={{ width: 0 }}
            animate={{ width: `${scrollProgress}%` }}
          />
        </Box>
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <AppBar sx={{ position: 'relative', bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }} elevation={0}>
            <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton edge="start" color="inherit" onClick={() => setOpenReader(false)} aria-label="close">
                  <X />
                </IconButton>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1 }}>{viewingCourse?.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{viewingCourse?.code} • {viewingCourse?.teacherName}</Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                {isStaff && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<Edit2 size={16} />}
                    onClick={() => {
                      if (viewingCourse) {
                        setOpenReader(false);
                        handleEdit(viewingCourse);
                      }
                    }}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    Edit
                  </Button>
                )}
                <Chip icon={<Globe size={14} />} label="Live" color="success" size="small" variant="outlined" sx={{ fontWeight: 900 }} />
              </Stack>
            </Toolbar>
          </AppBar>

          <Box sx={{ flexGrow: 1, overflow: 'auto', py: { xs: 4, md: 8 } }} onScroll={handleScroll}>
            <Container maxWidth="md">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {viewingCourse?.thumbnailUrl && (
                  <Box 
                    component="img" 
                    src={viewingCourse.thumbnailUrl} 
                    sx={{ width: '100%', height: { xs: 200, md: 400 }, objectFit: 'cover', borderRadius: 6, mb: 6, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }} 
                  />
                )}

                <Box sx={{ mb: 8, textAlign: isRTL(viewingCourse?.name || '') ? 'right' : 'left', dir: isRTL(viewingCourse?.name || '') ? 'rtl' : 'ltr' }}>
                  <Typography variant="h3" component="h1" sx={{ fontWeight: 900, mb: 3, letterSpacing: -1.5, color: '#fff' }}>
                    {viewingCourse?.name}
                  </Typography>
                  <Typography variant="h6" color="text.secondary" sx={{ lineHeight: 1.8, fontWeight: 500, fontSize: '1.25rem' }}>
                    {viewingCourse?.description}
                  </Typography>
                </Box>

                <Divider sx={{ mb: 8, opacity: 0.2, bgcolor: 'rgba(255,255,255,0.1)' }} />

                <Stack spacing={10}>
                  {viewingCourse?.sections?.map((section, index) => {
                    const isSectionRTL = isRTL(section.title) || isRTL(section.content);
                    return (
                      <Box key={section.id || index} id={`section-${index}`} sx={{ textAlign: isSectionRTL ? 'right' : 'left', dir: isSectionRTL ? 'rtl' : 'ltr' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexDirection: isSectionRTL ? 'row-reverse' : 'row' }}>
                          <Box sx={{ 
                            width: 50, height: 50, 
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            bgcolor: '#fff', 
                            color: '#000',
                            fontWeight: 900,
                            fontSize: '1.5rem',
                            boxShadow: '0 0 20px rgba(255,255,255,0.2)'
                          }}>
                            {index + 1}
                          </Box>
                          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1, color: '#fff' }}>
                            {section.title}
                          </Typography>
                          <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
                        </Box>

                        {section.mediaUrl && (
                          <Box sx={{ mb: 4 }}>
                            {section.type === 'video' ? (
                              <Box sx={{ position: 'relative', pt: '56.25%', borderRadius: 4, overflow: 'hidden', bgcolor: 'black', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <iframe
                                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                  src={section.mediaUrl.includes('youtube') ? section.mediaUrl.replace('watch?v=', 'embed/') : section.mediaUrl}
                                  title={section.title}
                                  allowFullScreen
                                />
                              </Box>
                            ) : section.type === 'audio' ? (
                              <Paper sx={{ 
                                p: 3, 
                                borderRadius: 5, 
                                bgcolor: 'rgba(255,255,255,0.03)', 
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 3,
                                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                              }}>
                                <Box sx={{ 
                                  width: 60, height: 60, 
                                  borderRadius: '50%', 
                                  bgcolor: 'primary.main', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  color: 'black',
                                  flexShrink: 0,
                                  boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.4)}`
                                }}>
                                  <Headphones size={28} />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: 2 }}>AUDIO BROADCAST</Typography>
                                  <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>Voice Lesson: {section.title}</Typography>
                                  <audio controls style={{ width: '100%', height: '40px', filter: 'invert(100%)' }}>
                                    <source src={section.mediaUrl} type="audio/mpeg" />
                                    Your browser does not support the audio element.
                                  </audio>
                                </Box>
                              </Paper>
                            ) : section.type === 'image' ? (
                              <Box component="img" src={section.mediaUrl} sx={{ width: '100%', borderRadius: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }} />
                            ) : section.type === 'file' ? (
                              <Button 
                                variant="outlined" 
                                startIcon={<FileText size={20} />}
                                href={section.mediaUrl}
                                target="_blank"
                                sx={{ borderRadius: 3, p: 2, fontWeight: 700, color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                              >
                                View/Download Attachment
                              </Button>
                            ) : null}
                          </Box>
                        )}

                        {section.type === 'quiz' && section.quizData ? (
                          <Box id={`section-quiz-${index}`}>
                            <QuizViewer 
                              quiz={section.quizData} 
                              sectionId={section.id || index.toString()} 
                              courseId={viewingCourse?.id || ''}
                              currentUser={currentUser}
                            />
                          </Box>
                        ) : (
                          <Box>
                            <Box 
                              sx={{ 
                                fontSize: '1.4rem', 
                                lineHeight: 2, 
                                color: 'rgba(255,255,255,0.95)',
                                fontFamily: isSectionRTL ? 'var(--font-urdu), "Inter", sans-serif' : '"Inter", sans-serif',
                                textAlign: isSectionRTL ? 'right' : 'left',
                                direction: isSectionRTL ? 'rtl' : 'ltr',
                                '& p': { mb: 3 },
                                '& ul, & ol': { mb: 3, pl: 4 },
                                '& li': { mb: 1.5 },
                                '& h1, & h2, & h3': { fontFamily: isSectionRTL ? 'var(--font-urdu)' : 'var(--font-serif)', color: '#fff', mb: 3, fontWeight: 700 }
                              }}
                            >
                              <ReactMarkdown>{section.content}</ReactMarkdown>
                            </Box>
                            {section.quizData && (
                              <Box sx={{ mt: 6 }} id={`section-quiz-${index}`}>
                                <Box sx={{ p: 4, borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px dashed', borderColor: 'primary.main', textAlign: 'center', mb: 4 }}>
                                  <Trophy size={32} color={theme.palette.primary.main} style={{ marginBottom: 16 }} />
                                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Lesson Knowledge Check</Typography>
                                  <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>Test your understanding of this module.</Typography>
                                </Box>
                                <QuizViewer 
                                  quiz={section.quizData} 
                                  sectionId={section.id || index.toString()} 
                                  courseId={viewingCourse?.id || ''}
                                  currentUser={currentUser}
                                />
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Stack>

                <Box sx={{ mt: 12, p: 6, borderRadius: 6, bgcolor: 'rgba(255,255,255,0.03)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Trophy size={48} color="#FFD700" className="mb-4 mx-auto" />
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 1, color: '#fff' }}>Course Milestone</Typography>
                  <Typography variant="body1" color="text.secondary">You've reached the end of the available modules in this course. Keep up the great work!</Typography>
                </Box>
              </motion.div>
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
            grade: currentUser.maktabLevel || 'N/A'
          });
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
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

function CourseCard({ course, isTeacher, isSuperAdmin, onEdit, onDelete, onRead, viewMode }: any) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  if (viewMode === 'list') {
    return (
      <Card sx={{ 
        borderRadius: 7, 
        mb: 3, 
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        border: 'none',
        bgcolor: 'background.paper',
        boxShadow: isDark 
          ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
          : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
        '&:hover': { 
          transform: 'translateX(10px)', 
          boxShadow: isDark 
            ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
            : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
        }
      }}>
        <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Avatar sx={{ 
            bgcolor: 'background.default', 
            color: 'primary.main', 
            borderRadius: 4, 
            width: 64, 
            height: 64,
            boxShadow: isDark
              ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
              : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
          }}>
            <BookOpen size={32} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -1 }}>{course.name}</Typography>
              <Chip label={course.code} size="small" sx={{ fontWeight: 900, height: 22, fontSize: '0.7rem', border: 'none', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
            </Box>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 500, fontWeight: 600 }}>
              {course.description}
            </Typography>
          </Box>
          <Stack direction="row" spacing={4} sx={{ px: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', letterSpacing: 1.5 }}>DURATION</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{course.duration}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', letterSpacing: 1.5 }}>MODULES</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: 'primary.main' }}>{course.sections?.length || 0}</Typography>
            </Box>
          </Stack>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {isTeacher && (
              <>
                <IconButton 
                  size="small" 
                  onClick={onEdit} 
                  sx={{ 
                    bgcolor: 'background.default',
                    boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff'
                  }}
                >
                  <Edit2 size={18} />
                </IconButton>
                {isSuperAdmin && (
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={onDelete} 
                    sx={{ 
                      bgcolor: 'background.default',
                      boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff'
                    }}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                )}
              </>
            )}
            <IconButton 
              aria-label="Read course"
              size="small" 
              onClick={() => onRead(course)}
              sx={{ 
                bgcolor: 'primary.main', 
                color: 'white', 
                boxShadow: '0 8px 16px rgba(15, 118, 110, 0.3)',
                '&:hover': { bgcolor: 'primary.dark' } 
              }}
            >
              <ArrowRight size={20} />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ 
      borderRadius: 7, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      border: 'none',
      bgcolor: 'background.paper',
      boxShadow: isDark 
        ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
        : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
      '&:hover': { 
        transform: 'translateY(-12px)', 
        boxShadow: isDark 
          ? '18px 18px 36px #060a12, -18px -18px 36px #182442'
          : '18px 18px 36px #d1d9e6, -18px -18px 36px #ffffff',
        '& .course-image': { transform: 'scale(1.15)' }
      }
    }}>
      <Box sx={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <Box 
          className="course-image" 
          component="img" 
          src={course.thumbnailUrl || `https://picsum.photos/seed/${course.code}/600/400`} 
          alt={course.name} 
          loading="lazy" 
          decoding="async" 
          sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} 
        />
        <Box sx={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: 1.5 }}>
          <Chip 
            label={course.code} 
            size="small" 
            sx={{ 
              bgcolor: alpha(theme.palette.background.paper, 0.85), 
              backdropFilter: 'blur(12px)', 
              fontWeight: 900, 
              color: 'primary.main', 
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }} 
          />
        </Box>
        <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
          <IconButton size="small" sx={{ bgcolor: alpha(theme.palette.background.paper, 0.85), backdropFilter: 'blur(12px)', color: 'text.primary', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <Bookmark size={18} />
          </IconButton>
        </Box>
      </Box>

      <CardContent sx={{ p: 4, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.2, letterSpacing: -1 }}>{course.name}</Typography>
          {isTeacher && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <IconButton aria-label="Edit course" size="small" onClick={onEdit} sx={{ p: 1, bgcolor: alpha(theme.palette.primary.main, 0.05) }}><Edit2 size={16} /></IconButton>
              {isSuperAdmin && (
                <IconButton aria-label="Delete course" size="small" color="error" onClick={onDelete} sx={{ p: 1, bgcolor: alpha(theme.palette.error.main, 0.05) }}><Trash2 size={16} /></IconButton>
              )}
            </Box>
          )}
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5, fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: 44, lineHeight: 1.6 }}>
          {course.description}
        </Typography>

        <Stack direction="row" spacing={4} sx={{ mb: 3.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
            <Clock size={18} color={theme.palette.primary.main} />
            <Typography variant="caption" sx={{ fontWeight: 900 }}>{course.duration}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
            <Users size={18} color={theme.palette.primary.main} />
            <Typography variant="caption" sx={{ fontWeight: 900 }}>24 Tulab</Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 3, borderStyle: 'dashed', opacity: 0.6 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ 
              width: 36, height: 36, fontSize: '0.9rem', fontWeight: 900, 
              bgcolor: 'background.default', color: 'primary.main',
              boxShadow: isDark ? '2px 2px 4px #060a12, -2px -2px 4px #182442' : '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff'
            }}>
              {course.teacherName.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.primary', display: 'block' }}>{course.teacherName}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Mudaris</Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', letterSpacing: 1 }}>MODULES</Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'primary.main' }}>{course.sections?.length || 0}</Typography>
          </Box>
        </Box>
      </CardContent>
      
      <Button 
        fullWidth 
        variant="contained" 
        onClick={() => onRead(course)}
        endIcon={<ArrowRight size={20} />}
        sx={{ 
          borderRadius: 0, 
          py: 2.5, 
          fontWeight: 900, 
          bgcolor: isDark ? 'background.default' : 'grey.900', 
          color: 'white',
          textTransform: 'none',
          fontSize: '1rem',
          '&:hover': { bgcolor: 'primary.main' } 
        }}
      >
        Read Mazmoon
      </Button>
    </Card>
  );
}
