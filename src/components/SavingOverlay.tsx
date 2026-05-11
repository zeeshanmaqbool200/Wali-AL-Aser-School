import React from 'react';
import { Box, Typography, LinearProgress, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'motion/react';
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
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              p: 6,
              borderRadius: 6,
              bgcolor: theme.palette.mode === 'dark' ? '#111' : '#fff',
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress 
                size={80} 
                thickness={2} 
                sx={{ color: alpha(theme.palette.primary.main, 0.2) }} 
              />
              <CircularProgress
                variant="indeterminate"
                size={80}
                thickness={2}
                sx={{
                  color: theme.palette.primary.main,
                  position: 'absolute',
                  left: 0,
                  [`& .MuiCircularProgress-circle`]: {
                    strokeLinecap: 'round',
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
                <Save size={32} color={theme.palette.primary.main} />
              </Box>
            </Box>

            <Box sx={{ width: '100%', mt: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, color: 'text.primary' }}>
                {message}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 2 }}>
                Please do not close the application
              </Typography>
              <LinearProgress 
                sx={{ 
                  height: 6, 
                  borderRadius: 3, 
                  bgcolor: theme.palette.action.hover,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                  }
                }} 
              />
            </Box>
          </Box>
        </Box>
      )}
    </AnimatePresence>
  );
}
