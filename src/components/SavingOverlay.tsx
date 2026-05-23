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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1, transition: { delay: 0.5 } }} // Hold a bit before vanishing
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.background.default, 0.4),
            backdropFilter: 'blur(4px)',
          }}
        >
          <Box
            component={motion.div}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.05, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              px: 3,
              py: 1.5,
              borderRadius: 4,
              bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,224,255,0.05)' 
                : '0 10px 30px rgba(0,0,0,0.08)',
              backdropFilter: 'blur(20px)',
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
