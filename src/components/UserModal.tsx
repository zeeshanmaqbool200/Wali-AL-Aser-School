import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Box, Typography, Grid, TextField, Avatar, IconButton, 
  Button, Paper, Stack, FormControl, InputLabel, 
  Select, MenuItem, Switch, FormControlLabel, InputAdornment, Menu
} from '@mui/material';
import { 
  UserPlus, Mail, Shield, User, GraduationCap, 
  BookOpen, Camera, Calendar, UserCheck, History, 
  Eye, EyeOff, AlertTriangle, UserCircle, Upload 
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import ImageCaptureDialog from './ImageCaptureDialog';
import { useAuth } from '../context/AuthContext';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'motion/react';

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: UserProfile | null;
  title?: string;
  existingUsers?: UserProfile[]; // Added for duplicate checking
}

const CLASS_LEVELS = ['Mubtadi', 'Awal', 'Duom', 'Soum', 'Chaharm', 'Panjum', 'Shasham', 'Haftum', 'Hashtum', 'Nahum', 'Dahum', 'Hafiz', 'Takhassus'];

export default function UserModal({ open, onClose, onSubmit, initialData, title, existingUsers = [] }: UserModalProps) {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'manager';

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
    photoURL: '',
    dob: '',
    createAccount: true, // New field
    autoPassword: true, // New field
  });

  const [captureOpen, setCaptureOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<UserProfile | null>(null);
  const [photoMenuAnchor, setPhotoMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        displayName: initialData.displayName || '',
        email: initialData.email || '',
        role: initialData.role || 'student',
        classLevel: initialData.classLevel || '',
        subject: initialData.subject || '',
        password: '', 
        fatherName: initialData.fatherName || '',
        motherName: initialData.motherName || '',
        phone: initialData.phone || '',
        whatsapp: initialData.whatsapp || '',
        address: initialData.address || '',
        qualifications: initialData.qualifications || '',
        expertise: initialData.expertise || [],
        admissionDate: (() => {
          const date = initialData.admissionDate || (initialData.createdAt ? new Date(initialData.createdAt).toISOString().split('T')[0] : '');
          return date || new Date().toISOString().split('T')[0];
        })(),
        studentId: initialData.admissionNo || initialData.studentId || initialData.staffId || '',
        photoURL: initialData.photoURL || '',
        dob: initialData.dob || '',
        createAccount: false, // Default false for edit
        autoPassword: true
      });
    } else {
      setFormData({
        displayName: '',
        email: '',
        role: 'student',
        classLevel: '',
        subject: '',
        password: '',
        fatherName: '',
        motherName: '',
        phone: '',
        whatsapp: '',
        address: '',
        qualifications: '',
        expertise: [],
        admissionDate: new Date().toISOString().split('T')[0],
        studentId: '',
        photoURL: '',
        dob: '',
        createAccount: true,
        autoPassword: true
      });
    }
    setDuplicateWarning(null);
  }, [open, initialData]);

  // Duplicate Check Trigger
  useEffect(() => {
    if (!initialData && open && formData.displayName && (formData.fatherName || formData.email)) {
      const duplicate = existingUsers.find(u => 
        (u.displayName?.toLowerCase() === formData.displayName.toLowerCase() && 
         u.fatherName?.toLowerCase() === formData.fatherName?.toLowerCase() &&
         formData.fatherName !== '') ||
        (u.email?.toLowerCase() === formData.email.toLowerCase() && formData.email !== '')
      );
      setDuplicateWarning(duplicate || null);
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.displayName, formData.fatherName, formData.email, existingUsers, initialData, open]);

  // Auto Password Logic
  useEffect(() => {
    if (formData.autoPassword && formData.displayName && formData.dob) {
      const firstName = formData.displayName.split(' ')[0];
      const year = formData.dob.split('-')[0] || '2024';
      setFormData(prev => ({ ...prev, password: `${firstName}${year}` }));
    }
  }, [formData.autoPassword, formData.displayName, formData.dob]);

  useEffect(() => {
    if (open && formData.role === 'student' && !formData.studentId && !initialData) {
      const year = new Date().getFullYear().toString().slice(-2);
      const random = Math.floor(1000 + Math.random() * 9000);
      setFormData(prev => ({ ...prev, studentId: `REG-${year}-${random}` }));
    }
  }, [open, formData.role, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name as string]: value }));
  };

  const handleCapture = (base64: string) => {
    setFormData(prev => ({ ...prev, photoURL: base64 }));
    setPhotoMenuAnchor(null);
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
    setPhotoMenuAnchor(null);
  };

  const handleSubmit = () => {
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm" 
      PaperProps={{ 
        sx: { 
          borderRadius: 4,
          backgroundImage: 'none'
        } 
      }}
    >
      <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <UserCircle size={24} color="#1976d2" />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 950, letterSpacing: -0.5 }}>
            {title || (initialData ? 'Edit Profile' : 'New Admission')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            {initialData ? 'Refine member details' : 'Register a new institutional member'}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {duplicateWarning && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
               <Paper 
                 sx={{ 
                   p: 2, bgcolor: alpha('#f59e0b', 0.1), border: '1px solid', borderColor: '#f59e0b', borderRadius: 3,
                   display: 'flex', gap: 2, alignItems: 'center'
                 }}
               >
                 <AlertTriangle color="#f59e0b" size={24} />
                 <Box>
                   <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#92400e' }}>Possible Duplicate Detected</Typography>
                   <Typography variant="caption" sx={{ fontWeight: 700, color: '#b45309' }}>
                     {duplicateWarning.displayName} ({duplicateWarning.admissionNo}) already exists in records.
                   </Typography>
                 </Box>
               </Paper>
            </motion.div>
          )}

          {/* Unified Photo Section */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar 
                src={formData.photoURL} 
                sx={{ 
                  width: 120, height: 120, border: '4px solid', borderColor: 'primary.main', borderRadius: 4,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)', bgcolor: alpha('#1976d2', 0.05)
                }}
              >
                <User size={60} color={alpha('#1976d2', 0.2)} />
              </Avatar>
              <IconButton 
                onClick={(e) => setPhotoMenuAnchor(e.currentTarget)}
                sx={{ 
                  position: 'absolute', bottom: -10, right: -10, 
                  bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' },
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)', p: 1.5
                }}
              >
                <Camera size={20} />
              </IconButton>
              <Menu
                anchorEl={photoMenuAnchor}
                open={Boolean(photoMenuAnchor)}
                onClose={() => setPhotoMenuAnchor(null)}
                PaperProps={{ sx: { borderRadius: 3, p: 1, mt: 1, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' } }}
              >
                <MenuItem onClick={() => setCaptureOpen(true)} sx={{ borderRadius: 2, py: 1.2, fontWeight: 700, gap: 1.5 }}>
                  <Camera size={18} /> Take Photo
                </MenuItem>
                <MenuItem component="label" sx={{ borderRadius: 2, py: 1.2, fontWeight: 700, gap: 1.5 }}>
                  <Upload size={18} /> Upload from Device
                  <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="displayName" label="Full Name / مکمل نام" fullWidth required
                value={formData.displayName} onChange={handleChange}
                placeholder="Enter candidate's full name"
                InputProps={{ sx: { borderRadius: 3, fontFamily: "'Noto Nastaliq Urdu', 'Inter', sans-serif" } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="email" label="Email Address" type="email" fullWidth required
                value={formData.email} onChange={handleChange}
                disabled={!!initialData}
                placeholder="email@example.com"
                InputProps={{ sx: { borderRadius: 3 } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Role Access</InputLabel>
                <Select
                  name="role" value={formData.role} onChange={handleChange as any}
                  label="Role Access" sx={{ borderRadius: 3 }}
                >
                  <MenuItem value="student">Student / طالب علم</MenuItem>
                  <MenuItem value="teacher">Teacher / مدرس</MenuItem>
                  <MenuItem value="staff">Other Staff / اسٹاف</MenuItem>
                  <MenuItem value="manager">Manager / منتظم</MenuItem>
                  <MenuItem value="superadmin">Administrator / ایڈمنسٹریٹر</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="dob" label="Date of Birth" type="date" fullWidth required
                value={formData.dob} onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                InputProps={{ sx: { borderRadius: 3 } }}
              />
            </Grid>

            {formData.role === 'student' && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                   <TextField
                    name="fatherName" label="Father's Name / ولدیت" fullWidth required
                    value={formData.fatherName} onChange={handleChange}
                    InputProps={{ sx: { borderRadius: 3, fontFamily: "'Noto Nastaliq Urdu', 'Inter', sans-serif" } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Primary Class</InputLabel>
                    <Select
                      name="classLevel" value={formData.classLevel} onChange={handleChange as any}
                      label="Primary Class" sx={{ borderRadius: 3 }}
                    >
                      {CLASS_LEVELS.map(level => (
                        <MenuItem key={level} value={level}>{level}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="phone" label="Phone Number" fullWidth
                value={formData.phone} onChange={handleChange}
                placeholder="0300 0000000"
                InputProps={{ sx: { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
               <TextField
                name="admissionNo" label={formData.role === 'student' ? "Admission No / رجسٹریشن نمبر" : "Staff ID"} 
                fullWidth value={formData.studentId} onChange={(e) => setFormData(p => ({ ...p, studentId: e.target.value }))}
                InputProps={{ sx: { borderRadius: 3 } }}
              />
            </Grid>
          </Grid>

          {!initialData && (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: alpha('#1976d2', 0.03), border: '1px solid', borderColor: alpha('#1976d2', 0.1) }}>
              <Stack spacing={2}>
                 <FormControlLabel
                   control={<Switch checked={formData.createAccount} onChange={(e) => setFormData(p => ({ ...p, createAccount: e.target.checked }))} />}
                   label={<Typography sx={{ fontWeight: 800 }}>Create Authentication Login</Typography>}
                 />
                 
                 <AnimatePresence>
                   {formData.createAccount && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <Stack spacing={2}>
                          <FormControlLabel
                            control={<Switch checked={formData.autoPassword} onChange={(e) => setFormData(p => ({ ...p, autoPassword: e.target.checked }))} />}
                            label={<Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>Generate Password Automatically</Typography>}
                          />
                          
                          {!formData.autoPassword && (
                            <TextField
                              name="password" label="Manual Password" type={showPassword ? 'text' : 'password'}
                              fullWidth value={formData.password} onChange={handleChange}
                              InputProps={{ 
                                sx: { borderRadius: 3 },
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton>
                                  </InputAdornment>
                                )
                              }}
                            />
                          )}
                        </Stack>
                     </motion.div>
                   )}
                 </AnimatePresence>
              </Stack>
            </Paper>
          )}

          {/* Edit History Section - Admin Only */}
          {isAdmin && initialData && initialData.editHistory && initialData.editHistory.length > 0 && (
            <Box sx={{ mt: 2, pt: 3, borderTop: '1px dotted', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, opacity: 0.6 }}>
                <History size={18} />
                <Typography variant="subtitle2" sx={{ fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  Modification History
                </Typography>
              </Stack>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 150, overflowY: 'auto' }}>
                {initialData.editHistory.slice().reverse().map((edit, i) => (
                  <Box 
                    key={i} 
                    sx={{ 
                      p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.75rem' }}>{edit.action}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>By {edit.modifiedBy || 'System'}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 700 }}>
                      {new Date(edit.timestamp).toLocaleDateString()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 3, fontWeight: 800, px: 3 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.displayName || !formData.email || !formData.role}
          sx={{ borderRadius: 3, fontWeight: 900, px: 4, py: 1 }}
        >
          {initialData ? 'Update Member' : 'Register Member'}
        </Button>
      </DialogActions>

      <ImageCaptureDialog 
        open={captureOpen} 
        onClose={() => setCaptureOpen(false)} 
        onCapture={handleCapture}
        title={initialData ? "Update Profile Photo" : "Add Profile Photo"}
      />
    </Dialog>
  );
}

