import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Typography, Box, Stack, IconButton, 
  Tooltip, alpha, useTheme, CircularProgress
} from '@mui/material';
import { 
  Shield, Bell, Camera, Mic, CheckCircle, 
  AlertTriangle, X, Settings, Smartphone
} from 'lucide-react';
import { useHardwarePermissions } from '../services/hardwareService';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../lib/logger';
import { motion, AnimatePresence } from 'framer-motion';

export default function PermissionAgent() {
  const theme = useTheme();
  const { user } = useAuth();
  const { 
    permissions, 
    requestNotificationPermission, 
    requestCameraPermission, 
    requestMicrophonePermission,
    hasAskedBefore 
  } = useHardwarePermissions();
  
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // Show agent only once if any critical permission is not granted and we haven't asked before
  useEffect(() => {
    if (!user || hasShown) return;
    
    const askedBefore = hasAskedBefore();
    
    const needsAttention = 
      (permissions.notifications === 'prompt' && !askedBefore.notifications) || 
      (permissions.camera === 'prompt' && !askedBefore.camera) || 
      (permissions.microphone === 'prompt' && !askedBefore.microphone);

    if (needsAttention) {
      const timer = setTimeout(() => {
        setOpen(true);
        setHasShown(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setOpen(false);
    }
  }, [user, permissions, hasShown]);

  const syncToBackend = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        hardwareStatus: {
          ...permissions,
          lastUpdated: new Date().toISOString()
        }
      });
      logger.success('Hardware permissions synced to backend');
    } catch (err) {
      logger.error('Failed to sync hardware status', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleRequest = async (type: 'notifications' | 'camera' | 'microphone') => {
    let result;
    if (type === 'notifications') result = await requestNotificationPermission();
    else if (type === 'camera') result = await requestCameraPermission();
    else if (type === 'microphone') result = await requestMicrophonePermission();
    
    if (result === 'granted') {
      logger.info(`${type} permission granted`);
      syncToBackend();
    }
    
    // Check if all permissions have been asked
    const askedBefore = hasAskedBefore();
    if (askedBefore.notifications && askedBefore.camera && askedBefore.microphone) {
      setOpen(false);
    }
  };

  const PermissionItem = ({ 
    icon: Icon, 
    title, 
    desc, 
    status, 
    onRequest 
  }: { 
    icon: any, 
    title: string, 
    desc: string, 
    status: string, 
    onRequest: () => void 
  }) => (
    <Box sx={{ 
      p: 2, 
      borderRadius: 4, 
      border: '1px solid', 
      borderColor: status === 'granted' ? 'success.light' : 'divider',
      bgcolor: status === 'granted' ? alpha(theme.palette.success.main, 0.03) : 'background.paper',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      transition: 'all 0.2s'
    }}>
      <Box sx={{ 
        p: 1.5, 
        borderRadius: 3, 
        bgcolor: status === 'granted' ? 'success.main' : 'primary.main',
        color: 'white'
      }}>
        <Icon size={20} />
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500 }}>
          {desc}
        </Typography>
      </Box>
      {status === 'granted' ? (
        <CheckCircle size={20} color={theme.palette.success.main} />
      ) : status === 'not-supported' ? (
        <Tooltip title="Not supported on this device">
          <AlertTriangle size={20} color={theme.palette.warning.main} />
        </Tooltip>
      ) : (
        <Button 
          variant="outlined" 
          size="small" 
          onClick={onRequest}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
        >
          Allow
        </Button>
      )}
    </Box>
  );

  return (
    <AnimatePresence>
      {open && (
        <Dialog 
          open={open} 
          onClose={() => setOpen(false)}
          disableEnforceFocus
          style={{ zIndex: 9999 }}
          PaperProps={{
            sx: { 
              borderRadius: 6, 
              width: '100%', 
              maxWidth: 450,
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              position: 'relative',
              zIndex: 9999
            }
          }}
        >
          <Box sx={{ 
            p: { xs: 2, sm: 3 }, 
            bgcolor: 'primary.main', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Shield size={24} />
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Permission Agent</Typography>
            </Box>
            <IconButton onClick={() => setOpen(false)} sx={{ color: 'white' }}>
              <X size={20} />
            </IconButton>
          </Box>
          
          <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="body2" sx={{ mb: 3, fontWeight: 500, color: 'text.secondary' }}>
              To provide the best experience for **Maktab Wali Ul Aser**, we need access to your device hardware. This allows real-time alerts and communication.
            </Typography>
            
            <Stack spacing={2}>
              <PermissionItem 
                icon={Bell}
                title="Notifications"
                desc="Get real-time alerts for fees and attendance"
                status={permissions.notifications}
                onRequest={() => handleRequest('notifications')}
              />
              <PermissionItem 
                icon={Camera}
                title="Camera"
                desc="Scan QR codes and update profile photos"
                status={permissions.camera}
                onRequest={() => handleRequest('camera')}
              />
              <PermissionItem 
                icon={Mic}
                title="Microphone"
                desc="Voice search and audio announcements"
                status={permissions.microphone}
                onRequest={() => handleRequest('microphone')}
              />
            </Stack>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Smartphone size={18} color={theme.palette.text.secondary} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Your preferences are securely synced to your account.
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: { xs: 2, sm: 3 }, pt: 0 }}>
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => {
                syncToBackend();
                setOpen(false);
              }}
              disabled={syncing}
              sx={{ 
                borderRadius: 3, 
                py: 1.5, 
                fontWeight: 900,
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
              }}
            >
              {syncing ? <CircularProgress size={24} color="inherit" /> : 'Done & Sync'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
