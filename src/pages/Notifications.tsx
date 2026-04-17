import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, TextField, 
  List, ListItem, ListItemText, ListItemAvatar, Avatar, 
  Chip, IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, FormControl, InputLabel, Select, MenuItem, 
  CircularProgress, Badge, Divider, Tab, Tabs, useTheme,
  alpha, Stack, Tooltip, Paper, Fade, Zoom
} from '@mui/material';
import { 
  Bell, Send, Trash2, CheckCircle, Info, AlertTriangle, 
  Users, User, BookOpen, CreditCard, Calendar, Filter, Search,
  Check, X, MoreVertical, Megaphone, MessageSquare, Clock,
  ArrowRight, Sparkles, ShieldCheck, Mail
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, arrayUnion } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Notification, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import { logger } from '../lib/logger';

export default function Notifications() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const { showToast } = useNotification();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'general' as Notification['type'],
    targetType: 'all' as Notification['targetType'],
    targetId: ''
  });

  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  useEffect(() => {
    if (!currentUser) return;
    logger.info('Notifications Page Loading...');

    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
      
      // Filter notifications based on role and target
      const filtered = data.filter(n => {
        if (isTeacher) return true; // Teachers see all sent notifications
        if (n.targetType === 'all') return true;
        if (n.targetType === 'individual' && n.targetId === currentUser.uid) return true;
        if (n.targetType === 'class' && n.targetId === currentUser.grade) return true;
        return false;
      });

      setNotifications(filtered);
      setLoading(false);
      logger.db('Notifications List Updated', 'notifications', { count: filtered.length });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    if (isTeacher) {
      const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'), limit(500));
      onSnapshot(studentsQuery, (snapshot) => {
        setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
        logger.db('Students List Loaded (Admin)', 'users', { count: snapshot.size });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    return () => unsubscribe();
  }, [currentUser, isTeacher]);

  const handleMarkAsRead = async (id: string) => {
    if (!currentUser) return;
    const notifRef = doc(db, 'notifications', id);
    try {
      logger.db('Marking Notification as Read', `notifications/${id}`);
      await updateDoc(notifRef, {
        readBy: arrayUnion(currentUser.uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    const unread = notifications.filter(n => !n.readBy.includes(currentUser.uid));
    if (unread.length === 0) return;

    try {
      logger.info(`Marking ${unread.length} notifications as read`);
      await Promise.all(unread.map(n => 
        updateDoc(doc(db, 'notifications', n.id), {
          readBy: arrayUnion(currentUser.uid)
        })
      ));
      showToast({
        title: 'Success',
        message: 'All notifications marked as read',
        type: 'success'
      });
      logger.success('All notifications marked as read');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications/all');
    }
  };

  const handleSend = async () => {
    if (!currentUser) return;
    try {
      logger.db('Sending Notification', 'notifications');
      const newNotif = {
        ...formData,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        createdAt: Date.now(),
        readBy: []
      };
      await addDoc(collection(db, 'notifications'), newNotif);
      setOpenDialog(false);
      setFormData({ title: '', message: '', type: 'general', targetType: 'all', targetId: '' });
      logger.success('Notification Sent Successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      logger.db('Deleting Notification', `notifications/${id}`);
      await deleteDoc(doc(db, 'notifications', id));
      logger.success('Notification Deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'fee_request': return <CreditCard size={20} />;
      case 'class_timing': return <Calendar size={20} />;
      case 'announcement': return <Megaphone size={20} />;
      default: return <Bell size={20} />;
    }
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'fee_request': return 'warning';
      case 'class_timing': return 'info';
      case 'announcement': return 'success';
      default: return 'primary';
    }
  };

  const filteredNotifications = notifications
    .filter(n => tabValue === 0 || !n.readBy.includes(currentUser?.uid || ''))
    .filter(n => typeFilter === 'all' || n.type === typeFilter)
    .filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.readBy.includes(currentUser?.uid || '')) {
      handleMarkAsRead(notif.id);
    }
    
    if (notif.type === 'fee_request') {
      navigate('/fees');
    } else if (notif.type === 'class_timing') {
      navigate('/schedule');
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: { xs: 4, sm: 6, md: 8 }, px: { xs: 1.5, sm: 2, md: 0 } }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Ittila'at (Notifications)</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Idarah ke elanat aur zaati ittila'at se bakhabar rahein
            </Typography>
          </Box>
          {isTeacher && (
            <Button 
              variant="contained" 
              startIcon={<Send size={18} />} 
              onClick={() => setOpenDialog(true)}
              sx={{ 
                borderRadius: 4, 
                fontWeight: 900, 
                px: 4, 
                py: 1.5,
                textTransform: 'none',
                boxShadow: theme.palette.mode === 'dark'
                  ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                  : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
              }}
            >
              Ittila Bhejein
            </Button>
          )}
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ 
        borderRadius: 7, 
        overflow: 'hidden', 
        border: 'none',
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'dark'
          ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
          : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
      }}>
            <Box sx={{ 
              p: 3, 
              borderBottom: '1px solid', 
              borderColor: 'divider', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: 3,
              bgcolor: alpha(theme.palette.background.default, 0.5),
              backdropFilter: 'blur(10px)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={(e, v) => setTabValue(v)} 
                  sx={{ 
                    '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0' },
                    '& .MuiTab-root': { fontWeight: 900, textTransform: 'none', minWidth: 100, fontSize: '0.95rem', py: 3, color: 'text.secondary' },
                    '& .Mui-selected': { color: 'primary.main' }
                  }}
                >
                  <Tab label="Sari Ittila'at" />
                  <Tab label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      An-Padhi
                      {notifications.filter(n => !n.readBy.includes(currentUser?.uid || '')).length > 0 && (
                        <Chip 
                          label={notifications.filter(n => !n.readBy.includes(currentUser?.uid || '')).length} 
                          size="small" 
                          color="primary" 
                          sx={{ height: 22, minWidth: 22, fontSize: '0.7rem', fontWeight: 900 }} 
                        />
                      )}
                    </Box>
                  } />
                </Tabs>
                
                <Select
                  size="small"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  sx={{ 
                    borderRadius: 4, 
                    minWidth: 160,
                    bgcolor: 'background.default',
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    boxShadow: theme.palette.mode === 'dark'
                      ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                      : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                  }}
                >
                  <MenuItem value="all" sx={{ fontWeight: 700 }}>Sari Qismein</MenuItem>
                  <MenuItem value="general" sx={{ fontWeight: 700 }}>Aam Ittila</MenuItem>
                  <MenuItem value="fee_request" sx={{ fontWeight: 700 }}>Fees</MenuItem>
                  <MenuItem value="class_timing" sx={{ fontWeight: 700 }}>Class Timing</MenuItem>
                  <MenuItem value="announcement" sx={{ fontWeight: 700 }}>Elanat</MenuItem>
                </Select>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexGrow: { xs: 1, sm: 0 } }}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    px: 2.5, 
                    borderRadius: 4, 
                    border: 'none',
                    bgcolor: 'background.default',
                    boxShadow: theme.palette.mode === 'dark'
                      ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                      : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                    width: { xs: '100%', sm: 250 }
                  }}
                >
                  <Search size={20} style={{ marginRight: 8, color: theme.palette.text.secondary }} />
                  <Box 
                    component="input"
                    placeholder="Talash karein..."
                    value={searchQuery}
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    sx={{ 
                      border: 'none', 
                      outline: 'none', 
                      p: 1.5, 
                      width: '100%', 
                      fontWeight: 700,
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      fontSize: '0.95rem',
                      '&::placeholder': { color: 'text.disabled' }
                    }} 
                  />
                </Paper>
                {notifications.some(n => !n.readBy.includes(currentUser?.uid || '')) && (
                  <Tooltip title="Mark all as read">
                    <IconButton 
                      onClick={handleMarkAllAsRead} 
                      color="primary" 
                      sx={{ 
                        bgcolor: 'background.paper',
                        boxShadow: theme.palette.mode === 'dark'
                          ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                          : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                      }}
                    >
                      <CheckCircle size={22} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            <List sx={{ p: 0 }}>
              <AnimatePresence mode="popLayout">
                {filteredNotifications.map((notif, index) => (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <NotificationItem 
                      notif={notif} 
                      currentUser={currentUser} 
                      isTeacher={isTeacher}
                      onRead={() => handleMarkAsRead(notif.id)}
                      onDelete={() => handleDelete(notif.id)}
                      onClick={() => handleNotificationClick(notif)}
                      getIcon={getIcon}
                      getTypeColor={getTypeColor}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {filteredNotifications.length === 0 && (
                <Box sx={{ p: 12, textAlign: 'center' }}>
                  <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                    <Bell size={64} color={theme.palette.divider} />
                    <Box sx={{ position: 'absolute', top: -5, right: -5, bgcolor: 'primary.main', color: 'white', borderRadius: '50%', p: 0.5 }}>
                      <Check size={16} />
                    </Box>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Sab mukammal hai!</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? 'No notifications match your search.' : 'Is waqt aapke paas koi nayi ittila nahi hai.'}
                  </Typography>
                </Box>
              )}
            </List>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Card sx={{ 
              borderRadius: 6, 
              bgcolor: 'primary.main', 
              color: 'white', 
              position: 'relative', 
              overflow: 'hidden',
              boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.2)}`
            }}>
              <Box sx={{ position: 'absolute', top: -20, right: -20, opacity: 0.1 }}>
                <Sparkles size={120} />
              </Box>
              <CardContent sx={{ p: 4, position: 'relative' }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 3, letterSpacing: -0.5 }}>Notification Center</Typography>
                <Stack spacing={3}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.15)' }}>
                      <ShieldCheck size={20} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5 }}>
                      Your communications are secure and encrypted end-to-end.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.15)' }}>
                      <Mail size={20} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5 }}>
                      Important alerts are also sent to your registered email address.
                    </Typography>
                  </Box>
                  <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 1 }} />
                  <Button 
                    variant="contained" 
                    fullWidth 
                    sx={{ 
                      bgcolor: 'white', 
                      color: 'primary.main', 
                      fontWeight: 900, 
                      borderRadius: '12px',
                      py: 1.5,
                      '&:hover': { bgcolor: alpha('#fff', 0.9) }
                    }}
                  >
                    Notification Settings
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ 
              borderRadius: 6, 
              border: '1px solid', 
              borderColor: 'rgba(0,0,0,0.04)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 3, letterSpacing: -0.5 }}>Recent Activity</Typography>
                <Stack spacing={3}>
                  {[
                    { text: 'New course "Advanced Math" added', time: '2h ago' },
                    { text: 'Exam results for Grade 10 published', time: '5h ago' },
                    { text: 'Holiday announcement for next week', time: '1d ago' }
                  ].map((item, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.6, boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.1)}` }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5 }}>{item.text}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>{item.time}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Send Notification Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ 
          sx: { 
            borderRadius: 6, 
            p: 1,
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark'
              ? '20px 20px 60px #060a12, -20px -20px 60px #182442'
              : '20px 20px 60px #d1d9e6, -20px -20px 60px #ffffff',
            border: 'none'
          } 
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.6rem', pb: 1, letterSpacing: -1 }}>
          Elan Bhejein
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 600 }}>
            Tulab ya classes ko ittila bhejein. Ye foran unke inbox mein zahir hogi.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Ittila ka Title"
                placeholder="e.g. Zaruri: Class ke Auqat ki Tabdeeli"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                InputProps={{ sx: { borderRadius: 4 } }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Paigham"
                placeholder="Apna tafseeli paigham yahan likhein..."
                multiline
                rows={4}
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                InputProps={{ sx: { borderRadius: 4 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}>
                <InputLabel sx={{ fontWeight: 800 }}>Qism</InputLabel>
                <Select
                  value={formData.type}
                  label="Qism"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <MenuItem value="general" sx={{ fontWeight: 700 }}>Aam Ittila</MenuItem>
                  <MenuItem value="fee_request" sx={{ fontWeight: 700 }}>Fees ki Adaigi ki Darkhwast</MenuItem>
                  <MenuItem value="class_timing" sx={{ fontWeight: 700 }}>Class ke Auqat ki Tabdeeli</MenuItem>
                  <MenuItem value="announcement" sx={{ fontWeight: 700 }}>Sarkari Elan</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}>
                <InputLabel sx={{ fontWeight: 800 }}>Jinhein Bhejna Hai</InputLabel>
                <Select
                  value={formData.targetType}
                  label="Jinhein Bhejna Hai"
                  onChange={(e) => setFormData({ ...formData, targetType: e.target.value as any, targetId: '' })}
                >
                  <MenuItem value="all" sx={{ fontWeight: 700 }}>Sabhi (Sare Tulab)</MenuItem>
                  <MenuItem value="class" sx={{ fontWeight: 700 }}>Khas Level / Class</MenuItem>
                  <MenuItem value="individual" sx={{ fontWeight: 700 }}>Infradi Talib-e-Ilm</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <AnimatePresence>
              {formData.targetType === 'class' && (
                <Grid size={12} component={motion.div} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <TextField
                    fullWidth
                    label="Class Name"
                    placeholder="e.g. 10th-A"
                    value={formData.targetId}
                    onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                    InputProps={{ sx: { borderRadius: 4 } }}
                  />
                </Grid>
              )}
              {formData.targetType === 'individual' && (
                <Grid size={12} component={motion.div} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}>
                    <InputLabel sx={{ fontWeight: 800 }}>Talib-e-Ilm Muntakhib Karein</InputLabel>
                    <Select
                      value={formData.targetId}
                      label="Talib-e-Ilm Muntakhib Karein"
                      onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                    >
                      {students.map(s => (
                        <MenuItem key={s.uid} value={s.uid} sx={{ fontWeight: 700 }}>{s.displayName} ({s.studentId})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </AnimatePresence>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 4, gap: 1.5 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 900, color: 'text.secondary', textTransform: 'none' }}>Cancel</Button>
          <Button 
            onClick={handleSend} 
            variant="contained" 
            startIcon={<Send size={18} />} 
            disabled={!formData.title || !formData.message}
            sx={{ 
              borderRadius: 4, 
              fontWeight: 900, 
              px: 4, 
              py: 1.2,
              textTransform: 'none',
              boxShadow: theme.palette.mode === 'dark'
                ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
            }}
          >
            Abhi Bhejein
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function NotificationItem({ notif, currentUser, isTeacher, onRead, onDelete, onClick, getIcon, getTypeColor }: any) {
  const theme = useTheme();
  const isRead = notif.readBy.includes(currentUser?.uid || '');
  
  return (
    <ListItem 
      onClick={onClick}
      sx={{ 
        px: 3,
        py: 2.5,
        cursor: 'pointer',
        borderBottom: '1px solid', 
        borderColor: 'divider',
        bgcolor: isRead ? 'transparent' : alpha(theme.palette.primary.main, 0.03),
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        '&:hover': { 
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          '& .action-buttons': { opacity: 1, transform: 'translateX(0)' }
        }
      }}
    >
      <ListItemAvatar sx={{ mr: 1 }}>
        <Badge 
          overlap="circular" 
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          variant="dot"
          color={isRead ? 'default' : 'primary'}
          invisible={isRead}
          sx={{ '& .MuiBadge-badge': { width: 12, height: 12, borderRadius: '50%', border: '2px solid white' } }}
        >
          <Avatar 
            sx={{ 
              bgcolor: alpha(theme.palette[getTypeColor(notif.type) as 'primary' | 'success' | 'warning' | 'info'].main, 0.1), 
              color: `${getTypeColor(notif.type)}.main`,
              borderRadius: 3,
              width: 52,
              height: 52,
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}
          >
            {getIcon(notif.type)}
          </Avatar>
        </Badge>
      </ListItemAvatar>
      
      <ListItemText
        primaryTypographyProps={{ component: 'div' }}
        secondaryTypographyProps={{ component: 'div' }}
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: isRead ? 700 : 900, color: isRead ? 'text.primary' : 'primary.main' }}>
              {notif.title}
            </Typography>
            <Chip 
              label={notif.type.replace('_', ' ')} 
              size="small" 
              sx={{ 
                fontSize: '0.65rem', 
                height: 20, 
                fontWeight: 800, 
                textTransform: 'uppercase',
                bgcolor: alpha(theme.palette[getTypeColor(notif.type) as 'primary' | 'success' | 'warning' | 'info'].main, 0.05),
                color: `${getTypeColor(notif.type)}.main`,
                border: 'none'
              }} 
            />
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body2" color="text.secondary" component="p" sx={{ mb: 1.5, fontWeight: 500, lineHeight: 1.6 }}>
              {notif.message}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <User size={14} />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{notif.senderName}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <Clock size={14} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{format(notif.createdAt, 'PPp')}</Typography>
              </Box>
            </Stack>
          </Box>
        }
      />
      
      <Box 
        className="action-buttons"
        sx={{ 
          display: 'flex', 
          gap: 1, 
          opacity: { xs: 1, sm: 0 }, 
          transform: { xs: 'none', sm: 'translateX(10px)' },
          transition: 'all 0.2s ease',
          ml: 2
        }}
      >
        {!isRead && (
          <Tooltip title="Mark as Read">
            <IconButton 
              size="small" 
              onClick={onRead} 
              sx={{ 
                bgcolor: 'background.paper', 
                boxShadow: theme.palette.mode === 'dark'
                  ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                  : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                '&:hover': { bgcolor: 'primary.main', color: 'white' } 
              }}
            >
              <Check size={18} />
            </IconButton>
          </Tooltip>
        )}
        {isTeacher && (
          <Tooltip title="Delete">
            <IconButton 
              size="small" 
              onClick={onDelete} 
              sx={{ 
                bgcolor: 'background.paper', 
                boxShadow: theme.palette.mode === 'dark'
                  ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                  : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                '&:hover': { bgcolor: 'error.main', color: 'white' } 
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </ListItem>
  );
}
