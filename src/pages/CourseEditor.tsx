import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Box, Typography, Button, Paper, Stack, Container, TextField, 
  IconButton, Chip, Grid, Divider, Select, MenuItem, 
  FormControl, InputLabel, Tooltip, Avatar, List, 
  ListItem, ListItemText, ListItemAvatar, Card, CardContent,
  Tab, Tabs, Alert, CircularProgress, Fab, FormControlLabel, Switch,
  InputAdornment, ListItemIcon
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  Plus, Save, Trash2, Edit2, ArrowLeft, 
  Layout, Book, Image as ImageIcon, Video, 
  FileText, Headphones, CheckCircle, HelpCircle, 
  GripVertical, Eye, Share2, Globe, Archive, 
  MoreVertical, Quote, Code, Bookmark, ChevronUp, ChevronDown,
  Type, MessageSquare, List as ListIcon, Calendar, Info,
  Upload, Music, Link as LinkIcon, Clock, Wand2, X, BookOpen
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
      setCourse({ [field]: result });
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
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={2} alignItems="center">
                    <Box sx={{ 
                      width: '100%', 
                      aspectRatio: '2/3', 
                      borderRadius: 4, 
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      border: '1px solid',
                      borderColor: 'divider',
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                    }}>
                      {course.thumbnailUrl ? (
                         <Box component="img" src={course.thumbnailUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                          <ImageIcon size={40} />
                          <Typography variant="caption" sx={{ mt: 1, fontWeight: 800 }}>Cover Art</Typography>
                        </Box>
                      )}
                    </Box>
                    <Button
                      component="label"
                      fullWidth
                      variant="outlined"
                      color="primary"
                      size="small"
                      sx={{ 
                        borderRadius: 3, 
                        fontWeight: 900, 
                        textTransform: 'none',
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                      }}
                      startIcon={<Upload size={16} />}
                    >
                      Change Cover
                      <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'thumbnailUrl')} />
                    </Button>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Stack spacing={2.5}>
                    <TextField 
                      fullWidth 
                      label="Subject Name" 
                      variant="filled"
                      value={course.name || ''} 
                      onChange={(e) => setCourse({ name: e.target.value })}
                      placeholder="e.g. History of Modern Architecture"
                      InputProps={{ sx: { borderRadius: 3, fontWeight: 800 }, disableUnderline: true }}
                    />
                    <TextField 
                      fullWidth 
                      label="Learning Outcomes" 
                      variant="filled"
                      value={course.learningOutcomes?.join(', ') || ''} 
                      onChange={(e) => setCourse({ learningOutcomes: (e.target.value ? e.target.value.split(',').map(s => s.trim()) : []) })}
                      placeholder="Enter outcomes separated by commas..."
                      InputProps={{ sx: { borderRadius: 3, fontWeight: 600 }, disableUnderline: true }}
                    />
                    <TextField 
                      fullWidth 
                      label="Banner Image URL" 
                      variant="filled"
                      size="small"
                      value={course.bannerUrl || ''} 
                      onChange={(e) => setCourse({ bannerUrl: e.target.value })}
                      placeholder="Cinematic wide banner URL"
                      InputProps={{ 
                        sx: { borderRadius: 3, fontSize: '0.8rem' }, 
                        disableUnderline: true,
                        startAdornment: <InputAdornment position="start"><Layout size={14} /></InputAdornment>
                      }}
                    />
                    <TextField 
                      fullWidth 
                      label="Cinematic Description" 
                      variant="filled"
                      multiline 
                      rows={4} 
                      value={course.description || ''} 
                      onChange={(e) => setCourse({ description: e.target.value })}
                      placeholder="Write a compelling summary..."
                      InputProps={{ sx: { borderRadius: 4, fontWeight: 600 }, disableUnderline: true }}
                    />
                  </Stack>
                </Grid>
              </Grid>
              
              <Grid container spacing={2} sx={{ mt: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Subject Code" 
                    value={course.code} 
                    onChange={(e) => setCourse({ code: e.target.value })}
                    InputProps={{ sx: { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select 
                      value={course.category} 
                      label="Category"
                      onChange={(e) => setCourse({ category: e.target.value })}
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
            </Paper>


          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Card sx={{ borderRadius: 6, bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1), boxShadow: 'none' }}>
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 1 }}>Course Difficulty</Typography>
                    <Select 
                      fullWidth
                      size="small"
                      value={course.difficulty || 'beginner'} 
                      onChange={(e) => setCourse({ difficulty: e.target.value })}
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

const SectionEditorTab = React.memo(({ newSection, setNewSection, onSave, isEditing, course }: {
  newSection: any,
  setNewSection: any,
  onSave: any,
  isEditing: boolean,
  course: any
}) => {
  const theme = useTheme();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field = 'mediaUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setNewSection((prev: any) => ({ ...prev, [field]: result }));
    };
    reader.readAsDataURL(file);
  };

  // Stable editor options to prevent unnecessary re-renders
  const editorOptions = useMemo(() => ({
    placeholder: "Your story starts here...",
    minHeight: '600px',
    spellChecker: false,
    toolbar: [
      "bold", "italic", "heading", "|", 
      "quote", "unordered-list", "ordered-list", "|", 
      "link", "image", "table", "|", 
      "preview", "side-by-side", "fullscreen"
    ] as any,
    status: false,
    autosave: {
      enabled: true,
      uniqueId: `section-editor-${newSection.id || 'new'}`,
      delay: 1000,
    },
    renderingConfig: {
      singleLineBreaks: false,
      codeSyntaxHighlighting: true,
    }
  }), [newSection.id]);

  return (
    <Box 
      component={motion.div}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      sx={{ mt: 2 }}
    >
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 4, 
                  borderRadius: 8, 
                  border: '1px solid', 
                  borderColor: alpha(theme.palette.divider, 0.5), 
                  bgcolor: alpha(theme.palette.background.paper, 0.8),
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.04)',
                  position: 'sticky',
                  top: 100
                }}
              >
                <Box sx={{ mb: 4 }}>
                  <Typography variant="overline" sx={{ fontWeight: 950, color: 'primary.main', letterSpacing: 2, display: 'block', mb: 0.5 }}>
                    STUDIO MODULE
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -1 }}>
                    Lesson {course.sections?.length ? course.sections.length + 1 : 1}
                  </Typography>
                </Box>

                <Stack spacing={4}>
                  <TextField 
                    fullWidth 
                    label="Lesson Title" 
                    variant="standard"
                    value={newSection.title || ''} 
                    onChange={(e) => setNewSection((p: any) => ({ ...p, title: e.target.value }))} 
                    InputProps={{ 
                      sx: { fontSize: '1.25rem', fontWeight: 900, py: 1 },
                      startAdornment: <InputAdornment position="start"><BookOpen size={20} style={{ opacity: 0.3 }} /></InputAdornment>
                    }}
                    placeholder="Enter an inspiring title..."
                  />
                  <FormControl variant="standard" fullWidth>
                    <InputLabel sx={{ fontWeight: 700 }}>Module Type</InputLabel>
                    <Select 
                      value={newSection.type} 
                      onChange={(e) => setNewSection((p: any) => ({ ...p, type: e.target.value as any }))}
                      sx={{ fontWeight: 700 }}
                    >
                        <MenuItem value="text" sx={{ fontWeight: 600 }}>📝 Rich Text Lesson</MenuItem>
                        <MenuItem value="audio" sx={{ fontWeight: 600 }}>🎧 Audiobook Lesson</MenuItem>
                        <MenuItem value="video" sx={{ fontWeight: 600 }}>📽️ Video Masterclass</MenuItem>
                        <MenuItem value="pdf" sx={{ fontWeight: 600 }}>📄 Reference Doc</MenuItem>
                        <MenuItem value="quiz" sx={{ fontWeight: 600 }}>💡 Knowledge Check</MenuItem>
                    </Select>
                  </FormControl>

                  {newSection.type !== 'quiz' && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 1, display: 'block' }}>RESOURCES (LINK OR UPLOAD)</Typography>
                      <Stack direction="row" spacing={1}>
                        <TextField 
                          fullWidth 
                          variant="standard"
                          label={newSection.type === 'video' ? 'Video URL' : newSection.type === 'pdf' ? 'PDF Link' : 'Hero Image'} 
                          value={newSection.mediaUrl} 
                          onChange={(e) => setNewSection((p: any) => ({ ...p, mediaUrl: e.target.value }))} 
                          placeholder="Link or Upload"
                          InputProps={{ 
                            sx: { fontWeight: 600 },
                            startAdornment: <InputAdornment position="start">
                              {newSection.type === 'video' ? <Video size={14} /> : newSection.type === 'pdf' ? <FileText size={14} /> : <ImageIcon size={14} />}
                            </InputAdornment> 
                          }}
                        />
                        <IconButton 
                          component="label" 
                          size="small"
                          sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}
                        >
                          <Upload size={16} />
                          <input type="file" hidden onChange={(e) => handleFileUpload(e, 'mediaUrl')} />
                        </IconButton>
                      </Stack>
                    </Box>
                  )}

                  {['text', 'audio'].includes(newSection.type) && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 1, display: 'block' }}>AUDIO ACCOMPANIMENT</Typography>
                      <Stack direction="row" spacing={1}>
                        <TextField 
                          fullWidth 
                          variant="standard"
                          label="Background Audio URL" 
                          value={newSection.audioUrl || ''} 
                          onChange={(e) => setNewSection((p: any) => ({ ...p, audioUrl: e.target.value }))} 
                          placeholder="Link or Upload soundtrack"
                          InputProps={{ 
                            sx: { fontWeight: 600, fontSize: '0.85rem' },
                            startAdornment: <InputAdornment position="start"><Music size={14} /></InputAdornment> 
                          }}
                        />
                        <IconButton 
                          component="label" 
                          size="small"
                          sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.05), borderRadius: 2, color: theme.palette.secondary.main }}
                        >
                          <Upload size={16} />
                          <input type="file" hidden accept="audio/*" onChange={(e) => handleFileUpload(e, 'audioUrl')} />
                        </IconButton>
                      </Stack>
                    </Box>
                  )}
                  <Box sx={{ mt: 2, pt: 3, borderTop: '1px solid', borderColor: alpha(theme.palette.divider, 0.2) }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>Practice Quiz</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.5, display: 'block' }}>Optional assessment for students</Typography>
                      </Box>
                      <Button 
                        variant="outlined" 
                        size="small"
                        color={newSection.metadata?.quizQuestions?.length ? "success" : "primary"}
                        onClick={() => {
                          if (!newSection.metadata?.quizQuestions?.length) {
                             const qs = [{ q: '', options: ['', '', '', ''], correct: 0, explanation: '' }];
                             setNewSection((p: any) => ({ ...p, metadata: { ...p.metadata, quizQuestions: qs } }));
                          }
                          // Scroll to builder
                          document.getElementById('quiz-builder-anchor')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        sx={{ borderRadius: 4, fontWeight: 900, textTransform: 'none' }}
                      >
                        {newSection.metadata?.quizQuestions?.length ? "Edit Quiz" : "Add Quiz"}
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </Paper>
              
              <Button 
                variant="contained" 
                fullWidth 
                onClick={onSave} 
                startIcon={isEditing ? <Save size={18} /> : <Plus size={18} />}
                sx={{ 
                  py: 2, 
                  borderRadius: 4, 
                  fontWeight: 950, 
                  fontSize: '0.9rem', 
                  textTransform: 'none',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)' 
                }}
              >
                {isEditing ? 'Save Changes' : 'Append to Curriculum'}
              </Button>
            </Stack>
          </Grid>
          
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={4}>
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Wand2 size={24} className="text-secondary-500" /> 
                    {newSection.type === 'audio' ? 'Narrative / Transcript' : 'Lesson Content'}
                  </Typography>
                  <Chip label="Markdown Ready" size="small" variant="outlined" sx={{ fontWeight: 800, borderColor: alpha(theme.palette.secondary.main, 0.4), color: theme.palette.secondary.main }} />
                </Box>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    borderRadius: 6, 
                    overflow: 'hidden', 
                    border: '1px solid', 
                    borderColor: alpha(theme.palette.divider, 0.4), 
                    bgcolor: 'background.paper',
                    '& .CodeMirror': { border: 'none' },
                    '& .editor-toolbar': { border: 'none', borderBottom: '1px solid', borderColor: alpha(theme.palette.divider, 0.4), bgcolor: alpha(theme.palette.background.default, 0.5) }
                  }}
                >
                  <SimpleMDE 
                    value={newSection.content || ''} 
                    onChange={(v) => setNewSection((p: any) => ({ ...p, content: v }))}
                    options={editorOptions}
                  />
                </Paper>
                
                {/* Simplified floating helper for quiz builders */}
                {(newSection.type === 'quiz' || (newSection.metadata?.quizQuestions?.length ?? 0) > 0) && (
                  <Paper 
                    id="quiz-builder-anchor"
                    component={motion.div}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    elevation={4} 
                    sx={{ 
                      mt: 3, 
                      p: 4, 
                      borderRadius: 6, 
                      border: '1px solid', 
                      borderColor: 'primary.main', 
                      bgcolor: 'background.paper',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                      <Box>
                         <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <HelpCircle size={22} className="text-primary-500" /> Lesson Quiz Builder
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Add interactive questions to test student knowledge</Typography>
                      </Box>
                      <Button 
                        variant="outlined" 
                        color="primary" 
                        startIcon={<Plus size={16} />}
                        onClick={() => {
                           const qs = [...(newSection.metadata?.quizQuestions || []), { q: '', options: ['', '', '', ''], correct: 0, explanation: '' }];
                           setNewSection((p: any) => ({ ...p, metadata: { ...p.metadata, quizQuestions: qs } }));
                        }}
                        sx={{ borderRadius: 3, fontWeight: 800 }}
                      >
                        Add Question
                      </Button>
                    </Stack>
                    
                    <Stack spacing={3}>
                      {(newSection.metadata?.quizQuestions || []).map((q: any, qIdx: number) => (
                        <Paper key={qIdx} elevation={0} sx={{ p: 4, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.4), borderRadius: 5, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                          <Stack spacing={3}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem', fontWeight: 900 }}>{qIdx + 1}</Avatar>
                              <TextField 
                                fullWidth 
                                variant="standard"
                                placeholder="Write your question here..." 
                                value={q.q} 
                                onChange={(e) => {
                                  const qs = [...(newSection.metadata?.quizQuestions || [])];
                                  qs[qIdx].q = e.target.value;
                                  setNewSection((p: any) => ({ ...p, metadata: { ...p.metadata, quizQuestions: qs } }));
                                }}
                                InputProps={{ sx: { fontWeight: 800, fontSize: '1.1rem' } }}
                              />
                              <IconButton size="small" color="error" onClick={() => {
                                const qs = (newSection.metadata?.quizQuestions || []).filter((_: any, i: number) => i !== qIdx);
                                setNewSection((p: any) => ({ ...p, metadata: { ...p.metadata, quizQuestions: qs } }));
                              }}>
                                <Trash2 size={18} />
                              </IconButton>
                            </Box>
                            
                            <Grid container spacing={3}>
                              {q.options.map((opt: string, optIdx: number) => (
                                <Grid size={6} key={optIdx}>
                                  <Box 
                                    onClick={() => {
                                      const qs = [...(newSection.metadata?.quizQuestions || [])];
                                      qs[qIdx].correct = optIdx;
                                      setNewSection((p: any) => ({ ...p, metadata: { ...p.metadata, quizQuestions: qs } }));
                                    }}
                                    sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 2, 
                                      p: 1, 
                                      borderRadius: 4, 
                                      border: '1px solid', 
                                      borderColor: q.correct === optIdx ? 'primary.main' : 'transparent',
                                      transition: '0.2s',
                                      cursor: 'pointer',
                                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                                    }}
                                  >
                                    <Box sx={{ 
                                      width: 24, height: 24, borderRadius: '50%', border: '2px solid', 
                                      borderColor: q.correct === optIdx ? 'primary.main' : 'divider',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                      {q.correct === optIdx && <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />}
                                    </Box>
                                    <TextField 
                                      fullWidth 
                                      variant="standard" 
                                      placeholder={`Option ${optIdx + 1}`} 
                                      value={opt}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        const qs = [...(newSection.metadata?.quizQuestions || [])];
                                        qs[qIdx].options[optIdx] = e.target.value;
                                        setNewSection((p: any) => ({ ...p, metadata: { ...p.metadata, quizQuestions: qs } }));
                                      }}
                                      InputProps={{ sx: { fontWeight: 700, fontSize: '0.9rem' }, disableUnderline: true }}
                                    />
                                  </Box>
                                </Grid>
                              ))}
                            </Grid>

                            <TextField 
                              fullWidth 
                              size="small"
                              variant="outlined"
                              label="Correct Answer Reasoning" 
                              placeholder="Provide historical context or scientific reasoning for the correct answer..."
                              value={q.explanation || ''}
                              onChange={(e) => {
                                const qs = [...(newSection.metadata?.quizQuestions || [])];
                                qs[qIdx].explanation = e.target.value;
                                setNewSection((p: any) => ({ ...p, metadata: { ...p.metadata, quizQuestions: qs } }));
                              }}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                            />
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Paper>
                )}
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

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  useEffect(() => {
    // Basic auto-save indicator logic
    if (submitting) setHasUnsavedChanges(false);
  }, [submitting]);

  const handleCourseUpdate = useCallback((updates: any) => {
    setCourse(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

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
      setLastSaved(Date.now());
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
      audioUrl: newSection.audioUrl,
      metadata: newSection.metadata || {},
      fontFamily: newSection.fontFamily as any || 'default',
      theme: newSection.theme || {}
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
      audioUrl: '',
      theme: {
        backgroundColor: '#ffffff',
        textColor: '#1a1a1a',
        fontPairing: 'default'
      },
      metadata: { estimatedReadTime: 5, calloutType: 'info', quizQuestions: [] } 
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
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            justifyContent="space-between" 
            alignItems={{ xs: 'flex-start', sm: 'center' }} 
            spacing={2}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={() => navigate('/courses')} size="small"><ArrowLeft size={20} /></IconButton>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 900, lineHeight: 1, display: 'block', maxWidth: { xs: 150, sm: 'none' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {course.name || 'New Subject'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 950, lineHeight: 1.2, fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' } }}>
                      <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Content Management </Box>Studio
                    </Typography>
                    {lastSaved && (
                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 800, display: { xs: 'none', sm: 'block' }, mt: 0.5 }}>
                        Synced: {new Date(lastSaved).toLocaleTimeString()}
                      </Typography>
                    )}
                  </Box>
            </Stack>
            <Stack 
              direction="row" 
              spacing={1} 
              sx={{ 
                width: { xs: '100%', sm: 'auto' },
                justifyContent: { xs: 'flex-end', sm: 'flex-start' }
              }}
            >
              {course.id && (
                 <Tooltip title="Preview">
                   <Button 
                     variant="outlined" 
                     onClick={() => navigate(`/courses/${course.id}`)} 
                     sx={{ 
                       borderRadius: 10, 
                       fontWeight: 800, 
                       textTransform: 'none', 
                       minWidth: { xs: 40, sm: 100 },
                       px: { xs: 1, sm: 2 }
                     }}
                   >
                     <Eye size={18} />
                     <Box component="span" sx={{ ml: 1, display: { xs: 'none', sm: 'inline' } }}>Preview</Box>
                   </Button>
                 </Tooltip>
              )}
              <Button 
                variant="outlined" 
                color="inherit"
                onClick={handleSaveCourse} 
                disabled={submitting}
                sx={{ 
                  borderRadius: 10, 
                  fontWeight: 900, 
                  px: { xs: 1.5, sm: 3 }, 
                  textTransform: 'none',
                  minWidth: { xs: 40, sm: 'auto' }
                }}
              >
                <Archive size={18} />
                <Box component="span" sx={{ ml: 1, display: { xs: 'none', sm: 'inline' } }}>Save Draft</Box>
                <Box component="span" sx={{ ml: 1, display: { xs: 'inline', sm: 'none' } }}>Save</Box>
              </Button>
              <Button 
                variant="contained" 
                color="primary"
                onClick={async () => {
                   setCourse(p => ({ ...p, isPublished: true }));
                   setSubmitting(true);
                   try {
                     const data = { ...course, isPublished: true, updatedAt: Date.now() };
                     if (course.id) await updateDoc(doc(db, 'courses', course.id), data);
                     logger.success('Subject published');
                   } catch(e) { logger.error('Publish failed'); }
                   setSubmitting(false);
                }} 
                disabled={submitting}
                sx={{ 
                  borderRadius: 10, 
                  fontWeight: 950, 
                  px: { xs: 2, sm: 4 }, 
                  textTransform: 'none', 
                  boxShadow: theme.palette.mode === 'dark' ? 'none' : '0 8px 24px rgba(25, 118, 210, 0.2)' 
                }}
              >
                <Globe size={18} />
                <Box component="span" sx={{ ml: 1 }}>Publish</Box>
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Paper>

      <Container maxWidth="xl">
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 3, 
                borderRadius: 6, 
                border: '1px solid', 
                borderColor: 'divider',
                position: 'sticky',
                top: 100,
                bgcolor: alpha(theme.palette.background.paper, 0.4),
                backdropFilter: 'blur(10px)'
              }}
            >
              <Typography variant="overline" sx={{ fontWeight: 950, color: 'primary.main', letterSpacing: 2, mb: 2, display: 'block' }}>
                NAVIGATE CURRICULUM
              </Typography>
              <List sx={{ px: 0 }}>
                <ListItem 
                  component={Button} 
                  onClick={() => setActiveTab(0)}
                  sx={{ 
                    borderRadius: 3, 
                    mb: 1, 
                    bgcolor: activeTab === 0 ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                    color: activeTab === 0 ? 'primary.main' : 'text.secondary',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}><Info size={18} /></ListItemIcon>
                  <ListItemText primary="General Details" primaryTypographyProps={{ fontWeight: 800, fontSize: '0.85rem' }} />
                </ListItem>
                <Divider sx={{ my: 1.5, opacity: 0.5 }} />
                {(course.sections || []).map((s, idx) => (
                  <ListItem 
                    key={s.id}
                    component={Button} 
                    onClick={() => editSection(idx)}
                    sx={{ 
                      borderRadius: 3, 
                      mb: 0.5, 
                      color: editingSectionIdx === idx ? 'primary.main' : 'text.primary',
                      bgcolor: editingSectionIdx === idx ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                      textAlign: 'left',
                      justifyContent: 'flex-start'
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: 'inherit', opacity: 0.5 }}>
                      {s.type === 'quiz' ? <HelpCircle size={14} /> : s.type === 'audio' ? <Headphones size={14} /> : <FileText size={14} />}
                    </ListItemIcon>
                    <ListItemText 
                      primary={s.title} 
                      primaryTypographyProps={{ 
                        fontWeight: 700, 
                        fontSize: '0.75rem',
                        noWrap: true,
                        color: editingSectionIdx === idx ? 'primary.main' : 'inherit'
                      }} 
                    />
                  </ListItem>
                ))}
                <Button 
                  fullWidth 
                  startIcon={<Plus size={16} />}
                  onClick={() => { setEditingSectionIdx(null); setActiveTab(2); }}
                  sx={{ 
                    mt: 2, 
                    borderRadius: 3, 
                    border: '1px dashed', 
                    borderColor: 'divider',
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: '0.75rem'
                  }}
                >
                  New Chapter
                </Button>
              </List>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 9 }}>
            <Box sx={{ mb: 4 }}>
              <Tabs 
                value={activeTab > 2 ? 2 : activeTab} 
                onChange={(_, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ 
                  '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' }
                }}
              >
                <Tab label="Subject Settings" sx={{ fontWeight: 900, textTransform: 'none', px: 4 }} />
                <Tab label="Curriculum Skeleton" sx={{ fontWeight: 900, textTransform: 'none', px: 4 }} />
                <Tab label={editingSectionIdx !== null ? "Editor Content" : "Quick Add Content"} sx={{ fontWeight: 900, textTransform: 'none', px: 4 }} />
              </Tabs>
            </Box>

            <AnimatePresence mode="wait">
              {activeTab === 0 && (
                <DetailsTab 
                  key="details-tab"
                  course={course} 
                  setCourse={handleCourseUpdate} 
                />
              )}
              {activeTab === 1 && (
                <CurriculumTab 
                  key="curriculum-tab"
                  sections={course.sections || []} 
                  moveSection={moveSection} 
                  editSection={editSection} 
                  removeSection={removeSection} 
                  onAddClick={() => { setEditingSectionIdx(null); setActiveTab(2); }} 
                />
              )}
              {activeTab === 2 && (
                <SectionEditorTab 
                  key="section-editor-tab"
                  newSection={newSection} 
                  setNewSection={setNewSection} 
                  onSave={handleAddSection} 
                  isEditing={editingSectionIdx !== null} 
                  course={course}
                />
              )}
            </AnimatePresence>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
