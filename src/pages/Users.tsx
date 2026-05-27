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
  Fingerprint,
  Edit2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import BulkIDCardModal from '../components/BulkIDCardModal';
import { logger } from '../lib/logger';
import SavingOverlay from '../components/SavingOverlay';
import PrintableMemberDirectory from '../components/PrintableMemberDirectory';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download as DownloadIcon, CheckSquare, Square } from 'lucide-react';

const Users = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { users, loading: dataLoading, setIsSaving } = useData();
  const { user: currentUser, instituteSettings } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToArchive, setUserToArchive] = useState<string | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [idCardUser, setIdCardUser] = useState<UserProfile | null>(null);
  const [bulkIdModalOpen, setBulkIdModalOpen] = useState(false);

  const printRef = React.useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Member_Directory',
  });

  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'manager';

  const toggleSelect = (uid: string) => {
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  const handleOpenProfile = (uid: string) => {
    navigate(`/users/${uid}`);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Logic for displaying members based on tabs
      const matchesSearch = 
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.admissionNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.fatherName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || u.status === statusFilter;

      if (!matchesSearch || !matchesStatus) return false;

      // Tab specific filtering
      if (tabValue === 3) return u.status === 'Archived';
      if (u.status === 'Archived' && tabValue !== 3) return false;
      
      if (tabValue === 2) return ((!u.isVerified || u.role?.includes('pending')) || u.status === 'Pending') && u.status !== 'Archived';
      
      if (tabValue === 0) {
        return (u.role === 'student' || !u.role) && (u.status === 'Active' || !u.status);
      }
      
      if (tabValue === 1) {
        return ['teacher', 'staff'].includes(u.role || '') || (['manager', 'admin'].includes(u.role || '') && isAdmin);
      }
      
      return true;
    });
  }, [users, searchQuery, statusFilter, tabValue, isAdmin]);

  const confirmArchive = async () => {
    setArchiveConfirmOpen(false);
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const targets = userToArchive ? [userToArchive] : selectedUsers;
      targets.forEach(id => {
        batch.update(doc(db, 'users', id), { 
          status: 'Archived', 
          archivedAt: Date.now() 
        });
      });
      await batch.commit();
      setSelectedUsers([]);
      setUserToArchive(null);
      logger.success(`${targets.length} members archived`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users/archive');
    } finally {
      setIsSaving(false);
    }
  };

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
      logger.success('Member(s) permanently deleted');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'users/bulk');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkAction = async (action: 'verify' | 'restore' | 'archive') => {
    if (selectedUsers.length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      selectedUsers.forEach(id => {
        const userRef = doc(db, 'users', id);
        if (action === 'verify') batch.update(userRef, { isVerified: true, status: 'Active' });
        else if (action === 'restore') batch.update(userRef, { status: 'Active', archivedAt: null });
        else if (action === 'archive') batch.update(userRef, { status: 'Archived', archivedAt: Date.now() });
      });
      await batch.commit();
      setSelectedUsers([]);
      logger.success(`Action ${action} completed`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users/bulk');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveUser = async (uid: string) => {
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as UserProfile;

      // Generate Student ID: ADM-2026-XXXX (incremental)
      const year = new Date().getFullYear();
      // Filter for students who already have an ID starting with ADM-YEAR
      const existingIds = users
        .map(u => u.studentId || u.admissionNo)
        .filter(id => id && id.startsWith(`ADM-${year}`)) as string[];
      
      let nextNum = 1;
      if (existingIds.length > 0) {
        const nums = existingIds.map(id => {
          const parts = id.split('-');
          return parseInt(parts[parts.length - 1], 10);
        }).filter(n => !isNaN(n));
        if (nums.length > 0) {
          nextNum = Math.max(...nums) + 1;
        }
      }
      
      const studentId = `ADM-${year}-${String(nextNum).padStart(4, '0')}`;

      await updateDoc(userRef, {
        status: 'Active',
        isVerified: true,
        studentId,
        admissionNo: studentId,
        admissionDate: new Date().toISOString().split('T')[0],
        role: userData.role === 'pending_teacher' ? 'teacher' : 'student'
      });
      logger.success(`Account approved. Generated ID: ${studentId}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users/approve');
    } finally {
      setIsSaving(false);
    }
  };

  if (dataLoading) return <Skeleton variant="rectangular" height={400} sx={{ p: 4, borderRadius: 4, mx: 2 }} />;

  const handleSaveUser = async (data: any) => {
    setIsSaving(true);
    try {
      if (editingUser) {
        // Update existing user
        const userRef = doc(db, 'users', editingUser.uid);
        
        const updatePayload: Partial<UserProfile> = {
          displayName: data.displayName,
          role: data.role,
          photoURL: data.photoURL || '',
          updatedAt: Date.now(),
          fatherName: data.fatherName,
          admissionDate: data.admissionDate,
          classLevel: data.classLevel,
          subject: data.subject,
          phone: data.phone,
          dob: data.dob,
          address: data.address,
          qualifications: data.qualifications,
          admissionNo: data.studentId, // Ensure ID is synced
          studentId: data.studentId,
          // Track history
          editHistory: [
            ...(editingUser.editHistory || []),
            {
              timestamp: Date.now(),
              modifiedBy: currentUser?.displayName || 'Admin',
              action: 'Profile Updated'
            }
          ]
        };

        await updateDoc(userRef, updatePayload);
        logger.success('Member updated successfully');
      } else {
        // Create new user (using UID if it's an auth account, otherwise just a profile)
        const newUserId = data.createAccount ? `auth_${Date.now()}` : `profile_${Date.now()}`;
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
          phone: data.phone,
          dob: data.dob,
          address: data.address,
          qualifications: data.qualifications,
          admissionNo: data.studentId,
          studentId: data.studentId,
          fatherName: data.fatherName,
          classLevel: data.classLevel,
          editHistory: [{
            timestamp: Date.now(),
            modifiedBy: currentUser?.displayName || 'Admin',
            action: 'Account Created'
          }]
        };

        await setDoc(userRef, newUser);
        
        if (data.createAccount) {
           logger.success('Login credentials prepared for creation');
        } else {
           logger.success('Profile record created successfully');
        }
      }
    } catch (e) {
      handleFirestoreError(e, editingUser ? OperationType.UPDATE : OperationType.CREATE, 'users');
    } finally {
      setIsSaving(false);
      setEditingUser(null);
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
      <UserModal 
        open={userModalOpen || !!editingUser} 
        onClose={() => { setUserModalOpen(false); setEditingUser(null); }} 
        onSubmit={handleSaveUser} 
        initialData={editingUser}
        existingUsers={users}
      />
      <IDCardModal open={!!idCardUser} user={idCardUser} onClose={() => setIdCardUser(null)} />
      <BulkIDCardModal 
        open={bulkIdModalOpen} 
        onClose={() => setBulkIdModalOpen(false)} 
        users={users.filter(u => selectedUsers.includes(u.uid))} 
      />
      
      <ConfirmDialog 
        isOpen={deleteConfirmOpen}
        title="Permanently Delete?"
        message="This will completely remove the user and all their records. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <ConfirmDialog 
        isOpen={archiveConfirmOpen}
        title="Move to Archive?"
        message="Archived students are hidden from active lists safely. They will be auto-deleted permanently after 30 days."
        onConfirm={confirmArchive}
        onCancel={() => setArchiveConfirmOpen(false)}
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
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 950, letterSpacing: -1 }}>Institutional Records</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>{filteredUsers.length} active entities indexed</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {isAdmin && (
              <Button 
                variant="contained" 
                startIcon={<UserPlus size={18} />} 
                onClick={() => setUserModalOpen(true)}
                sx={{ borderRadius: 3, fontWeight: 900, textTransform: 'none', px: 3 }}
              >
                {!isMobile && 'New Admission'}
              </Button>
            )}
            <IconButton onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              {viewMode === 'grid' ? <ListIcon size={18} /> : <GridIcon size={18} />}
            </IconButton>
          </Stack>
        </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Paper 
            sx={{ mx: 2, p: 2, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.paper, 0.4), backdropFilter: 'blur(20px)' }}
          >
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField 
                fullWidth size="small" placeholder="Smart Search (Name, Father, ID)..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{ 
                  startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>, 
                  sx: { borderRadius: 3, fontWeight: 700, bgcolor: 'background.paper' } 
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ minHeight: 40, '& .MuiTab-root': { fontWeight: 900, textTransform: 'none', px: 2 } }}>
                <Tab label="Students" />
                <Tab label="Academic Staff" />
                <Tab label="Admission Pool" />
                <Tab label="Record Archive" icon={<Archive size={16} />} iconPosition="start" />
              </Tabs>
            </Grid>
          </Grid>
        </Paper>
        </motion.div>

        {selectedUsers.length > 0 && (
          <Fade in={selectedUsers.length > 0}>
            <Paper 
              elevation={0}
              sx={{ 
                mx: 2, p: 1.5, borderRadius: 4, bgcolor: '#0f172a', color: 'white', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <IconButton onClick={() => setSelectedUsers([])} size="small" sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }}>
                  <X size={16} />
                </IconButton>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{selectedUsers.length} MEMBERS SELECTED</Typography>
              </Stack>
              
              <Stack direction="row" spacing={1}>
                {isAdmin && (
                  <>
                    <Box sx={{ position: 'relative' }}>
                      <Button 
                        variant="contained" size="small" 
                        startIcon={<Printer size={16} />}
                        onClick={() => setBulkIdModalOpen(true)}
                        sx={{ bgcolor: 'white', color: '#0f172a', fontWeight: 900, borderRadius: 2, px: 2, '&:hover': { bgcolor: '#f1f5f9' } }}
                      >
                        Bulk Pass Output
                      </Button>
                    </Box>
                    
                    {tabValue === 3 ? (
                       <Button variant="contained" size="small" color="success" onClick={() => handleBulkAction('restore')} sx={{ fontWeight: 900, borderRadius: 2, px: 2 }}>
                        Restore Members
                      </Button>
                    ) : (
                      <Button variant="contained" size="small" color="warning" onClick={() => setArchiveConfirmOpen(true)} sx={{ fontWeight: 900, borderRadius: 2, px: 2 }}>
                        Vault Archive
                      </Button>
                    )}
                    {tabValue === 2 && (
                      <Button variant="contained" size="small" color="success" onClick={() => handleBulkAction('verify')} sx={{ fontWeight: 900, borderRadius: 2, px: 2 }}>
                        Approve All
                      </Button>
                    )}
                  </>
                )}
                {tabValue === 3 && (
                   <Button variant="contained" size="small" onClick={() => setDeleteConfirmOpen(true)} color="error" sx={{ borderRadius: 2, fontWeight: 900, px: 2 }}>
                    Wipe Records
                  </Button>
                )}
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
                        onSelect={() => toggleSelect(user.uid)}
                        onOpenProfile={() => handleOpenProfile(user.uid)}
                        onPass={setIdCardUser}
                        onApprove={handleApproveUser}
                        onDelete={(u: any) => {
                          if (tabValue === 3) {
                            setUserToDelete(u.uid);
                            setDeleteConfirmOpen(true);
                          } else {
                            setUserToArchive(u.uid);
                            setArchiveConfirmOpen(true);
                          }
                        }}
                        onEdit={(u: any) => {
                          setEditingUser(u);
                          setUserModalOpen(true);
                        }}
                      />
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          ) : (
            <TableContainer 
              component={Paper} 
              sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}
              className="gpu-accelerated"
            >
              <Table size="small" sx={{ minWidth: 800 }}>
                <TableHead sx={{ bgcolor: 'background.default' }}>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <IconButton size="small" disabled><Square size={18} /></IconButton>
                    </TableCell>
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
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                         <IconButton size="small" onClick={() => toggleSelect(user.uid)} color={selectedUsers.includes(user.uid) ? 'primary' : 'default'}>
                            {selectedUsers.includes(user.uid) ? <CheckSquare size={18} /> : <Square size={18} />}
                         </IconButton>
                      </TableCell>
                      <TableCell onClick={() => handleOpenProfile(user.uid)}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar 
                            src={user.photoURL} 
                            sx={{ 
                              width: { xs: 36, md: 40 }, 
                              height: { xs: 36, md: 40 },
                              border: '1.5px solid',
                              borderColor: 'divider',
                              boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
                            }}
                          >
                            {user.displayName?.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.2, fontSize: { xs: '0.8rem', md: '0.875rem' }, fontFamily: "'Noto Nastaliq Urdu', 'Inter', sans-serif" }}>
                              {user.displayName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem', opacity: 0.7 }}>
                              {user.email || 'No email provided'}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell onClick={() => handleOpenProfile(user.uid)}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: { xs: '0.75rem', md: '0.8125rem' }, opacity: 0.8 }}>
                          {user.fatherName || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={() => handleOpenProfile(user.uid)}>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: 'primary.main', fontSize: { xs: '0.75rem', md: '0.8125rem' }, letterSpacing: 0.5 }}>
                          {user.admissionNo || user.studentId || user.staffId || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={() => handleOpenProfile(user.uid)} sx={{ textTransform: 'capitalize' }}>
                        <Chip 
                          label={user.role} 
                          size="small" 
                          sx={{ 
                            height: 20, 
                            fontSize: '0.65rem', 
                            fontWeight: 800, 
                            bgcolor: alpha(theme.palette.secondary.main, 0.08),
                            color: 'secondary.main',
                            border: '1px solid',
                            borderColor: alpha(theme.palette.secondary.main, 0.1)
                          }} 
                        />
                      </TableCell>
                      <TableCell onClick={() => handleOpenProfile(user.uid)}>
                        <Chip 
                          size="small" 
                          label={user.status || 'Active'} 
                          color={user.status === 'Active' ? 'success' : 'default'} 
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 900, px: 0.5 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {tabValue === 2 && (
                             <Tooltip title="Approve Admission">
                               <IconButton 
                                 size="small" 
                                 color="success" 
                                 onClick={(e) => { e.stopPropagation(); handleApproveUser(user.uid); }}
                                 sx={{ 
                                   bgcolor: alpha(theme.palette.success.main, 0.05),
                                   '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.1) }
                                 }}
                               >
                                 <CheckCircle2 size={14} />
                               </IconButton>
                             </Tooltip>
                          )}
                          {user.phone && (
                            <Tooltip title="Message via WhatsApp">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const phone = user.phone.replace(/\D/g, '');
                                  window.open(`https://wa.me/${phone}`, '_blank');
                                }}
                                sx={{ 
                                  bgcolor: alpha(theme.palette.success.main, 0.05),
                                  '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.1) }
                                }}
                              >
                                <Phone size={14} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {isAdmin && (
                            <Tooltip title="Quick Edit">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setEditingUser(user); 
                                  setUserModalOpen(true); 
                                }}
                                sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                              >
                                <Edit2 size={14} />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Print ID Card">
                            <IconButton 
                              size="small" 
                              onClick={(e) => { e.stopPropagation(); setIdCardUser(user); }}
                              sx={{ bgcolor: alpha(theme.palette.divider, 0.3) }}
                            >
                              <Printer size={14} />
                            </IconButton>
                          </Tooltip>

                          {isAdmin && (
                            <Tooltip title="Archive/Delete">
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={(e) => { e.stopPropagation(); if(tabValue === 3) { setUserToDelete(user.uid); setDeleteConfirmOpen(true); } else { setUserToArchive(user.uid); setArchiveConfirmOpen(true); } }}
                                sx={{ bgcolor: alpha(theme.palette.error.main, 0.05) }}
                              >
                                 {tabValue === 3 ? <Trash2 size={14} /> : <Archive size={14} />}
                              </IconButton>
                            </Tooltip>
                          )}
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

const UserCard = ({ user, onDelete, onSelect, isSelected, onEdit, isAdmin, onOpenProfile, onPass, onApprove }: any) => {
  const theme = useTheme();
  return (
    <Card sx={{ 
      borderRadius: 4, 
      position: 'relative', 
      overflow: 'visible', 
      border: isSelected ? '2px solid' : '1px solid', 
      borderColor: isSelected ? 'primary.main' : 'divider',
      transition: 'all 0.2s ease',
      '&:hover': {
        borderColor: 'primary.light',
        transform: 'translateY(-4px)',
        boxShadow: '0 10px 20px rgba(0,0,0,0.05)'
      }
    }}>
      <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
        <IconButton size="small" onClick={onSelect} color={isSelected ? 'primary' : 'default'}>
          {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
        </IconButton>
      </Box>

      <Box onClick={onOpenProfile} sx={{ p: 3, textAlign: 'center', cursor: 'pointer' }}>
        <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} badgeContent={user.isVerified ? <CheckCircle2 size={14} color="green" /> : null}>
          <Avatar src={user.photoURL} sx={{ width: 64, height: 64, mx: 'auto', mb: 2 }}>{user.displayName?.charAt(0)}</Avatar>
        </Badge>
        <Typography variant="subtitle1" sx={{ fontWeight: 950, letterSpacing: -0.5, fontFamily: "'Noto Nastaliq Urdu', 'Inter', sans-serif" }}>
          {user.displayName}
        </Typography>
        
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08), px: 1, py: 0.2, borderRadius: 1, width: 'fit-content', mx: 'auto' }}>
            ID: {user.admissionNo || user.studentId || user.staffId || 'N/A'}
          </Typography>
          {user.fatherName && (
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              S/O {user.fatherName}
            </Typography>
          )}
        </Stack>
        
        <Stack direction="row" spacing={1} sx={{ mt: 3, width: '100%' }}>
          {user.status === 'Pending' && (
            <Button 
              fullWidth 
              size="small" 
              variant="contained" 
              color="success" 
              onClick={(e) => { e.stopPropagation(); onApprove(user.uid); }}
              startIcon={<CheckCircle2 size={14} />} 
              sx={{ borderRadius: 2, fontWeight: 900, fontSize: '0.65rem' }}
            >
              Approve
            </Button>
          )}
          <Button fullWidth size="small" variant="contained" disableElevation onClick={(e) => { e.stopPropagation(); onPass(user); }} startIcon={<Printer size={14} />} sx={{ borderRadius: 2, fontWeight: 900, fontSize: '0.65rem' }}>Pass</Button>
          {user.phone && (
            <IconButton 
              size="small" 
              color="success" 
              onClick={(e) => { 
                e.stopPropagation(); 
                const phone = user.phone.replace(/\D/g, '');
                window.open(`https://wa.me/${phone}`, '_blank');
              }} 
              sx={{ borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.2), bgcolor: alpha(theme.palette.success.main, 0.05) }}
            >
              <Phone size={14} />
            </IconButton>
          )}
          {isAdmin && <Button fullWidth size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); onEdit(user); }} startIcon={<Edit2 size={14} />} sx={{ borderRadius: 2, fontWeight: 900, fontSize: '0.65rem' }}>Edit</Button>}
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(user); }} sx={{ borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.2) }}>
             <Trash2 size={14} />
          </IconButton>
        </Stack>
      </Box>
    </Card>
  );
};

export default Users;
