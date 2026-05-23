import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Grid, 
  Card, 
  Typography, 
  Button, 
  Chip, 
  Avatar, 
  IconButton, 
  TextField, 
  InputAdornment, 
  Stack, 
  Badge,
  useTheme,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  alpha,
  useMediaQuery,
  Divider,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Search, 
  CheckCircle2, 
  Trash2,
  Grid as GridIcon,
  Contact,
  List as ListIcon,
  X,
  Archive,
  Mail,
  Phone,
  ShieldAlert,
  UserPlus,
  Fingerprint
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { deleteUserPermanently, handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { UserProfile } from '../types';
import { doc, updateDoc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmDialog from '../components/ConfirmDialog';
import UserModal from '../components/UserModal';
import IDCardModal from '../components/IDCardModal';
import { logger } from '../lib/logger';
import SavingOverlay from '../components/SavingOverlay';
import PrintableMemberDirectory from '../components/PrintableMemberDirectory';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download as DownloadIcon } from 'lucide-react';

const Users = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { users, loading: dataLoading, setIsSaving } = useData();
  const { user: currentUser, instituteSettings } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [idCardUser, setIdCardUser] = useState<UserProfile | null>(null);

  const printRef = React.useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Member_Directory',
  });

  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'manager';

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Hide superadmins and managers from the directory
      if (['superadmin', 'manager', 'admin'].includes(u.role || '')) return false;

      const matchesSearch = 
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.admissionNo?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || u.status === statusFilter;

      if (!matchesSearch || !matchesStatus) return false;
      if (tabValue === 3) return u.status === 'Archived';
      if (u.status === 'Archived') return false;
      if (tabValue === 2) return !u.isVerified || u.role?.includes('pending');
      if (tabValue === 0) return (u.role === 'student' || !u.role);
      if (tabValue === 1) return ['teacher'].includes(u.role || '');
      
      return true;
    });
  }, [users, searchQuery, statusFilter, tabValue]);

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    setIsSaving(true);
    try {
      const targets = userToDelete ? [userToDelete] : selectedUsers;
      for (const id of targets) {
        await deleteUserPermanently(id);
      }
      setSelectedUsers([]);
      setUserToDelete(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'users/bulk');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkAction = async (action: 'verify' | 'restore') => {
    if (selectedUsers.length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      selectedUsers.forEach(id => {
        const userRef = doc(db, 'users', id);
        if (action === 'verify') batch.update(userRef, { isVerified: true, status: 'Active' });
        else if (action === 'restore') batch.update(userRef, { status: 'Active' });
      });
      await batch.commit();
      setSelectedUsers([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users/bulk');
    } finally {
      setIsSaving(false);
    }
  };

  if (dataLoading) return <Skeleton variant="rectangular" height={400} sx={{ p: 4, borderRadius: 4, mx: 2 }} />;

  const handleCreateUser = async (data: any) => {
    setIsSaving(true);
    try {
      const newUserId = `user_${Date.now()}`;
      const userRef = doc(db, 'users', newUserId);
      
      const newUser: UserProfile = {
        uid: newUserId,
        displayName: data.displayName,
        email: data.email,
        role: data.role,
        status: 'Active',
        isVerified: true,
        photoURL: data.photoURL || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (data.role === 'student') {
        const count = users.filter(u => u.role === 'student').length + 1;
        const year = new Date().getFullYear();
        newUser.admissionNo = data.studentId || `WLI-${year}-${String(count).padStart(4, '0')}`;
        newUser.studentId = newUser.admissionNo;
        newUser.fatherName = data.fatherName;
        newUser.admissionDate = data.admissionDate;
        newUser.classLevel = data.classLevel;
      } else {
        // Auto-generate Staff ID for all non-students (teachers, managers, admins)
        const staffCount = users.filter(u => u.role !== 'student').length + 1;
        const prefix = data.role === 'teacher' ? 'TR' : 'ADM';
        newUser.staffId = `${prefix}-${String(staffCount).padStart(3, '0')}-${String(Math.floor(100+Math.random()*900))}`;
        newUser.teacherId = newUser.staffId;
        if (data.subject) newUser.subject = data.subject;
      }

      await setDoc(userRef, newUser);
      logger.success('Member created successfully');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'users');
    } finally {
      setIsSaving(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.05 } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.3 } 
    }
  };

  return (
    <Box sx={{ pb: 16, pt: 2 }}>
      <PrintableMemberDirectory 
        ref={printRef} 
        users={filteredUsers} 
        settings={instituteSettings} 
        title={`${tabValue === 0 ? 'Student' : tabValue === 1 ? 'Staff' : 'Members'} Directory`} 
      />
      <SavingOverlay isSaving={false} message="Managing Directory..." />
      <UserModal open={userModalOpen} onClose={() => setUserModalOpen(false)} onSubmit={handleCreateUser} />
      <IDCardModal open={!!idCardUser} user={idCardUser} onClose={() => setIdCardUser(null)} />
      
      <ConfirmDialog 
        isOpen={deleteConfirmOpen}
        title="Permanently Delete User?"
        message="This will completely remove the user and all their records (attendance, fees). This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <Stack spacing={3}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Box 
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}
          >
          <Box>
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 950, letterSpacing: -1 }}>Member Directory</Typography>
            <Typography variant="body2" color="text.secondary">{filteredUsers.length} records found</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {isAdmin && (
              <>
                <Button 
                  variant="outlined" 
                  startIcon={<Printer size={18} />} 
                  onClick={() => handlePrint()}
                  sx={{ borderRadius: 3, fontWeight: 800, textTransform: 'none', display: { xs: 'none', sm: 'flex' } }}
                >
                  Print List
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<UserPlus size={18} />} 
                  onClick={() => setUserModalOpen(true)}
                  sx={{ borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                >
                  {!isMobile && 'Add Member'}
                </Button>
              </>
            )}
            <IconButton onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              {viewMode === 'grid' ? <ListIcon size={20} /> : <GridIcon size={20} />}
            </IconButton>
          </Stack>
        </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Paper 
            sx={{ mx: 2, p: 2, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}
          >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField 
                fullWidth size="small" placeholder="Search members..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>, sx: { borderRadius: 3 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ minHeight: 40 }}>
                <Tab label="Students" sx={{ fontWeight: 800, textTransform: 'none' }} />
                <Tab label="Staff" sx={{ fontWeight: 800, textTransform: 'none' }} />
                <Tab label="Pending" sx={{ fontWeight: 800, textTransform: 'none' }} />
                <Tab label="Archive" sx={{ fontWeight: 800, textTransform: 'none' }} />
              </Tabs>
            </Grid>
          </Grid>
        </Paper>
        </motion.div>

        {selectedUsers.length > 0 && (
          <Fade in={selectedUsers.length > 0}>
            <Paper sx={{ mx: 2, p: 2, borderRadius: 4, bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{selectedUsers.length} selected</Typography>
              <Stack direction="row" spacing={1}>
                {tabValue === 2 && <Button variant="contained" size="small" onClick={() => handleBulkAction('verify')} sx={{ bgcolor: 'white', color: 'primary.main' }}>Verify</Button>}
                <Button variant="contained" size="small" onClick={() => setDeleteConfirmOpen(true)} color="error">Delete</Button>
                <IconButton onClick={() => setSelectedUsers([])} size="small" sx={{ color: 'white' }}><X size={18} /></IconButton>
              </Stack>
            </Paper>
          </Fade>
        )}

        <Box sx={{ px: 2 }}>
          {viewMode === 'grid' ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Grid 
                container 
                spacing={3}
              >
                {filteredUsers.map(user => (
                  <Grid size={{ xs: 12, sm: 6, md: 4, xl: 3 }} key={user.uid}>
                    <motion.div variants={itemVariants}>
                      <UserCard 
                        user={user} 
                        isSelected={selectedUsers.includes(user.uid)}
                        isAdmin={isAdmin}
                        onSelect={(id: string) => setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                        onDelete={() => { setUserToDelete(user.uid); setDeleteConfirmOpen(true); }}
                        onViewID={() => setIdCardUser(user)}
                      />
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          ) : (
            <TableContainer 
              component={Paper} 
              sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}
              className="gpu-accelerated"
            >
              <Table size="small">
                <TableHead sx={{ bgcolor: 'background.default' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900 }}>Member</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Parentage</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>ID Number</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow 
                      key={user.uid} 
                      hover 
                      selected={selectedUsers.includes(user.uid)}
                    >
                      <TableCell onClick={() => setSelectedUsers(prev => prev.includes(user.uid) ? prev.filter(x => x !== user.uid) : [...prev, user.uid])}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar src={user.photoURL} sx={{ width: 32, height: 32 }}>{user.displayName?.charAt(0)}</Avatar>
                          <Box><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{user.displayName}</Typography><Typography variant="caption" color="text.secondary">{user.email}</Typography></Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {user.fatherName || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                          {user.admissionNo || user.staffId || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{user.role}</TableCell>
                      <TableCell><Chip size="small" label={user.status || 'Active'} color={user.status === 'Active' ? 'success' : 'default'} /></TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="View ID Card">
                            <IconButton size="small" onClick={() => setIdCardUser(user)}>
                              <Contact size={18} />
                            </IconButton>
                          </Tooltip>
                          <IconButton size="small" color="error" onClick={() => { setUserToDelete(user.uid); setDeleteConfirmOpen(true); }}>
                            <Trash2 size={18} />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

const UserCard = ({ user, onDelete, onSelect, isSelected, onViewID, isAdmin }: any) => (
  <Card sx={{ borderRadius: 4, position: 'relative', overflow: 'visible', border: isSelected ? '2px solid' : '1px solid', borderColor: isSelected ? 'primary.main' : 'divider' }}>
    <Box onClick={() => onSelect(user.uid)} sx={{ p: 3, textAlign: 'center', cursor: 'pointer' }}>
      <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} badgeContent={user.isVerified ? <CheckCircle2 size={14} color="green" /> : null}>
        <Avatar src={user.photoURL} sx={{ width: 64, height: 64, mx: 'auto', mb: 2 }}>{user.displayName?.charAt(0)}</Avatar>
      </Badge>
      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{user.displayName}</Typography>
      {user.role === 'student' && user.fatherName && (
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: 'text.secondary', mt: -0.5 }}>
          S/O: {user.fatherName}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">{user.email}</Typography>
      <Box sx={{ mt: 2 }}><Chip size="small" label={user.role} variant="outlined" sx={{ fontWeight: 800, textTransform: 'capitalize' }} /></Box>
    </Box>
    
    {isAdmin && (
      <Box sx={{ position: 'absolute', top: -10, right: -10, display: 'flex', gap: 1 }}>
        <Tooltip title="View ID Card">
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); onViewID(); }}
            sx={{ bgcolor: 'background.paper', boxShadow: 2, color: 'primary.main' }}
          >
            <Contact size={16} />
          </IconButton>
        </Tooltip>
      </Box>
    )}
  </Card>
);

export default Users;
