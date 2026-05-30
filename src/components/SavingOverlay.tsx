import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, alpha } from '@mui/material/styles';
import { CloudUpload } from 'lucide-react';

interface SavingOverlayProps {
  isSaving: boolean;
  message?: string;
}

export function SavingOverlay({ isSaving, message = 'Syncing Changes...' }: SavingOverlayProps) {
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
              px: { xs: 2, sm: 3 },
              py: 1.5,
              borderRadius: 4,
              bgcolor: theme.palette.mode === 'dark' ? alpha('#0f172a', 0.95) : '#ffffff',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' 
                : '0 20px 50px rgba(0,0,0,0.1)',
              backdropFilter: 'blur(20px)',
              pointerEvents: 'auto',
            }}
          >
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: `conic-gradient(from 0deg, transparent, ${theme.palette.primary.main})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 2
                }}
              >
                <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#fff' }} />
              </motion.div>
              <Box sx={{ position: 'absolute' }}>
                <CloudUpload size={14} color={theme.palette.primary.main} />
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 950, color: 'text.primary', letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.7rem', opacity: 0.8 }}>
                System Sync
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: -0.2, mt: -0.2 }}>
                {message}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </AnimatePresence>
  );
}
