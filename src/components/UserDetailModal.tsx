import React from 'react';
import { 
  Dialog, 
  Box, 
  Typography, 
  IconButton, 
  Avatar, 
  Stack, 
  Divider, 
  Grid, 
  Paper,
  Chip,
  Button
} from '@mui/material';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  BookOpen,
  Contact,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { UserProfile } from '../types';
import { alpha, useTheme } from '@mui/material/styles';

interface UserDetailModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onViewID?: (user: UserProfile) => void;
}

export default function UserDetailModal({ open, onClose, user, onViewID }: UserDetailModalProps) {
  const theme = useTheme();

  if (!user) return null;

  const DetailItem = ({ icon: Icon, label, value, color = 'text.secondary' }: any) => (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Box sx={{ color: 'primary.main', mt: 0.5 }}>
        <Icon size={18} />
      </Box>
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
          {value || 'N/A'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 4, overflow: 'hidden' }
      }}
    >
      <Box sx={{ 
        height: 140, 
        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.dark, 0.8)})`,
        position: 'relative'
      }}>
        <IconButton 
          onClick={onClose}
          sx={{ position: 'absolute', top: 16, right: 16, color: 'white', bgcolor: 'rgba(0,0,0,0.1)' }}
        >
          <X size={20} />
        </IconButton>
      </Box>

      <Box sx={{ px: 3, pb: 4, position: 'relative' }}>
        <Avatar 
          src={user.photoURL} 
          sx={{ 
            width: 120, 
            height: 120, 
            border: '4px solid white', 
            borderRadius: 4,
            mt: -8,
            bgcolor: 'background.paper',
            boxShadow: theme.shadows[4]
          }}
        >
          {user.displayName?.charAt(0)}
        </Avatar>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -1 }}>
              {user.displayName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <Chip 
                label={(user.role || 'Member').toUpperCase()} 
                size="small" 
                sx={{ 
                  fontWeight: 900, 
                  bgcolor: alpha(theme.palette.primary.main, 0.1), 
                  color: 'primary.main',
                  borderRadius: 1
                }} 
              />
              {user.isVerified && <CheckCircle2 size={16} color={theme.palette.success.main} />}
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                ID: {user.admissionNo || user.staffId || user.uid.slice(0, 8)}
              </Typography>
            </Stack>
          </Box>

          <Button 
            variant="outlined" 
            size="small"
            startIcon={<Contact size={16} />}
            onClick={() => onViewID?.(user)}
            sx={{ borderRadius: 2, fontWeight: 900, textTransform: 'none' }}
          >
            Digital ID Card
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DetailItem icon={Mail} label="Email Address" value={user.email} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DetailItem icon={Phone} label="Contact Number" value={user.phone} />
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6 }}>
            <DetailItem 
              icon={User} 
              label="Parentage" 
              value={user.fatherName ? `S/O ${user.fatherName}` : 'N/A'} 
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <DetailItem 
              icon={GraduationCap} 
              label={user.role === 'student' ? 'Current Class' : 'Department/Subject'} 
              value={user.classLevel || user.subject || 'N/A'} 
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <DetailItem 
              icon={Calendar} 
              label="Admission Date" 
              value={user.admissionDate || (user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A')} 
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <DetailItem 
              icon={Clock} 
              label="Account Status" 
              value={user.status || 'Active'} 
            />
          </Grid>

          <Grid size={12}>
            <DetailItem icon={MapPin} label="Permanent Address" value={user.address} />
          </Grid>

          {user.qualifications && (
            <Grid size={12}>
              <DetailItem icon={BookOpen} label="Academic Qualifications" value={user.qualifications} />
            </Grid>
          )}
        </Grid>

        <Box sx={{ mt: 5, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.05) }}>
           <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
             <ShieldCheck size={14} /> SECURITY & SYSTEM AUDIT
           </Typography>
           <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
             Account verified: {user.isVerified ? 'YES' : 'PENDING'}
           </Typography>
           <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
             Last system update: {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : 'N/A'}
           </Typography>
        </Box>
      </Box>
    </Dialog>
  );
}
