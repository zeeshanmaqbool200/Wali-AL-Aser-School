import React, { useEffect } from 'react';
import { Box, Typography, IconButton, Stack, Avatar } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { X, Megaphone, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ImportantNotificationBanner() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications } = useData();
  const [dismissed, setDismissed] = React.useState(() => {
    return sessionStorage.getItem('announcement_banner_dismissed') === 'true';
  });

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('announcement_banner_dismissed', 'true');
  };

  // Filter for unread and important/announcement
  const unreadAnnouncements = notifications.filter(n => 
    n.type === 'announcement' && (!n.readBy || (user && !n.readBy.includes(user.uid)))
  );

  useEffect(() => {
    // Request notification permission on mount if signed in
    if ('Notification' in window && user && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  if (dismissed || unreadAnnouncements.length === 0) return null;

  const latest = unreadAnnouncements[0];

  const handleAction = () => {
    // 1. Show native notification if possible
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Institutional Update', {
          body: latest.message,
          icon: latest.imageUrl || '/logo.png', // Fallback to a logo if available
          tag: latest.id
        });
      } catch (e) {
        console.warn('Native notification failed:', e);
      }
    }

    // 2. Vibrate if mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // 3. Navigate
    navigate('/notifications');

    // 4. Dismiss this banner (as it will be marked as read in Notifications page)
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0, y: -20 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{ overflow: 'hidden' }}
        >
          <Box
            onClick={handleAction}
            sx={{
              background: theme.palette.mode === 'dark' 
                ? `linear-gradient(90deg, ${alpha('#10b981', 0.1)} 0%, ${alpha('#10b981', 0.05)} 100%)`
                : `linear-gradient(90deg, ${alpha('#10b981', 0.08)} 0%, ${alpha('#10b981', 0.04)} 100%)`,
              borderBottom: '1px solid',
              borderColor: alpha('#10b981', 0.15),
              color: theme.palette.mode === 'dark' ? '#34d399' : '#047857',
              py: 1, // Balanced height
              px: { xs: 2, md: 3 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              backdropFilter: 'blur(12px)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                background: alpha('#10b981', 0.12),
                '& .banner-icon': { transform: 'scale(1.1) rotate(5deg)' }
              },
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                bgcolor: '#10b981',
              }
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
              {latest.imageUrl ? (
                <Avatar 
                  src={latest.imageUrl} 
                  variant="rounded"
                  sx={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 1,
                    boxShadow: `0 4px 12px ${alpha('#000', 0.1)}`
                  }} 
                />
              ) : (
                <Box 
                  className="banner-icon"
                  sx={{ 
                    p: 1, 
                    borderRadius: 2.5, 
                    bgcolor: alpha('#10b981', 0.15),
                    display: 'flex',
                    color: '#059669',
                    transition: 'transform 0.3s ease'
                  }}
                >
                  <Megaphone size={18} className="animate-pulse" />
                </Box>
              )}
              
              <Box sx={{ minWidth: 0 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 900, 
                    textTransform: 'uppercase', 
                    letterSpacing: 1.5, 
                    color: theme.palette.mode === 'dark' ? '#10b981' : '#059669', 
                    display: 'block', 
                    lineHeight: 1, 
                    mb: 0.4,
                    fontSize: '0.65rem'
                  }}
                >
                  Important Announcement
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 800, 
                    letterSpacing: -0.2, 
                    lineHeight: 1.2,
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: { xs: '200px', sm: '450px', md: '700px' }
                  }}
                >
                  {latest.message}
                </Typography>
              </Box>
            </Stack>
            
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }} 
              sx={{ 
                color: 'inherit', 
                opacity: 0.6, 
                '&:hover': { opacity: 1, bgcolor: alpha('#10b981', 0.1) } 
              }}
            >
              <X size={18} />
            </IconButton>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
