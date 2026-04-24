import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Zap, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function RateLimitOverlay() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleRateLimit = (e: any) => {
      setErrorMsg(e.detail?.error || 'Rate limit hit');
      setVisible(true);
    };

    window.addEventListener('firestore-rate-limit', handleRateLimit);
    return () => window.removeEventListener('firestore-rate-limit', handleRateLimit);
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <Box
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            bgcolor: alpha(theme.palette.background.default, 0.9),
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
            textAlign: 'center'
          }}
        >
          <Box
            component={motion.div}
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            sx={{
              p: 6,
              borderRadius: 4,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              maxWidth: 500,
              width: '100%'
            }}
          >
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Zap size={80} color={theme.palette.warning.main} strokeWidth={1} />
              </motion.div>
            </Box>
            
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 2, letterSpacing: -1 }}>
              System Offloading...
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontWeight: 500, lineHeight: 1.6 }}>
              We've hit a temporary speed limit while syncing your data. To ensure stability, the app is currently offloading requests.
            </Typography>

            <Box sx={{ 
              p: 2, 
              mb: 4, 
              borderRadius: 2, 
              bgcolor: alpha(theme.palette.error.main, 0.05),
              border: '1px solid',
              borderColor: alpha(theme.palette.error.main, 0.1)
            }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'error.main', fontWeight: 600 }}>
                {errorMsg}
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<RefreshCcw size={20} />}
              onClick={() => window.location.reload()}
              sx={{ 
                borderRadius: 2, 
                py: 2, 
                fontWeight: 900,
                boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.3)}`
              }}
            >
              Force Refresh App
            </Button>
            
            <Button
              variant="text"
              fullWidth
              onClick={() => setVisible(false)}
              sx={{ mt: 2, fontWeight: 700, color: 'text.secondary' }}
            >
              Wait more...
            </Button>
          </Box>
        </Box>
      )}
    </AnimatePresence>
  );
}
