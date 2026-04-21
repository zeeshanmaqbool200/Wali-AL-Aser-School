import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, FormControl, InputLabel, Select, 
  MenuItem, Box, Grid, CircularProgress 
} from '@mui/material';
import { Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export default function ScheduleModal({ open, onClose, onSubmit }: ScheduleModalProps) {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    subject: '',
    teacherId: '',
    teacherName: '',
    startTime: '09:00',
    endTime: '10:30',
    dayOfWeek: 0,
    room: ''
  });

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const snapshot = await getDocs(q);
        const teacherList = snapshot.docs.map(doc => ({ 
          uid: doc.id, 
          ...doc.data() 
        })) as UserProfile[];
        setTeachers(teacherList);
      } catch (err) {
        console.error('Error fetching teachers:', err);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchTeachers();
    }
  }, [open]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    if (name === 'teacherId') {
      const teacher = teachers.find(t => t.uid === value);
      setFormData(prev => ({ 
        ...prev, 
        teacherId: value, 
        teacherName: teacher ? teacher.displayName : '' 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
    setFormData({
      subject: '',
      teacherId: '',
      teacherName: '',
      startTime: '09:00',
      endTime: '10:30',
      dayOfWeek: 0,
      room: ''
    });
    onClose();
  };

  const days = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
  ];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Calendar size={24} color="#1976d2" />
        Add Class Schedule
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <TextField
            name="subject"
            label="Subject Name"
            fullWidth
            value={formData.subject}
            onChange={handleChange}
            InputProps={{
              startAdornment: <BookOpen size={18} style={{ marginRight: 12, color: '#666' }} />,
            }}
          />

          <FormControl fullWidth>
            <InputLabel>Teacher</InputLabel>
            <Select
              name="teacherId"
              value={formData.teacherId}
              onChange={handleChange}
              label="Teacher"
              startAdornment={<User size={18} style={{ marginRight: 12, color: '#666' }} />}
              disabled={loading}
            >
              {loading ? (
                <MenuItem disabled><CircularProgress size={20} /></MenuItem>
              ) : (
                teachers.map(teacher => (
                  <MenuItem key={teacher.uid} value={teacher.uid}>
                    {teacher.displayName}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Day</InputLabel>
                <Select
                  name="dayOfWeek"
                  value={formData.dayOfWeek}
                  onChange={handleChange}
                  label="Day"
                >
                  {days.map(day => (
                    <MenuItem key={day.value} value={day.value}>{day.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                name="room"
                label="Room Number"
                fullWidth
                value={formData.room}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <MapPin size={18} style={{ marginRight: 12, color: '#666' }} />,
                }}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                name="startTime"
                label="Start Time"
                type="time"
                fullWidth
                value={formData.startTime}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: <Clock size={18} style={{ marginRight: 12, color: '#666' }} />,
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                name="endTime"
                label="End Time"
                type="time"
                fullWidth
                value={formData.endTime}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: <Clock size={18} style={{ marginRight: 12, color: '#666' }} />,
                }}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.subject || !formData.teacherId || !formData.room}
          sx={{ px: 4 }}
        >
          Add to Schedule
        </Button>
      </DialogActions>
    </Dialog>
  );
}
