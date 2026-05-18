import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, List, ListItem, ListItemText, ListItemAvatar,
  Divider, InputAdornment, Paper, Tooltip,
  Stack, Fade, Zoom, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Plus, Search, FileText, Download, Trash2, 
  Filter, BookOpen, Clock, User, Share2,
  ExternalLink, File, FileCode, FileImage,
  MoreVertical, ArrowRight, Sparkles, CheckCircle,
  Folder, Layers, Layout, Save
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, or } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import ActionMenu, { ActionMenuItem } from '../components/ActionMenu';
import confetti from 'canvas-confetti';

interface StudyNote {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  authorName: string;
  subject: string;
  classLevel: string;
  uploadedAt: number;
}

export default function Notes() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fileUrl: '',
    subject: '',
    classLevel: 'All'
  });

  const classLevels = [
    'All', 'Mubtadi', 'Awal', 'Doum', 'Soum', 'Chaharm', 'Panjum', 'Shasham', 
    'Haftum', 'Hashtum', 'Nahum', 'Dahum', 'Hafiz'
  ];

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isManagerRole = currentUser?.role === 'manager';
  const isTeacherRole = currentUser?.role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

  useEffect(() => {
    if (!currentUser) return;

    let q;
    if (isAdmin) {
      q = query(collection(db, 'notes'), orderBy('uploadedAt', 'desc'));
    } else if (isTeacherRole) {
      // Teachers see 'All' or their assigned classes
      q = query(
        collection(db, 'notes'), 
        or(
          where('classLevel', '==', 'All'),
          where('classLevel', 'in', (currentUser.assignedClasses && currentUser.assignedClasses.length > 0) ? currentUser.assignedClasses : ['__none__']),
          where('uploadedBy', '==', currentUser.uid)
        ),
        orderBy('uploadedAt', 'desc')
      );
    } else {
      // Students see 'All' or their specific classLevel
      q = query(
        collection(db, 'notes'), 
        or(
          where('classLevel', '==', 'All'),
          where('classLevel', '==', currentUser?.classLevel || 'none')
        ),
        orderBy('uploadedAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StudyNote[];
      setNotes(allNotes); // We already filtered via query, so client-side filter is now redundant but safe
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes');
    });
    return () => unsubscribe();
  }, [currentUser, isAdmin, isStaff, isTeacherRole]);

  const handleUpload = async () => {
    if (!currentUser) return;
    try {
      const newNote = {
        ...formData,
        uploadedBy: currentUser.uid,
        authorName: currentUser.displayName,
        fileType: formData.fileUrl.split('.').pop() || 'pdf',
        fileUrl: formData.fileUrl || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        uploadedAt: Date.now()
      };
      await addDoc(collection(db, 'notes'), newNote);
      
      // Trigger confetti for a delightful experience
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#f59e0b']
      });

      setOpenDialog(false);
      setFormData({ title: '', description: '', fileUrl: '', subject: '', classLevel: 'All' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notes');
    }
  };

  const handleDelete = async (id: string, uploadedBy: string) => {
    if (!isAdmin && currentUser?.uid !== uploadedBy) return;
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
    }
  };

  const getFileIcon = (type: string, size = 24) => {
    switch (type.toLowerCase()) {
      case 'pdf': return <FileText size={size} />;
      case 'jpg':
      case 'png': return <FileImage size={size} />;
      case 'zip': return <FileCode size={size} />;
      default: return <File size={size} />;
    }
  };

  const getFileColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return 'error';
      case 'jpg':
      case 'png': return 'success';
      case 'zip': return 'warning';
      default: return 'primary';
    }
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.subject.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Study Materials</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Access digital notes, assignments, and study resources
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Box 
              sx={{ 
                display: 'flex', 
                bgcolor: 'background.paper', 
                p: 0.5, 
                borderRadius: 4,
                boxShadow: theme.palette.mode === 'dark'
                  ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                  : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
              }}
            >
              <IconButton 
                size="small" 
                onClick={() => setViewMode('grid')}
                sx={{ 
                  borderRadius: 3, 
                  bgcolor: viewMode === 'grid' ? 'primary.main' : 'transparent', 
                  color: viewMode === 'grid' ? 'white' : 'text.secondary',
                  boxShadow: viewMode === 'grid' 
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12' : '4px 4px 8px #d1d9e6')
                    : 'none',
                  '&:hover': { bgcolor: viewMode === 'grid' ? 'primary.dark' : alpha(theme.palette.primary.main, 0.1) }
                }}
              >
                <Layout size={18} />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('list')}
                sx={{ 
                  borderRadius: 3, 
                  bgcolor: viewMode === 'list' ? 'primary.main' : 'transparent', 
                  color: viewMode === 'list' ? 'white' : 'text.secondary',
                  boxShadow: viewMode === 'list' 
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12' : '4px 4px 8px #d1d9e6')
                    : 'none',
                  '&:hover': { bgcolor: viewMode === 'list' ? 'primary.dark' : alpha(theme.palette.primary.main, 0.1) }
                }}
              >
                <Filter size={18} />
              </IconButton>
            </Box>
            {isStaff && (
              <Button 
                variant="contained" 
                startIcon={<Plus size={18} />} 
                onClick={() => setOpenDialog(true)}
                sx={{ 
                  borderRadius: 4, 
                  fontWeight: 900, 
                  px: 4, 
                  py: 1.5,
                  textTransform: 'none',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                    : `0 8px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                Mawad Upload Karein
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
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? 'inset 6px 6px 12px #060a12, inset -6px -6px 12px #182442'
              : 'inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff',
          }}
        >
          <Search size={22} style={{ marginRight: 12, color: theme.palette.text.secondary }} />
          <Box 
            component="input"
            placeholder="Title, mazmoon ya level se talash karein..."
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
            sx={{ 
              border: 'none', 
              outline: 'none', 
              py: 2.5, 
              width: '100%', 
              fontWeight: 700,
              bgcolor: 'transparent',
              color: 'text.primary',
              fontSize: '1rem',
              '&::placeholder': { color: 'text.disabled' }
            }} 
          />
        </Paper>
      </Box>

      <Grid container spacing={3}>
        <AnimatePresence mode="popLayout">
          {filteredNotes.map((note, index) => (
            <Grid size={{ xs: 12, sm: 6, md: viewMode === 'grid' ? 4 : 12 }} key={note.id}>
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                {viewMode === 'grid' ? (
                  <NoteCard 
                    note={note} 
                    isTeacher={isStaff} 
                    onDelete={() => handleDelete(note.id, note.uploadedBy)} 
                    getFileIcon={getFileIcon}
                    getFileColor={getFileColor}
                  />
                ) : (
                  <NoteListItem 
                    note={note} 
                    isTeacher={isStaff} 
                    onDelete={() => handleDelete(note.id, note.uploadedBy)} 
                    getFileIcon={getFileIcon}
                    getFileColor={getFileColor}
                  />
                )}
              </motion.div>
            </Grid>
          ))}
        </AnimatePresence>
      </Grid>
      
      {filteredNotes.length === 0 && (
        <Box sx={{ p: 12, textAlign: 'center' }}>
          <Folder size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Koi mawad nahi mila</Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery ? 'Try adjusting your search terms.' : 'Abhi tak koi darsi mawad upload nahi kiya gaya hai.'}
          </Typography>
        </Box>
      )}

      {/* Upload Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', pb: 1 }}>
          Upload New Material
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
            Share study resources, notes, or assignments with your students.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Material Title"
                placeholder="e.g. Science Chapter 1 Notes"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Description"
                placeholder="Briefly describe what this material covers..."
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="File URL (Optional)"
                placeholder="https://example.com/file.pdf"
                value={formData.fileUrl}
                onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                helperText="If left empty, a dummy PDF will be used"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Subject"
                placeholder="e.g. Science"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                <InputLabel>Target Level (Assign To)</InputLabel>
                <Select
                  value={formData.classLevel}
                  label="Target Level (Assign To)"
                  onChange={(e) => setFormData({ ...formData, classLevel: e.target.value })}
                >
                  {classLevels.map(level => (
                    <MenuItem key={level} value={level}>{level}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            onClick={handleUpload} 
            variant="contained" 
            startIcon={<Plus size={18} />} 
            disabled={!formData.title}
            sx={{ 
              borderRadius: 3, 
              fontWeight: 950, 
              px: 4,
              py: 1.2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.75)} 100%)`,
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
              }
            }}
          >
            Upload Now
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function NoteCard({ note, onDelete, getFileIcon, getFileColor }: any) {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'manager';
  
  return (
    <Card sx={{ 
      borderRadius: 5, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: '1px solid',
      borderColor: alpha(theme.palette.divider, 0.1),
      bgcolor: 'background.paper',
      boxShadow: 'none',
      position: 'relative',
      overflow: 'hidden',
      '&:hover': { 
        borderColor: 'primary.main',
        transform: 'translateY(-4px)',
        boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.08)}`
      }
    }}>
      {/* Book-like "Cover" Ribbon */}
      <Box sx={{ 
        height: 6, 
        bgcolor: `${getFileColor(note.fileType)}.main`,
        width: '100%',
        opacity: 0.8
      }} />

      <CardContent sx={{ p: 3, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: 3, 
            bgcolor: alpha(theme.palette[getFileColor(note.fileType) as 'primary' | 'error' | 'success' | 'warning'].main, 0.1),
            color: `${getFileColor(note.fileType)}.main`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getFileIcon(note.fileType, 32)}
          </Box>
          <ActionMenu 
            items={[
              { 
                label: 'Sabaq Parhein (Read)', 
                icon: <BookOpen size={16} />, 
                onClick: () => window.open(note.fileUrl, '_blank'),
                color: 'primary.main'
              },
              { 
                label: 'Zakhira Karein (Download)', 
                icon: <Download size={16} />, 
                onClick: () => window.open(note.fileUrl, '_blank') 
              },
              { divider: true, label: '', icon: null, onClick: () => {} },
              { 
                label: 'Munsukh Karein (Delete)', 
                icon: <Trash2 size={16} />, 
                color: 'error.main',
                onClick: onDelete,
                disabled: !isAdmin && currentUser?.uid !== note.uploadedBy
              }
            ]} 
          />
        </Box>
        
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, lineHeight: 1.3, letterSpacing: -0.5 }}>
          {note.title}
        </Typography>
        
        <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Chip 
            label={note.subject} 
            size="small" 
            sx={{ fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.05), color: 'primary.main', borderRadius: 1.5, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }} 
          />
          <Chip 
            label={note.classLevel} 
            size="small" 
            sx={{ fontWeight: 800, bgcolor: 'background.default', borderRadius: 1.5, border: '1px solid', borderColor: theme.palette.divider }} 
          />
        </Stack>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 500, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {note.description}
        </Typography>
      </CardContent>
      
      <Divider sx={{ opacity: 0.5 }} />
      
      <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.background.default, 0.5), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Avatar 
            sx={{ 
              width: 26, 
              height: 26, 
              bgcolor: 'primary.main', 
              fontSize: '0.7rem', 
              fontWeight: 900,
            }}
          >
            {note.authorName.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary', display: 'block', lineHeight: 1 }}>{note.authorName}</Typography>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary' }}>Muallim (Teacher)</Typography>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
          {format(note.uploadedAt, 'MMM dd, yyyy')}
        </Typography>
      </Box>
    </Card>
  );
}

function NoteListItem({ note, onDelete, getFileIcon, getFileColor }: any) {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'manager';
  
  return (
    <Card sx={{ 
      borderRadius: 4, 
      mb: 2,
      transition: 'all 0.2s ease',
      border: '1px solid',
      borderColor: alpha(theme.palette.divider, 0.15),
      boxShadow: 'none',
      '&:hover': { 
        bgcolor: alpha(theme.palette.primary.main, 0.02),
        borderColor: 'primary.main'
      }
    }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 2.5, sm: 1 }}>
            <Box sx={{ 
              bgcolor: alpha(theme.palette[getFileColor(note.fileType) as 'primary' | 'error' | 'success' | 'warning'].main, 0.1), 
              color: `${getFileColor(note.fileType)}.main`,
              borderRadius: 2.5, 
              width: 44, 
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {getFileIcon(note.fileType, 20)}
            </Box>
          </Grid>
          <Grid size={{ xs: 9.5, sm: 5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0, lineHeight: 1.2 }}>{note.title}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{note.subject} • {note.classLevel}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }} sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '0.65rem', fontWeight: 800 }}>{note.authorName.charAt(0)}</Avatar>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', lineHeight: 1 }}>{note.authorName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.6rem' }}>{format(note.uploadedAt, 'dd MMM')}</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }} sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
               <Button 
                size="small" 
                variant="outlined" 
                onClick={() => window.open(note.fileUrl, '_blank')}
                sx={{ borderRadius: 10, fontWeight: 800, fontSize: '0.7rem' }}
               >
                 Padhein
               </Button>
              <ActionMenu 
                items={[
                  { 
                    label: 'Zakhira Karein', 
                    icon: <Download size={16} />, 
                    onClick: () => window.open(note.fileUrl, '_blank') 
                  },
                  { 
                    label: 'Munsukh Karein', 
                    icon: <Trash2 size={16} />, 
                    color: 'error.main',
                    onClick: onDelete,
                    disabled: !isAdmin && currentUser?.uid !== note.uploadedBy
                  }
                ]} 
              />
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
