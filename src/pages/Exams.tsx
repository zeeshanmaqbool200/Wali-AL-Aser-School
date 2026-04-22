import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, InputAdornment, Tab, Tabs,
  Divider, Tooltip, useTheme, useMediaQuery, alpha,
  Stack, Zoom, Fade, List, ListItem, ListItemAvatar, ListItemText,
  FormControl, InputLabel, Select, MenuItem, LinearProgress
} from '@mui/material';
import { 
  Plus, Search, FileText, Award, Trash2, 
  Filter, Calendar, Clock, User, CheckCircle,
  AlertCircle, TrendingUp, BookOpen, GraduationCap,
  ArrowRight, ExternalLink, Download, Layout,
  Layers, Star, Share2, Bookmark, Save
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { logger } from '../lib/logger';

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  date: string;
  maxMarks: number;
  type: 'test' | 'midterm' | 'final';
  status: 'upcoming' | 'completed' | 'cancelled';
  teacherId: string;
  teacherName: string;
  createdAt: number;
}

export default function Exams() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, id: string }>({ open: false, id: '' });
  
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    grade: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    maxMarks: 100,
    type: 'test' as const,
    status: 'upcoming' as const
  });

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isApprovedMudaris = currentUser?.role === 'approved_mudaris';
  const isTeacher = isSuperAdmin || isApprovedMudaris;

  useEffect(() => {
    let q = query(collection(db, 'exams'), orderBy('date', 'desc'));
    
    // Filtering exams based on role
    if (isApprovedMudaris) {
      q = query(
        collection(db, 'exams'), 
        where('grade', 'in', currentUser?.assignedClasses || ['none']), 
        orderBy('date', 'desc')
      );
    } else if (currentUser?.role === 'student') {
      q = query(
        collection(db, 'exams'), 
        where('grade', '==', currentUser.maktabLevel || currentUser.grade || 'none'), 
        orderBy('date', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Exam[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, isApprovedMudaris]);

  const handleSave = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const newExam = {
        ...formData,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName,
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'exams'), newExam);
      
      // Trigger confetti for a delightful experience
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f43f5e', '#fb923c', '#facc15']
      });

      setOpenDialog(false);
      setFormData({ 
        title: '', subject: '', grade: '', 
        date: format(new Date(), 'yyyy-MM-dd'), 
        maxMarks: 100, type: 'test', status: 'upcoming' 
      });
    } catch (error) {
      logger.error('Error creating exam', error as Error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirm({ open: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'exams', deleteConfirm.id));
      setDeleteConfirm({ open: false, id: '' });
    } catch (error) {
      logger.error('Error deleting exam', error as Error);
    }
  };

  const filteredExams = exams.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         e.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = tabValue === 0 ? e.status === 'upcoming' : e.status === 'completed';
    return matchesSearch && matchesTab;
  });

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
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Imtihanat & Janch (Exams)</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Schedule evaluations, track performance, and manage results for Tulab
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Box sx={{ 
              display: 'flex', 
              bgcolor: 'background.default', 
              p: 0.8, 
              borderRadius: 2,
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
                onClick={() => setOpenDialog(true)}
                sx={{ 
                  borderRadius: 2, 
                  fontWeight: 900, 
                  px: 4, 
                  py: 1.5,
                  textTransform: 'none',
                  boxShadow: theme.palette.mode === 'dark'
                    ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                    : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
                }}
              >
                Schedule Imtihan
              </Button>
            )}
          </Stack>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ 
            borderRadius: 2, 
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: 'none',
            boxShadow: theme.palette.mode === 'dark'
              ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
              : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
          }}>
            <Box sx={{ 
              borderBottom: 1, 
              borderColor: 'divider', 
              bgcolor: 'background.paper', 
              px: 3, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap',
              gap: 2,
              py: 1
            }}>
              <Tabs 
                value={tabValue} 
                onChange={(e, v) => setTabValue(v)} 
                sx={{ 
                  '& .MuiTab-root': { fontWeight: 900, py: 3, minWidth: 140, textTransform: 'none', fontSize: '1rem' },
                  '& .Mui-selected': { color: 'primary.main' },
                  '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0' }
                }}
              >
                <Tab label="Aane Wale" icon={<Calendar size={20} />} iconPosition="start" />
                <Tab label="Mukammal" icon={<CheckCircle size={20} />} iconPosition="start" />
              </Tabs>
              
              <Box sx={{ px: 2, py: 2, flex: { xs: 1, md: 'none' }, minWidth: { xs: '100%', md: 350 } }}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    px: 3, 
                    borderRadius: 2, 
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
                    placeholder="Search exams..." 
                    value={searchQuery}
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    sx={{ 
                      border: 'none', 
                      outline: 'none', 
                      p: 2, 
                      width: '100%', 
                      fontWeight: 800,
                      fontSize: '1rem',
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      '&::placeholder': { color: 'text.disabled' }
                    }} 
                  />
                </Paper>
              </Box>
            </Box>
            
            {viewMode === 'list' ? (
              <Box sx={{ overflowX: 'auto', width: '100%' }}>
                <TableContainer component={Box} sx={{ minWidth: { xs: 800, md: '100%' } }}>
                  <Table>
                    <TableHead>
                    <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.5) : 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 800, py: 2.5 }}>Imtihan Title</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Mazmoon</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Date & Time</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Maktab Level</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filteredExams.map((exam) => (
                        <TableRow 
                          component={motion.tr}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          key={exam.id} 
                          hover
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', width: 40, height: 40, borderRadius: 2 }}>
                                <BookOpen size={20} />
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{exam.title}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{exam.type.toUpperCase()}</Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={exam.subject} 
                              size="small" 
                              sx={{ fontWeight: 800, fontSize: '0.7rem', borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), color: 'primary.main', border: 'none' }} 
                            />
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{format(new Date(exam.date), 'MMM d, yyyy')}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>10:00 AM - 12:00 PM</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{exam.grade}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                              {isTeacher && (
                                <Tooltip title="Delete">
                                  <IconButton 
                                    size="small" 
                                    sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                    onClick={() => handleDelete(exam.id)}
                                  >
                                    <Trash2 size={16} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="View Analytics">
                                <IconButton size="small" sx={{ bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.4) : 'grey.100', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}>
                                  <TrendingUp size={16} />
                                </IconButton>
                              </Tooltip>
                              <IconButton size="small" sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}>
                                <ArrowRight size={18} />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </TableContainer>
              </Box>
            ) : (
              <Box sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  <AnimatePresence mode="popLayout">
                    {filteredExams.map((exam, index) => (
                      <Grid size={{ xs: 12, sm: 6 }} key={exam.id}>
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <ExamCard exam={exam} isTeacher={isTeacher} onDelete={() => handleDelete(exam.id)} />
                        </motion.div>
                      </Grid>
                    ))}
                  </AnimatePresence>
                </Grid>
              </Box>
            )}
            
            {filteredExams.length === 0 && (
              <Box sx={{ p: 10, textAlign: 'center' }}>
                <Award size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No exams found</Typography>
                <Typography variant="body2" color="text.secondary">Try adjusting your search query or filters</Typography>
              </Box>
            )}
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Card sx={{ borderRadius: 5, bgcolor: 'primary.main', color: 'white', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: -20, right: -20, opacity: 0.1 }}>
                <TrendingUp size={120} />
              </Box>
              <CardContent sx={{ p: 3, position: 'relative' }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 2.5 }}>Performance Insights</Typography>
                <Stack spacing={2.5}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Average Class Score</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>78.5%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={78.5} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Completion Rate</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>94%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={94} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
                  </Box>
                  <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 1 }} />
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)' }}>
                      <AlertCircle size={20} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
                      Class performance has improved by 5.2% compared to the previous semester assessments.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 5 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Recent Results</Typography>
                  <Button size="small" sx={{ fontWeight: 800 }}>View All</Button>
                </Box>
                <List disablePadding>
                  {[
                    { title: 'Mathematics Midterm', date: 'Oct 12', grade: 'A+', color: 'success' },
                    { title: 'Physics Quiz #4', date: 'Oct 08', grade: 'B', color: 'primary' },
                    { title: 'English Literature', date: 'Oct 05', grade: 'A', color: 'success' }
                  ].map((result, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 1.5, borderBottom: i < 2 ? '1px solid' : 'none', borderColor: 'divider' }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: alpha(theme.palette[result.color as 'success' | 'primary'].main, 0.1), color: `${result.color}.main`, borderRadius: 2 }}>
                          <Award size={20} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={result.title}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 800 } }}
                        secondary={`Published on ${result.date}`}
                        secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary', sx: { fontWeight: 600 } }}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: `${result.color}.main` }}>{result.grade}</Typography>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Schedule Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
      >
                <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', pb: 1 }}>
          Schedule Naya Imtihan
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
            Configure the assessment details below. Notifications will be sent to all enrolled Tulab.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Imtihan Title"
                placeholder="e.g. Shashmahi Imtihan 2026"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Mazmoon"
                placeholder="e.g. Quran with Tajweed"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Maktab Level"
                placeholder="e.g. Level 1"
                required
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Max Marks"
                type="number"
                value={formData.maxMarks}
                onChange={(e) => setFormData({ ...formData, maxMarks: Number(e.target.value) })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                <InputLabel>Imtihan Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Imtihan Type"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <MenuItem value="test">Sabaqi Imtihan (Test/Quiz)</MenuItem>
                  <MenuItem value="midterm">Shashmahi Imtihan (Midterm)</MenuItem>
                  <MenuItem value="final">Salana Imtihan (Final)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Save size={18} />} 
            disabled={!formData.title || !formData.subject || submitting}
            sx={{ borderRadius: 3, fontWeight: 800, px: 3, boxShadow: '0 8px 24px rgba(15, 118, 110, 0.3)' }}
          >
            {submitting ? 'Scheduling...' : 'Schedule Imtihan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: '' })} PaperProps={{ sx: { borderRadius: 5, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this exam? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteConfirm({ open: false, id: '' })} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" sx={{ borderRadius: 3, fontWeight: 800 }}>
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ExamCard({ exam, isTeacher, onDelete }: any) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Card sx={{ 
      borderRadius: 2, 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      border: 'none',
      bgcolor: 'background.paper',
      boxShadow: isDark 
        ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
        : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
      '&:hover': { 
        transform: 'translateY(-10px)', 
        boxShadow: isDark 
          ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
          : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff'
      }
    }}>
      <Box sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Avatar sx={{ 
            bgcolor: 'background.default', 
            color: 'primary.main', 
            width: 56, 
            height: 56, 
            borderRadius: 4,
            boxShadow: isDark
              ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
              : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
          }}>
            <BookOpen size={28} />
          </Avatar>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Chip 
              label={exam.type.toUpperCase()} 
              size="small" 
              sx={{ fontWeight: 900, fontSize: '0.7rem', bgcolor: 'background.default', borderRadius: 2.5, border: 'none' }} 
            />
            {isTeacher && (
              <IconButton size="small" color="error" onClick={onDelete} sx={{ bgcolor: 'background.default', boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }}>
                <Trash2 size={16} />
              </IconButton>
            )}
          </Box>
        </Box>
        
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1, letterSpacing: -1 }}>{exam.title}</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 800, mb: 4 }}>
          {exam.subject} • {exam.grade}
        </Typography>
        
        <Stack spacing={2.5} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
            <Calendar size={18} color={theme.palette.primary.main} />
            <Typography variant="body2" sx={{ fontWeight: 800 }}>{format(new Date(exam.date), 'MMMM d, yyyy')}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
            <Clock size={18} color={theme.palette.primary.main} />
            <Typography variant="body2" sx={{ fontWeight: 800 }}>10:00 AM - 12:00 PM (2 Hours)</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
            <Award size={18} color={theme.palette.primary.main} />
            <Typography variant="body2" sx={{ fontWeight: 800 }}>Max Marks: {exam.maxMarks}</Typography>
          </Box>
        </Stack>
        
        <Divider sx={{ mb: 3, borderStyle: 'dashed', opacity: 0.5 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ 
              width: 32, 
              height: 32, 
              fontSize: '0.8rem', 
              fontWeight: 900, 
              bgcolor: 'background.default', 
              color: 'primary.main',
              boxShadow: isDark ? '2px 2px 4px #060a12, -2px -2px 4px #182442' : '2px 2px 4px #d1d9e6, -2px -2px 4px #ffffff'
            }}>
              {exam.teacherName.charAt(0)}
            </Avatar>
            <Typography variant="caption" sx={{ fontWeight: 900 }}>{exam.teacherName}</Typography>
          </Box>
          <Button 
            variant="contained" 
            size="medium" 
            endIcon={<ArrowRight size={18} />}
            sx={{ 
              borderRadius: 3, 
              fontWeight: 900, 
              px: 3,
              textTransform: 'none',
              boxShadow: isDark 
                ? '6px 6px 12px #060a12, -6px -6px 12px #182442'
                : '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
            }}
          >
            Details
          </Button>
        </Box>
      </Box>
    </Card>
  );
}
