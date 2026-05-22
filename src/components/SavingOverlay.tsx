import React from 'react';
import { Box, Typography, LinearProgress, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, alpha } from '@mui/material/styles';
import { Save } from 'lucide-react';

interface SavingOverlayProps {
  isSaving: boolean;
  message?: string;
}

export default function SavingOverlay({ isSaving, message = 'Saving to Database...' }: SavingOverlayProps) {
  const theme = useTheme();

  return (
    <AnimatePresence>
      {isSaving && (
        <Box
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.background.default, 0.7),
            backdropFilter: 'blur(8px)',
          }}
        >
          <Box
            component={motion.div}
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              p: 4,
              borderRadius: 6,
              bgcolor: theme.palette.mode === 'dark' ? alpha('#111', 0.95) : alpha('#fff', 0.95),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' 
                : '0 20px 40px rgba(0,0,0,0.1)',
              textAlign: 'center',
              maxWidth: 280,
              width: '90%',
              backdropFilter: 'blur(20px)',
            }}
          >
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              >
                <CircularProgress 
                  size={64} 
                  thickness={1.5} 
                  sx={{ color: alpha(theme.palette.primary.main, 0.1) }} 
                />
              </motion.div>
              <CircularProgress
                variant="indeterminate"
                size={64}
                thickness={3}
                sx={{
                  color: theme.palette.primary.main,
                  position: 'absolute',
                  left: 0,
                  [`& .MuiCircularProgress-circle`]: {
                    strokeLinecap: 'round',
                    animationDuration: '1.5s',
                  },
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Save size={24} color={theme.palette.primary.main} />
                </motion.div>
              </Box>
            </Box>

            <Box sx={{ width: '100%', mt: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 950, mb: 1, color: 'text.primary', letterSpacing: -0.5 }}>
                {message}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 2, opacity: 0.8 }}>
                Synchronizing secure data nodes
              </Typography>
              <Box sx={{ position: 'relative', height: 6, width: '100%', bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 3, overflow: 'hidden' }}>
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: '50%',
                    background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, transparent)`,
                    borderRadius: 3,
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </AnimatePresence>
  );
}
