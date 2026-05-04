import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, alpha } from '@mui/material/styles';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function LoadingScreen() {
  const theme = useTheme();
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [showContent, setShowContent] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fetchLogo = async () => {
      try {
        const instDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (instDoc.exists() && mountedRef.current) {
          setLogoUrl(instDoc.data().logoUrl || '');
        }
      } catch (error) {
        console.error("Error fetching logo for loading screen:", error);
      }
    };
    
    fetchLogo();
    
    const timer = setTimeout(() => {
      if (mountedRef.current) setShowContent(true);
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
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
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(15, 118, 110, 0.15) 0%, rgba(0,0,0,0) 80%)',
        overflow: 'hidden'
      }}
    >
      <AnimatePresence>
        {showContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%'
            }}
          >
            {/* Main Animated Element - Simplified and more modern */}
            <Box 
              sx={{ 
                position: 'relative',
                width: { xs: 120, md: 160 },
                height: { xs: 120, md: 160 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 6
              }}
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '24px',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 70%)`
                }}
              />
              
              <Box 
                sx={{ 
                  width: '70%', 
                  height: '70%', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2
                }}
              >
                {logoUrl ? (
                  <motion.img
                    src={logoUrl}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 0 15px rgba(13, 148, 136, 0.4))'
                    }}
                  />
                ) : (
                  <Typography 
                    variant="h2" 
                    sx={{ 
                      fontWeight: 950, 
                      color: 'primary.main',
                      textShadow: `0 0 30px ${alpha(theme.palette.primary.main, 0.6)}`
                    }}
                  >
                    W
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Title with staggered entrance */}
            <Box sx={{ textAlign: 'center' }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                <Typography 
                  variant="h3" 
                  sx={{ 
                    fontFamily: 'var(--font-heading)', 
                    color: 'primary.main', 
                    fontWeight: 950,
                    letterSpacing: 10,
                    textTransform: 'uppercase',
                    fontSize: { xs: '1.2rem', md: '1.8rem' },
                    mb: 1
                  }}
                >
                  Wali Ul Aser
                </Typography>
              </motion.div>
              
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 80 }}
                transition={{ delay: 1, duration: 1.2, ease: "anticipate" }}
                style={{ 
                  height: '2px', 
                  backgroundColor: theme.palette.primary.main, 
                  margin: '0 auto 16px auto',
                  borderRadius: '2px',
                  boxShadow: `0 0 10px ${theme.palette.primary.main}`
                }}
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 1.4, duration: 1 }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'text.secondary', 
                    fontWeight: 800,
                    letterSpacing: 4,
                    textTransform: 'uppercase',
                    fontSize: '0.65rem'
                  }}
                >
                  Religious & Academic Excellence
                </Typography>
              </motion.div>
            </Box>

            {/* Bottom Progress Bar */}
            <Box 
              sx={{ 
                position: 'absolute', 
                bottom: '12%', 
                width: 240, 
                height: 3, 
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderRadius: 1,
                overflow: 'hidden',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
              }}
            >
              <motion.div
                animate={{ 
                  x: ['-100%', '100%']
                }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                style={{ 
                  width: '40%', 
                  height: '100%', 
                  background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, transparent)`
                }}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
