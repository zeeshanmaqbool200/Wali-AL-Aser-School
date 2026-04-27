import React, { useState, useEffect } from 'react';
import { Box, Paper, BottomNavigation, BottomNavigationAction, Badge, Avatar, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { LayoutDashboard, Users, CreditCard, Bell, Terminal, Settings as SettingsIcon, Calendar, BarChart3, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        // If the viewport height is significantly less than the screen height, keyboard is probably open
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.85;
        setKeyboardOpen(isKeyboard);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If we are at the very top, always show it
      if (currentScrollY < 50) {
        setInternalVisible(true);
        setLastScrollY(currentScrollY);
        return;
      }

      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling DOWN
        setInternalVisible(false);
      } else if (currentScrollY < lastScrollY || currentScrollY < 50) {
        // Scrolling UP or at the top
        setInternalVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const role = user.role || 'student';
  const isSuperAdmin = user.email === 'zeeshanmaqbool200@gmail.com';
  const isMuntazim = role === 'muntazim';
  const isMudarisRole = role === 'mudaris';
  const isAdmin = isSuperAdmin || isMuntazim;
  const isStaff = isAdmin || isMudarisRole;

  const menuItems = [
    { label: 'Home', icon: <LayoutDashboard size={20} />, path: '/', roles: ['student', 'mudaris', 'pending_mudaris', 'superadmin', 'muntazim'] },
    { label: 'Courses', icon: <BookOpen size={20} />, path: '/courses', roles: ['student', 'mudaris', 'superadmin', 'muntazim'] },
    { label: 'Tulab', icon: <Users size={20} />, path: '/users', roles: ['superadmin', 'muntazim'] },
    { label: 'Fees', icon: <CreditCard size={20} />, path: '/fees', roles: ['student', 'mudaris', 'superadmin', 'muntazim'] },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports', roles: ['superadmin'] },
    { label: 'Settings', icon: <SettingsIcon size={20} />, path: '/settings', roles: ['student', 'mudaris', 'superadmin', 'muntazim'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));
  
  const activeIndex = filteredMenu.findIndex(item => item.path === location.pathname);

  const isActuallyVisible = controlledVisible && internalVisible && !keyboardOpen;

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
              p: 0.5,
              bgcolor: theme.palette.mode === 'dark' ? alpha('#1a1a1a', 0.95) : alpha('#ffffff', 0.85),
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 4px 12px rgba(0,0,0,0.5)' 
                : '0 4px 12px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.25,
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
                    width: 44,
                    height: 44,
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
