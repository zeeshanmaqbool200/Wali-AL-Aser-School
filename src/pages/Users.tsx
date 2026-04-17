import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  TextField, Dialog, DialogTitle, DialogContent, 
  DialogActions, CircularProgress, IconButton, Chip,
  Avatar, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, InputAdornment, Tab, Tabs,
  FormControl, InputLabel, Select, MenuItem, useTheme,
  useMediaQuery, alpha, Stack, Tooltip, Zoom, Fade,
  LinearProgress, Divider
} from '@mui/material';
import { 
  Plus, Search, Edit2, Trash2, UserPlus, 
  Filter, Mail, Phone, MapPin, Shield,
  MoreVertical, User, GraduationCap, UserCheck,
  ArrowRight, ExternalLink, Download, Layout,
  Layers, CheckCircle, XCircle, Clock, Save,
  Bell, Camera, X
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, where } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, UserRole, MaktabLevel } from '../types';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function Users() {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openPromoteDialog, setOpenPromoteDialog] = useState(false);
  const [promotingUser, setPromotingUser] = useState<UserProfile | null>(null);
  const [newGrade, setNewGrade] = useState<MaktabLevel | ''>('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    role: 'student' as UserRole,
    phone: '',
    maktabLevel: '' as MaktabLevel,
    admissionNo: '',
    teacherId: '',
    fatherName: '',
    motherName: '',
    rollNo: '',
    admissionDate: format(new Date(), 'yyyy-MM-dd'),
    address: '',
    subject: '',
    subjectsEnrolled: [] as string[],
    status: 'Active' as 'Active' | 'Inactive'
  });

  const subjectsOptions = [
    'Quran Recitation', 'Diniyat', 'Urdu', 'Amali Masail', 
    'Naat Khawni', 'Surahs Learning', 'Hifz', 
    'Fiqh & Aqeedah', 'Gez-z / Gen-x Competitions'
  ];

  const maktabLevels: MaktabLevel[] = [
    'Awal', 'Doum', 'Soam', 'Chaharum', 'panjum', 'shahsum', 
    'haftum', 'hashtum', 'dahum', 'Hafiz', 'muntazim [m]', 'muntazimah [f]'
  ];

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin' || currentUser?.role === 'teacher';
  const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    try {
      let finalFormData = { ...formData };
      
      // Auto-assign admission number for new students if not provided
      if (!editingUser && formData.role === 'student' && !formData.admissionNo) {
        const year = format(new Date(), 'yyyy');
        const timestamp = Date.now().toString().slice(-4);
        const namePart = formData.displayName.slice(0, 3).toUpperCase();
        finalFormData.admissionNo = `ADM-${year}-${namePart}-${timestamp}`;
      }

      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.uid), finalFormData);
      } else {
        await addDoc(collection(db, 'users'), {
          ...finalFormData,
          createdAt: Date.now(),
          photoURL: `https://ui-avatars.com/api/?name=${formData.displayName}&background=random`
        });
      }
      setOpenDialog(false);
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const handleApproveClass = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        maktabLevel: user.pendingMaktabLevel,
        pendingMaktabLevel: null,
        status: 'Active'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleRejectClass = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pendingMaktabLevel: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handlePromote = async () => {
    if (!promotingUser || !newGrade) return;
    try {
      await updateDoc(doc(db, 'users', promotingUser.uid), {
        maktabLevel: newGrade,
        grade: newGrade
      });
      setOpenPromoteDialog(false);
      setPromotingUser(null);
      setNewGrade('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${promotingUser.uid}`);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (u.admissionNo && u.admissionNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (u.teacherId && u.teacherId.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (tabValue === 0) return u.role === 'student' && matchesSearch;
    if (tabValue === 1) return u.role === 'teacher' && matchesSearch;
    if (tabValue === 2) return u.pendingMaktabLevel && matchesSearch;
    return matchesSearch;
  });

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
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5, mb: 0.5 }}>{tabValue === 0 ? 'Tulab' : tabValue === 1 ? 'Mudaris' : 'Approval'} Management</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              Manage Tulab-e-Ilm, Mudaris, and administrative Muntazim
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Box sx={{ 
              display: 'flex', 
              bgcolor: 'background.default', 
              p: 0.8, 
              borderRadius: 4,
              boxShadow: theme.palette.mode === 'dark'
                ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
            }}>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('grid')}
                sx={{ 
                  borderRadius: 3, 
                  bgcolor: viewMode === 'grid' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'grid' 
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff')
                    : 'none',
                  color: viewMode === 'grid' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layout size={18} />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={() => setViewMode('list')}
                sx={{ 
                  borderRadius: 3, 
                  bgcolor: viewMode === 'list' ? 'background.paper' : 'transparent', 
                  boxShadow: viewMode === 'list' 
                    ? (theme.palette.mode === 'dark' ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff')
                    : 'none',
                  color: viewMode === 'list' ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s ease'
                }}
              >
                <Layers size={18} />
              </IconButton>
            </Box>
            {isAdmin && (
              <Button 
                variant="contained" 
                color="primary"
                startIcon={<UserPlus size={18} />} 
                onClick={() => {
                  setEditingUser(null);
                  setFormData({ 
                    displayName: '', email: '', role: tabValue === 0 ? 'student' : 'teacher', 
                    phone: '', maktabLevel: '' as MaktabLevel, admissionNo: '', teacherId: '', 
                    fatherName: '', motherName: '', rollNo: '', admissionDate: format(new Date(), 'yyyy-MM-dd'),
                    address: '', subject: '', subjectsEnrolled: [], status: 'Active'
                  });
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
                Add {tabValue === 0 ? 'Talib' : 'Mudaris'}
              </Button>
            )}
          </Stack>
        </Box>
      </motion.div>

      {/* Stats Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SummaryCard title="Total Tulab-e-Ilm" value={users.filter(u => u.role === 'student').length} icon={<GraduationCap size={24} />} color="primary" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SummaryCard title="Total Mudaris" value={users.filter(u => u.role === 'teacher').length} icon={<UserCheck size={24} />} color="success" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SummaryCard title="Active Now" value={users.filter(u => u.status === 'Active').length} icon={<Clock size={24} />} color="warning" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <SummaryCard title="New This Month" value={users.filter(u => u.createdAt && u.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000).length} icon={<Plus size={24} />} color="error" />
        </motion.div>
      </Box>

      <Card sx={{ 
        borderRadius: 2, 
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none'
      }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider', 
          bgcolor: 'background.paper', 
          px: 3, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: 2,
          py: 1
        }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, v) => setTabValue(v)} 
            sx={{ 
              '& .MuiTab-root': { fontWeight: 900, py: 3, minWidth: 140, textTransform: 'none', fontSize: '1rem' },
              '& .Mui-selected': { color: 'primary.main' },
              '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0' }
            }}
          >
            <Tab label="Tulab-e-Ilm" icon={<GraduationCap size={20} />} iconPosition="start" />
            <Tab label="Mudaris" icon={<UserCheck size={20} />} iconPosition="start" />
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                Pending Approvals
                {users.filter(u => u.pendingMaktabLevel).length > 0 && (
                  <Chip 
                    label={users.filter(u => u.pendingMaktabLevel).length} 
                    size="small" 
                    sx={{ height: 22, fontSize: '0.7rem', fontWeight: 900, bgcolor: 'warning.main', color: 'white' }} 
                  />
                )}
              </Box>
            } icon={<Clock size={20} />} iconPosition="start" />
          </Tabs>
          
          <Box sx={{ px: 2, py: 2, flex: { xs: 1, md: 'none' }, minWidth: { xs: '100%', md: 400 } }}>
            <Paper 
              elevation={0} 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                px: 3, 
                borderRadius: 1, 
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Search size={22} color={theme.palette.text.secondary} />
              <Box 
                component="input" 
                placeholder={`Search ${tabValue === 0 ? 'Tulab-e-Ilm' : 'Mudaris'}...`} 
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}
                sx={{ 
                  border: 'none', 
                  outline: 'none', 
                  p: 2, 
                  width: '100%', 
                  fontWeight: 800,
                  fontSize: '1rem',
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  '&::placeholder': { color: 'text.disabled' }
                }} 
              />
              <IconButton sx={{ 
                bgcolor: 'background.paper', 
                borderRadius: 2.5, 
                boxShadow: theme.palette.mode === 'dark' 
                  ? '4px 4px 8px #060a12, -4px -4px 8px #182442' 
                  : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' 
              }}>
                <Filter size={18} />
              </IconButton>
            </Paper>
          </Box>
        </Box>
        
        {viewMode === 'list' ? (
          <Box sx={{ overflowX: 'auto', width: '100%' }}>
            <TableContainer component={Box} sx={{ minWidth: { xs: 800, md: '100%' } }}>
              <Table>
                <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 800, py: 2.5 }}>Profile</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Admission No / ID</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>{tabValue === 0 ? 'Maktab Level' : 'Subject'}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Contact Info</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map((user) => (
                    <TableRow 
                      component={motion.tr}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={user.uid} 
                      hover
                      sx={{ transition: 'all 0.2s' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar 
                            src={user.photoURL} 
                            sx={{ 
                              width: 44, 
                              height: 44, 
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              border: '2px solid white'
                            }} 
                          />
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{user.displayName}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{user.email}</Typography>
                              {user.hardwareStatus && (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Tooltip title={`Notifications: ${user.hardwareStatus.notifications}`}>
                                    <Box sx={{ color: user.hardwareStatus.notifications === 'granted' ? 'success.main' : 'text.disabled' }}>
                                      <Bell size={12} />
                                    </Box>
                                  </Tooltip>
                                  <Tooltip title={`Camera: ${user.hardwareStatus.camera}`}>
                                    <Box sx={{ color: user.hardwareStatus.camera === 'granted' ? 'success.main' : 'text.disabled' }}>
                                      <Camera size={12} />
                                    </Box>
                                  </Tooltip>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={user.role === 'student' ? user.admissionNo || user.studentId : user.teacherId} 
                          size="small" 
                          variant="outlined" 
                          sx={{ fontWeight: 800, fontSize: '0.7rem', borderRadius: 2, bgcolor: 'grey.50' }} 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {user.role === 'student' ? user.maktabLevel || user.grade : (user.subject || 'N/A')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                            <Phone size={12} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{user.phone || 'N/A'}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                            <MapPin size={12} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>{user.address || 'N/A'}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          <Tooltip title="View Profile">
                            <IconButton size="small" sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}>
                              <ExternalLink size={16} />
                            </IconButton>
                          </Tooltip>
                          {isAdmin && (
                            <>
                              {user.pendingMaktabLevel && (
                                <>
                                  <Tooltip title="Approve Class">
                                    <IconButton 
                                      size="small" 
                                      sx={{ bgcolor: 'success.light', color: 'success.dark', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                                      onClick={() => handleApproveClass(user)}
                                    >
                                      <CheckCircle size={16} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Reject Class">
                                    <IconButton 
                                      size="small" 
                                      sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                      onClick={() => handleRejectClass(user)}
                                    >
                                      <XCircle size={16} />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                              {user.role === 'student' && user.maktabLevel && (
                                <Tooltip title="Promote">
                                  <IconButton 
                                    size="small" 
                                    sx={{ bgcolor: 'primary.light', color: 'primary.dark', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                                    onClick={() => { setPromotingUser(user); setOpenPromoteDialog(true); }}
                                  >
                                    <ArrowRight size={16} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Edit">
                                <IconButton 
                                  size="small" 
                                  sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                                  onClick={() => { setEditingUser(user); setFormData(user as any); setOpenDialog(true); }}
                                >
                                  <Edit2 size={16} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton 
                                  size="small" 
                                  sx={{ bgcolor: 'error.light', color: 'error.dark', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                  onClick={() => handleDelete(user.uid)}
                                  disabled={!isSuperAdmin}
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
        ) : (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user, index) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={user.uid}>
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <UserCard user={user} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} onEdit={() => { setEditingUser(user); setFormData(user as any); setOpenDialog(true); }} onDelete={() => handleDelete(user.uid)} />
                    </motion.div>
                  </Grid>
                ))}
              </AnimatePresence>
            </Grid>
          </Box>
        )}
        
        {filteredUsers.length === 0 && (
          <Box sx={{ p: 10, textAlign: 'center' }}>
            <User size={64} color={theme.palette.divider} style={{ marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No Tulab/Mudaris found</Typography>
            <Typography variant="body2" color="text.secondary">Try adjusting your search query or filters</Typography>
          </Box>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editingUser ? 'Edit Profile' : 'Register New Tulab/Mudaris'}
          <IconButton onClick={() => setOpenDialog(false)} className="close-button">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
            Enter the personal and academic details below.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Full Name"
                required
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Email Address"
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                <InputLabel>Role / Designation</InputLabel>
                <Select
                  value={formData.role}
                  label="Role / Designation"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  <MenuItem value="student">Talib-e-Ilm</MenuItem>
                  <MenuItem value="teacher">Mudaris</MenuItem>
                  <MenuItem value="admin">Muntazim</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
            {formData.role === 'student' ? (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Admission No"
                    value={formData.admissionNo}
                    onChange={(e) => setFormData({ ...formData, admissionNo: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                    <InputLabel>Maktab Level</InputLabel>
                    <Select
                      value={formData.maktabLevel}
                      label="Maktab Level"
                      onChange={(e) => setFormData({ ...formData, maktabLevel: e.target.value as MaktabLevel })}
                    >
                      {maktabLevels.map(level => (
                        <MenuItem key={level} value={level}>{level}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Father's Name"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Mother's Name"
                    value={formData.motherName}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Roll No"
                    value={formData.rollNo}
                    onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Admission Date"
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
                    <InputLabel>Subjects Enrolled</InputLabel>
                    <Select
                      multiple
                      value={formData.subjectsEnrolled}
                      label="Subjects Enrolled"
                      onChange={(e) => setFormData({ ...formData, subjectsEnrolled: e.target.value as string[] })}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                    >
                      {subjectsOptions.map((subject) => (
                        <MenuItem key={subject} value={subject}>
                          {subject}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            ) : (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Mudaris ID"
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Primary Subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Grid>
              </>
            )}
            <Grid size={12}>
              <TextField
                fullWidth
                label="Permanent Address"
                multiline
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 800, color: 'text.secondary' }}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            startIcon={<Save size={18} />} 
            disabled={!formData.displayName || !formData.email}
            sx={{ borderRadius: 3, fontWeight: 800, px: 3, boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}` }}
          >
            {editingUser ? 'Update Profile' : 'Register'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openPromoteDialog} onClose={() => setOpenPromoteDialog(false)} PaperProps={{ sx: { borderRadius: 1, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Promote Talib-e-Ilm
          <IconButton onClick={() => setOpenPromoteDialog(false)} className="close-button">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select the new class for <strong>{promotingUser?.displayName}</strong>.
          </Typography>
          <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}>
            <InputLabel>New Maktab Level</InputLabel>
            <Select
              value={newGrade}
              label="New Maktab Level"
              onChange={(e) => setNewGrade(e.target.value as MaktabLevel)}
            >
              {maktabLevels.map(level => (
                <MenuItem key={level} value={level}>{level}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenPromoteDialog(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button onClick={handlePromote} variant="contained" disabled={!newGrade} sx={{ borderRadius: 3, fontWeight: 800 }}>
            Confirm Promotion
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const UserCard = React.memo(({ user, isAdmin, isSuperAdmin, onEdit, onDelete }: any) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Card sx={{ 
      borderRadius: 2, 
      height: '100%', 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: 'none',
      '&:hover': { 
        transform: 'translateY(-10px)', 
        borderColor: 'primary.main',
        '& .user-actions': { opacity: 1, transform: 'translateY(0)' }
      }
    }}>
      <Box sx={{ height: 100, bgcolor: 'primary.main', position: 'relative' }}>
        <Box sx={{ position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)' }}>
          <Avatar 
            src={user.photoURL} 
            sx={{ 
              width: 88, 
              height: 88, 
              border: '4px solid',
              borderColor: 'background.paper',
              boxShadow: isDark 
                ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
                : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff'
            }} 
          />
        </Box>
      </Box>
      
      <CardContent sx={{ pt: 7, textAlign: 'center', pb: 4, px: 3.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1 }}>{user.displayName}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 3, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          {user.role} • {user.role === 'student' ? user.grade : user.subject}
        </Typography>
        
        <Stack spacing={2} sx={{ mb: 3.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, color: 'text.secondary' }}>
            <Mail size={16} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{user.email}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, color: 'text.secondary' }}>
            <Phone size={16} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{user.phone || 'N/A'}</Typography>
          </Box>
        </Stack>
        
        <Divider sx={{ mb: 3, borderStyle: 'dashed', opacity: 0.5 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
          <Chip 
            label={user.role === 'student' ? `ID: ${user.admissionNo || user.studentId}` : `ID: ${user.teacherId}`} 
            size="small" 
            sx={{ fontWeight: 900, bgcolor: 'background.default', borderRadius: 2.5, fontSize: '0.7rem', border: 'none' }} 
          />
          <Chip 
            label={user.status} 
            size="small" 
            color={user.status === 'Active' ? 'success' : 'default'}
            sx={{ fontWeight: 900, borderRadius: 2.5, fontSize: '0.7rem', border: 'none' }} 
          />
        </Box>
      </CardContent>
      
      <Box 
        className="user-actions"
        sx={{ 
          position: 'absolute', 
          top: 16, 
          right: 16, 
          display: 'flex', 
          gap: 1.5, 
          opacity: 0, 
          transform: 'translateY(-10px)', 
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
        }}
      >
        {isSuperAdmin && (
          <>
            <IconButton size="small" sx={{ bgcolor: 'background.paper', boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }} onClick={onEdit}>
              <Edit2 size={16} />
            </IconButton>
            <IconButton size="small" sx={{ bgcolor: 'background.paper', boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }} color="error" onClick={onDelete}>
              <Trash2 size={16} />
            </IconButton>
          </>
        )}
        {!isSuperAdmin && isAdmin && (
          <IconButton size="small" sx={{ bgcolor: 'background.paper', boxShadow: isDark ? '4px 4px 8px #060a12, -4px -4px 8px #182442' : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff' }} onClick={onEdit}>
            <Edit2 size={16} />
          </IconButton>
        )}
      </Box>
    </Card>
  );
});

const SummaryCard = React.memo(({ title, value, icon, color }: any) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const mainColor = theme.palette[color as 'primary' | 'success' | 'error' | 'warning'].main;
  
  return (
    <Card sx={{ 
      borderRadius: 7, 
      height: '100%', 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      border: 'none',
      bgcolor: 'background.paper',
      boxShadow: isDark 
        ? '8px 8px 16px #060a12, -8px -8px 16px #182442'
        : '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
      '&:hover': { 
        transform: 'translateY(-6px)', 
        boxShadow: isDark 
          ? '12px 12px 24px #060a12, -12px -12px 24px #182442'
          : '12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff',
        borderColor: alpha(mainColor, 0.2)
      }
    }}>
      <CardContent sx={{ p: 3.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ 
            p: 1.8, 
            borderRadius: '20px', 
            bgcolor: alpha(mainColor, 0.1), 
            color: mainColor,
            boxShadow: isDark
              ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
              : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
          }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1.5 }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>{title}</Typography>
      </CardContent>
    </Card>
  );
});
