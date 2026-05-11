import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, TextField, Radio, RadioGroup,
  FormControlLabel, Checkbox, Select, MenuItem, Stack, Card, CardContent,
  CircularProgress, alpha, useTheme, Alert, Divider, LinearProgress,
  Avatar, Paper, Grid
} from '@mui/material';
import { 
  Send, AlertCircle, CheckCircle2, Clock, Calendar, 
  MapPin, User, Mail, Hash, FileDown, ArrowLeft, Globe,
  ShieldCheck, Info
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { FormSchema, FormResponse } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import confetti from 'canvas-confetti';

export default function FormView() {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, instituteSettings } = useAuth();

  const [form, setForm] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [ipAddress, setIpAddress] = useState('');

  const primaryColor = form?.primaryColor || instituteSettings?.primaryColor || theme.palette.primary.main;
  const instituteLogo = form?.logoUrl || instituteSettings?.logoUrl;
  const instituteBanner = form?.bannerUrl || instituteSettings?.bannerUrl;

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => setIpAddress('unknown'));

    if (id) {
      const fetchForm = async () => {
        try {
          const docRef = doc(db, 'forms', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const formData = { id: docSnap.id, ...docSnap.data() } as FormSchema;
            
            // Expiry Logic
            const now = Date.now();
            if (formData.endDate && now > formData.endDate) {
              setError('This form is no longer accepting responses. Access expired on ' + format(formData.endDate, 'PPP p'));
              setLoading(false);
              return;
            }
            if (formData.startDate && now < formData.startDate) {
              setError('This form will start accepting responses on ' + format(formData.startDate, 'PPP p'));
              setLoading(false);
              return;
            }

            // One-response limit (Local check)
            if (formData.limitOneResponse && localStorage.getItem(`form_sub_${id}`)) {
              setError('You have already submitted a response to this form.');
              setLoading(false);
              return;
            }

            // Validation: Access Control
            if (formData.status !== 'published' && !(user?.role === 'superadmin' || user?.uid === formData.createdBy)) {
              setError('This form is currently in draft or closed.');
            } else if (!formData.allowNonStudents && !user) {
              setError('Student Access Only. Please sign in to your institutional account to view this form.');
            } else {
              setForm(formData);
            }
          } else {
            setError('The requested form does not exist or has been removed.');
          }
        } catch (err) {
          console.error(err);
          setError('Failed to fetch form. Check your connection.');
        } finally {
          setLoading(false);
        }
      };
      fetchForm();
    }
  }, [id, user]);

  const calculateProgress = () => {
    if (!form) return 0;
    const requiredQuestions = form.questions.filter(q => q.required);
    if (requiredQuestions.length === 0) return 100;
    const answeredRequired = requiredQuestions.filter(q => !!responses[q.id]);
    return Math.round((answeredRequired.length / requiredQuestions.length) * 100);
  };

  const generateReceiptPDF = (data: any) => {
    const doc = new jsPDF();
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Submission Receipt', 20, 25);
    doc.setFontSize(10);
    doc.text(`${instituteSettings?.instituteName || 'Institutional'} Form Solution • ${format(Date.now(), 'PPP p')}`, 20, 35);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.text(form?.title || 'Form Submission', 20, 60);
    
    const tableData = [
      ['Submission ID', data.id.substring(0, 8).toUpperCase()],
      ['Name', data.userName],
      ['Email', data.userEmail],
      ['Roll No', data.userRollNo || 'External'],
      ['Time', format(data.submittedAt, 'PPP p')],
      ['IP Address', data.ipAddress]
    ];

    (doc as any).autoTable({
      startY: 70,
      head: [['Field', 'Value']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [4, 47, 46] }
    });

    doc.save(`${form?.title}_Receipt.pdf`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !id) return;

    const missing = form.questions.filter(q => q.required && !responses[q.id]);
    if (missing.length > 0) {
      alert('Please fill all required fields: ' + missing.map(m => m.label).join(', '));
      return;
    }

    setSubmitting(true);
    try {
      let isDuplicate = false;
      const q = query(collection(db, 'form_responses'), where('formId', '==', id));
      const existingSubmissions = await getDocs(q);
      
      const userMatch = user && existingSubmissions.docs.some(doc => doc.data().userId === user.uid);
      const ipMatch = existingSubmissions.docs.some(doc => doc.data().ipAddress === ipAddress);
      
      if (userMatch || ipMatch) isDuplicate = true;

      const payload: any = {
        formId: id,
        userId: user?.uid || null,
        userEmail: user?.email || (responses['email'] || ''),
        userName: user?.displayName || (responses['name'] || 'Guest'),
        userRollNo: user?.rollNo || (responses['rollNo'] || ''),
        ipAddress,
        responses: form.questions.map(q => ({
          questionId: q.id,
          answer: responses[q.id]
        })),
        submittedAt: Date.now(),
        isDuplicate,
        browserInfo: navigator.userAgent
      };

      const docRef = await addDoc(collection(db, 'form_responses'), payload);
      setLastSubmission({ id: docRef.id, ...payload });
      if (form.limitOneResponse) {
        localStorage.setItem(`form_sub_${id}`, 'true');
      }
      setSubmitted(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: [primaryColor, '#fbbf24', '#ffffff']
      });
    } catch (err) {
      console.error(err);
      alert('Failed to submit. Please check your internet connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (q: any) => {
    switch (q.type) {
      case 'multiple_choice':
        return (
          <RadioGroup 
            value={responses[q.id] || ''} 
            onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
          >
            {q.options?.map((opt: string) => (
              <Box key={opt} sx={{ 
                border: '1px solid', 
                borderColor: responses[q.id] === opt ? 'primary.main' : 'divider',
                bgcolor: responses[q.id] === opt ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                borderRadius: 2, 
                mb: 1, 
                pl: 1,
                transition: 'all 0.2s ease'
              }}>
                <FormControlLabel value={opt} control={<Radio />} label={opt} sx={{ width: '100%', py: 0.5 }} />
              </Box>
            ))}
          </RadioGroup>
        );
      case 'dropdown':
        return (
          <TextField
             select
             fullWidth
             value={responses[q.id] || ''}
             onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
             variant="outlined"
          >
            {q.options?.map((opt: string) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        );
      case 'checkbox':
        return (
          <Grid container spacing={1}>
            {q.options?.map((opt: string) => (
              <Grid key={opt} size={{ xs: 12, sm: 6 }}>
                <Box sx={{ 
                  border: '1px solid', 
                  borderColor: (responses[q.id] || []).includes(opt) ? 'primary.main' : 'divider',
                  bgcolor: (responses[q.id] || []).includes(opt) ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                  borderRadius: 2, 
                  pl: 1,
                  transition: 'all 0.2s ease'
                }}>
                  <FormControlLabel 
                    control={
                      <Checkbox 
                        checked={(responses[q.id] || []).includes(opt)}
                        onChange={(e) => {
                          const current = responses[q.id] || [];
                          const next = e.target.checked 
                            ? [...current, opt]
                            : current.filter((o: string) => o !== opt);
                          setResponses({ ...responses, [q.id]: next });
                        }}
                      />
                    } 
                    label={opt} 
                    sx={{ width: '100%', py: 0.5 }}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        );
      case 'paragraph':
        return (
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="Type your response here..."
            value={responses[q.id] || ''}
            onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
        );
      case 'date':
        return <TextField type="date" fullWidth value={responses[q.id] || ''} onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, height: 48 } }} />;
      default:
        return (
          <TextField
            fullWidth
            variant="outlined"
            placeholder={q.placeholder || "Your answer"}
            value={responses[q.id] || ''}
            inputProps={{
              inputMode: q.label.toLowerCase().includes('phone') || q.label.toLowerCase().includes('roll') || q.label.toLowerCase().includes('number') ? 'numeric' : 'text',
            }}
            onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, height: 48 } }}
          />
        );
    }
  };

  const isStaffView = user?.role === 'superadmin' || user?.uid === form?.createdBy || user?.role === 'manager';

  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 2 }}>
      <CircularProgress size={60} thickness={4} />
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>Securing Connection...</Typography>
    </Box>
  );

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Card sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: 10 }}>
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <AlertCircle size={48} color={theme.palette.error.main} style={{ marginBottom: 16 }} />
            <Typography variant="h5" sx={{ fontWeight: 950, mb: 2, fontFamily: '"Cinzel Decorative", serif' }}>Access Terminated</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>{error}</Typography>
            <Button 
               variant="contained" 
               fullWidth
               startIcon={<ArrowLeft size={18} />}
               onClick={() => navigate('/')}
               sx={{ borderRadius: 3, py: 1.5, fontWeight: 900 }}
            >
              Return Home
            </Button>
          </Box>
        </Card>
      </Container>
    );
  }

  if (submitted && lastSubmission) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card sx={{ borderRadius: 6, boxShadow: 20, textAlign: 'center', overflow: 'hidden' }}>
            <Box sx={{ p: 4, bgcolor: alpha(primaryColor, 0.05), borderBottom: '1px dashed', borderColor: 'divider' }}>
               {instituteLogo && (
                 <Box sx={{ mb: 3 }}>
                    <img src={instituteLogo} style={{ width: 80, height: 80, objectFit: 'contain' }} />
                 </Box>
               )}
              <CheckCircle2 size={56} color={primaryColor} style={{ marginBottom: 16 }} />
              <Typography variant="h4" sx={{ fontWeight: 950, mb: 1, color: primaryColor }}>Success!</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Response recorded for {instituteSettings?.instituteName || 'Institutional Record'}.
              </Typography>
            </Box>
            <CardContent sx={{ p: 4 }}>
              <Stack spacing={2} sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: 'action.hover', borderRadius: 3 }}>
                  <Typography variant="body2" color="text.secondary">Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{lastSubmission.userName}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: 'action.hover', borderRadius: 3 }}>
                  <Typography variant="body2" color="text.secondary">Identifier</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{lastSubmission.userRollNo || 'Public'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: 'action.hover', borderRadius: 3 }}>
                  <Typography variant="body2" color="text.secondary">Date</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{format(lastSubmission.submittedAt, 'MMM d, p')}</Typography>
                </Box>
              </Stack>
              
              <Stack direction="row" spacing={2}>
                <Button 
                  fullWidth
                  variant="outlined"
                  size="large"
                  startIcon={<FileDown size={18} />}
                  onClick={() => generateReceiptPDF(lastSubmission)}
                  sx={{ borderRadius: 3, fontWeight: 900, py: 1.5 }}
                >
                  Download Receipt
                </Button>
                <Button 
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/')}
                  sx={{ borderRadius: 3, fontWeight: 900, py: 1.5 }}
                >
                  Dashboard
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </motion.div>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: alpha(primaryColor, 0.02), minHeight: '100vh', pb: 10 }}>
      {/* Staff Preview Banner (Sticky) */}
      {isStaffView && form?.status === 'published' && (
        <Box sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          py: 1, 
          textAlign: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 1400,
          boxShadow: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1
        }}>
          <ShieldCheck size={16} />
          <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
            Staff Preview Mode - Administrator View
          </Typography>
        </Box>
      )}

      {/* Dynamic Progress Bar (Sticky) */}
      {form?.showProgressBar && (
        <Box sx={{ position: 'fixed', top: (isStaffView && form?.status === 'published') ? 40 : 0, left: 0, right: 0, zIndex: 1300 }}>
          <LinearProgress 
            variant="determinate" 
            value={calculateProgress()} 
            sx={{ height: 6, bgcolor: alpha(form.primaryColor || theme.palette.primary.main, 0.1) }}
          />
        </Box>
      )}

      {/* Standalone Branding Banner */}
      {instituteBanner && (
        <Box sx={{ 
          height: { xs: 150, md: 300 }, 
          width: '100%', 
          position: 'relative',
          backgroundImage: `url(${instituteBanner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mb: { xs: -6, md: -10 }
        }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.1))' }} />
        </Box>
      )}

      <Container maxWidth="md" sx={{ pt: instituteBanner ? 4 : 8 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button 
            startIcon={<ArrowLeft size={18} />} 
            onClick={() => navigate(-1)}
            sx={{ fontWeight: 800, borderRadius: 2, color: 'text.secondary', minHeight: 44 }}
          >
            Go Back
          </Button>
          {form?.showProgressBar && (
             <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
               {calculateProgress()}% Complete
             </Typography>
          )}
        </Box>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Card sx={{ 
            borderRadius: 6, 
            mb: 4, 
            overflow: 'hidden', 
            boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
            borderTop: instituteBanner ? 'none' : `15px solid ${primaryColor}`,
            background: 'white'
          }}>
            <Box sx={{ p: { xs: 3, md: 5 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                {form?.headerLeftImageUrl ? (
                  <Box component="img" src={form.headerLeftImageUrl} sx={{ height: { xs: 40, sm: 60 }, width: 'auto', maxWidth: 100, objectFit: 'contain' }} />
                ) : (
                   instituteSettings?.receiptLeftImageUrl && <Box component="img" src={instituteSettings.receiptLeftImageUrl} sx={{ height: { xs: 40, sm: 60 }, width: 'auto', maxWidth: 100, objectFit: 'contain' }} />
                )}
                {instituteLogo && (
                  <Avatar 
                    src={instituteLogo} 
                    sx={{ 
                      width: { xs: 60, sm: 80 }, 
                      height: { xs: 60, sm: 80 }, 
                      boxShadow: 4, 
                      border: '4px solid white',
                      bgcolor: 'white'
                    }} 
                  />
                )}
                {form?.headerRightImageUrl ? (
                  <Box component="img" src={form.headerRightImageUrl} sx={{ height: { xs: 40, sm: 60 }, width: 'auto', maxWidth: 100, objectFit: 'contain' }} />
                ) : (
                  instituteSettings?.receiptRightImageUrl && <Box component="img" src={instituteSettings.receiptRightImageUrl} sx={{ height: { xs: 40, sm: 60 }, width: 'auto', maxWidth: 100, objectFit: 'contain' }} />
                )}
              </Stack>

              <Typography variant="h2" sx={{ 
                fontWeight: 950, 
                fontFamily: '"Cinzel Decorative", serif', 
                color: 'text.primary', 
                letterSpacing: -1, 
                textAlign: 'center',
                mb: 2,
                fontSize: { xs: '1.8rem', sm: '2.5rem', md: '3rem' }
              }}>
                {form?.title}
              </Typography>
              
              <Typography variant="body1" sx={{ 
                color: 'text.secondary', 
                lineHeight: 1.8, 
                fontSize: '1.1rem',
                textAlign: 'center'
              }}>
                {form?.description}
              </Typography>
              
              <Divider sx={{ my: 3 }} />
              
              <Stack direction="row" spacing={3} flexWrap="wrap" justifyContent="center">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                  <ShieldCheck size={16} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Verified Institution Form</Typography>
                </Box>
                {form?.anonymous && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                    <Globe size={16} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Anonymous Mode Enabled</Typography>
                  </Box>
                )}
                {form?.endDate && (
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <Clock size={16} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Due: {format(form.endDate, 'MMM d, p')}</Typography>
                  </Box>
                )}
              </Stack>
            </Box>
            
            {!form?.anonymous && user && (
              <Box sx={{ py: 2, px: { xs: 3, md: 5 }, bgcolor: alpha(theme.palette.primary.main, 0.03), borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: 'primary.main' }}>{user.displayName?.charAt(0)}</Avatar>
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>{user.displayName}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>| {user.email}</Typography>
                </Stack>
              </Box>
            )}
          </Card>

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              {form?.questions.map((q, index) => (
                <motion.div key={q.id} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.1 }}>
                  <Card sx={{ 
                    borderRadius: 5, 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.04)', 
                    border: '1px solid', 
                    borderColor: 'transparent',
                    transition: 'all 0.3s ease',
                    '&:focus-within': { borderColor: alpha(theme.palette.primary.main, 0.3), boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }
                  }}>
                    <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: 'text.primary', fontSize: { xs: '1.1rem', md: '1.2rem' } }}>
                          {q.label}
                        </Typography>
                        {q.required && <Typography color="error" variant="h5" sx={{ mt: -0.5 }}>*</Typography>}
                      </Stack>
                      {renderQuestion(q)}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              
              <Paper elevation={0} sx={{ p: 3, borderRadius: 5, bgcolor: alpha(theme.palette.success.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.1), display: 'flex', alignItems: 'center', gap: 2 }}>
                <ShieldCheck size={20} color={theme.palette.success.main} />
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Your response is being submitted to the secure institutional database. Your privacy is our priority.
                </Typography>
              </Paper>

              <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: 'flex-end', pt: 3, gap: 2 }}>
                <Button 
                   variant="text" 
                   sx={{ borderRadius: 3, fontWeight: 900, color: 'text.secondary', minHeight: 48 }}
                   onClick={() => navigate(-1)}
                >
                  Clear Form
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  size="large"
                  disabled={submitting}
                  startIcon={<Send size={18} />}
                  sx={{ 
                    borderRadius: 4, 
                    fontWeight: 900, 
                    px: { xs: 4, sm: 8 }, 
                    py: 2, 
                    fontSize: '1rem',
                    minHeight: 56,
                    boxShadow: `0 12px 24px ${alpha(form?.primaryColor || theme.palette.primary.main, 0.3)}`
                  }}
                >
                  {submitting ? 'Verifying...' : 'Submit Response'}
                </Button>
              </Box>
            </Stack>
          </form>
        </motion.div>
      </Container>
    </Box>
  );
}

