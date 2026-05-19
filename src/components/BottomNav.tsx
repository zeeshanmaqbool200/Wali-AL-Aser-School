import React, { useState, useEffect } from 'react';
import { Box, Paper, Badge, Typography, Popover, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  LayoutDashboard, Users, CreditCard, Bell, Terminal, 
  Settings as SettingsIcon, Calendar, BarChart3, BookOpen, 
  IndianRupee, FileText, User, ClipboardCheck, MoreHorizontal,
  ChevronUp
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';

interface BottomNavProps {
  user: UserProfile;
  unreadNotifications?: number;
  visible?: boolean;
  logoUrl?: string;
}

export default function BottomNav({ user, unreadNotifications = 0, visible: controlledVisible = true, logoUrl = '' }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [internalVisible, setInternalVisible] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.85;
        setKeyboardOpen(isKeyboard);
      }
    };

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
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let clickTimeout: any;
    let isRecentlyClicked = false;

    const handleScroll = () => {
      if (isRecentlyClicked) return;
      const currentScrollY = window.scrollY;
      
      const scrollDiff = currentScrollY - lastScrollY;
      if (Math.abs(scrollDiff) < 15) return; 

      if (currentScrollY < 100) {
        setInternalVisible(true);
        setLastScrollY(currentScrollY);
        return;
      }

      if (scrollDiff > 0 && currentScrollY > 200) {
        if (internalVisible) setInternalVisible(false);
      } else if (scrollDiff < 0) {
        if (!internalVisible) setInternalVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    const handleClick = (e: MouseEvent | TouchEvent) => {
      const navElement = document.querySelector('[data-testid="bottom-nav-paper"]');
      if (navElement && navElement.contains(e.target as Node)) return;

      isRecentlyClicked = true;
      if (clickTimeout) clearTimeout(clickTimeout);
      clickTimeout = setTimeout(() => {
        isRecentlyClicked = false;
      }, 500); 
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousedown', handleClick as any, { passive: true });
    window.addEventListener('touchstart', handleClick as any, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('touchstart', handleClick);
      if (clickTimeout) clearTimeout(clickTimeout);
    };
  }, [lastScrollY, internalVisible]);

  const role = user.role || 'student';
  
  const menuItems = [
    { label: 'Home', icon: <LayoutDashboard />, path: '/', roles: ['student', 'teacher', 'pending_teacher', 'superadmin', 'manager'] },
    { label: 'Users', icon: <Users />, path: '/users', roles: ['superadmin', 'manager'] },
    { label: 'Courses', icon: <BookOpen />, path: '/courses', roles: ['student', 'teacher', 'superadmin', 'manager'] },
    { label: 'Settings', icon: <SettingsIcon />, path: '/settings', roles: ['student', 'teacher', 'superadmin', 'manager'] },
    { label: 'Attendance', icon: <ClipboardCheck />, path: '/attendance', roles: ['teacher', 'superadmin', 'manager'] },
    { label: 'Fees', icon: <CreditCard />, path: '/fees', roles: ['student', 'teacher', 'superadmin', 'manager'] },
    { label: 'Expenses', icon: <IndianRupee />, path: '/expenses', roles: ['superadmin', 'manager'] },
    { label: 'Forms', icon: <FileText />, path: '/forms', roles: ['student', 'teacher', 'superadmin', 'manager'] },
    { label: 'Reports', icon: <BarChart3 />, path: '/reports', roles: ['superadmin'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));
  
  // Define primary items based on user request: dashboard users courses settings more
  const primaryPaths = ['/', '/users', '/courses', '/settings'];
  const primaryItems = filteredMenu.filter(item => primaryPaths.includes(item.path));
  const moreItems = filteredMenu.filter(item => !primaryPaths.includes(item.path));

  const isMoreActive = moreItems.some(item => item.path === location.pathname);
  const activePath = location.pathname;

  const isActuallyVisible = controlledVisible && internalVisible && !keyboardOpen;

  const handleMoreClick = (event: React.MouseEvent<HTMLElement>) => {
    setMoreAnchorEl(event.currentTarget);
  };

  const handleMoreClose = () => {
    setMoreAnchorEl(null);
  };

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
          bottom: { xs: 20, sm: 32 }, 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 1200, 
          width: { xs: 'calc(100% - 32px)', sm: 'auto' },
          maxWidth: { xs: 450, sm: 500 },
          pointerEvents: isActuallyVisible ? 'auto' : 'none',
          pb: { xs: 'env(safe-area-inset-bottom)', sm: 0 },
        }}
      >
        <Paper 
          elevation={0}
          data-testid="bottom-nav-paper"
          sx={{ 
            borderRadius: '24px', // More modern rounded rectangle than 999px pill for these larger buttons
            p: 1,
            width: '100%',
            bgcolor: theme.palette.mode === 'dark' ? alpha('#111111', 0.9) : alpha('#ffffff', 0.9),
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: theme.palette.mode === 'dark' 
              ? '0 20px 40px rgba(0,0,0,0.6)' 
              : '0 20px 40px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 1,
            pointerEvents: 'auto',
          }} 
        >
          {primaryItems.map((item) => {
            const isActive = activePath === item.path;
            return (
              <Box
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  height: 60,
                  cursor: 'pointer',
                  borderRadius: '16px',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.2s ease',
                  '&:active': { transform: 'scale(0.95)' }
                }}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-pill"
                      style={{
                        position: 'absolute',
                        inset: '4px',
                        borderRadius: '12px',
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        zIndex: -1
                      }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </AnimatePresence>
                
                <Box sx={{ position: 'relative' }}>
                  {React.cloneElement(item.icon as React.ReactElement<any>, { 
                    size: 24,
                    strokeWidth: isActive ? 2.5 : 2
                  })}
                  {item.label === 'Home' && unreadNotifications > 0 && (
                    <Badge 
                      badgeContent={unreadNotifications} 
                      color="error" 
                      sx={{ 
                        position: 'absolute', 
                        top: -5, 
                        right: -10,
                        '& .MuiBadge-badge': {
                          fontSize: '0.65rem',
                          height: 18,
                          minWidth: 18,
                          fontWeight: 900
                        }
                      }} 
                    />
                  )}
                </Box>
                <Typography variant="caption" sx={{ 
                  fontSize: '0.65rem', 
                  fontWeight: isActive ? 800 : 500,
                  mt: 0.5,
                  opacity: isActive ? 1 : 0.7 
                }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}

          {moreItems.length > 0 && (
            <Box
              onClick={handleMoreClick}
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                height: 60,
                cursor: 'pointer',
                borderRadius: '16px',
                color: isMoreActive ? 'primary.main' : 'text.secondary',
                transition: 'all 0.2s ease',
                '&:active': { transform: 'scale(0.95)' }
              }}
            >
              <AnimatePresence>
                {isMoreActive && (
                  <motion.div
                    layoutId="active-nav-pill"
                    style={{
                      position: 'absolute',
                      inset: '4px',
                      borderRadius: '12px',
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      zIndex: -1
                    }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </AnimatePresence>
              <MoreHorizontal size={24} strokeWidth={isMoreActive ? 2.5 : 2} />
              <Typography variant="caption" sx={{ 
                fontSize: '0.65rem', 
                fontWeight: isMoreActive ? 800 : 500,
                mt: 0.5,
                opacity: isMoreActive ? 1 : 0.7 
              }}>
                More
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      <Popover
        open={Boolean(moreAnchorEl)}
        anchorEl={moreAnchorEl}
        onClose={handleMoreClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            mb: 2,
            borderRadius: '20px',
            width: 200,
            overflow: 'hidden',
            bgcolor: theme.palette.mode === 'dark' ? '#111111' : '#ffffff',
            backgroundImage: 'none',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            boxShadow: theme.palette.mode === 'dark' 
              ? '0 10px 30px rgba(0,0,0,0.5)' 
              : '0 10px 30px rgba(0,0,0,0.1)',
          }
        }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="overline" sx={{ px: 2, py: 1, display: 'block', fontWeight: 900, opacity: 0.5 }}>
            More Actions
          </Typography>
          <Divider sx={{ mb: 1, opacity: 0.5 }} />
          {moreItems.map((item) => {
            const isActive = activePath === item.path;
            return (
              <MenuItem 
                key={item.path} 
                onClick={() => {
                  navigate(item.path);
                  handleMoreClose();
                }}
                sx={{
                  borderRadius: '12px',
                  mb: 0.5,
                  py: 1.5,
                  color: isActive ? 'primary.main' : 'text.primary',
                  bgcolor: isActive ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08)
                  }
                }}
              >
                <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                  {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20 })}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ 
                    variant: 'body2', 
                    fontWeight: isActive ? 800 : 500 
                  }} 
                />
              </MenuItem>
            );
          })}
        </Box>
      </Popover>

      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        `}
      </style>
    </Box>
  );
}

