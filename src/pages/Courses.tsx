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

const isRTL = (text: string) => {
  const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  return rtlChars.test(text);
};

export default function Courses() {
  const { user: currentUser } = useAuth();
  const { users: allUsers } = useData();
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

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const ReaderTeacher = React.useMemo(() => {
    return allTeachers.find(m => m.uid === viewingCourse?.teacherId);
  }, [allTeachers, viewingCourse?.teacherId]);

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
  const [localDeletedIds, setLocalDeletedIds] = useState<Set<string>>(new Set());

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
    fontFamily: 'default' as 'default' | 'serif' | 'nastaliq' | 'mono',
    alignment: 'left' as 'left' | 'center' | 'right' | 'justify',
    isRTL: false,
    fontSize: 'medium' as 'small' | 'medium' | 'large' | 'extra-large',
    secondaryMediaUrl: '',
    secondaryMediaType: 'audio' as 'audio' | 'video',
    layout: 'standard' as 'standard' | 'ebook' | 'blog' | 'magazine',
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

  const [showSuccess, setShowSuccess] = useState(false);

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

    // Use specific limits: 2MB for thumbnails (logo), 10MB for sections (images/audio/banners)
    const limitMB = target === 'thumbnail' ? 2 : 10;
    if (file.size > limitMB * 1024 * 1024) {
      setSnackbar({ open: true, message: `File too large. Please use an file smaller than ${limitMB}MB.`, severity: 'warning' });
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

  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin' || currentUser?.email === 'zeeshanmaqbool200@gmail.com';
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
      } else {
        await smartAddDoc(collection(db, 'courses'), { ...data, createdAt: Date.now() });
      }
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
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
      }, 1500);
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
      fontFamily: 'default',
      alignment: 'left',
      isRTL: false,
      fontSize: 'medium',
      quizData: { questions: [], passingScore: 70 }
    });
    setCurrentQuizQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
    setSnackbar({ open: true, message: 'Module saved to subject draft.', severity: 'success' });
  };

  // Memoized lesson editor to prevent focus loss during typing
  const LessonEditor = React.useMemo(() => (
    <Paper id="lesson-editor-entry" variant="outlined" sx={{ p: 4, borderRadius: 6, mb: 4, bgcolor: alpha(theme.palette.background.paper, 0.4) }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField 
            fullWidth 
            label="Lesson Title" 
            value={newSection.title} 
            onChange={(e) => setNewSection(p => ({ ...p, title: e.target.value }))} 
            variant="outlined" 
            sx={{ flex: 2 }}
          />
          <FormControl sx={{ flex: 1 }}>
            <InputLabel>Module Type</InputLabel>
            <Select 
              value={newSection.type} 
              label="Module Type" 
              onChange={(e) => setNewSection(p => ({ ...p, type: e.target.value as any, mediaUrl: '' }))}
            >
              <MenuItem value="text">Rich Text / Blog</MenuItem>
              <MenuItem value="audio">Audio / Podcast</MenuItem>
              <MenuItem value="video">Video Lecture</MenuItem>
              <MenuItem value="image">Graphic / Poster</MenuItem>
              <MenuItem value="quiz">Interactive Quiz</MenuItem>
              <MenuItem value="file">Resources / PDF</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ flex: 1 }}>
            <InputLabel>Layout Style</InputLabel>
            <Select 
              value={newSection.layout || 'standard'} 
              label="Layout Style" 
              onChange={(e) => setNewSection(p => ({ ...p, layout: e.target.value as any }))}
            >
              <MenuItem value="standard">Standard Reader</MenuItem>
              <MenuItem value="ebook">E-Book (Center focus)</MenuItem>
              <MenuItem value="blog">Editorial Blog</MenuItem>
              <MenuItem value="magazine">Magazine (Immersive)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ p: 2, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
          <Typography variant="caption" sx={{ fontWeight: 900, mb: 2, display: 'block', color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1 }}>Typography & Layout</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Font Profile</InputLabel>
                <Select value={newSection.fontFamily} label="Font Profile" onChange={(e) => setNewSection(p => ({ ...p, fontFamily: e.target.value as any }))}>
                  <MenuItem value="default">Modern Inter</MenuItem>
                  <MenuItem value="serif">Academic Serif</MenuItem>
                  <MenuItem value="nastaliq">Nastaliq (Urdu Standard)</MenuItem>
                  <MenuItem value="urdu-modern">Urdu Modern (Nastaliq)</MenuItem>
                  <MenuItem value="ebook-serif">E-Book Classic</MenuItem>
                  <MenuItem value="display-playfair">Playfair Display</MenuItem>
                  <MenuItem value="mono">Technical (Mono)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
               <FormControl fullWidth size="small">
                <InputLabel>Text Size</InputLabel>
                <Select value={newSection.fontSize} label="Text Size" onChange={(e) => setNewSection(p => ({ ...p, fontSize: e.target.value as any }))}>
                  <MenuItem value="small">Small</MenuItem>
                  <MenuItem value="medium">Standard</MenuItem>
                  <MenuItem value="large">Reading (Large)</MenuItem>
                  <MenuItem value="extra-large">Reading Plus</MenuItem>
                  <MenuItem value="massive">Very Large (Massive)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
               <FormControl fullWidth size="small">
                <InputLabel>Text Align</InputLabel>
                <Select value={newSection.alignment} label="Text Align" onChange={(e) => setNewSection(p => ({ ...p, alignment: e.target.value as any }))}>
                  <MenuItem value="left">Left Flush</MenuItem>
                  <MenuItem value="center">Centered</MenuItem>
                  <MenuItem value="right">Right Flush</MenuItem>
                  <MenuItem value="justify">Justified</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
               <Button 
                fullWidth 
                variant={newSection.isRTL ? "contained" : "outlined"} 
                size="small" 
                onClick={() => setNewSection(p => ({ ...p, isRTL: !p.isRTL }))}
                startIcon={<Globe size={14} />}
                sx={{ borderRadius: 2, textTransform: 'none', height: 40 }}
               >
                 {newSection.isRTL ? 'RTL Active (Urdu)' : 'LTR Active (Eng)'}
               </Button>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ p: 2, borderRadius: 4, border: '1px solid', borderColor: alpha(theme.palette.secondary.main, 0.2), bgcolor: alpha(theme.palette.secondary.main, 0.02) }}>
          <Typography variant="caption" sx={{ fontWeight: 900, mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'secondary.main', textTransform: 'uppercase', letterSpacing: 1 }}>
            <Headphones size={14} /> Blended Audio / Background Score
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 9 }}>
              <TextField 
                fullWidth 
                size="small" 
                label="Background Media URL" 
                value={newSection.secondaryMediaUrl || ''} 
                onChange={(e) => setNewSection(p => ({ ...p, secondaryMediaUrl: e.target.value }))} 
                placeholder="Paste audio URL here for blended experience..." 
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
               <Button component="label" variant="outlined" size="small" fullWidth sx={{ borderRadius: 2, borderStyle: 'dashed' }}>
                  Upload Audio
                  <input type="file" hidden accept="audio/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIsUploading(true);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewSection(p => ({ ...p, secondaryMediaUrl: reader.result as string, secondaryMediaType: 'audio' }));
                        setIsUploading(false);
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
               </Button>
            </Grid>
          </Grid>
        </Box>

        {newSection.type !== 'text' && newSection.type !== 'quiz' && (
           <Box>
             <TextField fullWidth label="Cloud Media Link" value={newSection.mediaUrl} onChange={(e) => setNewSection(p => ({ ...p, mediaUrl: e.target.value }))} variant="outlined" placeholder="https://..." sx={{ mb: 2 }} />
             <Button component="label" variant="outlined" fullWidth sx={{ borderRadius: 2, height: 48, borderStyle: 'dashed' }}>
                Upload Local Resource
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

        <SimpleMDE 
          value={newSection.content} 
          onChange={(v) => setNewSection(p => ({ ...p, content: v }))} 
          options={{ placeholder: "Lesson content...", minHeight: "200px", status: false }} 
        />
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" fullWidth onClick={handleAddSection} sx={{ borderRadius: 6 }}>{editingSectionIdx !== null ? 'Update' : 'Add Module'}</Button>
          {editingSectionIdx !== null && <Button onClick={() => { setEditingSectionIdx(null); setNewSection({ title: '', content: '', type: 'text', mediaUrl: '', fontFamily: 'default', alignment: 'left', isRTL: false, fontSize: 'medium', quizData: { questions: [], passingScore: 70 } }); }}>Cancel</Button>}
        </Box>
      </Stack>
    </Paper>
  ), [newSection, currentQuizQuestion, editingSectionIdx, handleFileUpload, handleAddSection, handleAddQuizQuestion, theme.palette.primary.main]);

  const handleEditSection = (idx: number) => {
    const s = formData.sections[idx];
    setNewSection({
      title: s.title,
      content: s.content || '',
      type: s.type,
      mediaUrl: s.mediaUrl || '',
      fontFamily: s.fontFamily || 'default',
      alignment: s.alignment || 'left',
      isRTL: s.isRTL || false,
      fontSize: s.fontSize || 'medium',
      secondaryMediaUrl: (s as any).secondaryMediaUrl || '',
      secondaryMediaType: (s as any).secondaryMediaType || 'audio',
      layout: (s as any).layout || 'standard',
      quizData: s.quizData || { questions: [], passingScore: 70 }
    });
    setEditingSectionIdx(idx);
    const entry = document.getElementById('lesson-editor-entry');
    if (entry) entry.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const performDelete = async () => {
    if (!deleteConfirmId) return;
    
    const courseToDelete = courses.find(c => c.id === deleteConfirmId);
    if (!courseToDelete) return;
    
    if (!isAdmin && currentUser?.uid !== courseToDelete.teacherId) {
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

  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (localDeletedIds.has(c.id)) return false;
      const matchesSearch = (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                           (c.code?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesClassLevel = classLevelFilter === 'all' || c.classLevelId === classLevelFilter;
      return matchesSearch && matchesClassLevel;
    });
  }, [courses, localDeletedIds, searchQuery, classLevelFilter]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  const isDark = theme.palette.mode === 'dark';

  const [readingMode, setReadingMode] = useState<'light' | 'dark' | 'sepia'>('light');

  const getReaderColors = () => {
    if (readingMode === 'sepia') return { bg: '#F4ECD8', text: '#5B4636', border: '#E2D1B3' };
    if (readingMode === 'dark') return { bg: '#121212', text: '#E0E0E0', border: '#333' };
    return { bg: '#FFFFFF', text: '#1A1A1A', border: '#EEE' };
  };

  const readerStyles = getReaderColors();

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
        gap: { xs: 3, md: 6 }
      }}>
        {/* Refined Library Header */}
        {!searchQuery && (
          <Box 
            component={motion.div}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            sx={{ 
              position: 'relative',
              textAlign: 'center',
              mt: { xs: 2, md: 4 },
              mb: { xs: 0, md: 2 },
              pb: 6,
              background: isDark 
                ? 'radial-gradient(circle at center, rgba(255,193,7,0.05) 0%, transparent 70%)' 
                : 'radial-gradient(circle at center, rgba(255,193,7,0.1) 0%, transparent 70%)'
            }}
          >
            <Box sx={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              mb: 2,
              p: 2,
              borderRadius: '50%',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'white',
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.05)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
            }}>
              <GraduationCap size={48} strokeWidth={1.5} color={theme.palette.primary.main} />
            </Box>
            <Typography 
              variant="h3" 
              sx={{ 
                fontFamily: '"Cinzel Decorative", serif',
                fontWeight: 1000,
                fontSize: { xs: '2rem', md: '3.5rem' },
                letterSpacing: -1,
                mb: 1,
                color: isDark ? 'white' : 'black',
                lineHeight: 1
              }}
            >
              Academic Library
            </Typography>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 800, 
                letterSpacing: '0.2rem', 
                textTransform: 'uppercase',
                color: 'text.secondary',
                fontSize: { xs: '0.7rem', md: '0.9rem' },
                opacity: 0.7
              }}
            >
              مکتب ولی العصر • Educational Resources
            </Typography>
          </Box>
        )}

        {/* Useful Stats / Info Section */}
        {!searchQuery && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3, 
                  borderRadius: 6, 
                  bgcolor: isDark ? 'rgba(255,193,7,0.03)' : '#FFFBF0', 
                  border: `1px solid ${isDark ? 'rgba(255,193,7,0.1)' : '#FFEAA7'}`,
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(255,193,7,0.08)' }
                }}
              >
                <Stack spacing={2}>
                  <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: '#FFC107', color: 'black', width: 'fit-content', display: 'flex' }}>
                    <BookOpen size={22} strokeWidth={2.5} />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 950, lineHeight: 1, fontFamily: 'var(--font-heading)' }}>{courses.length}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>Total Books</Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3, 
                  borderRadius: 6, 
                  bgcolor: isDark ? 'rgba(33,150,243,0.03)' : '#F0F7FF', 
                  border: `1px solid ${isDark ? 'rgba(33,150,243,0.1)' : '#D6EAFF'}`,
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(33,150,243,0.08)' }
                }}
              >
                <Stack spacing={2}>
                  <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: '#2196F3', color: 'white', width: 'fit-content', display: 'flex' }}>
                    <Users size={22} strokeWidth={2.5} />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 950, lineHeight: 1, fontFamily: 'var(--font-heading)' }}>{allTeachers.length}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>Instructors</Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3, 
                  borderRadius: 6, 
                  bgcolor: isDark ? 'rgba(76,175,80,0.03)' : '#F0FFF4', 
                  border: `1px solid ${isDark ? 'rgba(76,175,80,0.1)' : '#C6F6D5'}`,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                 <Stack direction="row" spacing={3} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900, color: 'success.main', letterSpacing: -0.5 }}>Active Community</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', opacity: 0.8 }}>
                        Join <Box component="span" sx={{ color: 'text.primary', fontWeight: 900 }}>{studentCount > 0 ? studentCount : 'Our growing'}</Box> students learning and growing today.
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                      <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 34, height: 34, fontSize: '0.8rem', border: '2px solid white' } }}>
                        {allUsers.filter(u => u.role === 'student' && u.photoURL && u.status !== 'Deleted').slice(0, 8).map(u => (
                          <Avatar key={u.uid} src={u.photoURL} imgProps={{ referrerPolicy: 'no-referrer' }}>{u.displayName?.[0]}</Avatar>
                        ))}
                      </AvatarGroup>
                    </Box>
                 </Stack>
              </Paper>
            </Grid>
          </Grid>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Book size={isMobile ? 18 : 20} />
            </Box>
            <Typography variant={isMobile ? "subtitle1" : "h6"} sx={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', display: { xs: 'none', sm: 'block' } }}>Library</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, alignItems: 'center' }}>
             <Paper 
               elevation={0} 
               sx={{ 
                 display: 'flex', 
                 alignItems: 'center', 
                 px: { xs: 1.5, sm: 2 }, 
                 py: 0.8,
                 borderRadius: '50px', 
                 bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'white',
                 border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                 width: { xs: '140px', sm: '300px' },
                 transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                 '&:focus-within': {
                   width: { xs: '160px', sm: '350px' },
                   borderColor: 'primary.main',
                   boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.08)}`
                 }
               }}
             >
               <Search size={isMobile ? 16 : 18} style={{ opacity: 0.5, marginRight: 8 }} />
               <Box 
                 component="input" 
                 placeholder="Search..." 
                 value={searchQuery}
                 onChange={(e: any) => setSearchQuery(e.target.value)}
                 sx={{ 
                   border: 'none', 
                   outline: 'none', 
                   width: '100%', 
                   fontWeight: 600,
                   fontSize: isMobile ? '0.75rem' : '0.85rem',
                   bgcolor: 'transparent',
                   color: 'text.primary',
                   '&::placeholder': { color: 'text.disabled' }
                 }} 
               />
             </Paper>
             <Avatar 
               src={currentUser?.photoURL} 
               imgProps={{ referrerPolicy: 'no-referrer' }}
               sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, bgcolor: 'primary.main', fontWeight: 900, cursor: 'pointer', border: `2px solid ${isDark ? '#333' : '#fff'}` }}
             >
               {currentUser?.displayName?.[0]}
              </Avatar>
          </Box>
        </Box>

        {/* Library Stats Row */}
        {!searchQuery && (
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1, mt: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {[
              { label: 'Books', value: courses.length, icon: <Book size={16} />, color: '#E9C46A' },
              { label: 'Classes', value: new Set(courses.map(c => c.classLevelId)).size, icon: <GraduationCap size={16} />, color: '#2A9D8F' },
              { label: 'Total Read', value: courses.reduce((sum, c) => sum + (c.views || 0), 0), icon: <Eye size={16} />, color: '#F4A261' }
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
        <Box sx={{ px: { xs: 2, md: 4 }, mb: 8 }}>
          <Box sx={{ 
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
            borderRadius: 10,
            p: { xs: 4, md: 6 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 6,
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
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6, maxWidth: 650, fontSize: { xs: '0.85rem', md: '1rem' }, opacity: 0.8 }}>
                {filteredCourses[0].description || "Dive into this comprehensive learning path curated for serious students of knowledge. Contains advanced modules and interactive resources."}
              </Typography>
              <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-start' }}>
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={() => handleReadCourse(filteredCourses[0])}
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
        {isStaff && (
          <Button 
            variant="text" 
            size="small"
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
            sx={{ fontWeight: 900, textTransform: 'none', color: 'primary.main', borderRadius: '50px', px: 2 }}
          >
            Add New
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

        <DialogContent sx={{ p: { xs: 0, md: 6 }, position: 'relative', bgcolor: isDark ? alpha('#000', 0.2) : alpha('#f8f8f8', 0.5) }}>
          <SavingProgress isSaving={submitting} success={showSuccess} />
          <Container maxWidth="xl">
            <Grid container spacing={6}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={4}>
                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block', letterSpacing: 2 }}>Subject Identity</Typography>
                    <Paper variant="outlined" sx={{ p: 4, borderRadius: 6, borderStyle: 'solid', bgcolor: 'background.paper' }}>
                      <Stack spacing={3}>
                        <TextField fullWidth label="Official Subject Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} variant="outlined" />
                        <Grid container spacing={2}>
                          <Grid size={6}>
                            <TextField fullWidth label="Catalog Code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} variant="outlined" placeholder="e.g. ARB-101" />
                          </Grid>
                          <Grid size={6}>
                             <FormControl fullWidth variant="outlined">
                              <InputLabel>Primary Class</InputLabel>
                              <Select value={formData.classLevelId} label="Primary Class" onChange={(e) => setFormData({ ...formData, classLevelId: e.target.value })}>
                                <MenuItem value="all">All Classes</MenuItem>
                                {CLASS_LEVELS.map(level => <MenuItem key={level} value={level}>{level}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                        {isAdmin && (
                          <FormControl fullWidth variant="outlined">
                            <InputLabel>Lead Instructor</InputLabel>
                            <Select
                              value={formData.teacherId}
                              label="Lead Instructor"
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
                        )}
                      </Stack>
                    </Paper>
                  </Box>

                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block', letterSpacing: 2 }}>Subject Narrative</Typography>
                    <TextField fullWidth label="Detailed Bio / Description" multiline rows={6} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} variant="outlined" placeholder="Enter course overview, goals, and what students will learn..." sx={{ '& .MuiOutlinedInput-root': { borderRadius: 6 } }} />
                  </Box>

                  <Box>
                    <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block', letterSpacing: 2 }}>Visual Branding</Typography>
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 4, borderRadius: 6, textAlign: 'center', borderStyle: 'dashed', 
                        borderColor: formData.thumbnailUrl ? 'primary.main' : 'divider',
                        bgcolor: alpha(theme.palette.primary.main, 0.02)
                      }}
                    >
                      {formData.thumbnailUrl ? (
                        <Box sx={{ position: 'relative' }}>
                          <Box component="img" src={formData.thumbnailUrl} sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 4, mb: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                          <Button variant="contained" color="error" size="small" onClick={() => setFormData(p => ({ ...p, thumbnailUrl: '' }))} sx={{ borderRadius: 2 }}>Reset Cover</Button>
                        </Box>
                      ) : (
                        <Box>
                          <ImageIcon size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 16 }} />
                          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 600 }}>High resolution cover image recommended</Typography>
                          <Button component="label" variant="contained" sx={{ borderRadius: 2 }}>
                            Upload Book Cover
                            <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'thumbnail')} />
                          </Button>
                        </Box>
                      )}
                    </Paper>
                  </Box>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 7 }}>
                <Box sx={{ mb: 4 }}>
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1, letterSpacing: 2 }}>
                    <Layers size={18} /> Course Curriculum Studio
                  </Typography>
                  {LessonEditor}

                  <Box sx={{ mt: 6 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 950, mb: 3, display: 'flex', alignItems: 'center', gap: 1, letterSpacing: -0.5 }}>
                      Draft Modules <Chip label={formData.sections.length} size="small" sx={{ fontWeight: 900 }} />
                    </Typography>
                    <Stack spacing={2}>
                       <AnimatePresence mode="popLayout">
                         {formData.sections.map((s, i) => (
                            <motion.div key={i} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                              <Paper sx={{ 
                                p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 4, 
                                border: '1px solid', borderColor: 'divider',
                                '&:hover': { boxShadow: '0 10px 30px rgba(0,0,0,0.05)', borderColor: 'primary.main' }
                              }}>
                                <Stack direction="row" spacing={3} alignItems="center">
                                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontWeight: 900 }}>{i + 1}</Avatar>
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{s.title}</Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                      <Chip label={s.type} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }} />
                                      {s.isRTL && <Chip label="RTL" color="secondary" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 900 }} />}
                                    </Stack>
                                  </Box>
                                </Stack>
                                <Box>
                                  <IconButton onClick={() => handleEditSection(i)} color="primary"><Edit2 size={18} /></IconButton>
                                  <IconButton onClick={() => setFormData(p => ({ ...p, sections: p.sections.filter((_, idx) => idx !== i) }))} color="error"><Trash2 size={18} /></IconButton>
                                </Box>
                              </Paper>
                            </motion.div>
                         ))}
                       </AnimatePresence>
                       {formData.sections.length === 0 && (
                         <Box sx={{ p: 6, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 6 }}>
                            <ClipboardList size={40} strokeWidth={1} style={{ opacity: 0.2, marginBottom: 8 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Your curriculum is empty. Add your first lesson above.</Typography>
                         </Box>
                       )}
                    </Stack>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={openTeacherProfile} 
        onClose={() => setOpenTeacherProfile(false)}
        PaperProps={{
          sx: {
            borderRadius: 6,
            bgcolor: '#0a0a0a',
            color: 'white',
            overflow: 'hidden',
            maxWidth: 400,
            width: '90%'
          }
        }}
      >
         {selectedTeacher && (
           <Box sx={{ p: 4, textAlign: 'center', position: 'relative' }}>
             <IconButton 
               onClick={() => setOpenTeacherProfile(false)}
               sx={{ position: 'absolute', right: 16, top: 16, color: 'white', bgcolor: alpha('#fff', 0.1) }}
             >
               <X size={20} />
             </IconButton>

             <Box sx={{ 
               width: 160, height: 160, mx: 'auto', mb: 3, position: 'relative',
               '&::after': {
                 content: '""', position: 'absolute', inset: -8, borderRadius: '50%',
                 border: '2px solid', borderColor: alpha(theme.palette.primary.main, 0.3),
                 animation: 'pulse 3s infinite'
               }
             }}>
               <Avatar 
                src={selectedTeacher.photoURL} 
                sx={{ width: '100%', height: '100%', border: '4px solid #000' }} 
                imgProps={{ referrerPolicy: 'no-referrer' }} 
               />
             </Box>
             
             <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: -1.5, mb: 0.5 }}>
               {selectedTeacher.displayName}
             </Typography>
             
             <Chip 
               icon={<Award size={14} color="#10b981" />}
               label={selectedTeacher.role === 'superadmin' ? 'Head of Institute' : 'Certified Instructor'} 
               sx={{ 
                 bgcolor: alpha('#10b981', 0.1), color: '#10b981', fontWeight: 800, mb: 4,
                 border: '1px solid', borderColor: alpha('#10b981', 0.2)
               }} 
             />

             <Box sx={{ 
               p: 3, textAlign: 'left', bgcolor: alpha('#fff', 0.05), borderRadius: 5,
               border: '1px solid', borderColor: alpha('#fff', 0.1)
             }}>
                <Typography variant="caption" sx={{ color: alpha('#fff', 0.5), fontWeight: 900, letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Zap size={14} /> EXPERTISE
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'white', lineHeight: 1.6 }}>
                  {(selectedTeacher as any).bio || "Subject Matter Expert specialized in Islamic Studies and Institutional Management."}
                </Typography>
             </Box>
             
             <Button 
               fullWidth 
               variant="contained"
               onClick={() => setOpenTeacherProfile(false)} 
               sx={{ 
                 mt: 4, borderRadius: 3, py: 1.5, fontWeight: 900,
                 bgcolor: 'white', color: 'black', '&:hover': { bgcolor: '#f0f0f0' }
               }}
             >
               Dismiss
             </Button>
           </Box>
         )}
      </Dialog>

      <Dialog fullScreen open={openReader} onClose={() => setOpenReader(false)} TransitionComponent={Slide} TransitionProps={{ direction: 'up' } as any}>
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: readerStyles.bg, color: readerStyles.text, transition: 'all 0.5s ease' }}>
          <AppBar position="sticky" elevation={0} sx={{ bgcolor: alpha(readerStyles.bg, 0.9), color: readerStyles.text, borderBottom: '1px solid', borderColor: readerStyles.border, backdropFilter: 'blur(10px)' }}>
            <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => setOpenReader(false)} sx={{ color: 'error.main' }}><X size={24} /></IconButton>
                <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 24, borderColor: readerStyles.border }} />
                <Stack direction="row" spacing={0.5}>
                  {[
                    { mode: 'light', icon: <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#fff', border: '1px solid #ddd' }} /> },
                    { mode: 'sepia', icon: <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#F4ECD8', border: '1px solid #E2D1B3' }} /> },
                    { mode: 'dark', icon: <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#121212', border: '1px solid #333' }} /> }
                  ].map((m) => (
                    <IconButton 
                      key={m.mode} 
                      size="small" 
                      onClick={() => setReadingMode(m.mode as any)}
                      sx={{ 
                        border: readingMode === m.mode ? '2px solid' : 'none', 
                        borderColor: 'primary.main',
                        p: 0.5
                      }}
                    >
                      {m.icon}
                    </IconButton>
                  ))}
                </Stack>
              </Box>
              <Typography 
                variant="h6" 
                noWrap 
                sx={{ 
                  fontWeight: 900, 
                  maxWidth: { xs: '120px', sm: '300px', md: '500px' },
                  fontSize: { xs: '0.85rem', sm: '1.1rem' },
                  fontFamily: '"Outfit", sans-serif'
                }}
              >
                {viewingCourse?.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  size="small" 
                  label={`${activeSection + 1} of ${viewingCourse?.sections?.length || 0}`} 
                  sx={{ fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} 
                />
              </Box>
            </Toolbar>
            <LinearProgress 
              variant="determinate" 
              value={((activeSection + 1) / (viewingCourse?.sections?.length || 1)) * 100} 
              sx={{ height: 4, bgcolor: alpha(theme.palette.primary.main, 0.05), '& .MuiLinearProgress-bar': { borderRadius: 2 } }}
            />
          </AppBar>

          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <Grid container sx={{ height: '100%' }}>
              <Grid 
                size={{ xs: 12, md: 3 }} 
                sx={{ 
                  borderRight: '1px solid',
                  borderColor: readerStyles.border,
                  display: { xs: activeSection === -1 ? 'block' : 'none', md: 'block' },
                  overflow: 'auto', 
                  height: '100%',
                  bgcolor: alpha(readerStyles.bg, 0.95),
                  zIndex: 2
                }}
              >
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: readerStyles.border, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: 2 }}>Curriculum Index</Typography>
                </Box>
                <List sx={{ p: 0 }}>
                  {viewingCourse?.sections?.map((section, idx) => (
                    <ListItem 
                      key={idx} 
                      onClick={() => handleSectionChange(idx)} 
                      sx={{ 
                        cursor: 'pointer', 
                        py: 2.5,
                        bgcolor: activeSection === idx ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                        borderLeft: '4px solid',
                        borderColor: activeSection === idx ? 'primary.main' : 'transparent',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: 40 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.8rem', bgcolor: activeSection === idx ? 'primary.main' : alpha(readerStyles.text, 0.1), color: activeSection === idx ? 'white' : readerStyles.text, fontWeight: 900 }}>
                          {idx + 1}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={section.title} 
                        secondary={section.type.toUpperCase()}
                        primaryTypographyProps={{ 
                          variant: 'body2', 
                          fontWeight: activeSection === idx ? 900 : 600,
                          color: activeSection === idx ? 'primary.main' : readerStyles.text,
                          letterSpacing: -0.2
                        }} 
                        secondaryTypographyProps={{
                          variant: 'caption',
                          sx: { fontWeight: 800, opacity: 0.5, fontSize: '0.65rem', letterSpacing: 1 }
                        }}
                      />
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
                      {(viewingCourse?.sections?.[activeSection]?.type === 'audio' || viewingCourse?.sections?.[activeSection]?.secondaryMediaUrl) && (
                        <Paper sx={{ 
                          mb: (viewingCourse?.sections?.[activeSection]?.type === 'audio') ? 8 : 4, 
                          p: (viewingCourse?.sections?.[activeSection]?.type === 'audio') ? 0 : 2, 
                          borderRadius: (viewingCourse?.sections?.[activeSection]?.type === 'audio') ? 8 : 4, 
                          overflow: 'hidden', 
                          maxWidth: (viewingCourse?.sections?.[activeSection]?.type === 'audio') ? 600 : '100%', 
                          mx: 'auto', 
                          boxShadow: (viewingCourse?.sections?.[activeSection]?.type === 'audio') ? '0 30px 60px rgba(0,0,0,0.2)' : 'none', 
                          bgcolor: readerStyles.bg,
                          border: '1px solid', borderColor: readerStyles.border,
                          transition: 'all 0.3s ease'
                        }}>
                           {(viewingCourse?.sections?.[activeSection]?.type === 'audio') && (
                             <Box sx={{ position: 'relative', height: { xs: 300, md: 450 } }}>
                               <Box component="img" src={viewingCourse?.sections?.[activeSection]?.mediaUrl || viewingCourse?.thumbnailUrl || `https://picsum.photos/seed/${viewingCourse.id}/600/900`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                               <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85))' }} />
                               <Box sx={{ position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', color: 'white' }}>
                                 <Typography variant="overline" sx={{ opacity: 0.7, fontWeight: 900, letterSpacing: 4, mb: 1, display: 'block' }}>Audio Experience</Typography>
                                 <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 1000, mb: 1, fontFamily: '"Outfit", sans-serif', letterSpacing: -1 }}>{viewingCourse.sections[activeSection].title}</Typography>
                               </Box>
                             </Box>
                           )}
                           <Box sx={{ p: (viewingCourse?.sections?.[activeSection]?.type === 'audio') ? 4 : 2, textAlign: 'center', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                              <Box sx={{ position: 'relative', mb: (viewingCourse?.sections?.[activeSection]?.type === 'audio') ? 3 : 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                                {(viewingCourse?.sections?.[activeSection]?.secondaryMediaUrl && viewingCourse?.sections?.[activeSection]?.type !== 'audio') && (
                                  <Chip icon={<Headphones size={14} />} label="Background Audio" size="small" variant="outlined" sx={{ fontWeight: 900, fontSize: '0.65rem' }} />
                                )}
                                <audio 
                                  controls 
                                  controlsList="nodownload" 
                                  style={{ width: '100%', height: (viewingCourse?.sections?.[activeSection]?.type === 'audio') ? 56 : 32, borderRadius: 28, filter: readingMode === 'dark' ? 'invert(1) hue-rotate(180deg)' : 'none' }} 
                                  src={viewingCourse.sections[activeSection].type === 'audio' ? viewingCourse.sections[activeSection].mediaUrl : viewingCourse.sections[activeSection].secondaryMediaUrl} 
                                />
                              </Box>
                              {(viewingCourse?.sections?.[activeSection]?.type === 'audio') && (
                                <Typography variant="body2" sx={{ color: readerStyles.text, fontWeight: 700, opacity: 0.6 }}>
                                  <Headphones size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                  Master quality audio • Optimal for focused study
                                </Typography>
                              )}
                           </Box>
                        </Paper>
                      )}

                      {viewingCourse?.sections?.[activeSection]?.type === 'video' && viewingCourse?.sections?.[activeSection]?.mediaUrl && (
                        <Box sx={{ mb: 6, borderRadius: 4, overflow: 'hidden', aspectRatio: '16/9', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', bgcolor: 'black' }}>
                           <iframe 
                             width="100%" 
                             height="100%" 
                             src={(() => {
                               const url = viewingCourse.sections[activeSection].mediaUrl || '';
                               if (url.includes('youtube.com/watch?v=') || url.includes('youtube.com/embed/')) {
                                 const videoId = url.includes('watch?v=') ? url.split('watch?v=')[1].split('&')[0] : url.split('embed/')[1].split('?')[0];
                                 return `https://www.youtube.com/embed/${videoId}`;
                               }
                               if (url.includes('youtu.be/')) {
                                 return `https://www.youtube.com/embed/${url.split('youtu.be/')[1].split('?')[0]}`;
                               }
                               if (url.includes('youtube.com/shorts/')) {
                                 return `https://www.youtube.com/embed/${url.split('/shorts/')[1].split('?')[0]}`;
                               }
                               return url;
                             })()} 
                             frameBorder="0" 
                             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                             allowFullScreen 
                           />
                        </Box>
                      )}

                      <Box sx={{ 
                        direction: viewingCourse?.sections?.[activeSection]?.isRTL ? 'rtl' : (isRTL(viewingCourse?.sections?.[activeSection]?.content || '') ? 'rtl' : 'ltr'),
                        px: (() => {
                          const l = (viewingCourse?.sections?.[activeSection] as any)?.layout;
                          if (l === 'ebook') return { xs: 2, md: 24 };
                          if (l === 'blog') return { xs: 2, md: 16 };
                          if (l === 'magazine') return { xs: 1, md: 4 };
                          return { xs: 0, md: 4 };
                        })(),
                        maxWidth: (() => {
                          const l = (viewingCourse?.sections?.[activeSection] as any)?.layout;
                          if (l === 'ebook') return '800px';
                          if (l === 'blog') return '950px';
                          return '100%';
                        })(),
                        mx: 'auto',
                        textAlign: viewingCourse?.sections?.[activeSection]?.alignment || 'left',
                        fontFamily: (() => {
                          const f = viewingCourse?.sections?.[activeSection]?.fontFamily;
                          if (f === 'nastaliq' || f === 'urdu-modern') return '"Noto Nastaliq Urdu", serif';
                          if (f === 'serif' || f === 'ebook-serif') return '"Noto Serif", serif';
                          if (f === 'display-playfair') return '"Playfair Display", serif';
                          if (f === 'mono') return 'monospace';
                          return 'inherit';
                        })(),
                        fontSize: (() => {
                          const s = viewingCourse?.sections?.[activeSection]?.fontSize;
                          if (s === 'small') return '0.85rem';
                          if (s === 'large') return '1.25rem';
                          if (s === 'extra-large') return '1.75rem';
                          if (s === 'massive') return '2.5rem';
                          return '1.05rem';
                        })()
                      }}>
                        <div className="markdown-body" style={{ 
                          fontSize: 'inherit', 
                          lineHeight: viewingCourse?.sections?.[activeSection]?.fontFamily === 'nastaliq' ? '2.8' : '1.9', 
                          color: isDark ? '#e5e5e5' : '#333' 
                        }}>
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
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

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

      if (percentage >= (quiz.passingScore || 70)) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }

      if (currentUser) {
        try {
          await smartAddDoc(collection(db, 'quiz_results'), {
            studentId: currentUser.uid, 
            studentName: currentUser.displayName, 
            courseId, 
            sectionId,
            score: correct, 
            percentage,
            totalQuestions: quiz.questions.length, 
            timestamp: Date.now()
          });
        } catch (e) { 
          console.error("Failed to save quiz result", e); 
        }
      }
    }
  };

  if (showResults) return (
    <Box sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 4, bgcolor: 'background.paper', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
       <Trophy size={48} color={theme.palette.primary.main} style={{ opacity: 0.8, marginBottom: 16 }} />
       <Typography variant="h5" sx={{ mt: 2, fontWeight: 900 }}>Score: {score} / {quiz.questions.length}</Typography>
       <Typography variant="h6" color="primary" sx={{ mb: 1, fontWeight: 850 }}>{Math.round((score / quiz.questions.length) * 100)}%</Typography>
       <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 600 }}>
         {((score / quiz.questions.length) * 100) >= (quiz.passingScore || 70) 
           ? 'Congratulations! You passed this module quiz. ✨' 
           : 'Keep practicing to improve your score. 📚'}
       </Typography>
       <Stack direction="row" spacing={2} justifyContent="center">
         <Button variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 800 }} onClick={() => { setShowResults(false); setCurrentStep(0); setSelectedAnswers([]); }}>Retake Quiz</Button>
         <Button variant="contained" size="small" sx={{ borderRadius: 2, fontWeight: 800 }} onClick={() => setShowResults(false)}>Close Results</Button>
       </Stack>
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
      <Typography noWrap variant="body2" sx={{ mt: 1.5, fontWeight: 900, fontSize: '0.85rem', color: theme.palette.mode === 'dark' ? 'white' : 'black' }}>{course.name}</Typography>
      
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
