import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  Switch, FormControlLabel, Stack, Divider, Paper,
  IconButton, Tooltip, CircularProgress, Alert,
  Chip, List, ListItem, ListItemText, ListItemIcon
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  Shield, CheckCircle, XCircle, Save, 
  AlertTriangle, Info, UserPlus, Trash2,
  Lock, Eye, Edit3, Trash, Plus, Settings
} from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';

interface RolePermissions {
  id: string;
  name: string;
  description: string;
  permissions: {
    [key: string]: boolean;
  };
}

const DEFAULT_PERMISSIONS = {
  view_dashboard: true,
  manage_students: false,
  manage_staff: false,
  manage_fees: false,
  manage_expenses: false,
  manage_reports: false,
  manage_exams: false,
  manage_attendance: false,
  system_settings: false,
};

export default function Roles() {
  const { user } = useAuth();
  const theme = useTheme();
  const [roles, setRoles] = useState<RolePermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RolePermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = user?.email === 'zeeshanmaqbool200@gmail.com';

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(collection(db, 'roles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RolePermissions[];
      setRoles(rolesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'roles');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'roles', selectedRole.id), selectedRole);
      setError(null);
    } catch (err) {
      setError("Failed to save role permissions.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    const newName = prompt("Enter Role Name (e.g., Accountant, Librarian):");
    if (!newName) return;
    
    const id = newName.toLowerCase().replace(/\s+/g, '_');
    const newRole: RolePermissions = {
      id,
      name: newName,
      description: `Custom permissions for ${newName}`,
      permissions: { ...DEFAULT_PERMISSIONS }
    };
    
    try {
      await setDoc(doc(db, 'roles', id), newRole);
      setSelectedRole(newRole);
    } catch (err) {
      setError("Failed to create role.");
    }
  };

  const togglePermission = (key: string) => {
    if (!selectedRole) return;
    setSelectedRole({
      ...selectedRole,
      permissions: {
        ...selectedRole.permissions,
        [key]: !selectedRole.permissions[key]
      }
    });
  };

  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          Access Denied. Only the Super Administrator can manage root roles.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Shield size={32} className="text-primary-500" />
            Role & Permissions Engine
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
            Define what different staff members can see and do within the system.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Plus />} 
          onClick={handleCreateRole}
          sx={{ borderRadius: 3, fontWeight: 800 }}
        >
          Define New Role
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 3 }}>{error}</Alert>}

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Typography variant="overline" sx={{ fontWeight: 900, color: 'text.disabled', letterSpacing: 1.5 }}>Available Roles</Typography>
            {loading ? <CircularProgress size={24} /> : roles.map(role => (
              <Card 
                key={role.id} 
                onClick={() => setSelectedRole(role)}
                sx={{ 
                  cursor: 'pointer', 
                  borderRadius: 3, 
                  border: '1px solid',
                  borderColor: selectedRole?.id === role.id ? 'primary.main' : 'divider',
                  bgcolor: selectedRole?.id === role.id ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': { transform: 'translateX(8px)', borderColor: 'primary.main' }
                }}
              >
                <CardContent sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{role.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {Object.values(role.permissions).filter(Boolean).length} Active Permissions
                    </Typography>
                  </Box>
                  <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); if(confirm('Delete role?')) deleteDoc(doc(db, 'roles', role.id)); }}>
                     <Trash2 size={16} />
                  </IconButton>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          {selectedRole ? (
            <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
               <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                    <Box>
                       <Typography variant="h5" sx={{ fontWeight: 900 }}>{selectedRole.name} Permissions</Typography>
                       <Typography variant="body2" color="text.secondary">{selectedRole.description}</Typography>
                    </Box>
                    <Button 
                      variant="contained" 
                      startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />} 
                      disabled={saving}
                      onClick={handleSaveRole}
                      sx={{ borderRadius: 2, fontWeight: 800 }}
                    >
                      Save Configuration
                    </Button>
                  </Box>

                  <Divider sx={{ mb: 4 }} />

                  <Grid container spacing={3}>
                    {Object.keys(DEFAULT_PERMISSIONS).map(key => (
                      <Grid size={{ xs: 12, sm: 6 }} key={key}>
                        <Paper 
                          elevation={0} 
                          sx={{ 
                            p: 2, 
                            borderRadius: 3, 
                            border: '1px solid', 
                            borderColor: 'divider',
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            bgcolor: selectedRole.permissions[key] ? alpha(theme.palette.success.main, 0.02) : 'transparent'
                          }}
                        >
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 800, textTransform: 'capitalize' }}>
                              {key.replace(/_/g, ' ')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Grant access to {key.split('_')[1]} module
                            </Typography>
                          </Box>
                          <Switch 
                            checked={!!selectedRole.permissions[key]} 
                            onChange={() => togglePermission(key)}
                            color="success"
                          />
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  <Box sx={{ mt: 6, p: 3, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                     <Info size={24} className="text-info-500" />
                     <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Changes to permissions will take effect next time members with this role log in or refresh their session.
                     </Typography>
                  </Box>
               </CardContent>
            </Card>
          ) : (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, opacity: 0.5 }}>
               <Lock size={64} />
               <Typography variant="h5" sx={{ mt: 2, fontWeight: 900 }}>Select a Role to Manage</Typography>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
