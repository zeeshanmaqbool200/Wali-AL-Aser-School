import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, FormControl, InputLabel, Select, MenuItem, 
  CircularProgress, IconButton, Chip, Paper, Divider,
  Avatar, Tooltip, useMediaQuery,
  Stack, Zoom, Fade, List, ListItem, ListItemAvatar, ListItemText, ListItemIcon
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  Plus, Calendar, Clock, MapPin, User, 
  Trash2, Edit2, ChevronLeft, ChevronRight,
  Bell, Send, Info, Filter, ArrowRight,
  Layout, Layers, CheckCircle, XCircle, Save,
  MoreVertical, BookOpen, GraduationCap, UserCheck, Users, Award
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where, or } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { ClassSchedule, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Schedule() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(!(window as any)._scheduleLoaded);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEventDialog, setOpenEventDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 0 : new Date().getDay() - 1); // 0 = Monday
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  
  const [formData, setFormData] = useState({
    subject: '',
    teacherName: '',
    teacherId: '',
    startTime: '09:00',
    endTime: '10:00',
    room: '',
    dayOfWeek: 0,
    grade: '',
    description: '',
    materials: [] as { title: string, url: string, type: 'pdf' | 'text' | 'link' }[]
  });

  const [newMaterial, setNewMaterial] = useState({ title: '', url: '', type: 'link' as 'pdf' | 'text' | 'link' });
  const [openMaterialsDialog, setOpenMaterialsDialog] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState<ClassSchedule | null>(null);

  const [eventFormData, setEventFormData] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '14:00',
    type: 'general',
    color: 'primary'
  });

  const isSuperAdmin = currentUser?.email === 'zeeshanmaqbool200@gmail.com';
  const isMuntazim = currentUser?.role === 'muntazim';
  const isMudarisRole = currentUser?.role === 'mudaris';
  const isAdmin = isSuperAdmin || isMuntazim;
  const isStaff = isAdmin || isMudarisRole;

  useEffect(() => {
    let q = query(collection(db, 'schedules'), orderBy('startTime', 'asc'));
    
    // Filtering schedules based on role
    if (isAdmin) {
      q = query(collection(db, 'schedules'), orderBy('startTime', 'asc'));
    } else if (isMudarisRole) {
      q = query(
        collection(db, 'schedules'), 
        where('grade', 'in', (currentUser?.assignedClasses && currentUser.assignedClasses.length > 0) ? currentUser.assignedClasses : ['__none__']), 
        orderBy('startTime', 'asc')
      );
    } else if (currentUser?.role === 'student') {
      q = query(
        collection(db, 'schedules'), 
        or(
          where('grade', '==', currentUser.maktabLevel || 'none'),
          where('grade', '==', currentUser.grade || 'none')
        ),
        orderBy('startTime', 'asc')
      );
    }
    
    // Events sync
    const eventsQuery = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClassSchedule[]);
      setLoading(false);
      (window as any)._scheduleLoaded = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'schedules');
    });

    return () => {
      unsubscribe();
      unsubscribeEvents();
    };
  }, [currentUser?.uid, currentUser?.assignedClasses, isMudarisRole, isAdmin]);

  const handleSaveEvent = async () => {
    try {
      const eventData = { ...eventFormData, updatedAt: Date.now() };
      
      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), eventData);
      } else {
        const docRef = await addDoc(collection(db, 'events'), { ...eventData, createdAt: Date.now() });
        
        // Auto-notify after adding event
        try {
          await addDoc(collection(db, 'notifications'), {
            title: `New Event: ${eventFormData.title}`,
            message: `A new ${eventFormData.type} event has been scheduled for ${eventFormData.date} at ${eventFormData.time}.`,
            type: 'event',
            targetType: 'all',
            senderId: currentUser?.uid || 'system',
            senderName: currentUser?.displayName || 'System',
            createdAt: Date.now(),
            readBy: []
          });
        } catch (e) {
          console.error("Failed to send event notification", e);
        }
      }
      setOpenEventDialog(false);
      setEditingEvent(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'events', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    try {
      const data = {
        ...formData,
        teacherName: currentUser.displayName,
        teacherId: currentUser.uid,
        createdAt: Date.now()
      };

      if (editingSchedule) {
        await updateDoc(doc(db, 'schedules', editingSchedule.id), data);
      } else {
        await addDoc(collection(db, 'schedules'), data);
      }
      
      setOpenDialog(false);
      setEditingSchedule(null);
      setFormData({ 
        subject: '', teacherName: '', teacherId: '', startTime: '09:00', endTime: '10:00', 
        room: '', dayOfWeek: selectedDay, grade: '', description: '', materials: [] 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'schedules');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `schedules/${id}`);
    }
  };

  const handleNotify = async (schedule: ClassSchedule) => {
    if (!currentUser) return;
    try {
      const notification = {
        title: `Class Reminder: ${schedule.subject}`,
        message: `Your class for ${schedule.subject} starts at ${schedule.startTime} in Room ${schedule.room}.`,
        type: 'class_timing',
        targetType: 'class',
        targetId: schedule.grade,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        createdAt: Date.now(),
        readBy: []
      };
      await addDoc(collection(db, 'notifications'), notification);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications');
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={60} thickness={4} />
    </Box>
  );

  return (
    <Box sx={{ pb: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>Schedule (Auqat)</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Manage weekly Maktab Level schedules and room assignments
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Box sx={{ 
              display: 'flex', 
              bgcolor: 'background.default', 
              p: 0.8, 
              borderRadius: 2,
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('daily')}
                sx={{ 
                  borderRadius: 3, 
                  bgcolor: viewMode === 'daily' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'daily' 
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff')
                    : 'none',
                  color: viewMode === 'daily' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layout size={18} />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('weekly')}
                sx={{ 
                  borderRadius: 3, 
                  bgcolor: viewMode === 'weekly' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'weekly' 
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff')
                    : 'none',
                  color: viewMode === 'weekly' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layers size={18} />
              </IconButton>
            </Box>
            {isStaff && (
              <Button 
                variant="contained" 
                startIcon={<Plus size={18} />} 
                onClick={() => {
                  setEditingSchedule(null);
                  setFormData({ ...formData, dayOfWeek: selectedDay });
                  setOpenDialog(true);
                }}
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
                Add Schedule
              </Button>
            )}
          </Stack>
        </Box>
      </motion.div>

      {/* Day Selector */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2, overflowX: 'auto', pb: 2, px: 1, '&::-webkit-scrollbar': { height: 4 } }}>
        {DAYS.map((day, index) => (
            <IconButton 
              size="small" 
              onClick={() => setSelectedDay(index)}
              sx={{ 
                borderRadius: 2, 
                minWidth: 120, 
                py: 2,
                fontWeight: 900,
                textTransform: 'none',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                bgcolor: selectedDay === index ? 'background.paper' : 'transparent',
                color: selectedDay === index ? 'primary.main' : 'text.secondary',
                boxShadow: selectedDay === index 
                  ? (theme.palette.mode === 'dark' 
                      ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                      : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff')
                  : 'none',
                transform: selectedDay === index ? 'scale(0.98)' : 'scale(1)',
                '&:hover': {
                  bgcolor: selectedDay === index ? 'background.paper' : alpha(theme.palette.primary.main, 0.05),
                }
              }}
            >
              {day}
            </IconButton>
        ))}
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <AnimatePresence mode="popLayout">
              {schedules
                .filter(s => s.dayOfWeek === selectedDay)
                .map((schedule, index) => (
                  <motion.div
                    key={schedule.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <ScheduleCard 
                      schedule={schedule} 
                      isTeacher={isStaff} 
                      onEdit={() => { setEditingSchedule(schedule); setFormData(schedule as any); setOpenDialog(true); }}
                      onDelete={() => handleDelete(schedule.id)}
                      onNotify={() => handleNotify(schedule)}
                      onViewMaterials={() => { setViewingSchedule(schedule); setOpenMaterialsDialog(true); }}
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
            
            {schedules.filter(s => s.dayOfWeek === selectedDay).length === 0 && (
              <Box sx={{ 
                p: 10, 
                textAlign: 'center', 
                bgcolor: 'background.paper', 
                borderRadius: 2, 
                border: 'none',
                boxShadow: theme.palette.mode === 'dark'
                  ? 'inset 8px 8px 16px #060a12, inset -8px -8px 16px #182442'
                  : 'inset 8px 8px 16px #d1d9e6, inset -8px -8px 16px #ffffff',
              }}>
                  <Calendar size={64} color={theme.palette.divider} style={{ marginBottom: 24 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 900, mb: 1 }}>No schedules found</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>There are no classes scheduled for {DAYS[selectedDay]}</Typography>
                </Box>
            )}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Card sx={{ borderRadius: 5, bgcolor: 'primary.main', color: 'white', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: -20, right: -20, opacity: 0.1 }}>
                <Clock size={120} />
              </Box>
              <CardContent sx={{ p: 3, position: 'relative' }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 2.5 }}>Schedule Insights</Typography>
                <Stack spacing={2.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Total Classes Today</Typography>
                    <Chip 
                      label={schedules.filter(s => s.dayOfWeek === selectedDay).length} 
                      size="small" 
                      sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 900 }} 
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Earliest Class</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{schedules.filter(s => s.dayOfWeek === selectedDay)[0]?.startTime || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Latest Class</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{schedules.filter(s => s.dayOfWeek === selectedDay).slice(-1)[0]?.endTime || 'N/A'}</Typography>
                  </Box>
                  <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 1 }} />
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)' }}>
                      <Bell size={20} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
                      Mudaris can send instant push notifications to all Tulab in a class for any timing changes.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 5 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Upcoming Events</Typography>
                  {isStaff && (
                    <IconButton size="small" color="primary" onClick={() => {
                      setEditingEvent(null);
                      setEventFormData({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '14:00', type: 'general', color: 'primary' });
                      setOpenEventDialog(true);
                    }}>
                      <Plus size={18} />
                    </IconButton>
                  )}
                </Box>
                <List disablePadding>
                  {events.map((event, i) => (
                    <ListItem 
                      key={event.id} 
                      disableGutters 
                      sx={{ py: 1.5, borderBottom: i < events.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}
                      secondaryAction={isStaff && (
                        <Box>
                          <IconButton size="small" onClick={() => {
                            setEditingEvent(event);
                            setEventFormData({ title: event.title, date: event.date, time: event.time, type: event.type, color: event.color });
                            setOpenEventDialog(true);
                          }}><Edit2 size={14} /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteEvent(event.id)}><Trash2 size={14} /></IconButton>
                        </Box>
                      )}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: alpha(theme.palette[event.color as 'primary' | 'success' | 'warning' | 'error']?.main || theme.palette.primary.main, 0.1), color: `${event.color}.main`, borderRadius: 2 }}>
                          {event.type === 'meeting' ? <Users size={18} /> : 
                           event.type === 'sports' ? <Award size={18} /> : 
                           <Calendar size={18} />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={event.title}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 800 } }}
                        secondary={`${event.date} • ${event.time}`}
                        secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary', sx: { fontWeight: 600 } }}
                      />
                    </ListItem>
                  ))}
                  {events.length === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>No upcoming events</Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', pb: 1 }}>
          {editingSchedule ? 'Edit Schedule Timing' : 'Schedule New Class'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
            Configure the class details below. This will be visible to all Tulab in the selected level.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                label="Mazmoon Name"
                placeholder="e.g. Quran with Tajweed"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Maktab Level"
                placeholder="e.g. Level 1"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Start Time"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="End Time"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Room Number / Hall"
                placeholder="e.g. Hall A"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                <InputLabel>Day of Week</InputLabel>
                <Select
                  value={formData.dayOfWeek}
                  label="Day of Week"
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value as number })}
                >
                  {DAYS.map((day, index) => <MenuItem key={day} value={index}>{day}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description / Instructions"
                multiline
                rows={3}
                placeholder="Add class details or preparation instructions..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Study Materials & Resources</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField 
                  size="small" 
                  placeholder="Title" 
                  value={newMaterial.title} 
                  onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                  sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <TextField 
                  size="small" 
                  placeholder="URL / Link" 
                  value={newMaterial.url} 
                  onChange={(e) => setNewMaterial({ ...newMaterial, url: e.target.value })}
                  sx={{ flex: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    if (newMaterial.title && newMaterial.url) {
                      setFormData({ ...formData, materials: [...formData.materials, newMaterial] });
                      setNewMaterial({ title: '', url: '', type: 'link' });
                    }
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {formData.materials.map((m, i) => (
                  <Chip 
                    key={i} 
                    label={m.title} 
                    onDelete={() => setFormData({ ...formData, materials: formData.materials.filter((_, idx) => idx !== i) })}
                    size="small"
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            startIcon={<Save size={18} />} 
            disabled={!formData.subject || !formData.grade}
            sx={{ borderRadius: 3, fontWeight: 800, px: 3, boxShadow: '0 8px 24px rgba(15, 118, 110, 0.3)' }}
          >
            {editingSchedule ? 'Update Schedule' : 'Add to Schedule'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Materials Dialog */}
      <Dialog open={openMaterialsDialog} onClose={() => setOpenMaterialsDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 5 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Class Materials</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Resources for <strong>{viewingSchedule?.subject}</strong>
          </Typography>
          <List>
            {viewingSchedule?.materials?.map((m, i) => (
              <ListItem key={i} component="a" href={m.url} target="_blank" sx={{ borderRadius: 3, mb: 1, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.5) : 'grey.50', color: 'inherit', textDecoration: 'none' }}>
                <ListItemIcon>
                  <BookOpen size={20} color={theme.palette.primary.main} />
                </ListItemIcon>
                <ListItemText primary={m.title} primaryTypographyProps={{ fontWeight: 700 }} />
                <ArrowRight size={16} />
              </ListItem>
            ))}
            {(!viewingSchedule?.materials || viewingSchedule.materials.length === 0) && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No materials attached to this class.
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMaterialsDialog(false)} sx={{ fontWeight: 800 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Event Add/Edit Dialog */}
      <Dialog open={openEventDialog} onClose={() => setOpenEventDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField fullWidth label="Event Title" value={eventFormData.title} onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })} />
            <TextField fullWidth type="date" label="Date" value={eventFormData.date} onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })} />
            <TextField fullWidth type="time" label="Time" value={eventFormData.time} onChange={(e) => setEventFormData({ ...eventFormData, time: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={eventFormData.type} label="Type" onChange={(e) => setEventFormData({ ...eventFormData, type: e.target.value })}>
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="meeting">Meeting</MenuItem>
                <MenuItem value="sports">Sports</MenuItem>
                <MenuItem value="exam">Exam</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Color</InputLabel>
              <Select value={eventFormData.color} label="Color" onChange={(e) => setEventFormData({ ...eventFormData, color: e.target.value })}>
                <MenuItem value="primary">Teal (Primary)</MenuItem>
                <MenuItem value="success">Green (Success)</MenuItem>
                <MenuItem value="warning">Orange (Warning)</MenuItem>
                <MenuItem value="error">Red (Error)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenEventDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEvent} disabled={!eventFormData.title} sx={{ borderRadius: 2 }}>Save Event</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ScheduleCard({ schedule, isTeacher, onEdit, onDelete, onNotify, onViewMaterials }: any) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Card sx={{ 
      borderRadius: 2, 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      border: 'none',
      bgcolor: 'background.paper',
      boxShadow: isDark 
        ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
        : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
      '&:hover': { 
        transform: 'translateY(-6px)', 
        boxShadow: isDark 
          ? '16px 16px 32px #060a12, -16px -16px 32px #182442'
          : '16px 16px 32px #d1d9e6, -16px -16px 32px #ffffff',
      }
    }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 8, bgcolor: 'primary.main' }} />
      <CardContent sx={{ p: 4 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, sm: 3 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2, 
              color: 'primary.main', 
              mb: 1,
              bgcolor: 'background.default',
              p: 2,
              borderRadius: 2,
              boxShadow: isDark
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}>
              <Clock size={22} />
              <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1 }}>{schedule.startTime}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, mt: 1.5, display: 'block', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
              Ends at {schedule.endTime}
            </Typography>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 5 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5, letterSpacing: -1 }}>{schedule.subject}</Typography>
            <Stack direction="row" spacing={2.5}>
              <Chip 
                label={schedule.grade} 
                size="small" 
                sx={{ 
                  fontWeight: 900, 
                  bgcolor: alpha(theme.palette.primary.main, 0.1), 
                  color: 'primary.main', 
                  borderRadius: 2.5,
                  px: 1,
                  border: 'none'
                }} 
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <MapPin size={18} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>{schedule.room}</Typography>
              </Box>
            </Stack>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, alignItems: 'center', gap: 2.5 }}>
              <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, display: 'block' }}>{schedule.teacherName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mudaris</Typography>
              </Box>
              <Avatar 
                sx={{ 
                  width: 52, 
                  height: 52, 
                  bgcolor: 'background.default',
                  color: 'primary.main',
                  fontWeight: 900,
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  boxShadow: isDark 
                    ? '6px 6px 12px #060a12, -6px -6px 12px #182442'
                    : '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
                  border: 'none'
                }}
                onClick={onViewMaterials}
              >
                {schedule.teacherName.charAt(0)}
              </Avatar>
              
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Tooltip title="View Materials">
                  <IconButton 
                    size="small" 
                    color="primary" 
                    onClick={onViewMaterials} 
                    sx={{ 
                      bgcolor: 'background.default',
                      boxShadow: isDark 
                        ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                        : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                    }}
                  >
                    <BookOpen size={18} />
                  </IconButton>
                </Tooltip>
                {isTeacher && (
                  <>
                    <Tooltip title="Notify Tulab">
                      <IconButton 
                        size="small" 
                        color="primary" 
                        onClick={onNotify} 
                        sx={{ 
                          bgcolor: 'background.default',
                          boxShadow: isDark 
                            ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                            : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                        }}
                      >
                        <Send size={18} />
                      </IconButton>
                    </Tooltip>
                    <IconButton 
                      size="small" 
                      onClick={onEdit} 
                      sx={{ 
                        bgcolor: 'background.default',
                        boxShadow: isDark 
                          ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                          : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                      }}
                    >
                      <Edit2 size={18} />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="error" 
                      onClick={onDelete} 
                      sx={{ 
                        bgcolor: 'background.default',
                        boxShadow: isDark 
                          ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                          : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                      }}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
