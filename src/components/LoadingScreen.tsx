import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { motion } from 'motion/react';
import { useTheme, alpha } from '@mui/material/styles';

export default function LoadingScreen() {
  const theme = useTheme();

  return (
    <Box 
      sx={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: '#000',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(15, 118, 110, 0.2) 0%, rgba(0,0,0,0) 70%)',
      }}
    >
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.5, 1, 0.5],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ marginBottom: '2rem' }}
      >
        <Box 
          sx={{ 
            width: 120, 
            height: 120, 
            borderRadius: '50%', 
            border: `2px solid ${theme.palette.primary.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 50px ${alpha(theme.palette.primary.main, 0.3)}`,
            position: 'relative'
          }}
        >
          {/* Central Icon - Placeholder for a religious graphic or just a styled "W" */}
          <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 900, fontFamily: 'var(--font-display)' }}>
            W
          </Typography>
          
          <CircularProgress 
            size={140} 
            thickness={1}
            sx={{ 
              position: 'absolute',
              color: 'primary.main',
              opacity: 0.3,
              '& .MuiCircularProgress-circle': {
                strokeDasharray: '80px, 200px'
              }
            }} 
          />
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Typography 
          variant="h5" 
          sx={{ 
            fontFamily: 'var(--font-display)', 
            color: 'primary.main', 
            fontWeight: 700,
            letterSpacing: 2,
            textAlign: 'center'
          }}
        >
          MAKTAB WALI UL ASER
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'text.secondary', 
            textAlign: 'center', 
            mt: 1,
            fontWeight: 600,
            letterSpacing: 1
          }}
        >
          Starting your journey of learning...
        </Typography>
      </motion.div>
    </Box>
  );
}
