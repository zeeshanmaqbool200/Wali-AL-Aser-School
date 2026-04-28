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
        zIndex: 9000,
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(15, 118, 110, 0.2) 0%, rgba(0,0,0,0) 70%)',
        backdropFilter: 'blur(20px)'
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
            width: 140, 
            height: 140, 
            borderRadius: '50%', 
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.1)}`,
            position: 'relative',
            bgcolor: alpha('#000', 0.3),
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Decorative "W" using Cinzel font */}
          <Typography 
            variant="h2" 
            sx={{ 
              fontFamily: 'var(--font-display)', 
              color: 'primary.main', 
              fontWeight: 900,
              zIndex: 2,
              textShadow: '0 0 20px rgba(15, 118, 110, 0.5)'
            }}
          >
            W
          </Typography>
          
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4 }}
          >
            <Box 
              sx={{ 
                width: '100%', 
                height: '100%', 
                borderRadius: '50%', 
                border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
              }} 
            />
          </motion.div>
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
            fontWeight: 800,
            letterSpacing: 4,
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)'
          }}
        >
          INSTITUTE WALI UL ASER
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'text.secondary', 
            textAlign: 'center', 
            mt: 2,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            opacity: 0.7
          }}
        >
          Journey of Learning & Growth
        </Typography>
      </motion.div>
    </Box>
  );
}
