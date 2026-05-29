import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Paper, 
  Avatar, 
  Stack, 
  Chip, 
  Tabs, 
  Tab, 
  Divider, 
  Button, 
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  useTheme,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog
} from '@mui/material';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  FileText, 
  Award,
  Contact,
  QrCode,
  BookOpen,
  Edit2,
  Printer,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, FeeReceipt, Attendance, Certificate } from '../types';
import IDCardModal from '../components/IDCardModal';
import { QRCodeSVG } from 'qrcode.react';
import AdmissionFormModal from '../components/AdmissionFormModal';
import UserModal from '../components/UserModal';
import CertificateModal from '../components/CertificateModal';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

const AcademicTab = ({ 
  user, 
  attendance, 
  isAdmin, 
  currentUser, 
  onIssueCertificate,
  onRevokeCertificate,
  setSelectedCert,
  setCertModalOpen
}: { 
  user: UserProfile, 
  attendance: Attendance[], 
  isAdmin: boolean,
  currentUser: any,
  onIssueCertificate: (cert: Certificate) => void,
  onRevokeCertificate: (certId: string) => void,
  setSelectedCert: (cert: Certificate | null) => void,
  setCertModalOpen: (open: boolean) => void
}) => {
  const theme = useTheme();
  
  const quizData = useMemo(() => {
    return (user.quizScores || []).map(s => ({
      name: s.sectionId.substring(0, 5),
      score: s.score,
      total: s.total,
      percentage: (s.score / s.total) * 100
    }));
  }, [user.quizScores]);

  const avgAccuracy = useMemo(() => {
    if (!user.quizScores || user.quizScores.length === 0) return 0;
    const total = user.quizScores.reduce((acc, curr) => acc + (curr.score / curr.total), 0);
    return Math.round((total / user.quizScores.length) * 100);
  }, [user.quizScores]);

  const courseCompletion = useMemo(() => {
    const totalEnrolled = user.enrolledCourses?.length || 0;
    const completed = Object.values(user.readingProgress || {}).filter(p => !!p.completedAt).length;
    return totalEnrolled > 0 ? Math.round((completed / totalEnrolled) * 100) : 0;
  }, [user.enrolledCourses, user.readingProgress]);

  return (
    <Box 
      component={motion.div}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Paper sx={{ p: 4, borderRadius: 6, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: 2 }}>QUIZ ACCURACY</Typography>
              <Typography variant="h2" sx={{ fontWeight: 950, my: 1, color: 'primary.main', letterSpacing: -2 }}>
                {avgAccuracy}%
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.6, fontWeight: 700 }}>Overall Performance</Typography>
              <Box sx={{ height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={quizData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <Area type="monotone" dataKey="percentage" stroke={theme.palette.primary.main} fill={alpha(theme.palette.primary.main, 0.1)} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Paper>

            <Paper sx={{ p: 4, borderRadius: 6, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: 2 }}>SUBJECT MASTERY</Typography>
              <Typography variant="h2" sx={{ fontWeight: 950, my: 1, color: 'secondary.main', letterSpacing: -2 }}>
                {courseCompletion}%
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.6, fontWeight: 700 }}>Library Progress</Typography>
              <Box sx={{ mt: 3, height: 8, bgcolor: alpha(theme.palette.secondary.main, 0.1), borderRadius: 10, overflow: 'hidden' }}>
                <Box sx={{ width: `${courseCompletion}%`, height: '100%', bgcolor: 'secondary.main' }} />
              </Box>
            </Paper>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 4, borderRadius: 6, mb: 4, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 950, mb: 4 }}>Quiz Performance History</Typography>
            {quizData.length > 0 ? (
               <Box sx={{ height: 300, width: '100%' }}>
                  <ResponsiveContainer>
                    <BarChart data={quizData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                      <XAxis dataKey="name" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} fontWeight={900} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 800 }}
                      />
                      <Bar dataKey="percentage" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
               </Box>
            ) : (
              <Box sx={{ py: 10, textAlign: 'center' }}>
                <Award size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                <Typography variant="body2" color="text.secondary">No assessment results recorded yet.</Typography>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 4, borderRadius: 6, border: '1px solid', borderColor: 'divider' }}>
             <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 950 }}>Academic Certificates</Typography>
                {isAdmin && (
                  <Button 
                    variant="contained" 
                    size="small" 
                    startIcon={<Award size={16} />}
                    onClick={() => {
                        const newCert: Certificate = {
                          id: Math.random().toString(36).substring(7),
                          studentId: user.uid!,
                          studentName: user.displayName,
                          courseId: 'manual-issue',
                          courseName: 'General Academic Excellence',
                          issueDate: Date.now(),
                          issuedBy: currentUser?.displayName || 'Admin',
                          certificateNumber: `MP-${Date.now().toString().slice(-6)}`,
                          template: 'islamic',
                          status: 'approved'
                        };
                        onIssueCertificate(newCert);
                    }}
                    sx={{ borderRadius: 10, fontWeight: 900, px: 3 }}
                  >
                    Issue Manual
                  </Button>
                )}
             </Stack>
             <List disablePadding>
                {(user.certificates || []).map((cert: any) => (
                   <ListItem 
                    key={cert.id} 
                    sx={{ px: 0, py: 2, borderBottom: '1px solid', borderColor: alpha(theme.palette.divider, 0.05), cursor: 'pointer' }}
                    onClick={() => onIssueCertificate(cert)}
                   >
                      <ListItemIcon><Award size={24} color="#B8860B" /></ListItemIcon>
                      <ListItemText 
                        primary={<Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{cert.courseName}</Typography>}
                        secondary={<Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.5 }}>Issued: {new Date(cert.issueDate).toLocaleDateString()}</Typography>}
                      />
                      <Stack direction="row" spacing={1}>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setSelectedCert(cert); 
                            setCertModalOpen(true); 
                          }}
                        >
                          <Printer size={18} />
                        </IconButton>
                        {isAdmin && (
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              onRevokeCertificate(cert.id); 
                            }}
                          >
                            <Trash2 size={18} />
                          </IconButton>
                        )}
                      </Stack>
                   </ListItem>
                ))}
                {(user.certificates || []).length === 0 && (
                   <Box sx={{ py: 6, textAlign: 'center', opacity: 0.3 }}>
                      <Award size={40} style={{ marginBottom: 8 }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, display: 'block' }}>NO CERTIFICATES ISSUED</Typography>
                   </Box>
                )}
             </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

const UserProfileView = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const { receipts: allReceipts, attendance: allAttendance, users: allUsers } = useData();
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'manager';
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [idModalOpen, setIdModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [admissionFormOpen, setAdmissionFormOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [certToRevoke, setCertToRevoke] = useState<string | null>(null);

  // Derived synced data
  const fees = useMemo(() => {
    return allReceipts.filter(r => r.studentId === uid || r.studentOfficialId === user?.studentId || r.studentOfficialId === user?.admissionNo);
  }, [allReceipts, uid, user?.studentId, user?.admissionNo]);

  const attendance = useMemo(() => {
    return allAttendance
      .filter(a => a.studentId === uid)
      .sort((a, b) => {
        const getDate = (obj: any) => {
          if (!obj) return 0;
          if (obj.toDate) return obj.toDate().getTime();
          if (obj.seconds) return obj.seconds * 1000;
          if (typeof obj === 'number') return obj;
          const d = new Date(obj);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getDate(b.date) - getDate(a.date);
      });
  }, [allAttendance, uid]);

  const handleIssueCertificate = async (cert: Certificate) => {
    if (!uid) return;
    
    // If it's a new cert (wasn't already in user.certificates), save it to Firestore
    const isNew = !user?.certificates?.find(c => c.id === cert.id);
    
    if (isNew) {
      try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          certificates: arrayUnion(cert)
        });
        setUser(prev => prev ? ({
          ...prev,
          certificates: [...(prev.certificates || []), cert]
        }) : null);
        toast.success('Certificate officially synchronized');
      } catch (error) {
        toast.error('Failed to sync certificate');
      }
    }
    
    setSelectedCert(cert);
    setCertModalOpen(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!uid) return;
      setLoading(true);
      try {
        // Fetch User Profile
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          setUser({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid]);

  const handleRevokeCertificate = async (certId: string) => {
    setCertToRevoke(certId);
    setRevokeConfirmOpen(true);
  };

  const confirmRevokeCertificate = async () => {
    if (!uid || !user || !certToRevoke) return;
    
    try {
      const userRef = doc(db, 'users', uid);
      const updatedCertificates = (user.certificates || []).filter((c: any) => c.id !== certToRevoke);
      
      await updateDoc(userRef, {
        certificates: updatedCertificates
      });

      setUser(prev => prev ? ({
        ...prev,
        certificates: updatedCertificates
      }) : null);

      toast.success('Certificate revoked successfully');
    } catch (error) {
      console.error('Error revoking certificate:', error);
      toast.error('Failed to revoke certificate');
    } finally {
      setRevokeConfirmOpen(false);
      setCertToRevoke(null);
    }
  };

  const handleUpdateProfile = async (updatedData: any) => {
    if (!uid || !user) return;
    
    try {
      const userRef = doc(db, 'users', uid);
      
      // Map form data back to UserProfile fields
      const updatePayload: any = {
        displayName: updatedData.displayName,
        role: updatedData.role,
        classLevel: updatedData.classLevel,
        subject: updatedData.subject,
        fatherName: updatedData.fatherName,
        motherName: updatedData.motherName,
        phone: updatedData.phone,
        whatsapp: updatedData.whatsapp,
        address: updatedData.address,
        qualifications: updatedData.qualifications,
        dob: updatedData.dob,
        admissionNo: updatedData.studentId,
        photoURL: updatedData.photoURL,
        updatedAt: Date.now(),
        editHistory: [
          ...(user.editHistory || []),
          {
            timestamp: Date.now(),
            modifiedBy: currentUser?.displayName || 'Admin',
            action: 'Profile Updated'
          }
        ]
      };

      await updateDoc(userRef, updatePayload);
      setUser(prev => prev ? ({ ...prev, ...updatePayload }) : null);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Container sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h5">Member not found</Typography>
        <Button onClick={() => navigate('/users')} startIcon={<ArrowLeft />} sx={{ mt: 2 }}>
          Back to Directory
        </Button>
      </Container>
    );
  }

  const roleLabel = (user.role || 'Member').replace(/_/g, ' ');

  const DetailItem = ({ icon: Icon, label, value }: any) => (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), color: 'primary.main' }}>
        <Icon size={18} />
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {value || 'N/A'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ pb: 8 }}>
      <IDCardModal open={idModalOpen} user={user} onClose={() => setIdModalOpen(false)} />
      {user && <AdmissionFormModal open={admissionFormOpen} onClose={() => setAdmissionFormOpen(false)} user={user} />}
      <UserModal 
        open={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        initialData={user} 
        onSubmit={handleUpdateProfile} 
      />
      <CertificateModal 
        open={certModalOpen} 
        onClose={() => setCertModalOpen(false)} 
        certificate={selectedCert} 
        onRevoke={handleRevokeCertificate}
      />

      <Dialog 
        open={revokeConfirmOpen} 
        onClose={() => setRevokeConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
      >
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <AlertCircle size={48} color={theme.palette.error.main} style={{ marginBottom: 16 }} />
          <Typography variant="h6" sx={{ fontWeight: 950, mb: 1 }}>Revoke Certificate?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This action will permanently remove this certificate from the student's profile.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button 
              onClick={() => setRevokeConfirmOpen(false)} 
              variant="outlined" 
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmRevokeCertificate} 
              variant="contained" 
              color="error"
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Revoke Now
            </Button>
          </Stack>
        </Box>
      </Dialog>
      
      <Dialog open={qrModalOpen} onClose={() => setQrModalOpen(false)} sx={{ '& .MuiDialog-paper': { borderRadius: 6, p: 4, textAlign: 'center' } }}>
        <Typography variant="h6" sx={{ fontWeight: 950, mb: 3 }}>Verification Portal</Typography>
        <Box sx={{ p: 4, bgcolor: 'white', borderRadius: 4, display: 'inline-block', boxShadow: theme.shadows[10], mb: 3 }}>
          <QRCodeSVG value={`${window.location.origin}/verify/member/${user.uid}`} size={240} level="H" includeMargin={true} />
        </Box>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: 1 }}>
          SECURE SCAN TO VERIFY IDENTITY
        </Typography>
        <Button onClick={() => setQrModalOpen(false)} variant="outlined" sx={{ mt: 3, borderRadius: 2, fontWeight: 900 }}>Dismiss</Button>
      </Dialog>
      
      {/* Header / Hero Section */}
      <Box sx={{ 
        bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
        borderBottom: '1px solid',
        borderColor: 'divider',
        pt: { xs: 4, md: 8 },
        pb: 4
      }}>
        <Container maxWidth="lg">
          <Button 
            onClick={() => navigate('/users')} 
            startIcon={<ArrowLeft size={18} />}
            sx={{ mb: 4, fontWeight: 900, borderRadius: 2, textTransform: 'none' }}
          >
            Directory
          </Button>

          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 8 }}>
              <Box sx={{ display: 'flex', gap: { xs: 2, sm: 4 }, alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' }, textAlign: { xs: 'center', sm: 'left' } }}>
                <Avatar 
                  src={user.photoURL} 
                  sx={{ 
                    width: { xs: 120, sm: 160 }, 
                    height: { xs: 120, sm: 160 }, 
                    border: '6px solid white', 
                    borderRadius: 6,
                    boxShadow: theme.shadows[10],
                    bgcolor: 'primary.main'
                  }}
                >
                  {user.displayName?.charAt(0)}
                </Avatar>
                
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'center', sm: 'flex-start' }} sx={{ mb: 1 }}>
                    <Chip 
                      label={roleLabel.toUpperCase()} 
                      size="small" 
                      sx={{ fontWeight: 950, bgcolor: 'primary.main', color: 'white', borderRadius: 1.5, letterSpacing: 1 }} 
                    />
                    {user.isVerified && <CheckCircle2 size={18} color={theme.palette.success.main} />}
                    <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', bgcolor: alpha(theme.palette.text.secondary, 0.1), px: 1, py: 0.5, borderRadius: 1 }}>
                      ID: {user.admissionNo || user.staffId || user.studentId || 'NOT SET'}
                    </Typography>
                  </Stack>
                  <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: -1.5, color: 'text.primary', mb: 1, fontSize: { xs: '2rem', sm: '3rem' } }}>
                    {user.displayName}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {user.classLevel || user.subject || 'Institutional Member'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack direction="row" spacing={1} justifyContent={{ xs: 'center', md: 'flex-end' }} flexWrap="wrap" sx={{ gap: 1 }}>
                {isAdmin && (
                  <Button 
                    variant="contained" 
                    startIcon={<Edit2 size={18} />}
                    onClick={() => setEditModalOpen(true)}
                    sx={{ borderRadius: 3, fontWeight: 900 }}
                  >
                    Edit Profile
                  </Button>
                )}
                <Button 
                  variant="outlined" 
                  startIcon={<Contact size={18} />}
                  onClick={() => setIdModalOpen(true)}
                  sx={{ borderRadius: 3, fontWeight: 900 }}
                >
                  ID Card
                </Button>
                <Button 
                  variant="outlined" 
                  color="secondary"
                  startIcon={<FileText size={18} />}
                  onClick={() => setAdmissionFormOpen(true)}
                  sx={{ borderRadius: 3, fontWeight: 900 }}
                >
                  Form
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Tabs Section */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', position: 'sticky', top: 0, zIndex: 10 }}>
        <Container maxWidth="lg">
          <Tabs 
            value={tabValue} 
            onChange={(_, v) => setTabValue(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { fontWeight: 900, textTransform: 'none', minWidth: 120, py: 3 },
              '& .Mui-selected': { color: 'primary.main' }
            }}
          >
            <Tab label="Overview" icon={<User size={18} />} iconPosition="start" />
            <Tab label="Fee Status" icon={<DollarSign size={18} />} iconPosition="start" />
            <Tab label="Attendance" icon={<Clock size={18} />} iconPosition="start" />
            <Tab label="Academic" icon={<GraduationCap size={18} />} iconPosition="start" />
          </Tabs>
        </Container>
      </Box>

      {/* Content Area */}
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <AnimatePresence mode="wait">
          {tabValue === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Paper elevation={0} sx={{ p: 4, borderRadius: 4, mb: 4, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1), boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                    <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
                      <FileText size={20} color={theme.palette.primary.main} /> Bio-Data Details
                    </Typography>
                    
                    <Grid container spacing={4}>
                      <Grid size={{ xs: 12, sm: 6 }}><DetailItem icon={Mail} label="Email Address" value={user.email} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><DetailItem icon={Phone} label="Primary Contact" value={user.phone} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><DetailItem icon={User} label="Father Name" value={user.fatherName} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><DetailItem icon={Calendar} label="Date of Birth" value={user.dob} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><DetailItem icon={ShieldCheck} label="Account Status" value={user.status || 'Active'} /></Grid>
                      <Grid size={{ xs: 12, sm: 6 }}><DetailItem icon={Award} label="Qualifications" value={user.qualifications} /></Grid>
                      <Grid size={12}><DetailItem icon={MapPin} label="Permanent Resident Address" value={user.address} /></Grid>
                    </Grid>
                  </Paper>

                  <Paper sx={{ p: 4, borderRadius: 4, bgcolor: alpha(theme.palette.info.main, 0.03), border: '1px dashed', borderColor: alpha(theme.palette.info.main, 0.2) }}>
                     <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>System Note</Typography>
                     <Typography variant="body2" color="text.secondary">
                       This profile is a verified institutional identity record. Any changes made to biological data or academic assignments are tracked in the security audit logs of the Maktab Portal System.
                     </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                  <Paper elevation={0} sx={{ p: 4, borderRadius: 4, mb: 4, border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1), boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                    <Typography variant="h6" sx={{ fontWeight: 950, mb: 3 }}>Active Enrollments</Typography>
                    <List disablePadding>
                      {(user.enrolledCourses || []).length > 0 ? (
                        user.enrolledCourses?.map((course, i) => (
                          <ListItem key={i} sx={{ px: 0, py: 1.5, borderBottom: i < (user.enrolledCourses?.length || 0) - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                            <ListItemIcon><BookOpen size={20} /></ListItemIcon>
                            <ListItemText primary={<Typography sx={{ fontWeight: 800 }}>{course}</Typography>} />
                          </ListItem>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">No explicitly listed courses.</Typography>
                      )}
                    </List>
                  </Paper>

                  <Paper sx={{ p: 4, borderRadius: 4, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 950, color: 'primary.main', mb: 2 }}>Verification QR Portal</Typography>
                    <Box sx={{ p: 3, bgcolor: 'white', borderRadius: 4, display: 'flex', justifyContent: 'center', mb: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                       <QRCodeSVG value={`${window.location.origin}/verify/member/${user.uid}`} size={160} />
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', fontWeight: 800, color: 'text.secondary', lineHeight: 1.4 }}>
                       SCAN TO VERIFY OFFICIAL IDENTITY STATUS OF THIS MEMBER
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {tabValue === 1 && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <Paper sx={{ borderRadius: 4, overflow: 'hidden' }}>
                <Box sx={{ p: 4, bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <DollarSign size={24} color={theme.palette.primary.main} /> Financial Ledger Status
                  </Typography>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'background.default' }}>
                        <TableCell sx={{ fontWeight: 900 }}>Receipt #</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Fee Category</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Mode</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Amount</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {fees.length > 0 ? (
                        fees.map((fee) => (
                          <TableRow key={fee.id}>
                            <TableCell sx={{ fontWeight: 700, fontFamily: 'mono', fontSize: '0.75rem' }}>{fee.receiptNumber || fee.receiptNo}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {(() => {
                                const obj = fee.date as any;
                                let d: Date;
                                if (obj?.toDate) d = obj.toDate();
                                else if (obj?.seconds) d = new Date(obj.seconds * 1000);
                                else d = new Date(fee.date);
                                
                                return isNaN(d.getTime()) ? fee.date : d.toLocaleDateString();
                              })()}
                            </TableCell>
                            <TableCell>{fee.feeHead}</TableCell>
                            <TableCell>{fee.paymentMode}</TableCell>
                            <TableCell sx={{ fontWeight: 900, color: 'primary.main' }}>PKR {fee.amount.toLocaleString()}</TableCell>
                            <TableCell align="right">
                              <Chip label={fee.status?.toUpperCase() || 'APPROVED'} size="small" variant="filled" sx={{ fontWeight: 900, borderRadius: 1, fontSize: '0.6rem' }} />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                            <Typography variant="body2" color="text.secondary">No financial records found for this student.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </motion.div>
          )}

          {tabValue === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
               <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 4 }}>
                     <Paper sx={{ p: 4, borderRadius: 4, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: 2 }}>ATTENDANCE SUMMARY</Typography>
                        <Typography variant="h2" sx={{ fontWeight: 950, my: 2, color: 'primary.main' }}>
                          {attendance.length > 0 ? Math.round((attendance.filter((a: any) => a.status === 'present').length / attendance.length) * 100) : 0}%
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.5 }}>Overall Attendance Record</Typography>
                        
                        <Stack spacing={2} sx={{ mt: 4 }}>
                           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>Present</Typography>
                              <Chip label={attendance.filter(a => a.status === 'present').length} size="small" color="success" sx={{ fontWeight: 900 }} />
                           </Box>
                           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>Absent</Typography>
                              <Chip label={attendance.filter(a => a.status === 'absent').length} size="small" color="error" sx={{ fontWeight: 900 }} />
                           </Box>
                           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>Leave</Typography>
                              <Chip label={attendance.filter(a => a.status === 'leave').length} size="small" color="info" sx={{ fontWeight: 900 }} />
                           </Box>
                        </Stack>
                     </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 8 }}>
                     <Paper sx={{ p: 0, borderRadius: 4, overflow: 'hidden' }}>
                        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
                           <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Daily Presence Logs</Typography>
                        </Box>
                        <List disablePadding>
                           {attendance.length > 0 ? (
                             attendance.map((log, i) => (
                               <ListItem key={log.id} sx={{ borderBottom: i < attendance.length - 1 ? '1px solid' : 'none', borderColor: 'divider', py: 2 }}>
                                 <ListItemIcon>
                                   <Box sx={{ 
                                     width: 12, height: 12, borderRadius: '50%', 
                                     bgcolor: log.status === 'present' ? 'success.main' : log.status === 'absent' ? 'error.main' : 'info.main' 
                                   }} />
                                 </ListItemIcon>
                                 <ListItemText 
                                   primary={
                                     <Typography sx={{ fontWeight: 900, fontSize: '0.9rem' }}>
                                       {(() => {
                                         const d = log.date && (log.date as any).toDate ? (log.date as any).toDate() : new Date(log.date);
                                         return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                       })()}
                                     </Typography>
                                   }
                                   secondary={<Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Marked by: {log.markedByName || 'System'}</Typography>}
                                 />
                                 <Chip 
                                   label={log.status.toUpperCase()} 
                                   size="small" 
                                   variant="outlined" 
                                   color={log.status === 'present' ? 'success' : log.status === 'absent' ? 'error' : 'info'}
                                   sx={{ fontWeight: 950, borderRadius: 1.5, fontSize: '0.65rem' }}
                                 />
                               </ListItem>
                             ))
                           ) : (
                             <Box sx={{ p: 10, textAlign: 'center' }}>
                               <Typography variant="body2" color="text.secondary">No attendance data available.</Typography>
                             </Box>
                           )}
                        </List>
                     </Paper>
                  </Grid>
               </Grid>
            </motion.div>
          )}

          {tabValue === 3 && (
            <AcademicTab 
              user={user} 
              attendance={attendance} 
              isAdmin={isAdmin} 
              currentUser={currentUser} 
              onIssueCertificate={handleIssueCertificate}
              onRevokeCertificate={handleRevokeCertificate}
              setSelectedCert={setSelectedCert}
              setCertModalOpen={setCertModalOpen}
            />
          )}
        </AnimatePresence>
      </Container>
    </Box>
  );
};

export default UserProfileView;
