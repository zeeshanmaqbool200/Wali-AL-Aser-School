import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Box, Typography, Button, Paper, Stack, Container, TextField, 
  IconButton, Chip, Grid, Divider, Select, MenuItem, 
  FormControl, InputLabel, Tooltip, Avatar, List, 
  ListItem, ListItemText, ListItemAvatar, Card, CardContent,
  Tab, Tabs, Alert, CircularProgress, Fab, FormControlLabel, Switch,
  InputAdornment
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  Plus, Save, Trash2, Edit2, ArrowLeft, 
  Layout, Book, Image as ImageIcon, Video, 
  FileText, Headphones, CheckCircle, HelpCircle, 
  GripVertical, Eye, Share2, Globe, Archive, 
  MoreVertical, Quote, Code, Bookmark, ChevronUp, ChevronDown,
  Type, MessageSquare, List as ListIcon, Calendar, Info,
  Upload, Music, Link as LinkIcon, Clock
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from '../firebase';
import { Course, CourseSection } from '../types';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import { motion, AnimatePresence } from 'motion/react';
import SimpleMDE from 'react-simplemde-editor';
import "easymde/dist/easymde.min.css";

// Memoized Sub-components to prevent focus loss during large state updates
const DetailsTab = React.memo(({ course, setCourse }: { course: any, setCourse: any }) => {
  const theme = useTheme();
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCourse((prev: any) => ({ ...prev, [field]: result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box 
      component={motion.div}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={4}>
            <Paper sx={{ p: 4, borderRadius: 6, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 950, mb: 3 }}>Core Information</Typography>
              <Stack spacing={3}>
                <TextField 
                  fullWidth 
                  label="Subject Name" 
                  value={course.name} 
                  onChange={(e) => setCourse((p: any) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. History of Modern Architecture"
                  InputProps={{ sx: { borderRadius: 3 } }}
                />
                <TextField 
                  fullWidth 
                  label="Description (Cinematic Style)" 
                  multiline 
                  rows={4} 
                  value={course.description} 
                  onChange={(e) => setCourse((p: any) => ({ ...p, description: e.target.value }))}
                  placeholder="Write a compelling summary that hooks students..."
                  InputProps={{ sx: { borderRadius: 4 } }}
                />
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <TextField 
                      fullWidth 
                      label="Subject Code" 
                      value={course.code} 
                      onChange={(e) => setCourse((p: any) => ({ ...p, code: e.target.value }))}
                      InputProps={{ sx: { borderRadius: 3 } }}
                    />
                  </Grid>
                  <Grid size={6}>
                      <FormControl fullWidth>
                        <InputLabel>Category</InputLabel>
                        <Select 
                          value={course.category} 
                          label="Category"
                          onChange={(e) => setCourse((p: any) => ({ ...p, category: e.target.value }))}
                          sx={{ borderRadius: 3 }}
                        >
                            <MenuItem value="General">General</MenuItem>
                            <MenuItem value="History">History</MenuItem>
                            <MenuItem value="Arts">Arts</MenuItem>
                            <MenuItem value="Science">Science</MenuItem>
                            <MenuItem value="Dinyat">Dinyat</MenuItem>
                        </Select>
                      </FormControl>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>

            <Paper sx={{ p: 4, borderRadius: 6, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 950, mb: 3 }}>Branding & Visuals</Typography>
              <Grid container spacing={3}>
                <Grid size={12}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <TextField 
                      fullWidth 
                      label="Vertical Cover URL" 
                      value={course.thumbnailUrl} 
                      onChange={(e) => setCourse((p: any) => ({ ...p, thumbnailUrl: e.target.value }))}
                      placeholder="Link or upload high-quality vertical cover"
                      InputProps={{ 
                        sx: { borderRadius: 3 },
                        startAdornment: <InputAdornment position="start"><ImageIcon size={18} /></InputAdornment>
                      }}
                    />
                    <Button
                      component="label"
                      variant="outlined"
                      sx={{ borderRadius: 3, height: 56, minWidth: 120, fontWeight: 800 }}
                      startIcon={<Upload size={18} />}
                    >
                      Browse
                      <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'thumbnailUrl')} />
                    </Button>
                  </Stack>
                </Grid>
                <Grid size={12}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <TextField 
                      fullWidth 
                      label="Wide Banner URL" 
                      value={course.bannerUrl} 
                      onChange={(e) => setCourse((p: any) => ({ ...p, bannerUrl: e.target.value }))}
                      placeholder="Link or upload cinematic wide banner"
                      InputProps={{ 
                        sx: { borderRadius: 3 },
                        startAdornment: <InputAdornment position="start"><Layout size={18} /></InputAdornment>
                      }}
                    />
                    <Button
                      component="label"
                      variant="outlined"
                      sx={{ borderRadius: 3, height: 56, minWidth: 120, fontWeight: 800 }}
                      startIcon={<Upload size={18} />}
                    >
                      Browse
                      <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'bannerUrl')} />
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Card sx={{ borderRadius: 6, bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1), boxShadow: 'none' }}>
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 1.5 }}>Publishing Status</Typography>
                    <FormControlLabel 
                      control={
                        <Switch 
                          checked={course.isPublished} 
                          onChange={(e) => setCourse((p: any) => ({ ...p, isPublished: e.target.checked }))} 
                        />
                      }
                      label={
                        <Chip 
                          label={course.isPublished ? "Visible to Students" : "Draft (Teacher Only)"} 
                          size="small" 
                          color={course.isPublished ? "success" : "default"} 
                          sx={{ fontWeight: 900, borderRadius: 1 }}
                        />
                      }
                      sx={{ ml: 0, justifyContent: 'space-between', width: '100%', flexDirection: 'row-reverse' }}
                    />
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 1 }}>Course Difficulty</Typography>
                    <Select 
                      fullWidth
                      size="small"
                      value={course.difficulty || 'beginner'} 
                      onChange={(e) => setCourse((p: any) => ({ ...p, difficulty: e.target.value }))}
                      sx={{ borderRadius: 2 }}
                    >
                        <MenuItem value="beginner">Beginner</MenuItem>
                        <MenuItem value="intermediate">Intermediate</MenuItem>
                        <MenuItem value="advanced">Advanced (Scholarly)</MenuItem>
                    </Select>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
});

const CurriculumTab = React.memo(({ sections, moveSection, editSection, removeSection, onAddClick }: { 
  sections: CourseSection[], 
  moveSection: any, 
  editSection: any, 
  removeSection: any,
  onAddClick: any
}) => {
  return (
    <Box 
      component={motion.div}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
    >
        <Stack spacing={2}>
          {(!sections || sections.length === 0) ? (
            <Paper sx={{ p: 10, textAlign: 'center', borderRadius: 10, border: '2px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
              <Book size={60} strokeWidth={1} style={{ opacity: 0.1, marginBottom: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Empty Curriculum</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>Start by adding your first chapter using the button below.</Typography>
              <Button variant="contained" startIcon={<Plus />} onClick={onAddClick} sx={{ borderRadius: 10, px: 4 }}>Create Chapter</Button>
            </Paper>
          ) : (
            <List>
              {sections.map((section, idx) => (
                <ListItem 
                  key={section.id}
                  sx={{ 
                    mb: 2, 
                    bgcolor: 'background.paper', 
                    borderRadius: 4, 
                    border: '1px solid', 
                    borderColor: 'divider',
                    p: 2,
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'scale(1.005)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }
                  }}
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                        <IconButton onClick={() => moveSection(idx, 'up')} disabled={idx === 0}><ChevronUp size={18} /></IconButton>
                        <IconButton onClick={() => moveSection(idx, 'down')} disabled={idx === sections.length - 1}><ChevronDown size={18} /></IconButton>
                        <IconButton onClick={() => editSection(idx)} color="primary"><Edit2 size={18} /></IconButton>
                        <IconButton onClick={() => removeSection(idx)} color="error"><Trash2 size={18} /></IconButton>
                    </Stack>
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 900, border: '1px solid', borderColor: 'divider' }}>{idx + 1}</Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={section.title} 
                    primaryTypographyProps={{ fontWeight: 850 }}
                    secondary={
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip label={section.type.toUpperCase()} size="small" variant="outlined" sx={{ fontSize: '0.6rem', fontWeight: 800, px: 0.5 }} />
                        <Chip label={section.layout || 'standard'} size="small" sx={{ fontSize: '0.6rem', fontWeight: 800, px: 0.5 }} />
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Button variant="outlined" startIcon={<Plus />} onClick={onAddClick} sx={{ fontWeight: 900, borderRadius: 10 }}>Append New Chapter</Button>
              </Box>
            </List>
          )}
        </Stack>
    </Box>
  );
});

const SectionEditorTab = React.memo(({ newSection, setNewSection, onSave, isEditing }: {
  newSection: any,
  setNewSection: any,
  onSave: any,
  isEditing: boolean
}) => {
  const theme = useTheme();

  const handleLayoutChange = (layout: string) => {
    setNewSection((p: any) => {
      const next = { ...p, layout };
      // Default configurations for premium layouts
      if (layout === 'audio-immersive') {
        next.type = 'audio';
        next.fontFamily = 'serif';
      } else if (layout === 'video-lesson') {
        next.type = 'video';
      } else if (layout === 'study-sheet') {
        next.type = 'flashcard';
        next.layout = 'standard';
      }
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setNewSection((prev: any) => ({ ...prev, mediaUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box 
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <Paper sx={{ p: 3, borderRadius: 6, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 3 }}>Chapter Structure</Typography>
                <Stack spacing={3}>
                  <TextField 
                    fullWidth 
                    label="Chapter Title" 
                    value={newSection.title} 
                    onChange={(e) => setNewSection((p: any) => ({ ...p, title: e.target.value }))} 
                    InputProps={{ sx: { borderRadius: 3 } }}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Premium Layout</InputLabel>
                    <Select 
                      value={newSection.layout} 
                      label="Premium Layout" 
                      onChange={(e) => handleLayoutChange(e.target.value as any)}
                      sx={{ borderRadius: 3 }}
                    >
                        <MenuItem value="standard">Standard Content</MenuItem>
                        <MenuItem value="audio-immersive">Audio Experience First</MenuItem>
                        <MenuItem value="video-lesson">Video Learning Suite</MenuItem>
                        <MenuItem value="ebook">Elegant E-Book</MenuItem>
                        <MenuItem value="magazine">Editorial Magazine</MenuItem>
                        <MenuItem value="study-sheet">Minimal Study Sheet</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth>
                    <InputLabel>Module Type</InputLabel>
                    <Select 
                      value={newSection.type} 
                      label="Module Type" 
                      onChange={(e) => setNewSection((p: any) => ({ ...p, type: e.target.value as any }))}
                      sx={{ borderRadius: 3 }}
                    >
                        <MenuItem value="text">Rich Text / Transcription</MenuItem>
                        <MenuItem value="audio">Audio Resource</MenuItem>
                        <MenuItem value="video">Video Resource</MenuItem>
                        <MenuItem value="pdf">Document / PDF Attachment</MenuItem>
                        <MenuItem value="quiz">Interactive Assessment</MenuItem>
                        <MenuItem value="quote">Inspirational Quote</MenuItem>
                    </Select>
                  </FormControl>

                  <Stack direction="row" spacing={1}>
                    <TextField 
                      fullWidth 
                      label="Media Link (URL)" 
                      value={newSection.mediaUrl} 
                      onChange={(e) => setNewSection((p: any) => ({ ...p, mediaUrl: e.target.value }))} 
                      placeholder="HTTPS link"
                      InputProps={{ 
                        sx: { borderRadius: 3 },
                        startAdornment: <InputAdornment position="start">
                          {newSection.type === 'audio' ? <Music size={16} /> : <LinkIcon size={16} />}
                        </InputAdornment> 
                      }}
                    />
                    <IconButton 
                      component="label" 
                      sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 3, width: 56, height: 56 }}
                    >
                      <Upload size={20} />
                      <input type="file" hidden onChange={handleFileUpload} />
                    </IconButton>
                  </Stack>
                </Stack>
              </Paper>

              <Paper sx={{ p: 3, borderRadius: 6, bgcolor: alpha('#1976d2', 0.03), border: '1px solid', borderColor: alpha('#1976d2', 0.1) }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Clock size={16} /> Reading Time
                </Typography>
                <TextField 
                  fullWidth size="small" type="number" 
                  value={newSection.metadata?.estimatedReadTime || 5}
                  onChange={(e) => setNewSection((p: any) => ({ ...p, metadata: { ...p.metadata, estimatedReadTime: parseInt(e.target.value) } }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Paper>
            </Stack>
          </Grid>
          
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>
              <Paper sx={{ borderRadius: 6, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.divider, 0.2), borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Content Studio</Typography>
                  <Tooltip title="Formatting Options">
                    <HelpCircle size={14} style={{ opacity: 0.5 }} />
                  </Tooltip>
                </Box>
                <SimpleMDE 
                  value={newSection.content} 
                  onChange={(v) => setNewSection((p: any) => ({ ...p, content: v }))}
                  options={{ 
                    placeholder: "Inject your knowledge here using Markdown...", 
                    minHeight: '450px',
                    spellChecker: false,
                    toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "link", "image", "table", "|", "preview"]
                  }}
                />
              </Paper>

              <Box sx={{ pt: 2, display: 'flex', gap: 2 }}>
                  <Button 
                    variant="contained" 
                    fullWidth 
                    onClick={onSave} 
                    sx={{ py: 2, borderRadius: 10, fontWeight: 950, fontSize: '1rem', boxShadow: '0 10px 40px rgba(25, 118, 210, 0.2)' }}
                  >
                    {isEditing ? 'Sync Chapter Changes' : 'Append to Curriculum'}
                  </Button>
              </Box>
            </Stack>
          </Grid>
        </Grid>
    </Box>
  );
});

export default function CourseEditor() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  const [course, setCourse] = useState<Partial<Course>>({
    name: '',
    code: '',
    description: '',
    sections: [] as CourseSection[],
    isPublished: false,
    thumbnailUrl: '',
    bannerUrl: '',
    category: 'General',
    difficulty: 'beginner'
  });

  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin' || currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isTeacher = currentUser?.role === 'teacher';

  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [newSection, setNewSection] = useState<Partial<CourseSection>>({
    title: '',
    content: '',
    type: 'text',
    layout: 'standard',
    fontFamily: 'default',
    metadata: {
      estimatedReadTime: 5,
      calloutType: 'info'
    }
  });

  useEffect(() => {
    if (!courseId || courseId === 'new') {
      setLoading(false);
      return;
    }

    const fetchCourse = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'courses', courseId));
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Course;
          
          // Ownership Check
          const isOwner = data.ownerId === currentUser?.uid || data.teacherId === currentUser?.uid;
          if (!isSuperAdmin && !isOwner) {
            logger.error('Unauthorized access to this subject.');
            navigate('/courses');
            return;
          }

          setCourse(data);
        }
      } catch (e) {
        logger.error('Failed to load subject');
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId, currentUser?.uid, isSuperAdmin, navigate]);

  const handleSaveCourse = async () => {
    if (!course.name) {
      logger.error('Subject name is required');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        ...course,
        ownerId: course.ownerId || currentUser?.uid,
        teacherId: course.teacherId || currentUser?.uid,
        teacherName: course.teacherName || currentUser?.displayName,
        updatedAt: Date.now(),
        createdAt: course.createdAt || Date.now()
      };

      if (course.id) {
        await updateDoc(doc(db, 'courses', course.id), data);
      } else {
        const docRef = await addDoc(collection(db, 'courses'), data);
        setCourse(p => ({ ...p, id: docRef.id }));
      }
      logger.success('Subject saved to library');
    } catch (e) {
      logger.error('Failed to saveSubject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSection = useCallback(() => {
    if (!newSection.title) return;

    const sections = [...(course.sections || [])];
    const section: CourseSection = {
      id: newSection.id || Math.random().toString(36).substr(2, 9),
      order: editingSectionIdx !== null ? sections[editingSectionIdx].order : sections.length,
      title: newSection.title as string,
      content: newSection.content || '',
      type: newSection.type as any,
      layout: newSection.layout as any || 'standard',
      mediaUrl: newSection.mediaUrl,
      metadata: newSection.metadata || {},
      fontFamily: newSection.fontFamily as any || 'default'
    } as CourseSection;

    if (editingSectionIdx !== null) {
      sections[editingSectionIdx] = section;
      setEditingSectionIdx(null);
    } else {
      sections.push(section);
    }

    setCourse(prev => ({ ...prev, sections }));
    setNewSection({ 
      title: '', 
      content: '', 
      type: 'text', 
      layout: 'standard', 
      fontFamily: 'default',
      metadata: { estimatedReadTime: 5, calloutType: 'info' } 
    });
    setActiveTab(1); // Switch to content tab after adding
  }, [newSection, editingSectionIdx, course.sections]);

  const editSection = useCallback((idx: number) => {
    setEditingSectionIdx(idx);
    setNewSection(course.sections![idx]);
    setActiveTab(2); // Switch to editor tab
  }, [course.sections]);

  const removeSection = useCallback((idx: number) => {
    const sections = course.sections!.filter((_, i) => i !== idx);
    setCourse(p => ({ ...p, sections }));
  }, [course.sections]);

  const moveSection = useCallback((idx: number, dir: 'up' | 'down') => {
     const sections = [...(course.sections || [])];
     const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
     if (targetIdx < 0 || targetIdx >= sections.length) return;
     
     const temp = sections[idx];
     sections[idx] = sections[targetIdx];
     sections[targetIdx] = temp;
     
     // Update order property
     sections.forEach((s, i) => s.order = i);
     setCourse(p => ({ ...p, sections }));
  }, [course.sections]);

  if (loading) return (
     <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
       <CircularProgress />
     </Box>
  );

  return (
    <Box sx={{ pb: 20 }}>
      {/* Dynamic Sub-Header */}
      <Paper 
        elevation={0}
        sx={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 10, 
          p: 2, 
          bgcolor: alpha(theme.palette.background.default, 0.9),
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: 4
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton onClick={() => navigate('/courses')}><ArrowLeft /></IconButton>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 950, lineHeight: 1 }}>{course.name || 'New Subject'}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>Content Management Studio</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.5}>
              {course.id && (
                 <Button 
                   variant="outlined" 
                   onClick={() => navigate(`/courses/${course.id}`)} 
                   startIcon={<Eye size={18} />}
                   sx={{ borderRadius: 10, fontWeight: 800, textTransform: 'none', display: { xs: 'none', sm: 'flex' } }}
                 >
                   Preview
                 </Button>
              )}
              <Button 
                variant="outlined" 
                color="inherit"
                onClick={handleSaveCourse} 
                disabled={submitting}
                startIcon={<Archive size={18} />}
                sx={{ borderRadius: 10, fontWeight: 900, px: 3, textTransform: 'none' }}
              >
                {submitting ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button 
                variant="contained" 
                color="primary"
                onClick={async () => {
                   setCourse(p => ({ ...p, isPublished: true }));
                   // Immediate save via custom call to ensure state is captured
                   setSubmitting(true);
                   try {
                     const data = { ...course, isPublished: true, updatedAt: Date.now() };
                     if (course.id) await updateDoc(doc(db, 'courses', course.id), data);
                     logger.success('Subject published to library');
                   } catch(e) { logger.error('Publish failed'); }
                   setSubmitting(false);
                }} 
                disabled={submitting}
                startIcon={<Globe size={18} />}
                sx={{ borderRadius: 10, fontWeight: 950, px: 4, textTransform: 'none', boxShadow: theme.palette.mode === 'dark' ? 'none' : '0 8px 24px rgba(25, 118, 210, 0.2)' }}
              >
                Publish
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Paper>

      <Container maxWidth="lg">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="Subject Details" sx={{ fontWeight: 800, textTransform: 'none' }} />
            <Tab label="Curriculum Builder" sx={{ fontWeight: 800, textTransform: 'none' }} />
            <Tab label={editingSectionIdx !== null ? "Edit Chapter" : "New Chapter"} sx={{ fontWeight: 800, textTransform: 'none' }} />
          </Tabs>
        </Box>

        {activeTab === 0 && <DetailsTab course={course} setCourse={setCourse} />}
        {activeTab === 1 && <CurriculumTab sections={course.sections || []} moveSection={moveSection} editSection={editSection} removeSection={removeSection} onAddClick={() => setActiveTab(2)} />}
        {activeTab === 2 && <SectionEditorTab newSection={newSection} setNewSection={setNewSection} onSave={handleAddSection} isEditing={editingSectionIdx !== null} />}
      </Container>
    </Box>
  );
}
