import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Box, Typography, Grid, Avatar, IconButton } from '@mui/material';
import { UserPlus, Mail, Shield, User, GraduationCap, BookOpen, Camera, Calendar, UserCheck } from 'lucide-react';
import { UserRole } from '../types';
import ImageCaptureDialog from './ImageCaptureDialog';

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const CLASS_LEVELS = ['Mubtadi', 'Awal', 'Doum', 'Soum', 'Chaharm', 'Panjum', 'Shasham', 'Haftum', 'Hashtum', 'Nahum', 'Dahum', 'Hafiz'];

export default function UserModal({ open, onClose, onSubmit }: UserModalProps) {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    role: 'student' as UserRole,
    classLevel: '',
    subject: '',
    password: '',
    fatherName: '',
    admissionDate: new Date().toISOString().split('T')[0],
    studentId: '',
    photoURL: ''
  });

  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    if (open && formData.role === 'student' && !formData.studentId) {
      // Auto-generate student ID: REG-YY-XXXX
      const year = new Date().getFullYear().toString().slice(-2);
      const random = Math.floor(1000 + Math.random() * 9000);
      setFormData(prev => ({ ...prev, studentId: `REG-${year}-${random}` }));
    }
  }, [open, formData.role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name as string]: value }));
  };

  const handleCapture = (base64: string) => {
    setFormData(prev => ({ ...prev, photoURL: base64 }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
        <UserPlus size={20} color="#1976d2" />
        Add New User
      </DialogTitle>
      <DialogContent sx={{ py: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          {/* Photo Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar 
                src={formData.photoURL} 
                sx={{ width: 80, height: 80, border: '2px solid', borderColor: 'primary.main', mb: 1 }}
              >
                <User size={40} />
              </Avatar>
              <IconButton 
                size="small"
                onClick={() => setCaptureOpen(true)}
                sx={{ 
                  position: 'absolute', 
                  bottom: 8, 
                  right: -8, 
                  bgcolor: 'primary.main', 
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' }
                }}
              >
                <Camera size={14} />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              PROFILE PHOTO
            </Typography>
          </Box>

          <TextField
            name="displayName"
            label="Full Name"
            fullWidth
            required
            value={formData.displayName}
            onChange={handleChange}
            InputProps={{
              startAdornment: <User size={18} style={{ marginRight: 12, color: '#666' }} />,
            }}
          />

          <TextField
            name="email"
            label="Email Address"
            type="email"
            fullWidth
            required
            value={formData.email}
            onChange={handleChange}
            InputProps={{
              startAdornment: <Mail size={18} style={{ marginRight: 12, color: '#666' }} />,
            }}
          />

          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              name="role"
              value={formData.role}
              onChange={handleChange as any}
              label="Role"
              startAdornment={<Shield size={18} style={{ marginRight: 12, color: '#666' }} />}
            >
              <MenuItem value="student">Student</MenuItem>
              <MenuItem value="teacher">Teacher</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
              <MenuItem value="superadmin">Administrator</MenuItem>
              <MenuItem value="pending_teacher">Pending Teacher</MenuItem>
            </Select>
          </FormControl>

          {formData.role === 'student' && (
            <>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    name="fatherName"
                    label="Parentage / Father Name"
                    fullWidth
                    value={formData.fatherName}
                    onChange={handleChange}
                    InputProps={{
                      startAdornment: <UserCheck size={18} style={{ marginRight: 12, color: '#666' }} />,
                    }}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    name="studentId"
                    label="Student ID (Auto)"
                    fullWidth
                    value={formData.studentId}
                    onChange={handleChange}
                    helperText="Generated automatically"
                    InputProps={{
                      readOnly: true,
                      startAdornment: <Shield size={18} style={{ marginRight: 12, color: '#666' }} />,
                    }}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={6}>
                  <FormControl fullWidth>
                    <InputLabel>Class Level</InputLabel>
                    <Select
                      name="classLevel"
                      value={formData.classLevel}
                      onChange={handleChange as any}
                      label="Class Level"
                      startAdornment={<GraduationCap size={18} style={{ marginRight: 12, color: '#666' }} />}
                    >
                      {CLASS_LEVELS.map(level => (
                        <MenuItem key={level} value={level}>{level}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={6}>
                  <TextField
                    name="admissionDate"
                    label="Admission Date"
                    type="date"
                    fullWidth
                    value={formData.admissionDate}
                    onChange={handleChange}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: <Calendar size={18} style={{ marginRight: 12, color: '#666' }} />,
                    }}
                  />
                </Grid>
              </Grid>
            </>
          )}

          {(formData.role === 'teacher' || formData.role === 'pending_teacher') && (
            <TextField
              name="subject"
              label="Primary Subject"
              fullWidth
              value={formData.subject}
              onChange={handleChange}
              InputProps={{
                startAdornment: <BookOpen size={18} style={{ marginRight: 12, color: '#666' }} />,
              }}
            />
          )}

          <TextField
            name="password"
            label="Temporary Password"
            type="password"
            fullWidth
            value={formData.password}
            onChange={handleChange}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" size="small">Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.displayName || !formData.email || !formData.role}
          sx={{ px: 3 }}
          size="small"
        >
          Create User
        </Button>
      </DialogActions>

      <ImageCaptureDialog 
        open={captureOpen} 
        onClose={() => setCaptureOpen(false)} 
        onCapture={handleCapture}
        title="Add Profile Photo"
      />
    </Dialog>
  );
}
