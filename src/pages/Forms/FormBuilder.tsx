import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, TextField, MenuItem, 
  Switch, FormControlLabel, IconButton, Stack, Card, CardContent,
  Divider, Grid, alpha, useTheme, Tooltip, CircularProgress,
  Snackbar, Alert, Paper, Chip
} from '@mui/material';
import { 
  Trash2, Plus, GripVertical, Settings, Save, ArrowLeft,
  Type, AlignLeft, List, CheckSquare, ChevronDown, Calendar, 
  Hash, Clock, Image as ImageIcon, Palette, FileDown, Share2,
  Copy, Eye
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { FormSchema, FormQuestion } from '../../types';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const QUESTION_TYPES = [
  { value: 'text', label: 'Short Answer', icon: <Type size={16} /> },
  { value: 'paragraph', label: 'Paragraph', icon: <AlignLeft size={16} /> },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: <List size={16} /> },
  { value: 'checkbox', label: 'Checkboxes', icon: <CheckSquare size={16} /> },
  { value: 'dropdown', label: 'Dropdown', icon: <ChevronDown size={16} /> },
  { value: 'date', label: 'Date', icon: <Calendar size={16} /> },
  { value: 'time', label: 'Time', icon: <Clock size={16} /> },
  { value: 'number', label: 'Number', icon: <Hash size={16} /> },
];

export default function FormBuilder() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, instituteSettings } = useAuth();
  const formId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'info' | 'error' });
  const [form, setForm] = useState<Partial<FormSchema>>({
    title: 'Untitled Form',
    description: '',
    type: 'survey',
    status: 'draft',
    allowNonStudents: true,
    anonymous: false,
    questions: [],
    primaryColor: theme.palette.primary.main,
    collectEmail: true,
    collectRollNo: true,
    collectName: true
  });

  const handleShare = () => {
    if (!formId) {
      setSnackbar({ open: true, message: 'Please save the form first to generate a share link.', severity: 'info' });
      return;
    }
    const url = `${window.location.origin}/forms/view/${formId}`;
    navigator.clipboard.writeText(url);
    setSnackbar({ open: true, message: 'Public share link copied to clipboard!', severity: 'success' });
  };

  useEffect(() => {
    if (formId) {
      const loadForm = async () => {
        const docRef = doc(db, 'forms', formId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as FormSchema;
          // Security Check: Teachers can only edit their own forms
          if (user?.role === 'teacher' && data.createdBy !== user.uid) {
            alert('Security Alert: You do not have permission to edit this form.');
            navigate('/forms');
            return;
          }
          setForm({ id: docSnap.id, ...data });
        }
      };
      loadForm();
    }
  }, [formId, user, navigate]);

  const addQuestion = () => {
    const newQuestion: FormQuestion = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'text',
      label: 'New Question',
      required: false,
      options: ['Option 1'],
    };
    setForm(prev => ({ ...prev, questions: [...(prev.questions || []), newQuestion] }));
  };

  const removeQuestion = (id: string) => {
    setForm(prev => ({ ...prev, questions: prev.questions?.filter(q => q.id !== id) }));
  };

  const updateQuestion = (id: string, updates: Partial<FormQuestion>) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions?.map(q => q.id === id ? { ...q, ...updates } : q)
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const payload = {
        ...form,
        createdBy: form.createdBy || user.uid,
        createdByName: form.createdByName || user.displayName || 'Staff',
        updatedAt: Date.now(),
        createdAt: form.createdAt || Date.now(),
      };

      if (formId) {
        await setDoc(doc(db, 'forms', formId), payload);
      } else {
        const docRef = await addDoc(collection(db, 'forms'), payload);
        navigate(`/forms/build?id=${docRef.id}`, { replace: true });
      }
      alert('Form saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Error saving form');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(form.primaryColor || '#000000');
    doc.rect(0, 0, 210, 45, 'F');
    
    // Branding Images
    if (form.headerLeftImageUrl || instituteSettings?.receiptLeftImageUrl) {
      const left = form.headerLeftImageUrl || instituteSettings?.receiptLeftImageUrl;
      try { doc.addImage(left!, 'PNG', 10, 5, 30, 35); } catch(e) {}
    }
    if (form.headerRightImageUrl || instituteSettings?.receiptRightImageUrl) {
      const right = form.headerRightImageUrl || instituteSettings?.receiptRightImageUrl;
      try { doc.addImage(right!, 'PNG', 170, 5, 30, 35); } catch(e) {}
    }
    if (form.logoUrl || instituteSettings?.logoUrl) {
      const logo = form.logoUrl || instituteSettings?.logoUrl;
      try { doc.addImage(logo!, 'PNG', 95, 5, 20, 20); } catch(e) {}
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(form.title || 'Untitled Form', 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(form.department || instituteSettings?.instituteName || 'MAKTAB WALI UL ASR', 105, 38, { align: 'center' });

    // Form Description
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.text(form.description || '', 20, 55, { maxWidth: 170 });

    let cursorY = 75;

    // Questions
    form.questions?.forEach((q, i) => {
      if (cursorY > 260) {
        doc.addPage();
        cursorY = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}. ${q.label} ${q.required ? '*' : ''}`, 20, cursorY);
      cursorY += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);

      switch (q.type) {
        case 'text':
        case 'paragraph':
          doc.rect(20, cursorY, 170, q.type === 'text' ? 8 : 25);
          cursorY += q.type === 'text' ? 15 : 32;
          break;
        case 'multiple_choice':
        case 'checkbox':
        case 'dropdown':
          q.options?.forEach((opt) => {
            doc.circle(23, cursorY - 1, 2, 'S');
            doc.text(opt, 28, cursorY);
            cursorY += 8;
          });
          cursorY += 5;
          break;
        case 'date':
        case 'time':
          doc.rect(20, cursorY, 50, 8);
          cursorY += 15;
          break;
      }
    });

    doc.save(`${form.title}_Blank_Form.pdf`);
  };

  const handleImageUpload = (field: keyof FormSchema) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = field === 'bannerUrl' ? 1200 : 600;
        
        if (width > height) {
          if (width > max) { height *= max / width; width = max; }
        } else {
          if (height > max) { width *= max / height; height = max; }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setForm(prev => ({ ...prev, [field]: base64 }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={0} sx={{ 
        p: { xs: 2, md: 2.5 }, 
        borderRadius: 4, 
        mb: 6, 
        bgcolor: alpha(theme.palette.background.paper, 0.95),
        backdropFilter: 'blur(20px)',
        border: '1px solid',
        borderColor: 'divider',
        position: 'sticky',
        top: { xs: 70, md: 20 }, // Avoid fixed top nav if any
        zIndex: 1100,
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
      }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 'auto' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton onClick={() => navigate('/forms')} sx={{ bgcolor: 'action.hover', borderRadius: 2 }}>
                <ArrowLeft size={20} />
              </IconButton>
              <Box>
                 <Typography variant="h6" sx={{ fontWeight: 1000, fontFamily: '"Cinzel Decorative", serif', letterSpacing: -0.5, lineHeight: 1 }}>
                   Design Studio
                 </Typography>
                 <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                   {formId ? `Editing: ${form.title}` : 'Creating New Project'}
                 </Typography>
              </Box>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 'grow' as any }}>
            <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'center', md: 'flex-end' }} flexWrap="wrap" sx={{ gap: 1 }}>
              {form.status === 'published' && (
                <Chip 
                  label="LIVE" 
                  size="small" 
                  sx={{ bgcolor: alpha(theme.palette.success.main, 0.15), color: 'success.main', fontWeight: 950, borderRadius: 1.5, px: 1 }} 
                />
              )}
              <Tooltip title={formId ? "Open Public Link" : "Save to Preview"}>
                 <IconButton 
                  onClick={() => formId && window.open(`/forms/view/${formId}`, '_blank')}
                  disabled={!formId}
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), color: 'primary.main', borderRadius: 2 }}
                 >
                   <Eye size={18} />
                 </IconButton>
              </Tooltip>
              <Button 
                variant="outlined" 
                size="small"
                startIcon={<Share2 size={16} />}
                onClick={handleShare}
                sx={{ borderRadius: 2, fontWeight: 900, px: 2 }}
              >
                Share
              </Button>
              <Button 
                variant="contained" 
                size="small"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save size={16} />}
                onClick={handleSave}
                disabled={loading}
                sx={{ 
                  borderRadius: 2, 
                  fontWeight: 900, 
                  px: 3,
                  boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.2)}`,
                }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Card sx={{ 
        borderRadius: 8, 
        mb: 6, 
        borderTop: `16px solid ${form.primaryColor}`, 
        boxShadow: '0 25px 50px rgba(0,0,0,0.08)',
        overflow: 'visible',
        backdropFilter: 'blur(30px)',
        bgcolor: alpha(theme.palette.background.paper, 0.4), // Reduced opacity
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.1)
      }}>
        <CardContent sx={{ p: { xs: 4, md: 8 } }}>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Form Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            InputProps={{ 
              sx: { fontSize: '2.5rem', fontWeight: 1000, mb: 1, fontFamily: '"Cinzel Decorative", serif' },
              disableUnderline: true
            }}
          />
          <TextField
            fullWidth
            multiline
            variant="standard"
            placeholder="Describe your form (supports markdown)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            InputProps={{ 
              sx: { fontSize: '1.1rem', color: 'text.secondary' },
              disableUnderline: true
            }}
            sx={{ mb: 4 }}
          />
          
          <Divider sx={{ mb: 4 }} />
          
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="Campaign Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
              >
                <MenuItem value="exam">Academic Exam</MenuItem>
                <MenuItem value="survey">Institution Survey</MenuItem>
                <MenuItem value="registration">Admission Form</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="Publication Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
              >
                <MenuItem value="draft">Draft - Private</MenuItem>
                <MenuItem value="published">Published - Live</MenuItem>
                <MenuItem value="closed">Closed - Archive</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Duration Limit (Minutes)"
                type="number"
                placeholder="0 for No Limit"
                value={form.durationLimit || ''}
                onChange={(e) => setForm({ ...form, durationLimit: parseInt(e.target.value) || 0 })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Department / Idarah Name"
                placeholder="e.g. Maktab Wali Ul Aser"
                value={form.department || ''}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
              />
            </Grid>

            {/* Custom Branding Assets */}
            <Grid size={12}>
               <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Palette size={16} color={theme.palette.primary.main} />
                  <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: 2 }}>Branding Assets</Typography>
               </Stack>
               <Grid container spacing={2}>
                 <Grid size={{ xs: 6, sm: 3 }}>
                    <Tooltip title="Logo Upload">
                      <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 4, p: 1, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'transparent' }}>
                        {form.logoUrl ? (
                          <Box sx={{ position: 'relative', height: '100%' }}>
                              <img src={form.logoUrl} alt="Logo" style={{ height: '100%', objectFit: 'contain' }} />
                              <IconButton size="small" onClick={() => setForm({ ...form, logoUrl: '' })} sx={{ position: 'absolute', top: -5, right: -5, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' }, width: 20, height: 20 }}><Trash2 size={10} /></IconButton>
                          </Box>
                        ) : (
                          <IconButton component="label" sx={{ color: 'text.secondary' }}>
                            <ImageIcon />
                            <input type="file" hidden accept="image/*" onChange={handleImageUpload('logoUrl')} />
                          </IconButton>
                        )}
                      </Box>
                    </Tooltip>
                 </Grid>
                 <Grid size={{ xs: 6, sm: 3 }}>
                    <Tooltip title="Header Left Branding">
                      <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 4, p: 1, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'transparent' }}>
                        {form.headerLeftImageUrl ? (
                          <Box sx={{ position: 'relative', height: '100%' }}>
                              <img src={form.headerLeftImageUrl} alt="Left" style={{ height: '100%', objectFit: 'contain' }} />
                              <IconButton size="small" onClick={() => setForm({ ...form, headerLeftImageUrl: '' })} sx={{ position: 'absolute', top: -5, right: -5, bgcolor: 'error.main', color: 'white', width: 20, height: 20 }}><Trash2 size={10} /></IconButton>
                          </Box>
                        ) : (
                          <IconButton component="label" sx={{ color: 'text.secondary' }}>
                            <ImageIcon />
                            <input type="file" hidden accept="image/*" onChange={handleImageUpload('headerLeftImageUrl')} />
                          </IconButton>
                        )}
                      </Box>
                    </Tooltip>
                 </Grid>
                 <Grid size={{ xs: 6, sm: 3 }}>
                    <Tooltip title="Header Right Branding">
                      <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 4, p: 1, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'transparent' }}>
                        {form.headerRightImageUrl ? (
                          <Box sx={{ position: 'relative', height: '100%' }}>
                              <img src={form.headerRightImageUrl} alt="Right" style={{ height: '100%', objectFit: 'contain' }} />
                              <IconButton size="small" onClick={() => setForm({ ...form, headerRightImageUrl: '' })} sx={{ position: 'absolute', top: -5, right: -5, bgcolor: 'error.main', color: 'white', width: 20, height: 20 }}><Trash2 size={10} /></IconButton>
                          </Box>
                        ) : (
                          <IconButton component="label" sx={{ color: 'text.secondary' }}>
                            <ImageIcon />
                            <input type="file" hidden accept="image/*" onChange={handleImageUpload('headerRightImageUrl')} />
                          </IconButton>
                        )}
                      </Box>
                    </Tooltip>
                 </Grid>
                 <Grid size={{ xs: 12, sm: 3 }}>
                    <Tooltip title="Form Accent Color">
                       <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, p: 1, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: form.primaryColor, boxShadow: 2 }} />
                          <input 
                            type="color" 
                            style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer', width: '100%', height: '100%' }} 
                            value={form.primaryColor}
                            onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                          />
                       </Box>
                    </Tooltip>
                 </Grid>
                 <Grid size={12}>
                    <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 4, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.action.hover, 0.3), overflow: 'hidden' }}>
                      {form.bannerUrl ? (
                          <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
                              <img src={form.bannerUrl} alt="Banner" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                              <IconButton size="small" onClick={() => setForm({ ...form, bannerUrl: '' })} sx={{ position: 'absolute', top: 10, right: 10, bgcolor: 'error.main', color: 'white' }}><Trash2 size={14} /></IconButton>
                          </Box>
                      ) : (
                        <Button component="label" fullWidth startIcon={<ImageIcon size={20} />} sx={{ height: '100%', color: 'text.secondary', fontWeight: 800 }}>
                          UPLOAD TOP BANNER (A4 COMPLIANT)
                          <input type="file" hidden accept="image/*" onChange={handleImageUpload('bannerUrl')} />
                        </Button>
                      )}
                    </Box>
                 </Grid>
               </Grid>
            </Grid>

            {/* Constraints & Member Autofill */}
            <Grid size={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="overline" sx={{ fontWeight: 1000, color: 'primary.main', mb: 2, display: 'block', letterSpacing: 1.5 }}>
                Advanced Control & Autofill
              </Typography>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <FormControlLabel
                  control={<Switch checked={form.allowNonStudents} onChange={(e) => setForm({ ...form, allowNonStudents: e.target.checked })} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 800 }}>Global Public Share</Typography>}
                />
                <FormControlLabel
                  control={<Switch checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 800 }}>Anonymous Feedback</Typography>}
                />
                <FormControlLabel
                  control={<Switch checked={form.limitOneResponse} onChange={(e) => setForm({ ...form, limitOneResponse: e.target.checked })} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 800 }}>One response per IP</Typography>}
                />
                <FormControlLabel
                  control={<Switch checked={form.collectName} onChange={(e) => setForm({ ...form, collectName: e.target.checked })} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 800 }}>Autofill Name</Typography>}
                />
                <FormControlLabel
                  control={<Switch checked={form.collectRollNo} onChange={(e) => setForm({ ...form, collectRollNo: e.target.checked })} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 800 }}>Autofill Roll#</Typography>}
                />
                <FormControlLabel
                  control={<Switch checked={form.collectEmail} onChange={(e) => setForm({ ...form, collectEmail: e.target.checked })} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 800 }}>Autofill Email</Typography>}
                />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Reorder.Group axis="y" values={form.questions || []} onReorder={(newQuestions) => setForm({ ...form, questions: newQuestions })}>
        <Stack spacing={3}>
          <AnimatePresence>
            {form.questions?.map((q, index) => (
              <Reorder.Item 
                key={q.id} 
                value={q}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card sx={{ 
                  borderRadius: 7, 
                  boxShadow: '0 15px 45px rgba(0,0,0,0.05)',
                  border: '1px solid',
                  borderColor: alpha(theme.palette.divider, 0.8),
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:focus-within': { 
                    borderColor: theme.palette.primary.main, 
                    boxShadow: `0 20px 60px ${alpha(theme.palette.primary.main, 0.1)}`,
                    transform: 'translateY(-4px)'
                  }
                }}>
                  <CardContent sx={{ position: 'relative', p: { xs: 4, md: 6 } }}>
                    <Box sx={{ position: 'absolute', left: 4, top: 0, bottom: 0, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', color: 'text.disabled' }}>
                      <GripVertical size={16} />
                    </Box>
                    
                    <Box sx={{ ml: 2 }}>
                      <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, md: 8 }}>
                          <TextField
                            fullWidth
                            variant="outlined"
                            label={`Interactive Question ${index + 1}`}
                            value={q.label}
                            onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4, fontWeight: 700 } }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <TextField
                            select
                            fullWidth
                            variant="outlined"
                            value={q.type}
                            onChange={(e) => updateQuestion(q.id, { type: e.target.value as any })}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: alpha(theme.palette.action.hover, 0.2) } }}
                          >
                            {QUESTION_TYPES.map(type => (
                              <MenuItem key={type.value} value={type.value}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
                                  {type.icon} {type.label}
                                </Box>
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                      </Grid>

                      {/* Options for List-types */}
                      {['multiple_choice', 'checkbox', 'dropdown'].includes(q.type) && (
                        <Box sx={{ pl: 2, mb: 3 }}>
                          {q.options?.map((opt, optIndex) => (
                            <Stack key={optIndex} direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                              <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid', borderColor: alpha(theme.palette.text.disabled, 0.4) }} />
                              <TextField
                                size="small"
                                variant="standard"
                                placeholder={`Option ${optIndex + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(q.options || [])];
                                  newOpts[optIndex] = e.target.value;
                                  updateQuestion(q.id, { options: newOpts });
                                }}
                                sx={{ flex: 1, '& .MuiInput-input': { fontWeight: 600 } }}
                              />
                              <IconButton size="small" onClick={() => {
                                const newOpts = q.options?.filter((_, i) => i !== optIndex);
                                updateQuestion(q.id, { options: newOpts });
                              }} color="error">
                                <Trash2 size={14} />
                              </IconButton>
                            </Stack>
                          ))}
                          <Button 
                            variant="text"
                            size="small" 
                            startIcon={<Plus size={14} />}
                            onClick={() => updateQuestion(q.id, { options: [...(q.options || []), `New Choice ${(q.options?.length || 0) + 1}` ] })}
                            sx={{ fontWeight: 800, mt: 1, borderRadius: 2 }}
                          >
                            Add New Choice
                          </Button>
                        </Box>
                      )}

                      <Divider sx={{ my: 2 }} />
                      
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          {form.type === 'exam' && (
                            <TextField
                              label="Grade Points"
                              type="number"
                              size="small"
                              sx={{ width: 120, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                              value={q.points || 0}
                              onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) })}
                            />
                          )}
                        </Box>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <FormControlLabel
                            control={<Switch size="small" checked={q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} />}
                            label={<Typography variant="caption" sx={{ fontWeight: 900 }}>MANDATORY</Typography>}
                          />
                          <IconButton onClick={() => removeQuestion(q.id)} color="error" sx={{ bgcolor: alpha(theme.palette.error.main, 0.05) }}>
                            <Trash2 size={18} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Stack>
      </Reorder.Group>

      <Box sx={{ mt: 5, display: 'flex', justifyContent: 'center' }}>
        <Button 
          variant="contained" 
          startIcon={<Plus size={20} />}
          onClick={addQuestion}
          sx={{ 
            borderRadius: 6, 
            px: 6, 
            py: 2, 
            fontWeight: 1000, 
            fontSize: '1rem',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.35)}`,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'scale(1.05)',
              boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.45)}`,
            }
          }}
        >
          Add New Question
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity as any} 
          sx={{ width: '100%', borderRadius: 3, fontWeight: 800 }}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
