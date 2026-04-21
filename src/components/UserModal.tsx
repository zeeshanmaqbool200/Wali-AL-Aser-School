import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Box, Typography, Grid, Avatar } from '@mui/material';
import { UserPlus, Mail, Shield, User, GraduationCap, BookOpen } from 'lucide-react';
import { UserRole } from '../types';

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export default function UserModal({ open, onClose, onSubmit }: UserModalProps) {
  const [formData, setFormData] = React.useState({
    displayName: '',
    email: '',
    role: 'student' as UserRole,
    grade: '',
    subject: '',
    password: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name as string]: value }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <UserPlus size={24} color="#1976d2" />
        Add New User
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <TextField
            name="displayName"
            label="Full Name"
            fullWidth
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
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="super-admin">Super Admin</MenuItem>
            </Select>
          </FormControl>

          {formData.role === 'student' && (
            <TextField
              name="grade"
              label="Grade / Class"
              fullWidth
              value={formData.grade}
              onChange={handleChange}
              InputProps={{
                startAdornment: <GraduationCap size={18} style={{ marginRight: 12, color: '#666' }} />,
              }}
            />
          )}

          {formData.role === 'approved_mudaris' && (
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
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.displayName || !formData.email || !formData.role}
          sx={{ px: 4 }}
        >
          Create User
        </Button>
      </DialogActions>
    </Dialog>
  );
}
