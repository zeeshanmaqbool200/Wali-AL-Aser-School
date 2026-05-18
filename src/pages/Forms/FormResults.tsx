import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, Grid, Card, CardContent, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, Stack, alpha, useTheme, Divider, Avatar
} from '@mui/material';
import { 
  BarChart3, Download, ArrowLeft, MoreVertical, 
  FileSpreadsheet, FileDown, AlertTriangle, User,
  FileText, Eye, Award, Globe, CheckCircle
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { FormSchema, FormResponse } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { safelyFormatDate } from '../../lib/dateUtils';
import { 
  Dialog, DialogTitle, DialogContent, Table as MuiTable, Snackbar, Alert
} from '@mui/material';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function FormResults() {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const { instituteSettings } = useAuth();

  const [form, setForm] = useState<FormSchema | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewSubmission, setViewSubmission] = useState<FormResponse | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    if (!id) return;

    const unsubForm = onSnapshot(doc(db, 'forms', id), (snapshot) => {
      if (snapshot.exists()) {
        setForm({ id: snapshot.id, ...snapshot.data() } as FormSchema);
      }
    });

    const q = query(collection(db, 'form_responses'), where('formId', '==', id));
    const unsubResponses = onSnapshot(q, (snapshot) => {
      setResponses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FormResponse[]);
      setLoading(false);
    });

    return () => {
      unsubForm();
      unsubResponses();
    };
  }, [id]);

  const generateReportPDF = () => {
    if (!form) return;
    const doc = new jsPDF() as any;

    // Header logic
    doc.setFillColor(form.primaryColor || '#000000');
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(`Result Sheet: ${form.title}`, 20, 25);
    
    doc.setFontSize(10);
    doc.text(`Total Responses: ${responses.length}`, 20, 35);

    const tableData = responses.map(res => [
      res.userName || 'Anonymous',
      res.userEmail || 'N/A',
      res.userRollNo || 'N/A',
      safelyFormatDate(res.submittedAt, 'MMM d, p'),
      res.isDuplicate ? 'YES' : 'NO'
    ]);

    doc.autoTable({
      startY: 50,
      head: [['Respondent Name', 'Email', 'Roll No', 'Date Submitted', 'Duplicate?']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [4, 47, 46], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`${form.title}_Results.pdf`);
  };

  const generateCertificate = (res: FormResponse) => {
    if (!form) return;
    const doc = new jsPDF('l', 'mm', 'a4') as any;

    // Background Accent
    doc.setFillColor(form.primaryColor || '#0ea5e9');
    doc.rect(0, 0, 297, 15, 'F');
    doc.rect(0, 195, 297, 15, 'F');

    // Ornamental Border
    doc.setDrawColor(form.primaryColor || '#0ea5e9');
    doc.setLineWidth(1);
    doc.rect(10, 25, 277, 160, 'S');

    // Logo
    const logo = form.logoUrl || instituteSettings?.logoUrl;
    if (logo) try { doc.addImage(logo, 'PNG', 138, 30, 20, 20); } catch(e) {}

    doc.setTextColor(4, 47, 46);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(form?.department || instituteSettings?.instituteName || 'MAKTAB WALI UL ASR', 148, 65, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('AWARDS THIS OFFICIAL COMPLIANCE CERTIFICATE TO', 148, 80, { align: 'center' });

    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(form.primaryColor || '#0ea5e9');
    doc.text(res.userName || 'Valued Participant', 148, 105, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`For successful participation in the ${form.title}`, 148, 125, { align: 'center' });

    const scoreText = res.totalScore !== undefined ? `SCORE ACHIEVED: ${res.totalScore} POINTS` : 'COMPLIANCE VERIFIED';
    doc.setFont('helvetica', 'bold');
    doc.text(scoreText, 148, 135, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Official ID: ${res.userRollNo || 'External'}`, 148, 155, { align: 'center' });
    doc.text(`Verification Date: ${safelyFormatDate(res.submittedAt, 'PPP')}`, 148, 162, { align: 'center' });
    doc.text(`Digital Sign: ${res.id.substring(0, 12)}`, 148, 169, { align: 'center' });

    doc.save(`Certificate_${res.userName}_${form.title}.pdf`);
  };

  const publishResults = async () => {
    if (!id || !form) return;
    try {
      await updateDoc(doc(db, 'forms', id), { resultsPublished: !form?.resultsPublished });
    } catch (err: any) {
      setSnackbar({ open: true, message: 'Failed to update publication', severity: 'error' });
    }
  };

  const leaderboard = [...responses]
    .filter(r => !r.isDuplicate)
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
    .slice(0, 5);

  const exportCSV = () => {
    if (!form || responses.length === 0) return;
    
    const headers = ['Name', 'Email', 'Roll No', 'Date', 'IP', 'Duplicate'];
    form.questions.forEach(q => headers.push(q.label));

    const rows = responses.map(res => {
      const row = [
        res.userName || 'Anonymous',
        res.userEmail || 'N/A',
        res.userRollNo || 'N/A',
        safelyFormatDate(res.submittedAt, 'yyyy-MM-dd HH:mm'),
        res.ipAddress,
        res.isDuplicate ? 'True' : 'False'
      ];
      form.questions.forEach(q => {
        const ans = res.responses.find(r => r.questionId === q.id)?.answer;
        row.push(Array.isArray(ans) ? ans.join('; ') : String(ans || ''));
      });
      return row.join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${form.title}_Responses.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const getAnalyticsData = (q: any) => {
    if (!['multiple_choice', 'checkbox', 'dropdown'].includes(q.type)) return null;
    
    const counts: Record<string, number> = {};
    responses.forEach(res => {
      const ans = res.responses.find(r => r.questionId === q.id)?.answer;
      if (Array.isArray(ans)) {
        ans.forEach(val => counts[val] = (counts[val] || 0) + 1);
      } else if (ans) {
        counts[ans] = (counts[ans] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
        <IconButton onClick={() => navigate('/forms')}>
          <ArrowLeft />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: -1, fontFamily: '"Cinzel Decorative", serif' }}>
            Results & Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {form?.title} • {responses.length} Submissions
          </Typography>
        </Box>
        <Button
          variant={form?.resultsPublished ? "contained" : "outlined"}
          color={form?.resultsPublished ? "success" : "primary"}
          startIcon={form?.resultsPublished ? <CheckCircle size={18} /> : <Globe size={18} />}
          onClick={publishResults}
          sx={{ borderRadius: 3, fontWeight: 900, px: 3 }}
        >
          {form?.resultsPublished ? "Results Public" : "Publish Results"}
        </Button>
        <Button 
          variant="contained" 
          startIcon={<FileSpreadsheet size={18} />} 
          onClick={exportCSV}
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
          Export CSV
        </Button>
        <Button 
          variant="contained" 
          startIcon={<FileDown size={18} />} 
          onClick={generateReportPDF}
          sx={{ 
            borderRadius: 3, 
            fontWeight: 900,
            px: 3,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 12px 20px ${alpha(theme.palette.primary.main, 0.4)}`
            }
          }}
        >
          Result Sheet (PDF)
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* Summary Widgets */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.05), border: 'none' }}>
            <CardContent>
              <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', color: 'primary.main' }}>Total Responses</Typography>
              <Typography variant="h3" sx={{ fontWeight: 950 }}>{responses.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 4, bgcolor: alpha(theme.palette.error.main, 0.05), border: 'none' }}>
            <CardContent>
              <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', color: 'error.main' }}>Duplicate Flags</Typography>
              <Typography variant="h3" sx={{ fontWeight: 950 }}>{responses.filter(r => r.isDuplicate).length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 4, bgcolor: alpha(theme.palette.success.main, 0.05), border: 'none' }}>
            <CardContent>
              <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', color: 'success.main' }}>Completion Rate</Typography>
              <Typography variant="h3" sx={{ fontWeight: 950 }}>100%</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Visual Analytics */}
        {form?.questions.filter(q => ['multiple_choice', 'checkbox', 'dropdown'].includes(q.type)).map((q) => {
          const data = getAnalyticsData(q);
          if (!data) return null;
          return (
            <Grid key={q.id} size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 4, height: 400 }}>
                <CardContent sx={{ height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>{q.label}</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip 
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="value" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          );
        })}

        {/* Leaderboard Section */}
        {form?.type === 'exam' && leaderboard.length > 0 && (
          <Grid size={12}>
            <Card sx={{ 
              borderRadius: 5, 
              mb: 2, 
              boxShadow: '0 12px 24px rgba(0,0,0,0.05)', 
              overflow: 'hidden',
              background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${alpha(theme.palette.secondary.main, 0.85)} 100%)`,
              color: 'white'
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 2 }}>
                <Award size={24} />
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Top Performers | Leaderboard</Typography>
              </CardContent>
              <TableContainer sx={{ bgcolor: 'white', borderTop: '4px solid', borderColor: 'secondary.dark' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Rank</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Student Name</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Roll No</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaderboard.map((res, idx) => (
                      <TableRow key={res.id} hover>
                        <TableCell>
                          <Typography sx={{ fontWeight: 900, color: idx === 0 ? 'orange' : idx === 1 ? 'silver' : idx === 2 ? 'brown' : 'text.primary' }}>
                            #{idx + 1}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{res.userName}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{res.userRollNo}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${res.totalScore} pts`} 
                            color={idx === 0 ? "secondary" : "default"} 
                            size="small" 
                            sx={{ fontWeight: 800 }} 
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>
        )}

        {/* Response Table */}
        <Grid size={12}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Recent Submissions</Typography>
                {form?.type === 'exam' && (
                  <Chip 
                    label="Leaderboard Ranking (Top Scores)" 
                    color="primary" 
                    size="small" 
                    icon={<Award size={14} />}
                    sx={{ fontWeight: 800, borderRadius: 2 }}
                  />
                )}
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Respondent</TableCell>
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Identifier</TableCell>
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Submitted At</TableCell>
                      {form?.type === 'exam' && <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Score</TableCell>}
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {responses.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).map((res, index) => (
                      <TableRow key={res.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontSize: '0.8rem', fontWeight: 800 }}>
                              {form?.type === 'exam' ? index + 1 : (res.userName?.charAt(0) || 'A')}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{res.userName || 'Anonymous Respondent'}</Typography>
                              <Typography variant="caption" color="text.secondary">{res.userEmail}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontWeight: 800, bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}>
                            ID: {res.userRollNo || 'External'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {safelyFormatDate(res.submittedAt, 'MMM d, h:mm a')}
                          </Typography>
                        </TableCell>
                        {form?.type === 'exam' && (
                          <TableCell>
                            <Chip 
                              label={`${res.totalScore || 0} pts`} 
                              color={(res.totalScore || 0) > 50 ? 'success' : 'warning'}
                              size="small" 
                              sx={{ fontWeight: 800, fontSize: '0.65rem' }} 
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <IconButton size="small" onClick={() => setViewSubmission(res)} color="primary">
                              <Eye size={16} />
                            </IconButton>
                            <IconButton size="small" onClick={() => generateCertificate(res)} sx={{ color: 'secondary.main' }}>
                              <Award size={16} />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Individual View Dialog */}
      <Dialog 
        open={Boolean(viewSubmission)} 
        onClose={() => setViewSubmission(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
          Submission Details - {viewSubmission?.userName}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {viewSubmission && form && (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>Details</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 800 }}>ID: {viewSubmission.userRollNo}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>IP: {viewSubmission.ipAddress}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>Date</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{safelyFormatDate(viewSubmission.submittedAt, 'PPP pp')}</Typography>
                  {viewSubmission.isAutoSubmit && <Chip label="Auto-Submitted" color="error" size="small" sx={{ mt: 1, fontWeight: 800, height: 20 }} />}
                </Grid>
                {viewSubmission.totalScore !== undefined && (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>Score</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 1000, color: 'primary.main' }}>{viewSubmission.totalScore} Points</Typography>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      startIcon={<Award size={14} />} 
                      onClick={() => generateCertificate(viewSubmission)}
                      sx={{ mt: 1, borderRadius: 2, fontWeight: 800 }}
                    >
                      Print Result Card
                    </Button>
                  </Grid>
                )}
              </Grid>

              <Divider sx={{ borderStyle: 'dashed' }} />

              <Stack spacing={2.5}>
                {form.questions.map((q, idx) => {
                  const resp = viewSubmission.responses.find(r => r.questionId === q.id);
                  return (
                    <Box key={q.id} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, display: 'flex', gap: 1 }}>
                        <span style={{ opacity: 0.5 }}>{idx + 1}.</span> {q.label}
                      </Typography>
                      {resp ? (
                        <Box>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 700, 
                            color: q.correctAnswer ? (resp.isCorrect ? 'success.main' : 'error.main') : 'text.primary',
                            p: 1.5,
                            bgcolor: 'background.paper',
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}>
                            {Array.isArray(resp.answer) ? resp.answer.join(', ') : (String(resp.answer) || 'No Answer')}
                          </Typography>
                          {q.correctAnswer && !resp.isCorrect && (
                            <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block', fontWeight: 800 }}>
                              Correct Answer: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="error" sx={{ fontWeight: 800 }}>Not Answered / Question Skipped</Typography>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          sx={{ width: '100%', borderRadius: 3, fontWeight: 800 }}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
