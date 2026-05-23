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
  ShieldCheck, Info, Share2, Award
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { FormSchema, FormResponse } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { safelyFormatDate } from '../../lib/dateUtils';
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
  const [userSubmission, setUserSubmission] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [ipAddress, setIpAddress] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);

  // Autofill Details for Members
  useEffect(() => {
    // Priority 1: Logged In User
    if (user && form && Object.keys(responses).length === 0) {
      const autoFilled: Record<string, any> = {};
      form.questions.forEach(q => {
        const labelLower = q.label.toLowerCase();
        if (labelLower.includes('name')) autoFilled[q.id] = user.displayName;
        if (labelLower.includes('email')) autoFilled[q.id] = user.email;
        if (labelLower.includes('roll') || labelLower.includes('id') || labelLower.includes('admission')) {
          autoFilled[q.id] = user.rollNo || user.admissionNo;
        }
        if (labelLower.includes('phone') || labelLower.includes('mobile')) autoFilled[q.id] = user.phone;
        if (labelLower.includes('class') || labelLower.includes('level')) autoFilled[q.id] = user.classLevel;
        if (labelLower.includes('father')) autoFilled[q.id] = user.fatherName;
      });
      if (Object.keys(autoFilled).length > 0) {
        setResponses(prev => ({ ...autoFilled, ...prev }));
      }
    }
  }, [user, form]);

  const handleSmartAutofill = async (questionId: string, value: string) => {
    if (!value || value.length < 3) return;
    
    const question = form?.questions.find(q => q.id === questionId);
    if (!question) return;
    
    const isIdentityField = ['roll', 'id', 'admission', 'enrollment'].some(key => question.label.toLowerCase().includes(key));
    if (!isIdentityField) return;

    try {
      // 1. Check local users cache if available in context/session
      const usersCacheStr = sessionStorage.getItem('users_list');
      let foundUser: any = null;
      
      if (usersCacheStr) {
        const cachedUsers = JSON.parse(usersCacheStr);
        foundUser = cachedUsers.find((u: any) => 
          u.admissionNo === value || u.rollNo === value || u.email === value
        );
      }

      // 2. Fallback to Firestore if not in cache and looks like a valid pattern
      if (!foundUser && value.length >= 8) {
        const qUsers = query(collection(db, 'users'), where('admissionNo', '==', value), limit(1));
        const snap = await getDocs(qUsers);
        if (!snap.empty) {
          foundUser = snap.docs[0].data();
        } else {
          // Try email
          const qEmail = query(collection(db, 'users'), where('email', '==', value), limit(1));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) foundUser = snapEmail.docs[0].data();
        }
      }

      if (foundUser) {
        const extraFields: Record<string, any> = {};
        form?.questions.forEach(q => {
          if (q.id === questionId) return; // Don't overwrite the field we typed in
          const l = q.label.toLowerCase();
          if (l.includes('name')) extraFields[q.id] = foundUser.displayName;
          if (l.includes('email')) extraFields[q.id] = foundUser.email;
          if (l.includes('phone') || l.includes('mobile')) extraFields[q.id] = foundUser.phone;
          if (l.includes('father')) extraFields[q.id] = foundUser.fatherName;
          if (l.includes('class') || l.includes('level')) extraFields[q.id] = foundUser.classLevel;
        });
        setResponses(prev => ({ ...prev, ...extraFields }));
      }
    } catch (e) {
      console.error('Smart autofill failed', e);
    }
  };

  const primaryColor = form?.primaryColor || instituteSettings?.primaryColor || theme.palette.primary.main;
  const instituteLogo = form?.logoUrl || instituteSettings?.logoUrl;
  const instituteBanner = form?.bannerUrl || instituteSettings?.bannerUrl;

  // Timer Effect
  useEffect(() => {
    if (form?.durationLimit && !timeLeft && !submitted && !loading) {
      // Start Timer
      setTimeLeft(form.durationLimit * 60);
      setTimerActive(true);
    }
  }, [form, timeLeft, submitted, loading]);

  useEffect(() => {
    let interval: any;
    if (timerActive && timeLeft && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      // Auto Submit - fill mandatory questions with "Out of Time"
      const finalAnswers = { ...responses };
      form?.questions?.forEach(q => {
        if (q.required && !finalAnswers[q.id]) {
          finalAnswers[q.id] = 'Out of Time';
        }
      });
      handleSubmit(new Event('submit') as any, true, finalAnswers);
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => setIpAddress(''));

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
            } else if (formData.allowNonStudents !== true && !user) {
              setError('Student Access Only. Please sign in to your institutional account to view this form.');
            } else {
              setForm(formData);
              // Fetch user's existing submission if logged in
              if (user) {
                try {
                  const qSub = query(
                    collection(db, 'form_responses'), 
                    where('formId', '==', id),
                    where('userId', '==', user.uid)
                  );
                  const subSnap = await getDocs(qSub);
                  if (!subSnap.empty) {
                    setUserSubmission({ id: subSnap.docs[0].id, ...subSnap.docs[0].data() });
                  }
                } catch (e) { console.error('Sub fetch err:', e); }
              }
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
    
    // Left Branding
    const left = form?.headerLeftImageUrl || instituteSettings?.receiptLeftImageUrl;
    if (left) try { doc.addImage(left, 'PNG', 10, 5, 30, 35, undefined, 'FAST'); } catch(e) {}

    // Right Branding
    const right = form?.headerRightImageUrl || instituteSettings?.receiptRightImageUrl;
    if (right) try { doc.addImage(right, 'PNG', 170, 5, 30, 35, undefined, 'FAST'); } catch(e) {}

    // Center Logo
    const logo = form?.logoUrl || instituteSettings?.logoUrl;
    if (logo) try { doc.addImage(logo, 'PNG', 95, 5, 20, 20, undefined, 'FAST'); } catch(e) {}

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(form?.department || instituteSettings?.instituteName || 'MAKTAB WALI UL ASR', 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(form?.title || 'Official Submission Record', 105, 38, { align: 'center' });

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.text('Submission Receipt', 20, 60);
    
    const totalPoints = form?.questions.reduce((acc, q) => acc + (q.points || 0), 0);
    const score = data.totalScore !== undefined ? data.totalScore : 0;
    const percentage = totalPoints && totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

    const tableData = [
      ['Submission ID', data.id.substring(0, 8).toUpperCase()],
      ['Name', data.userName],
      ['Roll No', data.userRollNo || 'External'],
      ['Score Achieved', `${score} / ${totalPoints || 'N/A'} (${percentage}%)`],
      ['Time', safelyFormatDate(data.submittedAt, 'PPP p')],
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

  const handleSubmit = async (e?: React.FormEvent, isAutoSubmit = false, customResponses?: any) => {
    if (e) e.preventDefault();
    if (!form || !id) return;

    const currentResponses = customResponses || responses;

    if (!isAutoSubmit) {
      const missing = form.questions.filter(q => q.required && !currentResponses[q.id]);
      if (missing.length > 0) {
        alert('Please fill all required fields: ' + missing.map(m => m.label).join(', '));
        return;
      }
    }

    setSubmitting(true);
    try {
      let isDuplicate = false;
      const q = query(collection(db, 'form_responses'), where('formId', '==', id));
      const existingSubmissions = await getDocs(q);
      
      const userMatch = user && existingSubmissions.docs.some(doc => doc.data().userId === user.uid);
      const ipMatch = existingSubmissions.docs.some(doc => doc.data().ipAddress === ipAddress);
      
      if (userMatch || ipMatch) isDuplicate = true;

      // Handle External ID Generation
      let externalId = currentResponses['rollNo'] || localStorage.getItem(`ext_id_${id}`);
      if (!user && !externalId) {
        externalId = 'EXT-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        localStorage.setItem(`ext_id_${id}`, externalId);
      }

      const payload: any = {
        formId: id,
        userId: user?.uid || null,
        userEmail: user?.email || (currentResponses['email'] || 'anonymous@institution.com'),
        userName: user?.displayName || (currentResponses['name'] || 'Guest Participant'),
        userRollNo: user?.rollNo || externalId,
        ipAddress,
        responses: form.questions.map(q => ({
          questionId: q.id,
          answer: currentResponses[q.id] || (isAutoSubmit ? 'Out of Time / Auto-filled' : '')
        })),
        submittedAt: Date.now(),
        isDuplicate,
        isAutoSubmit,
        browserInfo: navigator.userAgent
      };

      // Auto-grading if it's an exam and questions have correctAnswers
      if (form.type === 'exam') {
        let totalScore = 0;
        payload.responses = payload.responses.map((r: any) => {
          const question = form.questions.find(fq => fq.id === r.questionId);
          if (question?.correctAnswer) {
            const isCorrect = Array.isArray(question.correctAnswer) 
              ? JSON.stringify(question.correctAnswer.sort()) === JSON.stringify((r.answer || []).sort())
              : r.answer === question.correctAnswer;
            
            if (isCorrect) totalScore += (question.points || 0);
            return { ...r, isCorrect, score: isCorrect ? (question.points || 0) : 0 };
          }
          return r;
        });
        payload.totalScore = totalScore;
      }

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
      setError('Failed to submit. Please check your internet connection or try again.');
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
            onChange={(e) => {
              const val = e.target.value;
              setResponses({ ...responses, [q.id]: val });
              handleSmartAutofill(q.id, val);
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, height: 48 } }}
          />
        );
    }
  };

  const isStaffView = user?.role === 'superadmin' || user?.uid === form?.createdBy || user?.role === 'manager';

  const handlePrint = () => {
    window.print();
  };

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

  if (form?.resultsPublished && (userSubmission || lastSubmission)) {
    const data = userSubmission || lastSubmission;
    const totalPoints = form.questions.reduce((acc, q) => acc + (q.points || 0), 0);
    const score = data.totalScore !== undefined ? data.totalScore : 0;
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card sx={{ borderRadius: 8, boxShadow: '0 25px 60px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ bgcolor: primaryColor, p: 4, color: 'white', textAlign: 'center' }}>
              <Award size={64} style={{ marginBottom: 16 }} />
              <Typography variant="h4" sx={{ fontWeight: 1000, mb: 1, fontFamily: '"Cinzel Decorative", serif' }}>Exam Results Declared</Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>Congratulations on completing the assessment!</Typography>
            </Box>
            <CardContent sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 4, color: 'text.secondary' }}>{form.title}</Typography>
              
              <Grid container spacing={4} justifyContent="center" sx={{ mb: 6 }}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: alpha(primaryColor, 0.05), border: '1px solid', borderColor: alpha(primaryColor, 0.1) }}>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: primaryColor, letterSpacing: 1.5 }}>SCORE</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 1000, color: primaryColor }}>{score}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Out of {totalPoints}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: alpha(primaryColor, 0.05), border: '1px solid', borderColor: alpha(primaryColor, 0.1) }}>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: primaryColor, letterSpacing: 1.5 }}>PERCENTAGE</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 1000, color: primaryColor }}>{percentage}%</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Overall Performance</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 4 }} />

              <Stack direction="row" spacing={2} justifyContent="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
                <Button 
                  variant="contained" 
                  startIcon={<FileDown size={20} />}
                  onClick={() => generateReceiptPDF(data)}
                  sx={{ 
                    borderRadius: 3, fontWeight: 900, px: 4, py: 1.5,
                    bgcolor: primaryColor,
                    '&:hover': { bgcolor: alpha(primaryColor, 0.9) }
                  }}
                >
                  Download Result Card (PDF)
                </Button>
                <Button 
                  variant="outlined" 
                  startIcon={<ArrowLeft size={18} />}
                  onClick={() => navigate('/forms')}
                  sx={{ borderRadius: 3, fontWeight: 900, px: 3 }}
                >
                  Back to Portal
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </motion.div>
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
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{safelyFormatDate(lastSubmission.submittedAt, 'MMM d, p')}</Typography>
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
    <Box sx={{ 
      bgcolor: 'transparent', 
      minHeight: '100vh', 
      pb: 10,
      width: '100vw',
      position: 'relative',
      overflow: 'hidden',
      '@media print': {
        bgcolor: 'white !important',
        p: 0,
        width: '210mm',
        '& .no-print': { display: 'none' }
      }
    }}>
      {/* Dynamic Progress Bar & Timer (Sticky) - No Print */}
      <Box className="no-print" sx={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1500,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {isStaffView && form?.status === 'published' && (
          <Box sx={{ 
            bgcolor: 'primary.main', 
            color: 'white', 
            py: 0.5, 
            textAlign: 'center',
            boxShadow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}>
            <ShieldCheck size={14} />
            <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
              Staff Preview Mode
            </Typography>
          </Box>
        )}
        
        {timeLeft !== null && (
          <Box sx={{ 
            bgcolor: timeLeft < 120 ? 'error.main' : 'background.paper', 
            color: timeLeft < 120 ? 'white' : 'text.primary',
            py: 1,
            px: 3,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            boxShadow: 2,
            transition: 'all 0.3s ease'
          }}>
            <Clock size={18} className={timeLeft < 120 ? 'animate-pulse' : ''} />
            <Typography variant="h6" sx={{ fontWeight: 1000, fontFamily: 'monospace' }}>
              {formatTime(timeLeft)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', opacity: 0.8 }}>
              {timeLeft < 120 ? 'STRICT DEADLINE: HURRY' : 'TIME REMAINING'}
            </Typography>
          </Box>
        )}

        {form?.showProgressBar && (
          <LinearProgress 
            variant="determinate" 
            value={calculateProgress()} 
            sx={{ height: 4, bgcolor: alpha(form.primaryColor || theme.palette.primary.main, 0.1) }}
          />
        )}
      </Box>

      {/* Standalone Branding Banner */}
      {instituteBanner && (
        <Box sx={{ 
          height: { xs: 120, md: 240 }, 
          width: '100%', 
          position: 'relative',
          backgroundImage: `url(${instituteBanner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mb: { xs: 2, md: 4 },
          '@media print': {
            height: 120,
            mb: 2
          }
        }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0))' }} />
        </Box>
      )}

      <Container maxWidth="lg" sx={{ pt: instituteBanner ? 4 : 8 }}>
        <Box className="no-print" sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button 
            startIcon={<ArrowLeft size={22} />} 
            onClick={() => navigate(-1)}
            sx={{ fontWeight: 900, borderRadius: 4, color: 'text.secondary', minHeight: 48, px: 3, bgcolor: 'background.paper', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
          >
            Exit Preview
          </Button>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button 
                variant="outlined" 
                startIcon={<Share2 size={18} />}
                onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url);
                  alert('Shareable link copied to clipboard!');
                }}
                sx={{ fontWeight: 900, borderRadius: 4, px: 3, height: 48 }}
              >
                Share
            </Button>
            <Button
              variant="outlined"
              onClick={handlePrint}
              startIcon={<FileDown size={20} />}
              sx={{ fontWeight: 900, borderRadius: 4, px: 3, height: 48 }}
            >
              Print A4
            </Button>
            {form?.showProgressBar && (
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', bgcolor: 'background.paper', px: 3, py: 1, borderRadius: 5, boxShadow: 2, fontSize: '0.8rem' }}>
                {calculateProgress()}% Ready
              </Typography>
            )}
          </Stack>
        </Box>

        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}>
          {/* Header Section - Transparent with Logo */}
          <Box sx={{ mb: 8, textAlign: 'center', position: 'relative', bgcolor: 'transparent' }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', md: 'center' }, 
        mb: 6,
        gap: { xs: 2, md: 6 },
        px: { xs: 2, md: 6 },
        bgcolor: 'transparent'
      }}>
        <Stack direction="row" spacing={3} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Box sx={{ width: { xs: 80, md: 120 }, height: { xs: 80, md: 120 }, bgcolor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(form?.logoUrl || instituteSettings?.logoUrl) && (
              <Box 
                component="img" 
                src={form?.logoUrl || instituteSettings?.logoUrl} 
                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', bgcolor: 'transparent' }} 
              />
            )}
          </Box>
          <Box sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'left' }}>
            <Typography variant="h5" sx={{ fontWeight: 1000, fontFamily: '"Cinzel Decorative", serif', color: 'text.primary' }}>
              {form?.department || instituteSettings?.instituteName || 'MAKTAB'}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, color: primaryColor, fontSize: '0.9rem' }}>
              {form?.title}
            </Typography>
          </Box>
        </Stack>
        
        <Box sx={{ textAlign: 'center', flex: 1, px: 4, bgcolor: 'transparent', display: { xs: 'none', md: 'block' } }}>
          <Typography variant="h1" sx={{ 
            fontWeight: 1000, 
            fontFamily: '"Cinzel Decorative", serif', 
            color: 'text.primary', 
            letterSpacing: -1.5, 
            fontSize: { xs: '1.2rem', sm: '2rem', md: '2.8rem' },
            lineHeight: 1,
            mb: 1.5
          }}>
            {form?.department || instituteSettings?.instituteName || 'MAKTAB WALI UL ASR'}
          </Typography>
          <Typography variant="h3" sx={{ 
            fontWeight: 950, 
            color: primaryColor, 
            letterSpacing: -1, 
            fontSize: { xs: '1.4rem', sm: '2.2rem', md: '3.2rem' },
            lineHeight: 1.1,
            mb: 1
          }}>
            {form?.title}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Typography variant="subtitle1" sx={{ 
              fontWeight: 900, 
              letterSpacing: '0.4rem', 
              textTransform: 'uppercase',
              color: 'text.secondary',
              mt: 2,
              px: 4,
              py: 0.5,
              borderTop: '2px solid',
              borderBottom: '2px solid',
              borderColor: alpha(theme.palette.divider, 0.1),
              fontSize: '0.75rem'
            }}>
              Official Institutional Assessment Portal
            </Typography>
          </Box>
        </Box>

        <Box sx={{ width: { xs: '100%', md: 120 }, height: { xs: 50, md: 120 }, bgcolor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'center' } }}>
          {(form?.headerRightImageUrl || instituteSettings?.receiptRightImageUrl) && (
            <Box 
              component="img" 
              src={form?.headerRightImageUrl || instituteSettings?.receiptRightImageUrl} 
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', bgcolor: 'transparent' }} 
            />
          )}
        </Box>
      </Box>

            <Box sx={{ maxWidth: '850px', mx: 'auto', px: 3 }}>
              <Typography variant="body1" sx={{ 
                color: 'text.secondary', 
                lineHeight: 2, 
                fontSize: { xs: '1rem', md: '1.25rem' },
                fontWeight: 500,
                mb: 4
              }}>
                {form?.description}
              </Typography>
              
              <Stack direction="row" spacing={4} flexWrap="wrap" justifyContent="center">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                  <ShieldCheck size={18} />
                  <Typography variant="body2" sx={{ fontWeight: 900, letterSpacing: 1 }}>VERIFIED PROTOCOL</Typography>
                </Box>
                {form?.anonymous && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'primary.main' }}>
                    <Globe size={18} />
                    <Typography variant="body2" sx={{ fontWeight: 900, letterSpacing: 1 }}>OPEN ACCESS PORTAL</Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          </Box>

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              {/* Identity Section if Non-Student/Anonymous */}
              {form?.allowNonStudents && !user && !form?.anonymous && (
                <Card sx={{ 
                  borderRadius: 5, 
                  bgcolor: alpha(theme.palette.info.main, 0.05),
                  border: '1px dashed',
                  borderColor: 'info.main'
                }}>
                  <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                      <User size={20} color={theme.palette.info.main} />
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>Guest Identification</Typography>
                    </Box>
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField 
                          fullWidth 
                          required 
                          label="Your Full Name" 
                          value={responses['name'] || ''}
                          onChange={(e) => setResponses({ ...responses, name: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField 
                          fullWidth 
                          required 
                          type="email"
                          label="Email Address" 
                          value={responses['email'] || ''}
                          onChange={(e) => setResponses({ ...responses, email: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Logged in User Badge */}
              {!form?.anonymous && user && (
                <Paper elevation={0} sx={{ py: 1.5, px: 3, borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.1) }}>
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main', fontWeight: 900 }}>{user.displayName?.charAt(0)}</Avatar>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 900, display: 'block', lineHeight: 1 }}>Submitting as {user.displayName}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>{user.email}</Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {form?.questions.map((q, index) => (
                <motion.div key={q.id} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.05 }}>
                  <Card sx={{ 
                    borderRadius: 8, 
                    bgcolor: alpha(theme.palette.background.paper, 0.95),
                    backdropFilter: 'blur(30px)',
                    boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.04)}`, 
                    border: '1px solid', 
                    borderColor: alpha(theme.palette.primary.main, 0.08),
                    position: 'relative',
                    overflow: 'visible',
                    '@media print': { 
                      boxShadow: 'none', 
                      border: '1px solid #eee', 
                      breakInside: 'avoid', 
                      mb: 4,
                      bgcolor: 'white'
                    }
                  }}>
                    <CardContent sx={{ p: { xs: 4, md: 8 } }}>
                      <Stack direction="row" spacing={3} sx={{ mb: 4 }}>
                        <Box sx={{ 
                          width: 44, 
                          height: 44, 
                          borderRadius: 3, 
                          bgcolor: alpha(primaryColor, 0.1), 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: `0 4px 10px ${alpha(primaryColor, 0.15)}`
                        }}>
                          <Typography variant="h6" sx={{ fontWeight: 1000, color: primaryColor }}>{index + 1}</Typography>
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 1000, color: 'text.primary', fontSize: { xs: '1.25rem', md: '1.6rem' }, letterSpacing: -0.5, lineHeight: 1.2 }}>
                          {q.label} {q.required && <Typography component="span" color="error" variant="h4" sx={{ fontWeight: 1000, position: 'relative', top: 4 }}>*</Typography>}
                        </Typography>
                      </Stack>
                      {renderQuestion(q)}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              
              <Paper className="no-print" elevation={0} sx={{ p: 3, borderRadius: 5, bgcolor: alpha(theme.palette.success.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.1), display: 'flex', alignItems: 'center', gap: 2 }}>
                <ShieldCheck size={20} color={theme.palette.success.main} />
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Secure Submission: Your data is protected by industry-standard encryption.
                </Typography>
              </Paper>

              <Box className="no-print" sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: 'flex-end', pt: 3, gap: 2 }}>
                <Button 
                   variant="text" 
                   sx={{ borderRadius: 3, fontWeight: 900, color: 'text.secondary', minHeight: 48 }}
                   onClick={() => window.location.reload()}
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
                  {submitting ? 'Authenticating...' : 'Submit Final Response'}
                </Button>
              </Box>
            </Stack>
          </form>
        </motion.div>
      </Container>
    </Box>
  );
}

