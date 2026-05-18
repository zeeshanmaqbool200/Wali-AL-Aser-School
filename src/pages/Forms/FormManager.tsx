import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Button, Card, CardContent, Grid, 
  Chip, IconButton, Stack, alpha, useTheme, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Zoom
} from '@mui/material';
import { 
  Plus, FileText, BarChart3, Clock, Lock, Globe, Edit, Trash2, 
  ExternalLink, FileDown, Eye, Share2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, query, onSnapshot, orderBy, doc, deleteDoc, where 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { FormSchema } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { safelyFormatDate } from '../../lib/dateUtils';

export default function FormManager() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const handleShare = (id: string) => {
    const url = `${window.location.origin}/forms/view/${id}`;
    navigator.clipboard.writeText(url);
    setSnackbar({ open: true, message: 'Share link copied to clipboard!', severity: 'success' });
  };

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

  const handleDelete = async () => {
    const idToDelete = deleteDialog.id;
    if (!idToDelete) return;
    
    setDeleteDialog({ open: false, id: null });
    try {
      await deleteDoc(doc(db, 'forms', idToDelete));
      setSnackbar({ open: true, message: 'Form deleted successfully!', severity: 'success' });
    } catch (error: any) {
      console.error('Delete error:', error);
      setSnackbar({ open: true, message: `Failed to delete form: ${error.message}`, severity: 'error' });
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
        <AnimatePresence mode="popLayout">
          {forms.map((form) => (
            <Grid key={form.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                whileHover={{ y: -5 }}
              >
                <Card sx={{ 
                  height: '100%', 
                  borderRadius: 4, 
                  border: '1px solid',
                  borderColor: 'divider',
                  position: 'relative',
                  overflow: 'visible',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 12px 24px ${alpha(form.primaryColor || theme.palette.primary.main, 0.1)}`
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
                          <IconButton size="small" onClick={() => handleShare(form.id)} color="primary">
                            <Share2 size={16} />
                          </IconButton>
                          <IconButton size="small" onClick={() => navigate(`/forms/build?id=${form.id}`)} sx={{ color: 'text.secondary' }}>
                            <Edit size={16} />
                          </IconButton>
                          {(isSuperAdmin || (user?.role === 'teacher' && form.createdBy === user.uid)) && (
                            <IconButton size="small" onClick={() => setDeleteDialog({ open: true, id: form.id })} color="error" sx={{ opacity: 0.6 }}>
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
                        {safelyFormatDate(form.startDate, 'MMM d, h:mm a') || 'No Start Date'}
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
        </AnimatePresence>

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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 3, fontWeight: 800 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog 
        open={deleteDialog.open} 
        onClose={() => setDeleteDialog({ open: false, id: null })}
        TransitionComponent={Zoom}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this form? This action is permanent and cannot be undone. 
            Responses already submitted will be preserved in the database.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setDeleteDialog({ open: false, id: null })} 
            sx={{ fontWeight: 800, borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained" 
            sx={{ fontWeight: 900, borderRadius: 2, px: 3 }}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
