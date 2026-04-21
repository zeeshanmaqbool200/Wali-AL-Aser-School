import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button,
  TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, List, ListItem, ListItemText, ListItemAvatar,
  Divider, InputAdornment, Paper, Tooltip, useTheme,
  useMediaQuery, alpha, Stack, Zoom, Fade
} from '@mui/material';
import {
  Plus, Search, Edit2, Trash2, BookOpen,
  Clock, User, Users, Filter, CheckCircle,
  MoreVertical, Book, GraduationCap, ArrowRight,
  Star, Share2, Bookmark, Layout, Layers
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Course, UserProfile } from '../types';
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
    teacherId: ''
  });

  const isTeacher = currentUser?.role === 'approved_mudaris' || currentUser?.role === 'superadmin';

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!currentUser) return;
    try {
      const data = {
        ...formData,
        fee: Number(formData.fee),
        teacherName: currentUser.displayName,
        teacherId: currentUser.uid,
        createdAt: Date.now()
      };

      if (editingCourse) {
        await updateDoc(doc(db, 'courses', editingCourse.id), data);
      } else {
        await addDoc(collection(db, 'courses'), data);

        // Trigger confetti for a delightful experience
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899']
        });
      }

      setOpenDialog(false);
      setEditingCourse(null);
      setFormData({ name: '', code: '', description: '', duration: '', fee: '', teacherName: '', teacherId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
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
      teacherId: course.teacherId
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
    <Box sx={{ pb: { xs: 4, sm: 6, md: 8 }, px: { xs: 1.5, sm: 2, md: 0 } }}>
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
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => {
                  setEditingCourse(null);
                  setFormData({ name: '', code: '', description: '', duration: '', fee: '', teacherName: '', teacherId: '' });
                  setOpenDialog(true);
                }}
                sx={{
                  borderRadius: 4,
                  fontWeight: 900,
                  px: 4,
                  py: 1.5,
                  textTransform: 'none',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                    : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
                }}
              >
                Add New Mazmoon
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Mazmoon Fee"
                type="number"
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  sx: { borderRadius: 3 }
                }}
                value={formData.fee}
                onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
              />
            </Grid>
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

function CourseCard({ course, isTeacher, onEdit, onDelete, viewMode }: any) {
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
              size="small"
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
          src={`https://picsum.photos/seed/${course.code}/600/400`}
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
              <IconButton size="small" onClick={onEdit} sx={{ p: 1, bgcolor: alpha(theme.palette.primary.main, 0.05) }}><Edit2 size={16} /></IconButton>
              <IconButton size="small" color="error" onClick={onDelete} sx={{ p: 1, bgcolor: alpha(theme.palette.error.main, 0.05) }}><Trash2 size={16} /></IconButton>
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
        View Details
      </Button>
    </Card>
  );
}
