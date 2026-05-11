import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, Card, CardContent, Grid, 
  Chip, IconButton, Stack, alpha, useTheme 
} from '@mui/material';
import { 
  Plus, FileText, BarChart3, Clock, Lock, Globe, Edit, Trash2, 
  ExternalLink, FileDown, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, query, onSnapshot, orderBy, doc, deleteDoc, where 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { FormSchema } from '../../types';
import { motion } from 'motion/react';
import { format } from 'date-fns';

export default function FormManager() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // RBAC: Teachers see only their own, Admins see all
    let q = query(collection(db, 'forms'), orderBy('createdAt', 'desc'));
    
    if (user.role === 'teacher') {
      q = query(collection(db, 'forms'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      setForms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FormSchema[]);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this form? All responses will remain but the form definition will be gone.')) {
      await deleteDoc(doc(db, 'forms', id));
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'published': return <Chip label="Live" color="success" size="small" variant="filled" sx={{ fontWeight: 800 }} />;
      case 'closed': return <Chip label="Closed" color="error" size="small" variant="filled" sx={{ fontWeight: 800 }} />;
      default: return <Chip label="Draft" color="default" size="small" variant="filled" sx={{ fontWeight: 800 }} />;
    }
  };

  const getTypeChip = (type: string) => {
    switch (type) {
      case 'exam': return <Chip label="Exam" color="primary" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
      case 'survey': return <Chip label="Survey" color="secondary" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
      default: return <Chip label="Registration" color="info" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
    }
  };

  const isStaff = user?.role === 'superadmin' || user?.role === 'manager' || user?.role === 'teacher';
  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, fontFamily: '"Cinzel Decorative", serif' }}>
            Forms & Exams
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create and manage institution forms, surveys, and assessments.
          </Typography>
        </Box>
        {isStaff && (
          <Button 
            variant="contained" 
            startIcon={<Plus size={18} />}
            onClick={() => navigate('/forms/build')}
            sx={{ 
              borderRadius: 3, 
              fontWeight: 900, 
              px: 3,
              py: 1.2,
              background: `linear-gradient(134deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
              border: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.45)}`,
              }
            }}
          >
            Create New Form
          </Button>
        )}
      </Stack>

      <Grid container spacing={3}>
        {forms.map((form) => (
          <Grid key={form.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <motion.div whileHover={{ y: -5 }}>
              <Card sx={{ 
                height: '100%', 
                borderRadius: 4, 
                border: '1px solid',
                borderColor: 'divider',
                position: 'relative',
                overflow: 'visible',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.1)}`
                }
              }}>
                {/* Visual Accent */}
                <Box sx={{ 
                  position: 'absolute', top: 0, left: 0, right: 0, height: 4, 
                  bgcolor: form.primaryColor || 'primary.main',
                  borderRadius: '4px 4px 0 0'
                }} />

                <CardContent sx={{ pt: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {getStatusChip(form.status)}
                      {getTypeChip(form.type)}
                    </Box>
                    {isStaff && (
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" onClick={() => navigate(`/forms/build?id=${form.id}`)} sx={{ color: 'text.secondary' }}>
                          <Edit size={16} />
                        </IconButton>
                        {isSuperAdmin && (
                          <IconButton size="small" onClick={() => handleDelete(form.id)} color="error" sx={{ opacity: 0.6 }}>
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                      </Stack>
                    )}
                  </Stack>

                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>
                    {form.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ 
                    mb: 2, height: 40, overflow: 'hidden', display: '-webkit-box', 
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' 
                  }}>
                    {form.description}
                  </Typography>

                  <Stack spacing={1} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                      <Clock size={14} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {form.startDate ? format(form.startDate, 'MMM d, h:mm a') : 'No Start Date'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                      {form.allowNonStudents ? <Globe size={14} /> : <Lock size={14} />}
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {form.allowNonStudents ? 'Publicly Available' : 'Restricted to Students'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Grid container spacing={1.5}>
                    <Grid size={6}>
                      <Button 
                        fullWidth 
                        size="medium" 
                        variant="contained"
                        startIcon={<Eye size={16} />}
                        onClick={() => navigate(`/forms/view/${form.id}`)}
                        sx={{ 
                          borderRadius: 3, 
                          fontWeight: 800,
                          py: 1,
                          background: `linear-gradient(135deg, ${alpha(form.primaryColor || theme.palette.primary.main, 0.25)} 0%, ${alpha(form.primaryColor || theme.palette.primary.main, 0.1)} 100%)`,
                          border: '1px solid',
                          borderColor: alpha(form.primaryColor || theme.palette.primary.main, 0.3),
                          color: form.primaryColor || theme.palette.primary.main,
                          boxShadow: 'none',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            borderColor: form.primaryColor || theme.palette.primary.main,
                            bgcolor: alpha(form.primaryColor || theme.palette.primary.main, 0.15),
                            transform: 'translateY(-2px)',
                            boxShadow: `0 4px 12px ${alpha(form.primaryColor || theme.palette.primary.main, 0.15)}`
                          }
                        }}
                      >
                        Preview
                      </Button>
                    </Grid>
                    {isStaff && (
                      <Grid size={6}>
                        <Button 
                          fullWidth 
                          size="medium" 
                          variant="contained"
                          startIcon={<BarChart3 size={16} />}
                          onClick={() => navigate(`/forms/results/${form.id}`)}
                          sx={{ 
                            borderRadius: 3, 
                            fontWeight: 800,
                            py: 1,
                            background: `linear-gradient(135deg, ${form.primaryColor || theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                            boxShadow: `0 6px 15px ${alpha(form.primaryColor || theme.palette.primary.main, 0.3)}`,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            border: 'none',
                            color: 'white',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: `0 8px 20px ${alpha(form.primaryColor || theme.palette.primary.main, 0.4)}`,
                              filter: 'brightness(1.1)'
                            }
                          }}
                        >
                          Results
                        </Button>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}

        {forms.length === 0 && !loading && (
          <Grid size={12}>
            <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
              <FileText size={48} style={{ marginBottom: 16 }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>No forms found</Typography>
              <Typography variant="body2">Create your first exam or registration form.</Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
