import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Badge, Typography, Popover, MenuItem, ListItemIcon, ListItemText, Divider, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  LayoutDashboard, Users, CreditCard, Bell, Terminal, 
  Settings as SettingsIcon, Calendar, BarChart3, BookOpen, 
  IndianRupee, FileText, User, ClipboardCheck, MoreHorizontal,
  ChevronUp
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [internalVisible, setInternalVisible] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);

  const scrollPos = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Dialog observer to hide nav when a modal is open
    const observer = new MutationObserver(() => {
      const isDialogOpen = !!document.querySelector('.MuiDialog-root');
      setInternalVisible(!isDialogOpen);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Keyboard observer
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.85;
        setKeyboardOpen(isKeyboard);
      }
    };

    // Scroll handler with requestAnimationFrame for performance
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const prevScrollY = scrollPos.current;
          const diff = currentScrollY - prevScrollY;
          
          // HIDE logic: Scrolling down (even by 1 pixel)
          if (currentScrollY > 10 && diff > 1) {
             setInternalVisible(false);
          } 
          // SHOW logic: Deliberate upward scroll or at very top
          else if (currentScrollY <= 2) {
             setInternalVisible(true);
          }
          else if (diff < -40) {
             setInternalVisible(true);
          }
          // Do nothing when diff is 0 (stopped scrolling) - this keeps it hidden if it was hidden
          
          scrollPos.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      observer.disconnect();
    };
  }, []);

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
  const activeMoreItem = moreItems.find(item => item.path === location.pathname);
  const moreLabel = activeMoreItem ? activeMoreItem.label : 'More';
  const displayMoreLabel = moreLabel;
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
          scale: isActuallyVisible ? 1 : 0.98
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 30 
        }}
        sx={{ 
          position: 'fixed', 
          bottom: { xs: 16, md: 24 }, 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 1200, 
          width: { xs: 'calc(100% - 16px)', sm: 'auto' },
          maxWidth: { xs: 400, sm: 500, md: 800 },
          pointerEvents: isActuallyVisible ? 'auto' : 'none',
          pb: { xs: 'env(safe-area-inset-bottom)', sm: 0 },
        }}
      >
        <Paper 
          elevation={0}
          data-testid="bottom-nav-paper"
          sx={{ 
            borderRadius: { xs: '24px', sm: '28px' },
            p: { xs: '4px', sm: '8px' },
            width: '100%',
            bgcolor: theme.palette.mode === 'dark' ? alpha('#050505', 0.85) : alpha('#ffffff', 0.85),
            backdropFilter: 'blur(30px) saturate(180%)',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            boxShadow: theme.palette.mode === 'dark' 
              ? '0 20px 40px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)' 
              : '0 20px 40px -12px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 0, sm: 2, md: 4 },
            pointerEvents: 'auto',
          }} 
        >
          {primaryItems.map((item) => {
            const isActive = activePath === item.path;
            return (
              <Box
                key={item.path}
                component={motion.div}
                whileTap={{ scale: 0.94 }}
                onClick={() => navigate(item.path)}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: { xs: 60, sm: 80, md: 100 },
                  height: { xs: 48, sm: 60 },
                  cursor: 'pointer',
                  borderRadius: '18px',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  mx: { xs: 0, sm: 0.25 },
                  '&:hover': {
                    color: 'primary.main',
                    '& .nav-icon': {
                      transform: 'translateY(-1px)',
                    }
                  }
                }}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-glow"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '18px',
                        backgroundColor: alpha(theme.palette.primary.main, 0.06),
                        zIndex: -1,
                      }}
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                    >
                      <Box sx={{ 
                        position: 'absolute', 
                        bottom: 0, 
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        width: '24%', 
                        height: 2.5, 
                        bgcolor: 'primary.main', 
                        borderRadius: '4px 4px 0 0',
                        boxShadow: `0 0 10px ${theme.palette.primary.main}`
                      }} />
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <Box className="nav-icon" sx={{ position: 'relative', display: 'flex', mb: { xs: 0, sm: 0.25 }, transition: 'transform 0.3s ease' }}>
                  {React.cloneElement(item.icon as React.ReactElement<any>, { 
                    size: isMobile ? 16 : 18,
                    strokeWidth: isActive ? 2.5 : 2,
                    style: { 
                      filter: isActive ? `drop-shadow(0 0 6px ${alpha(theme.palette.primary.main, 0.3)})` : 'none',
                    }
                  })}
                  {item.label === 'Home' && unreadNotifications > 0 && (
                    <Badge 
                      badgeContent={unreadNotifications} 
                      color="error" 
                      sx={{ 
                        position: 'absolute', 
                        top: -4, 
                        right: -8,
                        '& .MuiBadge-badge': {
                          fontSize: '0.55rem',
                          height: 14,
                          minWidth: 14,
                          fontWeight: 900,
                          border: `1.5px solid ${theme.palette.mode === 'dark' ? '#050505' : '#fff'}`
                        }
                      }} 
                    />
                  )}
                </Box>
                {!isMobile && (
                  <Typography variant="caption" sx={{ 
                    fontSize: '0.6rem', 
                    fontWeight: isActive ? 800 : 500,
                    letterSpacing: '0.01em',
                    opacity: isActive ? 1 : 0.6,
                  }}>
                    {item.label}
                  </Typography>
                )}
                {isMobile && isActive && (
                  <Typography variant="caption" sx={{ 
                    fontSize: '0.55rem', 
                    fontWeight: 800,
                    position: 'absolute',
                    bottom: 4,
                  }}>
                    {item.label}
                  </Typography>
                )}
              </Box>
            );
          })}

          {moreItems.length > 0 && (
            <Box
              component={motion.div}
              whileTap={{ scale: 0.94 }}
              onClick={handleMoreClick}
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: { xs: 60, sm: 80, md: 100 },
                height: { xs: 48, sm: 60 },
                cursor: 'pointer',
                borderRadius: '18px',
                color: isMoreActive ? 'primary.main' : 'text.secondary',
                transition: 'all 0.3s ease',
                mx: { xs: 0, sm: 0.25 },
                '&:hover': {
                  color: 'primary.main',
                }
              }}
            >
              <AnimatePresence>
                {isMoreActive && (
                  <motion.div
                    layoutId="active-nav-glow"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '18px',
                      backgroundColor: alpha(theme.palette.primary.main, 0.06),
                      zIndex: -1,
                    }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  >
                    <Box sx={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      left: '50%', 
                      transform: 'translateX(-50%)', 
                      width: '24%', 
                      height: 2.5, 
                      bgcolor: 'primary.main', 
                      borderRadius: '4px 4px 0 0',
                      boxShadow: `0 0 10px ${theme.palette.primary.main}`
                    }} />
                  </motion.div>
                )}
              </AnimatePresence>
              {activeMoreItem ? React.cloneElement(activeMoreItem.icon as React.ReactElement<any>, { 
                size: isMobile ? 16 : 18, 
                strokeWidth: 2.5 
              }) : <MoreHorizontal size={isMobile ? 16 : 18} strokeWidth={isMoreActive ? 2.5 : 2} />}
              {!isMobile && (
                <Typography variant="caption" sx={{ 
                  fontSize: '0.6rem', 
                  fontWeight: isMoreActive ? 800 : 500,
                  letterSpacing: '0.01em',
                  opacity: isMoreActive ? 1 : 0.6 
                }}>
                  {displayMoreLabel}
                </Typography>
              )}
              {isMobile && isMoreActive && (
                <Typography variant="caption" sx={{ 
                  fontSize: '0.55rem', 
                  fontWeight: 800,
                  position: 'absolute',
                  bottom: 4,
                }}>
                  {moreLabel}
                </Typography>
              )}
              {isMobile && !isMoreActive && (
                <Typography variant="caption" sx={{ 
                  fontSize: '0.55rem', 
                  fontWeight: 500,
                  opacity: 0.6
                }}>
                  More
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      </Box>

      <AnimatePresence>
        {Boolean(moreAnchorEl) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleMoreClose}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(8px)',
                zIndex: 1300,
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              style={{
                position: 'fixed',
                bottom: 85,
                right: isMobile ? 12 : 'auto',
                left: isMobile ? 'auto' : 'calc(50% + 140px)',
                width: 160,
                backgroundColor: theme.palette.mode === 'dark' ? alpha('#0f0f0f', 0.95) : alpha('#ffffff', 0.95),
                backdropFilter: 'blur(30px)',
                borderRadius: 20,
                padding: 4,
                zIndex: 1301,
                boxShadow: theme.palette.mode === 'dark' 
                  ? '0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)' 
                  : '0 20px 50px rgba(0,0,0,0.12)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                transform: isMobile ? 'none' : 'translateX(-50%)',
              }}
            >
              <Typography variant="overline" sx={{ px: 1.5, py: 0.5, mb: 0.5, display: 'block', fontWeight: 900, opacity: 0.5, letterSpacing: '0.1em', fontSize: '0.6rem' }}>
                ADMIN & TOOLS
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {moreItems.map((item) => {
                  const isActive = activePath === item.path;
                  return (
                    <Box
                      key={item.path}
                      component={motion.div}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        navigate(item.path);
                        handleMoreClose();
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1,
                        borderRadius: '16px',
                        cursor: 'pointer',
                        color: isActive ? 'primary.main' : 'text.primary',
                        bgcolor: isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                    >
                      <Box sx={{ 
                        display: 'flex', 
                        color: isActive ? 'primary.main' : 'text.secondary',
                        p: 0.75,
                        borderRadius: 1.2,
                        bgcolor: isActive ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.divider, 0.03)
                      }}>
                        {React.cloneElement(item.icon as React.ReactElement<any>, { size: 18, strokeWidth: isActive ? 2.5 : 2 })}
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.8rem' }}>
                        {item.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

