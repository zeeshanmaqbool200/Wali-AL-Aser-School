import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, alpha } from '@mui/material/styles';
import { CloudUpload } from 'lucide-react';

interface SavingOverlayProps {
  isSaving: boolean;
  message?: string;
}

export default function SavingOverlay({ isSaving, message = 'Syncing Changes...' }: SavingOverlayProps) {
  const theme = useTheme();

  return (
    <AnimatePresence>
      {isSaving && (
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, transition: { delay: 0.5 } }}
          sx={{
            position: 'fixed',
            bottom: { xs: 80, md: 30 },
            left: { xs: '50%', md: 'auto' },
            right: { xs: 'auto', md: 30 },
            transform: { xs: 'translateX(-50%)', md: 'none' },
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none', // Allow clicking through it if necessary, though it's usually small
          }}
        >
          <Box
            component={motion.div}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1.2,
              borderRadius: 3,
              bgcolor: theme.palette.mode === 'dark' ? alpha('#1e293b', 0.9) : alpha('#ffffff', 0.9),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 10px 30px rgba(0,0,0,0.5)' 
                : '0 10px 30px rgba(0,0,0,0.06)',
              backdropFilter: 'blur(10px)',
              pointerEvents: 'auto', // Re-enable pointer events for the box itself if needed
            }}
          >
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  borderTopColor: theme.palette.primary.main,
                }}
              />
              <Box sx={{ position: 'absolute' }}>
                <CloudUpload size={14} color={theme.palette.primary.main} />
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: -0.2 }}>
                {message}
              </Typography>
              <Box sx={{ mt: 0.5, height: 2, width: '100%', bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 1, overflow: 'hidden' }}>
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  style={{
                    height: '100%',
                    width: '40%',
                    background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, transparent)`,
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
