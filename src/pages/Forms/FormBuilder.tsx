import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, TextField, MenuItem, 
  Switch, FormControlLabel, IconButton, Stack, Card, CardContent,
  Divider, Grid, alpha, useTheme, Tooltip, CircularProgress
} from '@mui/material';
import { 
  Trash2, Plus, GripVertical, Settings, Save, ArrowLeft,
  Type, AlignLeft, List, CheckSquare, ChevronDown, Calendar, 
  Hash, Clock, Image as ImageIcon, Palette, FileDown
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { FormSchema, FormQuestion } from '../../types';
import { motion, Reorder } from 'motion/react';
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
  const [form, setForm] = useState<Partial<FormSchema>>({
    title: 'Untitled Form',
    description: '',
    type: 'survey',
    status: 'draft',
    allowNonStudents: true,
    anonymous: false,
    questions: [],
    primaryColor: theme.palette.primary.main,
  });

  useEffect(() => {
    if (formId) {
      const loadForm = async () => {
        const docRef = doc(db, 'forms', formId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setForm({ id: docSnap.id, ...docSnap.data() } as FormSchema);
        }
      };
      loadForm();
    }
  }, [formId]);

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
        createdBy: user.uid,
        createdByName: user.displayName || 'Staff',
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
    const logoBase64 = instituteSettings?.logoUrl; // In real app, would need to handle CORS/Base64
    
    // Header
    doc.setFillColor(form.primaryColor || '#000000');
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(form.title || 'Untitled Form', 20, 20);
    doc.setFontSize(10);
    doc.text(instituteSettings?.instituteName || 'Islamic Academy', 20, 30);

    // Form Description
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.text(form.description || '', 20, 50, { maxWidth: 170 });

    let cursorY = 70;

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
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/forms')}>
          <ArrowLeft />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 900, flex: 1, fontFamily: '"Cinzel Decorative", serif' }}>
          Form Builder
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<FileDown size={18} />}
          onClick={generatePDF}
          sx={{ 
            borderRadius: 3, 
            fontWeight: 800,
            px: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.25)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
            color: 'primary.main',
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.35),
            transition: 'all 0.3s ease',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              transform: 'translateY(-2px)'
            }
          }}
        >
          Physical Form (PDF)
        </Button>
        <Button 
          variant="contained" 
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save size={18} />}
          onClick={handleSave}
          disabled={loading}
          sx={{ 
            borderRadius: 3, 
            fontWeight: 900, 
            px: 4,
            background: loading 
              ? theme.palette.action.disabledBackground 
              : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: loading ? 'none' : `0 8px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: loading ? 'none' : 'translateY(-2px)',
              boxShadow: loading ? 'none' : `0 12px 20px ${alpha(theme.palette.primary.main, 0.4)}`
            }
          }}
        >
          {loading ? 'Saving...' : 'Save Form'}
        </Button>
      </Stack>

      <Card sx={{ borderRadius: 4, mb: 4, borderTop: `10px solid ${form.primaryColor}` }}>
        <CardContent>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Form Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            InputProps={{ sx: { fontSize: '2rem', fontWeight: 900, mb: 2 } }}
          />
          <TextField
            fullWidth
            multiline
            variant="standard"
            placeholder="Form Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            sx={{ mb: 3 }}
          />
          
          <Divider sx={{ my: 3 }} />
          
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="Form Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                size="small"
              >
                <MenuItem value="exam">Exam / Assessment</MenuItem>
                <MenuItem value="survey">Survey / Feedback</MenuItem>
                <MenuItem value="registration">Registration Form</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                size="small"
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published (Live)</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </TextField>
            </Grid>

            {/* Custom Branding Assets */}
            <Grid size={12}>
               <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', display: 'block', mb: 1 }}>VISUAL BRANDING</Typography>
               <Grid container spacing={2}>
                 <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 1, position: 'relative', textAlign: 'center' }}>
                      {form.logoUrl ? (
                         <Box sx={{ position: 'relative' }}>
                            <img src={form.logoUrl} alt="Logo" style={{ maxHeight: 60, maxWidth: '100%' }} />
                            <IconButton size="small" onClick={() => setForm({ ...form, logoUrl: '' })} sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}><Trash2 size={12} /></IconButton>
                         </Box>
                      ) : (
                        <Button component="label" fullWidth startIcon={<ImageIcon size={18} />} sx={{ height: 60, color: 'text.secondary', fontWeight: 700 }}>
                          LOGO
                          <input type="file" hidden accept="image/*" onChange={handleImageUpload('logoUrl')} />
                        </Button>
                      )}
                    </Box>
                 </Grid>
                 <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 1, position: 'relative', textAlign: 'center' }}>
                      {form.headerLeftImageUrl ? (
                         <Box sx={{ position: 'relative' }}>
                            <img src={form.headerLeftImageUrl} alt="Left" style={{ maxHeight: 60, maxWidth: '100%' }} />
                            <IconButton size="small" onClick={() => setForm({ ...form, headerLeftImageUrl: '' })} sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'error.main', color: 'white' }}><Trash2 size={12} /></IconButton>
                         </Box>
                      ) : (
                        <Button component="label" fullWidth startIcon={<ImageIcon size={18} />} sx={{ height: 60, color: 'text.secondary', fontWeight: 700 }}>
                          HDR LEFT
                          <input type="file" hidden accept="image/*" onChange={handleImageUpload('headerLeftImageUrl')} />
                        </Button>
                      )}
                    </Box>
                 </Grid>
                 <Grid size={{ xs: 12, sm: 4 }}>
                    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 1, position: 'relative', textAlign: 'center' }}>
                      {form.headerRightImageUrl ? (
                         <Box sx={{ position: 'relative' }}>
                            <img src={form.headerRightImageUrl} alt="Right" style={{ maxHeight: 60, maxWidth: '100%' }} />
                            <IconButton size="small" onClick={() => setForm({ ...form, headerRightImageUrl: '' })} sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'error.main', color: 'white' }}><Trash2 size={12} /></IconButton>
                         </Box>
                      ) : (
                        <Button component="label" fullWidth startIcon={<ImageIcon size={18} />} sx={{ height: 60, color: 'text.secondary', fontWeight: 700 }}>
                          HDR RIGHT
                          <input type="file" hidden accept="image/*" onChange={handleImageUpload('headerRightImageUrl')} />
                        </Button>
                      )}
                    </Box>
                 </Grid>
                 <Grid size={12}>
                    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 1, position: 'relative', textAlign: 'center' }}>
                      {form.bannerUrl ? (
                         <Box sx={{ position: 'relative', height: 80 }}>
                            <img src={form.bannerUrl} alt="Banner" style={{ height: '100%', width: '100%', objectFit: 'cover', borderRadius: 8 }} />
                            <IconButton size="small" onClick={() => setForm({ ...form, bannerUrl: '' })} sx={{ position: 'absolute', top: 5, right: 5, bgcolor: 'error.main', color: 'white' }}><Trash2 size={12} /></IconButton>
                         </Box>
                      ) : (
                        <Button component="label" fullWidth startIcon={<ImageIcon size={18} />} sx={{ height: 80, color: 'text.secondary', fontWeight: 700 }}>
                          UPLOAD TOP BANNER IMAGE
                          <input type="file" hidden accept="image/*" onChange={handleImageUpload('bannerUrl')} />
                        </Button>
                      )}
                    </Box>
                 </Grid>
               </Grid>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControlLabel
                control={<Switch checked={form.allowNonStudents} onChange={(e) => setForm({ ...form, allowNonStudents: e.target.checked })} />}
                label="Public Access"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControlLabel
                control={<Switch checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} />}
                label="Anonymous"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControlLabel
                control={<Switch checked={form.limitOneResponse} onChange={(e) => setForm({ ...form, limitOneResponse: e.target.checked })} />}
                label="Limit 1 Response"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <FormControlLabel
                control={<Switch checked={form.showProgressBar} onChange={(e) => setForm({ ...form, showProgressBar: e.target.checked })} />}
                label="Progress Bar"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Start Date & Time"
                type="datetime-local"
                value={form.startDate ? format(form.startDate, "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => setForm({ ...form, startDate: new Date(e.target.value).getTime() })}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Expiry Date & Time"
                type="datetime-local"
                value={form.endDate ? format(form.endDate, "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => setForm({ ...form, endDate: new Date(e.target.value).getTime() })}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Reorder.Group axis="y" values={form.questions || []} onReorder={(newQuestions) => setForm({ ...form, questions: newQuestions })}>
        <Stack spacing={2}>
          {form.questions?.map((q, index) => (
            <Reorder.Item key={q.id} value={q}>
              <Card sx={{ 
                borderRadius: 4, 
                transition: 'all 0.3s ease',
                '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.4) }
              }}>
                <CardContent sx={{ position: 'relative' }}>
                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>
                    <GripVertical size={16} color="grey" />
                  </Box>
                  
                  <Box sx={{ ml: 4 }}>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 12, md: 8 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label={`Question ${index + 1}`}
                          value={q.label}
                          onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={q.type}
                          onChange={(e) => updateQuestion(q.id, { type: e.target.value as any })}
                        >
                          {QUESTION_TYPES.map(type => (
                            <MenuItem key={type.value} value={type.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {type.icon} {type.label}
                              </Box>
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    </Grid>

                    {/* Options for List-types */}
                    {['multiple_choice', 'checkbox', 'dropdown'].includes(q.type) && (
                      <Box sx={{ pl: 2, mb: 2 }}>
                        {q.options?.map((opt, optIndex) => (
                          <Stack key={optIndex} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Box sx={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid grey' }} />
                            <TextField
                              size="small"
                              variant="standard"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...(q.options || [])];
                                newOpts[optIndex] = e.target.value;
                                updateQuestion(q.id, { options: newOpts });
                              }}
                              sx={{ flex: 1 }}
                            />
                            <IconButton size="small" onClick={() => {
                              const newOpts = q.options?.filter((_, i) => i !== optIndex);
                              updateQuestion(q.id, { options: newOpts });
                            }}>
                              <Trash2 size={14} />
                            </IconButton>
                          </Stack>
                        ))}
                        <Button 
                          size="small" 
                          startIcon={<Plus size={14} />}
                          onClick={() => updateQuestion(q.id, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}` ] })}
                        >
                          Add Option
                        </Button>
                      </Box>
                    )}

                    <Divider sx={{ my: 1 }} />
                    
                    <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
                      {form.type === 'exam' && (
                        <TextField
                          label="Points"
                          type="number"
                          size="small"
                          sx={{ width: 80 }}
                          value={q.points || 0}
                          onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) })}
                        />
                      )}
                      <FormControlLabel
                        control={<Switch size="small" checked={q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} />}
                        label="Required"
                      />
                      <IconButton onClick={() => removeQuestion(q.id)} color="error">
                        <Trash2 size={20} />
                      </IconButton>
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Reorder.Item>
          ))}
        </Stack>
      </Reorder.Group>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button 
          variant="contained" 
          startIcon={<Plus size={18} />}
          onClick={addQuestion}
          sx={{ 
            borderRadius: 4, 
            px: 4, 
            py: 1.5, 
            fontWeight: 900, 
            borderStyle: 'dashed', 
            borderWidth: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, transparent 100%)`,
            borderColor: alpha(theme.palette.primary.main, 0.4),
            color: 'primary.main',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: theme.palette.primary.main,
              background: alpha(theme.palette.primary.main, 0.1)
            }
          }}
        >
          Add New Question
        </Button>
      </Box>
    </Container>
  );
}
