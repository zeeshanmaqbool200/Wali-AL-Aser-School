import React from 'react';
import { Box, LinearProgress, Typography, alpha, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

interface SavingProgressProps {
  isSaving: boolean;
  message?: string;
  success?: boolean;
}

export default function SavingProgress({ isSaving, message = 'Saving changes...', success }: SavingProgressProps) {
  const theme = useTheme();

  return (
    <AnimatePresence>
      {(isSaving || success) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
        >
          <Box sx={{
            bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : 'white',
            color: theme.palette.text.primary,
            px: 3,
            py: 1.5,
            borderRadius: 50,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            border: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? alpha('#fff', 0.1) : alpha('#000', 0.05),
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            minWidth: 200,
            backdropFilter: 'blur(10px)',
          }}>
            {isSaving ? (
              <Box sx={{ width: 24, height: 24, position: 'relative' }}>
                <LinearProgress 
                  sx={{ 
                    width: 24, 
                    height: 24, 
                    borderRadius: '50%',
                    bgcolor: 'transparent',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: '50%',
                    }
                  }} 
                />
                <Box sx={{ 
                  position: 'absolute', 
                  inset: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Box className="animate-spin" sx={{ width: 14, height: 14, border: '2px solid', borderColor: 'primary.main', borderTopColor: 'transparent', borderRadius: '50%' }} />
                </Box>
              </Box>
            ) : (
              <Box sx={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%', 
                bgcolor: alpha(theme.palette.success.main, 0.1), 
                color: theme.palette.success.main,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Check size={16} strokeWidth={3} />
              </Box>
            )}
            <Typography variant="body2" sx={{ fontWeight: 800, letterSpacing: -0.2 }}>
              {success ? 'Changes saved' : message}
            </Typography>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
