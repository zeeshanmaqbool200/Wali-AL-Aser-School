import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, List, ListItem, ListItemText, ListItemAvatar,
  Divider, InputAdornment, Paper, Tooltip, useTheme,
  useMediaQuery, alpha, Stack, Zoom, Fade,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { 
  Plus, Search, Edit2, Trash2, BookOpen, 
  Clock, User, Users, Filter, CheckCircle,
  MoreVertical, Book, GraduationCap, ArrowRight,
  Star, Share2, Bookmark, Layout, Layers
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, or, and } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Course, CourseSection, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function Courses() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openReader, setOpenReader] = useState(false);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration: '',
    fee: '',
    teacherName: '',
    teacherId: '',
    thumbnailUrl: '',
    sections: [] as CourseSection[],
    isPublished: false,
    gradeId: ''
  });

  const [newSection, setNewSection] = useState<CourseSection>({ title: '', content: '', type: 'text', mediaUrl: '' });

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isMudaris = currentUser?.role === 'approved_mudaris';
  const isTeacher = isSuperAdmin || isMudaris;

  useEffect(() => {
    let q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    
    // Students only see published courses or courses assigned specifically to them/their class
    // For now, let's just filter by isPublished and gradeId
    if (!isTeacher && currentUser) {
      q = query(
        collection(db, 'courses'), 
        and(
          where('isPublished', '==', true),
          or(
            where('gradeId', '==', currentUser.maktabLevel || 'none'),
            where('gradeId', '==', 'all'),
            where('enrolledStudents', 'array-contains', currentUser.uid)
          )
        )
      );
    } else if (isMudaris && !isSuperAdmin) {
      // Mudaris sees courses assigned to them
      q = query(
        collection(db, 'courses'), 
        or(
          where('teacherId', '==', currentUser.uid),
          where('assignedMudaris', 'array-contains', currentUser.uid)
        )
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });
    return () => unsubscribe();
  }, [currentUser, isTeacher]);

  const handleSave = async () => {
    if (!currentUser) return;
    try {
      const data = {
        ...formData,
        fee: Number(formData.fee),
        // If teacher is mudaris, they stay teacher. If admin is creating, they might assign someone else.
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
      setFormData({ name: '', code: '', description: '', duration: '', fee: '', teacherName: '', teacherId: '', thumbnailUrl: '', sections: [], isPublished: false, gradeId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
  };

  const handleAddSection = () => {
    if (!newSection.title || !newSection.content) return;
    setFormData({ ...formData, sections: [...formData.sections, newSection] });
    setNewSection({ title: '', content: '', type: 'text', mediaUrl: '' });
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
      fee: course.fee.toString(),
      teacherName: course.teacherName,
      teacherId: course.teacherId,
      thumbnailUrl: course.thumbnailUrl || '',
      sections: course.sections || [],
      isPublished: course.isPublished || false,
      gradeId: course.gradeId || ''
    });
    setOpenDialog(true);
  };

  const filteredCourses = courses.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: 8 }}>
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
          <Stack direction="row" spacing={2}>
            <Box sx={{ 
              display: 'flex', 
              bgcolor: 'background.default', 
              p: 0.8, 
              borderRadius: 4,
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('grid')}
                sx={{ 
                  borderRadius: 3, 
                  bgcolor: viewMode === 'grid' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'grid' 
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff')
                    : 'none',
                  color: viewMode === 'grid' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layout size={18} />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('list')}
                sx={{ 
                  borderRadius: 3, 
                  bgcolor: viewMode === 'list' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'list' 
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff')
                    : 'none',
                  color: viewMode === 'list' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layers size={18} />
              </IconButton>
            </Box>
            {isTeacher && (
              <Box sx={{ position: 'fixed', bottom: { xs: 90, md: 40 }, right: { xs: 20, md: 40 }, zIndex: 1000 }}>
                <Zoom in={true}>
                  <Button 
                    variant="contained" 
                    startIcon={<Plus size={24} />} 
                    onClick={() => {
                      setEditingCourse(null);
                      setFormData({
                        name: '',
                        code: '',
                        description: '',
                        duration: '',
                        fee: '',
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
                      borderRadius: '50px', 
                      fontWeight: 900, 
                      px: isMobile ? 3 : 4, 
                      py: 2,
                      minHeight: 64,
                      textTransform: 'none',
                      fontSize: '1rem',
                      boxShadow: theme.palette.mode === 'dark'
                        ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
                        : '12px 12px 24px #cbd5e1, -12px -12px 24px #ffffff',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        boxShadow: theme.palette.mode === 'dark'
                          ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
                          : '16px 16px 32px #cbd5e1, -16px -16px 32px #ffffff',
                      }
                    }}
                  >
                    {!isMobile && "Add New Mazmoon"}
                  </Button>
                </Zoom>
              </Box>
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
            px: 3, 
            borderRadius: 5, 
            border: 'none',
            bgcolor: 'background.default',
            boxShadow: theme.palette.mode === 'dark'
              ? 'inset 6px 6px 12px #060a12, inset -6px -6px 12px #182442'
              : 'inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff',
          }}
        >
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
          <IconButton sx={{ 
            bgcolor: 'background.paper', 
            borderRadius: 3, 
            boxShadow: theme.palette.mode === 'dark' 
              ? '4px 4px 8px #060a12, -4px -4px 8px #182442' 
              : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' 
          }}>
            <Filter size={20} />
          </IconButton>
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
                  isTeacher={isTeacher} 
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
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', pb: 1 }}>
          {editingCourse ? 'Edit Mazmoon' : 'Create New Mazmoon'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
            Fill in the details below to {editingCourse ? 'update the' : 'add a new'} mazmoon to the curriculum.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                label="Mazmoon Name"
                placeholder="e.g. Quran with Tajweed"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Mazmoon Code"
                placeholder="e.g. QRN-101"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Description"
                placeholder="Briefly describe what Tulab will learn..."
                multiline
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Duration"
                placeholder="e.g. 6 Months / 1 Year"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Course Modules (Blog Style Content)</Typography>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 3 }}>
                <Stack spacing={2}>
                  <TextField fullWidth size="small" label="Module Title" value={newSection.title} onChange={(e) => setNewSection({ ...newSection, title: e.target.value })} />
                  <TextField fullWidth multiline rows={3} label="Module Content" placeholder="Supports rich text descriptions..." value={newSection.content} onChange={(e) => setNewSection({ ...newSection, content: e.target.value })} />
                  <Stack direction="row" spacing={2}>
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Type</InputLabel>
                      <Select value={newSection.type} label="Type" onChange={(e) => setNewSection({ ...newSection, type: e.target.value as any })}>
                        <MenuItem value="text">Text</MenuItem>
                        <MenuItem value="image">Image</MenuItem>
                        <MenuItem value="video">Video</MenuItem>
                        <MenuItem value="file">Downloadable File</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField fullWidth size="small" sx={{ flex: 2 }} label="Media URL (Optional)" value={newSection.mediaUrl} onChange={(e) => setNewSection({ ...newSection, mediaUrl: e.target.value })} />
                  </Stack>
                  <Button variant="outlined" fullWidth onClick={handleAddSection} sx={{ borderRadius: 2 }}>Add Module</Button>
                </Stack>
              </Paper>
              <Stack spacing={1}>
                {formData.sections.map((s, i) => (
                  <Chip key={i} label={s.title} color="primary" variant="outlined" onDelete={() => setFormData({ ...formData, sections: formData.sections.filter((_, idx) => idx !== i) })} sx={{ borderRadius: 2, fontWeight: 700 }} />
                ))}
              </Stack>
            </Grid>
            {isSuperAdmin && (
              <Grid size={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>Assignment Controls (Admin Only)</Typography>
                <TextField fullWidth label="Restrict to Level (e.g. Level 1, all)" value={formData.gradeId} onChange={(e) => setFormData({ ...formData, gradeId: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            startIcon={<CheckCircle size={18} />} 
            disabled={!formData.name || !formData.code}
            sx={{ borderRadius: 3, fontWeight: 800, px: 3, boxShadow: '0 8px 24px rgba(15, 118, 110, 0.3)' }}
          >
            {editingCourse ? 'Update Mazmoon' : 'Create Mazmoon'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function CourseCard({ course, isTeacher, onEdit, onDelete, onRead, viewMode }: any) {
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
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', letterSpacing: 1.5 }}>FEE</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: 'primary.main' }}>₹{course.fee}</Typography>
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
        <Box className="course-image" component="img" src={`https://picsum.photos/seed/${course.code}/600/400`} alt={course.name} loading="lazy" decoding="async" sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
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
              <IconButton aria-label="Delete course" size="small" color="error" onClick={onDelete} sx={{ p: 1, bgcolor: alpha(theme.palette.error.main, 0.05) }}><Trash2 size={16} /></IconButton>
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
            <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.primary' }}>{course.teacherName}</Typography>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: -1.5 }}>₹{course.fee}</Typography>
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
