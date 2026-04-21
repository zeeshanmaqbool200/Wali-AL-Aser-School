import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, alpha, useTheme, Slide } from '@mui/material';
import { Bell, X, Info, AlertCircle } from 'lucide-react';
import { useNotifications } from '../services/notificationService';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationBanner() {
  const theme = useTheme();
  const { permission, isSupported, requestPermission } = useNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDeniedBanner, setShowDeniedBanner] = useState(false);

  useEffect(() => {
    if (isSupported && permission === 'default') {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
    if (isSupported && permission === 'denied') {
      setShowDeniedBanner(true);
    }
  }, [isSupported, permission]);

  const handleRequest = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      setShowPrompt(false);
    }
  };

  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3000, pointerEvents: 'none' }}>
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            style={{ pointerEvents: 'auto', padding: '16px' }}
          >
            <Box sx={{ 
              maxWidth: 500, mx: 'auto', bgcolor: 'background.paper', borderRadius: 100, p: 1.5, pl: 2.5,
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid', borderColor: alpha(theme.palette.divider, 0.1),
              display: 'flex', alignItems: 'center', gap: 2,
              pointerEvents: 'auto',
              backdropFilter: 'blur(20px)',
            }}>
              <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                <Bell size={20} />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>Stay Updated</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>Enable notifications for important alerts.</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" onClick={() => setShowPrompt(false)} sx={{ fontWeight: 700, color: 'text.secondary', borderRadius: 100 }}>Later</Button>
                <Button size="small" variant="contained" onClick={handleRequest} sx={{ fontWeight: 800, borderRadius: 100, px: 3 }}>Enable</Button>
              </Box>
            </Box>
          </motion.div>
        )}

        {showDeniedBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            style={{ pointerEvents: 'auto', padding: '16px' }}
          >
            <Box sx={{ 
              maxWidth: 500, mx: 'auto', bgcolor: '#FFF5F5', borderRadius: 4, p: 2,
              border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.2),
              display: 'flex', alignItems: 'center', gap: 2,
              boxShadow: '0 10px 20px rgba(0,0,0,0.05)'
            }}>
              <Box sx={{ color: 'error.main', display: 'flex' }}>
                <AlertCircle size={20} />
              </Box>
              <Typography variant="caption" sx={{ flexGrow: 1, fontWeight: 700, color: 'error.dark' }}>
                Notifications are blocked. Please enable them in your browser settings for a better experience.
              </Typography>
              <IconButton size="small" onClick={() => setShowDeniedBanner(false)} sx={{ color: 'error.main' }}><X size={16} /></IconButton>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
