import React, { useState, useEffect } from 'react';
import { Box, Paper, BottomNavigation, BottomNavigationAction, alpha, useTheme, Badge, Avatar, Tooltip } from '@mui/material';
import { LayoutDashboard, Users, CreditCard, Bell, Terminal, Settings as SettingsIcon, Calendar, BarChart3, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '../types';

interface BottomNavProps {
  user: UserProfile;
  unreadNotifications?: number;
  visible?: boolean;
}

export default function BottomNav({ user, unreadNotifications = 0, visible: controlledVisible = true }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [internalVisible, setInternalVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If we are at the very top, always show it
      if (currentScrollY < 50) {
        setInternalVisible(true);
        setLastScrollY(currentScrollY);
        return;
      }

      // User said: hide bottom nav on scroll up and show on scroll down
      if (currentScrollY < lastScrollY) {
        // Scrolling UP
        setInternalVisible(false);
      } else {
        // Scrolling DOWN
        if (Math.abs(currentScrollY - lastScrollY) > 5) { // Add small threshold
          setInternalVisible(true);
        }
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const role = user.role || 'student';
  const isSuperAdmin = role === 'superadmin';
  const isMudaris = role === 'approved_mudaris';

  const menuItems = [
    { label: 'Home', icon: <LayoutDashboard size={22} />, path: '/', roles: ['student', 'approved_mudaris', 'pending_mudaris', 'superadmin'] },
    { label: 'Courses', icon: <BookOpen size={22} />, path: '/courses', roles: ['student', 'approved_mudaris', 'superadmin'] },
    { label: 'Tulab', icon: <Users size={22} />, path: '/users', roles: ['superadmin', 'approved_mudaris'] },
    { label: 'Fees', icon: <CreditCard size={22} />, path: '/fees', roles: ['student', 'approved_mudaris', 'superadmin'] },
    { label: 'Reports', icon: <BarChart3 size={22} />, path: '/reports', roles: ['approved_mudaris', 'superadmin'] },
    { label: 'Settings', icon: <SettingsIcon size={22} />, path: '/settings', roles: ['student', 'approved_mudaris', 'pending_mudaris', 'superadmin'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));
  
  const activeIndex = filteredMenu.findIndex(item => item.path === location.pathname);

  const isActuallyVisible = controlledVisible && internalVisible;

  if (filteredMenu.length === 0) return null;

  return (
    <AnimatePresence>
      {isActuallyVisible && (
        <Box 
          component={motion.div}
          initial={{ y: 100, x: '-50%', opacity: 0 }}
          animate={{ y: 0, x: '-50%', opacity: 1 }}
          exit={{ y: 100, x: '-50%', opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          sx={{ 
            position: 'fixed', 
            bottom: { xs: 16, sm: 32 }, 
            left: '50%', 
            zIndex: 10000, 
            width: 'auto',
            pointerEvents: 'none',
          }}
        >
          <Paper 
            elevation={0}
            sx={{ 
              borderRadius: 1,
              p: 0.75,
              bgcolor: theme.palette.mode === 'dark' ? alpha('#1a1a1a', 0.95) : alpha('#ffffff', 0.85),
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 20px 40px rgba(0,0,0,0.8)' 
                : '0 20px 40px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              pointerEvents: 'auto',
            }} 
          >
            {filteredMenu.map((item, index) => {
              const isActive = activeIndex === index;
              return (
                <Box
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    cursor: 'pointer',
                    borderRadius: 1,
                    color: isActive ? 'primary.main' : 'text.secondary',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    }
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      style={{
                        position: 'absolute',
                        inset: 4,
                        borderRadius: 1,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                        zIndex: -1
                      }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {item.icon}
                </Box>
              );
            })}
          </Paper>
        </Box>
      )}
    </AnimatePresence>
  );
}
