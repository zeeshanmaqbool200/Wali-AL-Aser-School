import React, { useState, useEffect } from 'react';
import { Box, Paper, BottomNavigation, BottomNavigationAction, Badge, Avatar, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { LayoutDashboard, Users, CreditCard, Bell, Terminal, Settings as SettingsIcon, Calendar, BarChart3, BookOpen, IndianRupee } from 'lucide-react';
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

    // Observer for detecting dialogs (Adding/Editing mode)
    const observer = new MutationObserver(() => {
      const isDialogOpen = !!document.querySelector('.MuiDialog-root');
      setInternalVisible(!isDialogOpen);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        observer.disconnect();
      };
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let scrollTimeout: any;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (Math.abs(currentScrollY - lastScrollY) < 5) return; // Ignore micro-scrolls

      // If we are at the very top, always show it
      if (currentScrollY < 20) {
        setInternalVisible(true);
        setLastScrollY(currentScrollY);
        return;
      }

      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling DOWN
        if (internalVisible) setInternalVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling UP
        if (!internalVisible) setInternalVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [lastScrollY, internalVisible]);

  const role = user.role || 'student';
  const isSuperAdmin = user.email === 'zeeshanmaqbool200@gmail.com';
  const isManagerRole = role === 'manager';
  const isTeacherRole = role === 'teacher';
  const isAdmin = isSuperAdmin || isManagerRole;
  const isStaff = isAdmin || isTeacherRole;

  const menuItems = [
    { label: 'Home', icon: <LayoutDashboard size={20} />, path: '/', roles: ['student', 'teacher', 'pending_teacher', 'superadmin', 'manager'] },
    { label: 'Courses', icon: <BookOpen size={20} />, path: '/courses', roles: ['student', 'teacher', 'superadmin', 'manager'] },
    { label: 'Students', icon: <Users size={20} />, path: '/users', roles: ['superadmin', 'manager'] },
    { label: 'Expenses', icon: <CreditCard size={20} />, path: '/expenses', roles: ['superadmin', 'manager'] },
    { label: 'Fees', icon: <IndianRupee size={20} />, path: '/fees', roles: ['student', 'teacher', 'superadmin', 'manager'] },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports', roles: ['superadmin'] },
    { label: 'Settings', icon: <SettingsIcon size={20} />, path: '/settings', roles: ['student', 'teacher', 'superadmin', 'manager'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));
  
  const activeIndex = filteredMenu.findIndex(item => item.path === location.pathname);

  const isActuallyVisible = controlledVisible && internalVisible && !keyboardOpen;

  if (filteredMenu.length === 0) return null;

  return (
    <Box>
      <Box 
        component={motion.div}
            initial={{ y: 100, x: '-50%', opacity: 0 }}
            animate={{ 
              y: isActuallyVisible ? 0 : 100, 
              x: '-50%', 
              opacity: isActuallyVisible ? 1 : 0,
              scale: isActuallyVisible ? 1 : 0.95
            }}
            transition={{ 
              type: 'spring', 
              stiffness: 260, 
              damping: 20 
            }}
            sx={{ 
              position: 'fixed', 
              bottom: { xs: 24, sm: 32 }, 
              left: '50%', 
              zIndex: 5000, 
              width: 'auto',
              pointerEvents: isActuallyVisible ? 'auto' : 'none',
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
    </Box>
  );
}
