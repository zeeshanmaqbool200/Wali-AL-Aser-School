import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, Grid, Card, CardContent, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, Stack, alpha, useTheme, Divider, Avatar
} from '@mui/material';
import { 
  BarChart3, Download, ArrowLeft, MoreVertical, 
  FileSpreadsheet, FileDown, AlertTriangle, User,
  FileText
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { FormSchema, FormResponse } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { format } from 'date-fns';
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
      format(res.submittedAt, 'MMM d, p'),
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

  const exportCSV = () => {
    if (!form || responses.length === 0) return;
    
    const headers = ['Name', 'Email', 'Roll No', 'Date', 'IP', 'Duplicate'];
    form.questions.forEach(q => headers.push(q.label));

    const rows = responses.map(res => {
      const row = [
        res.userName || 'Anonymous',
        res.userEmail || 'N/A',
        res.userRollNo || 'N/A',
        format(res.submittedAt, 'yyyy-MM-dd HH:mm'),
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

        {/* Response Table */}
        <Grid size={12}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>Recent Submissions</Typography>
              <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Respondent</TableCell>
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Identifier</TableCell>
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Submitted At</TableCell>
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Integrity</TableCell>
                      <TableCell sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.7rem' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {responses.map((res) => (
                      <TableRow key={res.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontSize: '0.8rem', fontWeight: 800 }}>
                              {res.userName?.charAt(0) || 'A'}
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
                            {format(res.submittedAt, 'MMM d, h:mm a')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {res.isDuplicate ? (
                            <Chip 
                              icon={<AlertTriangle size={14} />} 
                              label="Duplicate Detected" 
                              size="small" 
                              color="error" 
                              sx={{ fontWeight: 800, fontSize: '0.65rem' }} 
                            />
                          ) : (
                            <Chip 
                              label="Original Submission" 
                              size="small" 
                              color="success" 
                              variant="outlined"
                              sx={{ fontWeight: 800, fontSize: '0.65rem' }} 
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small">
                            <MoreVertical size={16} />
                          </IconButton>
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
    </Container>
  );
}
