import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Avatar } from '@mui/material';
import { motion } from 'motion/react';
import { useTheme, alpha } from '@mui/material/styles';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function LoadingScreen() {
  const theme = useTheme();
  const [logoUrl, setLogoUrl] = useState<string>('');

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const instDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (instDoc.exists()) {
          setLogoUrl(instDoc.data().logoUrl || '');
        }
      } catch (error) {
        console.error("Error fetching logo for loading screen:", error);
      }
    };
    fetchLogo();
  }, []);

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
        zIndex: 99999,
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(15, 118, 110, 0.2) 0%, rgba(0,0,0,0) 70%)',
        backdropFilter: 'blur(20px)'
      }}
    >
      <motion.div
        animate={{ 
          scale: [1, 1.05, 1],
          opacity: [0.8, 1, 0.8]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ marginBottom: '2rem' }}
      >
        <Box 
          sx={{ 
            width: { xs: 120, md: 160 }, 
            height: { xs: 120, md: 160 }, 
            borderRadius: '50%', 
            border: `2px solid ${alpha(theme.palette.primary.main, 0.4)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 50px ${alpha(theme.palette.primary.main, 0.25)}`,
            position: 'relative',
            bgcolor: alpha('#fff', 0.08),
            backdropFilter: 'blur(15px)',
            p: 2.5
          }}
        >
          {logoUrl ? (
            <Box 
              component="img"
              src={logoUrl} 
              sx={{ 
                width: '80%', 
                height: '80%', 
                objectFit: 'contain',
                zIndex: 5,
                filter: 'drop-shadow(0 0 10px rgba(15, 118, 110, 0.5))'
              }}
              onError={() => setLogoUrl('')}
            />
          ) : (
            <Typography 
              variant="h2" 
              sx={{ 
                fontFamily: 'var(--font-display)', 
                color: 'primary.main', 
                fontWeight: 900,
                zIndex: 2,
                fontSize: { xs: '3rem', md: '4rem' },
                textShadow: '0 0 20px rgba(15, 118, 110, 0.5)'
              }}
            >
              W
            </Typography>
          )}
          
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            style={{ position: 'absolute', top: -8, left: -8, right: -8, bottom: -8 }}
          >
            <Box 
              sx={{ 
                width: '100%', 
                height: '100%', 
                borderRadius: '50%', 
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                opacity: 0.6
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
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            textTransform: 'uppercase'
          }}
        >
          Wali Ul Aser Institute
        </Typography>
        <Box sx={{ width: 40, height: 2, bgcolor: 'primary.main', mx: 'auto', mt: 1, borderRadius: 1 }} />
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
          INSTITUTE MANAGEMENT SYSTEM
        </Typography>
      </motion.div>
    </Box>
  );
}
