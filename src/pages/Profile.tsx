import React, { useState, useEffect } from 'react';
/* Profile Page - Allows users to manage their personal information */
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Avatar, IconButton, Chip, CircularProgress, 
  Stack, Snackbar, useMediaQuery, Alert, Divider, Dialog
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Camera, Save, User, Mail, Phone, MapPin, ChevronLeft, Send, AlertCircle, Contact } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, smartUpdateDoc } from '../firebase';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../lib/logger';
import ImageCaptureDialog from '../components/ImageCaptureDialog';
import SavingOverlay from '../components/SavingOverlay';
import IDCardModal from '../components/IDCardModal';
import AdmissionFormPrint from '../components/AdmissionFormPrint';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';

export default function Profile() {
  const { user: currentUser, instituteSettings } = useAuth();
  const { setIsSaving } = useData();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<Partial<UserProfile>>({});
  const [originalData, setOriginalData] = useState<string>('');
  const [openCapture, setOpenCapture] = useState(false);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ 
    open: false, message: '', severity: 'success' 
  });
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  const handleSendRequest = async () => {
    if (!currentUser || !requestNote.trim()) return;
    setSendingRequest(true);
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      await addDoc(collection(db, 'notifications'), {
        type: 'sensitive_edit_request',
        title: 'Sensitive Edit Request',
        message: `${currentUser.displayName} has requested a sensitive data change: ${requestNote}`,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        targetType: 'role',
        targetId: 'superadmin',
        createdAt: Date.now(),
        readBy: []
      });
      setSnackbar({ open: true, message: "Request sent to Administration!", severity: 'success' });
      setRequestDialogOpen(false);
      setRequestNote('');
    } catch (err) {
      logger.error('Failed to send request', err);
      setSnackbar({ open: true, message: "Failed to send request", severity: 'error' });
    } finally {
      setSendingRequest(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) return;
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          
          // Auto-generate staffId for superadmin if missing
          if (data.role === 'superadmin' && !data.staffId) {
            const generatedId = `ADM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            await updateDoc(userRef, { staffId: generatedId });
            data.staffId = generatedId;
            logger.info('Generated unique Staff ID for Administrator');
          }

          setProfileData(data);
          setOriginalData(JSON.stringify(data));
        }
      } catch (err) {
        logger.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    setIsSaving(true);
    try {
      logger.db('Updating Profile', `users/${currentUser.uid}`);
      
      const isTeacher = profileData.role === 'teacher';
      
      // Specifically allow only these fields for self-update
      const finalData: any = {
        displayName: profileData.displayName || '',
        phone: profileData.phone || '',
        whatsapp: profileData.whatsapp || '',
        address: profileData.address || '',
        fatherName: profileData.fatherName || '',
        motherName: profileData.motherName || '',
        dob: profileData.dob || '',
        qualifications: profileData.qualifications || '',
        updatedAt: Date.now()
      };

      if (isTeacher) {
        // If teacher, profession and expertise must be pending
        finalData.pendingProfileChanges = {
          profession: profileData.profession || '',
          expertise: profileData.expertise || [],
          status: 'pending',
          submittedAt: Date.now()
        };
        // Don't update current profession/expertise yet
      }
      
      if (profileData.photoURL) {
        finalData.photoURL = profileData.photoURL;
      } else if (profileData.displayName) {
        finalData.photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.displayName)}&background=random&color=fff`;
      }
      
      await smartUpdateDoc(doc(db, 'users', currentUser.uid), finalData);
      setOriginalData(JSON.stringify({ ...profileData, ...finalData }));
      // Notification removed per user request "dont show notification prompt after saving"
      logger.success('Profile Updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    } finally {
      setSaving(false);
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 400;
        if (width > height) {
          if (width > max) {
            height *= max / width;
            width = max;
          }
        } else {
          if (height > max) {
            width *= max / height;
            height = max;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setProfileData({ ...profileData, photoURL: base64 });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isDirty = originalData !== JSON.stringify(profileData);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', pb: 8, px: { xs: 2, sm: 0 } }}>
      <SavingOverlay isSaving={saving} message="Updating Secure Profile..." />
      <IDCardModal open={idCardOpen} user={profileData as any} onClose={() => setIdCardOpen(false)} />
      <AdmissionFormPrint ref={printRef} user={profileData as any} settings={instituteSettings} />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 900, letterSpacing: -1.5 }}>
            Personal Profile
          </Typography>
          <Stack direction="row" spacing={1}>
            {profileData.role === 'student' && (
              <Button
                variant="contained"
                size={isMobile ? "small" : "medium"}
                startIcon={<Printer size={isMobile ? 16 : 20} />}
                onClick={() => handlePrint()}
                sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none' }}
              >
                Admission Form
              </Button>
            )}
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              startIcon={<Contact size={isMobile ? 16 : 20} />}
              onClick={() => setIdCardOpen(true)}
              sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none' }}
            >
              Digital ID
            </Button>
          </Stack>
        </Box>

        <Card sx={{ 
          borderRadius: 2, 
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: 'none',
        }}>
          <Box sx={{ 
            height: 120, 
            bgcolor: 'primary.main', 
            position: 'relative',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
          }}>
            <Box sx={{ 
              position: 'absolute', 
              bottom: isMobile ? -60 : -40, 
              left: isMobile ? '50%' : 24,
              transform: isMobile ? 'translateX(-50%)' : 'none',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'center' : 'flex-end',
              gap: 2,
              width: isMobile ? '100%' : 'auto',
              textAlign: isMobile ? 'center' : 'left'
            }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar 
                  src={profileData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.displayName || 'User')}&background=random&color=fff`} 
                  imgProps={{ referrerPolicy: 'no-referrer' }}
                  sx={{ 
                    width: 100, 
                    height: 100, 
                    border: '4px solid',
                    borderColor: 'background.paper',
                    bgcolor: 'grey.200'
                  }}
                >
                  {profileData.displayName?.charAt(0)}
                </Avatar>
                <IconButton 
                  size="small"
                  onClick={() => setOpenCapture(true)}
                  sx={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    right: 0, 
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'background.default' }
                  }}
                >
                  <Camera size={16} />
                </IconButton>
                <ImageCaptureDialog 
                  open={openCapture}
                  onClose={() => setOpenCapture(false)}
                  onCapture={(base64) => setProfileData({ ...profileData, photoURL: base64 })}
                />
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  {profileData.displayName}
                </Typography>
                <Chip 
                  label={profileData.role === 'superadmin' ? 'ADMINISTRATOR' : profileData.role?.toUpperCase()} 
                  size="small" 
                  sx={{ fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', mt: 0.5, borderRadius: 1 }} 
                />
              </Box>
            </Box>
          </Box>

          <CardContent sx={{ pt: isMobile ? 12 : 8, px: 3, pb: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label={profileData.role === 'student' ? 'Admission No' : (profileData.role === 'superadmin' ? 'Admin ID' : 'Staff ID')}
                  value={profileData.admissionNo || profileData.staffId || profileData.teacherId || profileData.studentId || 'N/A'}
                  disabled
                  InputProps={{ 
                    sx: { borderRadius: 1.5, bgcolor: alpha(theme.palette.action.disabledBackground, 0.05) }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Display Name"
                  value={profileData.displayName || ''}
                  onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                  InputProps={{ 
                    startAdornment: <User size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
                    sx: { borderRadius: 1.5 }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={profileData.email || ''}
                  disabled
                  InputProps={{ 
                    startAdornment: <Mail size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
                    sx: { borderRadius: 1.5, bgcolor: alpha(theme.palette.action.disabledBackground, 0.05) }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={profileData.phone || ''}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  inputProps={{ 
                    inputMode: 'tel',
                    pattern: '[0-9]*'
                  }}
                  InputProps={{ 
                    startAdornment: <Phone size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
                    sx: { borderRadius: 1.5 }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Father's Name"
                  value={profileData.fatherName || ''}
                  onChange={(e) => setProfileData({ ...profileData, fatherName: e.target.value })}
                  InputProps={{ sx: { borderRadius: 1.5 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Mother's Name"
                  value={profileData.motherName || ''}
                  onChange={(e) => setProfileData({ ...profileData, motherName: e.target.value })}
                  InputProps={{ sx: { borderRadius: 1.5 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  value={profileData.dob || ''}
                  onChange={(e) => setProfileData({ ...profileData, dob: e.target.value })}
                  InputProps={{ sx: { borderRadius: 1.5 } }}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="WhatsApp"
                  value={profileData.whatsapp || ''}
                  onChange={(e) => setProfileData({ ...profileData, whatsapp: e.target.value })}
                  inputProps={{ 
                    inputMode: 'tel',
                    pattern: '[0-9]*'
                  }}
                  InputProps={{ sx: { borderRadius: 1.5 } }}
                />
              </Grid>
              {(profileData.role === 'teacher' || profileData.role === 'manager' || profileData.role === 'superadmin') && (
                <Grid size={12}>
                  <TextField 
                    fullWidth 
                    label="Qualifications" 
                    value={profileData.qualifications || ''} 
                    onChange={(e) => setProfileData({ ...profileData, qualifications: e.target.value })} 
                    placeholder="e.g. M.A Urdu, B.Ed, Hafiz-e-Quran"
                    helperText="Academic or professional degrees"
                    InputProps={{ sx: { borderRadius: 1.5 } }}
                  />
                </Grid>
              )}
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={2}
                  value={profileData.address || ''}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  InputProps={{ 
                    startAdornment: <MapPin size={18} style={{ marginRight: 8, marginTop: 4, alignSelf: 'flex-start', opacity: 0.5 }} />,
                    sx: { borderRadius: 1.5 }
                  }}
                />
              </Grid>

              {/* Teacher Specific Fields with Pending Logic */}
              {profileData.role === 'teacher' && (
                <>
                  <Grid size={12} sx={{ mt: 2 }}>
                    <Divider sx={{ mb: 2 }}>
                      <Chip label="PROfESSIONAL DETAILS" size="small" sx={{ fontWeight: 900, letterSpacing: 1 }} />
                    </Divider>
                    {profileData.pendingProfileChanges?.status === 'pending' && (
                      <Alert severity="info" sx={{ mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'info.light' }}>
                        You have pending changes for Profession/Expertise awaiting Admin approval.
                      </Alert>
                    )}
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Profession"
                      placeholder="e.g. Software Engineer, Doctor"
                      value={profileData.profession || ''}
                      onChange={(e) => setProfileData({ ...profileData, profession: e.target.value })}
                      InputProps={{ sx: { borderRadius: 1.5 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Expertise (Comma separated)"
                      placeholder="e.g. Math, Quran, Physics"
                      value={profileData.expertise?.join(', ') || ''}
                      onChange={(e) => setProfileData({ ...profileData, expertise: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                      InputProps={{ sx: { borderRadius: 1.5 } }}
                    />
                  </Grid>
                </>
              )}
            </Grid>

            <AnimatePresence>
              {isDirty && (
                <Box 
                  component={motion.div}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}
                >
                  {(profileData.role === 'teacher' || profileData.role === 'manager') && (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<AlertCircle size={20} />}
                      onClick={() => setRequestDialogOpen(true)}
                      sx={{ 
                        borderRadius: 1.5, 
                        fontWeight: 800, 
                        px: 3, 
                        py: 1.2,
                        textTransform: 'none',
                        borderWidth: 2,
                        '&:hover': { borderWidth: 2 }
                      }}
                    >
                      Request Sensitive Edit
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save size={20} />}
                    onClick={handleSave}
                    disabled={saving}
                    sx={{ 
                      borderRadius: 1.5, 
                      fontWeight: 800, 
                      px: 4, 
                      py: 1.2,
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover': { boxShadow: 'none' }
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Profile Changes'}
                  </Button>
                </Box>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />

      <Dialog open={requestDialogOpen} onClose={() => setRequestDialogOpen(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertCircle color={theme.palette.warning.main} /> Request Sensitive Change
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Use this to request changes to locked data (like joining date, permanent records etc.) or to provide feedback to the Head of Institute.
          </Typography>
          <TextField
             fullWidth
             multiline
             rows={4}
             placeholder="Describe the change you need or your feedback..."
             value={requestNote}
             onChange={(e) => setRequestNote(e.target.value)}
             InputProps={{ sx: { borderRadius: 2 } }}
          />
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button onClick={() => setRequestDialogOpen(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
            <Button 
               variant="contained" 
               startIcon={sendingRequest ? <CircularProgress size={16} color="inherit" /> : <Send size={18} />} 
               disabled={sendingRequest || !requestNote.trim()}
               onClick={handleSendRequest}
               sx={{ borderRadius: 2, fontWeight: 800, px: 3 }}
            >
              Send Request
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}
