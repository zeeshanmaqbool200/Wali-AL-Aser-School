import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Box, Typography, Grid, Avatar, IconButton, Stack } from '@mui/material';
import { UserPlus, Mail, Shield, User, GraduationCap, BookOpen, Camera, Calendar, UserCheck } from 'lucide-react';
import { UserRole } from '../types';
import ImageCaptureDialog from './ImageCaptureDialog';

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const CLASS_LEVELS = ['Mubtadi', 'Awal', 'Duom', 'Soum', 'Chaharm', 'Panjum', 'Shasham', 'Haftum', 'Hashtum', 'Nahum', 'Dahum', 'Hafiz', 'Takhassus'];

export default function UserModal({ open, onClose, onSubmit }: UserModalProps) {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    role: 'student' as UserRole,
    classLevel: '',
    subject: '',
    password: '',
    fatherName: '',
    motherName: '',
    phone: '',
    whatsapp: '',
    address: '',
    qualifications: '',
    expertise: [] as string[],
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
        <UserPlus size={20} color="#1976d2" />
        Add New Member
      </DialogTitle>
      <DialogContent sx={{ py: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          {/* Photo Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar 
                src={formData.photoURL} 
                sx={{ width: 90, height: 90, border: '3px solid', borderColor: 'primary.main', mb: 1, borderRadius: 2 }}
              >
                <User size={45} />
              </Avatar>
              <Stack direction="row" spacing={1} sx={{ position: 'absolute', bottom: 0, right: -15 }}>
                 <IconButton 
                    size="small"
                    onClick={() => setCaptureOpen(true)}
                    sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, borderRadius: 1.5 }}
                  >
                    <Camera size={14} />
                  </IconButton>
                  <IconButton 
                    size="small"
                    component="label"
                    sx={{ bgcolor: 'secondary.main', color: 'white', '&:hover': { bgcolor: 'secondary.dark' }, borderRadius: 1.5 }}
                  >
                    <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
                    <Camera size={14} /> {/* Using camera icon for both for consistency or paperclip? Lucide doesn't have upload but has Camera/Image */}
                  </IconButton>
              </Stack>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, mt: 1 }}>
              MEMBERSHIP PHOTO
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
            <InputLabel shrink>Role Access</InputLabel>
            <Select
              name="role"
              value={formData.role}
              onChange={handleChange as any}
              label="Role Access"
              notched
              startAdornment={<Shield size={18} style={{ marginRight: 12, color: '#666' }} />}
            >
              <MenuItem value="student">Student / طالب علم</MenuItem>
              <MenuItem value="mudaris">Mudaris (Teacher) / مدرس</MenuItem>
              <MenuItem value="mudeer">Mudeer (Principal) / مدیر</MenuItem>
              <MenuItem value="muntazim">Muntazim (Manager) / منتظم</MenuItem>
              <MenuItem value="superadmin">Administrator / ایڈمنسٹریٹر</MenuItem>
            </Select>
          </FormControl>

          {formData.role === 'student' && (
            <>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    name="fatherName"
                    label="Father's Name"
                    fullWidth
                    value={formData.fatherName}
                    onChange={handleChange}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: <UserCheck size={18} style={{ marginRight: 12, color: '#666' }} />,
                    }}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    name="motherName"
                    label="Mother's Name"
                    fullWidth
                    value={formData.motherName}
                    onChange={handleChange}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: <UserCheck size={18} style={{ marginRight: 12, color: '#666' }} />,
                    }}
                  />
                </Grid>
              </Grid>

              <TextField
                name="studentId"
                label="Student ID (Auto)"
                fullWidth
                value={formData.studentId}
                onChange={handleChange}
                helperText="Generated automatically"
                InputProps={{
                  readOnly: true,
                  sx: { bgcolor: 'action.hover' },
                  startAdornment: <Shield size={18} style={{ marginRight: 12, color: '#666' }} />,
                }}
              />

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

          {(formData.role && formData.role !== 'student') && (
            <>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <TextField
                    name="phone"
                    label="Phone Number"
                    fullWidth
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    name="whatsapp"
                    label="WhatsApp"
                    fullWidth
                    value={formData.whatsapp}
                    onChange={handleChange}
                  />
                </Grid>
              </Grid>
              <TextField
                name="qualifications"
                label="Academic Qualifications"
                fullWidth
                value={formData.qualifications}
                onChange={handleChange}
                placeholder="e.g. M.A Urdu, B.Ed"
              />
              <TextField
                name="address"
                label="Current Address"
                fullWidth
                multiline
                rows={2}
                value={formData.address}
                onChange={handleChange}
              />
            </>
          )}

          {(formData.role === 'teacher' || formData.role === 'mudaris' || formData.role === 'pending_teacher') && (
            <TextField
              name="subject"
              label="Primary Subject Expertise"
              fullWidth
              value={formData.subject}
              onChange={handleChange}
              placeholder="e.g. Quran, Arabic"
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
