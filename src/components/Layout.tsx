import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, Container, AppBar, Toolbar, Typography, IconButton, 
  Avatar, useMediaQuery, Badge, 
  Tooltip, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider,
  InputBase, Paper, Menu, MenuItem, LinearProgress, Stack, Button
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  LogOut, User, Bell, Menu as MenuIcon, Search,
  LayoutDashboard, Users, Calendar, BookOpen, CreditCard, ClipboardList, FileText,
  ChevronRight, X, Shield, Sun, Moon, School, Download, ArrowLeft
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, Notification as NotificationType } from '../types';
import { useData } from '../context/DataContext';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import SavingOverlay from './SavingOverlay';
import ImportantNotificationBanner from './ImportantNotificationBanner';
import { collection, query, onSnapshot, orderBy, limit, updateDoc, doc, arrayUnion, getDoc, where, or, and } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { InstituteSettings } from '../types';
import { useThemeContext } from '../context/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile | null;
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const theme = useTheme();
  const { mode, setMode, navPreference } = useThemeContext();
  const { isSyncing, notifications: allNotifs, isSaving } = useData();
  const isXSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [instituteName, setInstituteName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bottomNavVisible, setBottomNavVisible] = useState(false);
  
  const showBottomNav = !isDesktop;
  const showHamburger = isDesktop; // Show hamburger on desktop to allow collapsing sidebar
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const scrollTracker = useRef({ lastY: 0, ticking: false });
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const { lastY, ticking } = scrollTracker.current;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (currentY > lastY && currentY > 100) {
            setHeaderVisible(false);
          } else {
            setHeaderVisible(true);
          }
          scrollTracker.current.lastY = currentY;
          scrollTracker.current.ticking = false;
        });
        scrollTracker.current.ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isArchived = user?.status === 'Archived' || user?.status === 'Deleted';

  const downloadUserData = async () => {
    if (!user) return;
    try {
      const myData = [
        { Section: 'Basic Profile', Field: 'Full Name', Value: user.displayName },
        { Section: 'Basic Profile', Field: 'Email', Value: user.email },
        { Section: 'Basic Profile', Field: 'Role', Value: user.role },
        { Section: 'Institutional', Field: 'Admission No', Value: user.admissionNo || 'Not Assigned' },
        { Section: 'Institutional', Field: 'Class Level', Value: user.classLevel || 'N/A' },
        { Section: 'Personal Details', Field: 'Phone', Value: user.phone || 'N/A' },
        { Section: 'Personal Details', Field: 'Father Name', Value: user.fatherName || 'N/A' },
        { Section: 'Personal Details', Field: 'Mother Name', Value: user.motherName || 'N/A' },
        { Section: 'Account Status', Field: 'Verified', Value: user.isVerified ? 'Yes' : 'No' },
        { Section: 'Account Status', Field: 'Current Status', Value: user.status },
      ];
      const { exportToCSV } = await import('../lib/exportUtils');
      exportToCSV(myData, `Member_Export_${user.uid}`);
    } catch (e) {
      console.error('Data export failed:', e);
    }
  };

  useEffect(() => {
    setNavLoading(true);
    const timer = setTimeout(() => setNavLoading(false), 600);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileAnchorEl(null);
  };

  useEffect(() => {
    // Show nav only after initial mount and a small delay for smoother entrance
    const timer = setTimeout(() => {
      setBottomNavVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Real-time listener for institute settings
    const unsubscribe = onSnapshot(doc(db, 'settings', 'institute'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.instituteName !== undefined) {
          setInstituteName(data.instituteName || '');
          document.title = data.instituteName || 'Institute Portal';
        }
        if (data.tagline !== undefined) {
          setTagline(data.tagline || '');
        }
        if (data.logoUrl !== undefined) {
          const finalLogo = data.logoUrl || '';
          setLogoUrl(finalLogo);
          // Dynamically update favicon
          if (finalLogo) {
            const link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
            if (link) {
              link.href = finalLogo;
            } else {
              const newLink = document.createElement('link');
              newLink.rel = 'icon';
              newLink.href = finalLogo;
              document.head.appendChild(newLink);
            }
            const appleLink: HTMLLinkElement | null = document.querySelector("link[rel~='apple-touch-icon']");
            if (appleLink) {
              appleLink.href = finalLogo;
            }
          }
        }
      }
    }, (error) => {
      // Don't use handleFirestoreError for this passive background task
      // as it would throw and potentially crash the SDK loop or React render
      // console.warn('Institute settings listener failed:', error.message);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || allNotifs.length === 0) return;
    const unread = allNotifs.filter(n => !n.readBy?.includes(user.uid)).length;
    setUnreadCount(unread);
  }, [user, allNotifs]);

  if (!user) return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>{children}</Box>;

  // Standalone Verification Page
  if (location.pathname.startsWith('/verify')) {
    return (
      <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden' }}>
      <SavingOverlay isSaving={isSaving} />
      
      {/* Sidebar / Drawer */}
      <Drawer
        variant={isDesktop ? "permanent" : "temporary"}
        open={isDesktop || sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sx={{
          width: isDesktop ? (sidebarCollapsed ? 88 : 280) : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': { 
            width: isDesktop ? (sidebarCollapsed ? 88 : 280) : 280, 
            boxSizing: 'border-box',
            border: 'none',
            boxShadow: isDesktop ? 'none' : '10px 0 30px rgba(0,0,0,0.1)',
            borderRight: isDesktop ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none',
            borderRadius: { xs: 0, md: isDesktop ? 0 : '0 30px 30px 0' },
            transition: theme.transitions.create(['width', 'transform'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden'
          },
        }}
      >
        <Sidebar 
          role={user.role} 
          open={!sidebarCollapsed} 
          onToggle={() => isDesktop ? setSidebarCollapsed(!sidebarCollapsed) : setSidebarOpen(false)} 
          onLogout={onLogout}
          unreadNotifications={unreadCount}
          instituteName={instituteName}
          logoUrl={logoUrl}
          tagline={tagline}
        />
      </Drawer>

      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minWidth: 0,
        marginLeft: 0 // Drawer variant permanent handles it if using display flex on container
      }}>
        {/* Top App Bar */}
        <AppBar 
          position="fixed" 
          color="inherit" 
          elevation={0} 
          className="no-print"
          sx={{ 
            zIndex: theme.zIndex.drawer + 1, 
            width: isDesktop ? `calc(100% - ${sidebarCollapsed ? '88px' : '280px'})` : '100%',
            ml: isDesktop ? (sidebarCollapsed ? '88px' : '280px') : 0,
            transition: 'all 0.3s ease',
            bgcolor: alpha(theme.palette.background.default, 0.95),
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
          }}
        >
          {navLoading && (
            <LinearProgress 
              sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                height: '2px',
                zIndex: 10,
                '& .MuiLinearProgress-bar': {
                  transition: 'none'
                }
              }} 
            />
          )}
          <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 60, md: 80 }, px: { xs: 1.5, md: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/* Back Button for Deep Pages on Mobile */}
              {isXSmall && !['/', '/dashboard', '/users', '/fees', '/reports', '/settings', '/courses', '/expenses', '/attendance', '/notes', '/exams', '/schedule', '/profile', '/notifications'].includes(location.pathname) && (
                <IconButton onClick={() => navigate(-1)} sx={{ color: 'primary.main', mr: 1 }}>
                  <ArrowLeft size={24} />
                </IconButton>
              )}
              
              <AnimatePresence>
                {/* Hide text logo if using Sidebar and it's visible or likely taking up space */}
                {(showBottomNav && !sidebarOpen) && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: (isDesktop || isXSmall) ? 'pointer' : 'default' }}
                    onClick={() => (isDesktop || isXSmall) && setSidebarOpen(true)}
                  >
                    <Box sx={{ 
                      width: { xs: 35, md: 45 }, 
                      height: { xs: 35, md: 45 }, 
                      borderRadius: 1,
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      <img 
                        src={logoUrl} 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        alt="Logo" 
                        referrerPolicy="no-referrer"
                      />
                    </Box>
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                      <Typography variant="subtitle1" sx={{ 
                        fontWeight: 900, 
                        color: 'primary.main',
                        lineHeight: 1
                      }}>
                        {instituteName}
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        fontWeight: 700, 
                        color: 'text.secondary',
                        fontSize: '0.6rem'
                      }}>
                        {tagline}
                      </Typography>
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 } }}>
              {/* Sync Status Label */}
              <AnimatePresence>
                {isSyncing && (
                  <Box 
                    component={motion.div}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.8, 
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      color: 'success.main',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 10,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.success.main, 0.2)
                    }}
                  >
                    <Box 
                      component={motion.div}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      sx={{ width: 8, height: 8, bgcolor: 'success.main', borderRadius: '50%' }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: 1 }}>Syncing</Typography>
                  </Box>
                )}
              </AnimatePresence>
              {/* Global Search - Disabled on search-heavy pages to avoid redundancy */}
              {!['/', '/dashboard', '/users', '/fees', '/expenses', '/reports'].includes(location.pathname) && (
                <Box sx={{ position: 'relative', display: { xs: 'none', sm: 'block' } }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      width: 280,
                      bgcolor: 'background.default',
                      borderRadius: 1,
                      boxShadow: theme.palette.mode === 'dark'
                        ? '1px 1px 3px rgba(0,0,0,0.4), -1px -1px 3px rgba(255,255,255,0.02)'
                        : '1px 1px 3px rgba(0,0,0,0.05)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:focus-within': {
                        width: 340,
                        boxShadow: theme.palette.mode === 'dark'
                          ? '2px 2px 4px rgba(0,0,0,0.6), -2px -2px 4px rgba(255,255,255,0.03)'
                          : '2px 2px 4px rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <IconButton sx={{ p: '10px', color: 'primary.main' }} aria-label="search">
                      <Search size={20} />
                    </IconButton>
                    <InputBase
                      sx={{ ml: 1, flex: 1, fontSize: '0.95rem', fontWeight: 600 }}
                      placeholder="Search anything..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </Paper>
                </Box>
              )}

              <Tooltip title="Notifications">
                <IconButton 
                  onClick={() => navigate('/notifications')} 
                  size="large"
                  sx={{ 
                    bgcolor: 'transparent',
                    color: unreadCount > 0 ? 'primary.main' : 'text.secondary',
                    width: isMobile ? 36 : 48,
                    height: isMobile ? 36 : 48,
                    border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    '&:hover': { 
                      transform: 'translateY(-2px)',
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.04)
                    }
                  }}
                >
                  <Badge 
                    badgeContent={unreadCount} 
                    color="error"
                    sx={{ 
                      '& .MuiBadge-badge': { 
                        animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
                        fontWeight: 900,
                        border: `2px solid ${theme.palette.background.default}`,
                        height: isMobile ? 16 : 20,
                        minWidth: isMobile ? 16 : 20,
                        fontSize: isMobile ? '0.6rem' : '0.75rem'
                      } 
                    }}
                  >
                    <Bell size={isMobile ? 18 : 22} />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Tooltip title={`Switch to ${theme.palette.mode === 'dark' ? 'Light' : 'Dark'} Mode`}>
                <IconButton 
                  onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} 
                  size="large"
                  sx={{ 
                    bgcolor: 'transparent',
                    color: 'text.secondary',
                    width: isMobile ? 36 : 48,
                    height: isMobile ? 36 : 48,
                    border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    '&:hover': { 
                      transform: 'translateY(-2px)',
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.04)
                    }
                  }}
                >
                  {theme.palette.mode === 'dark' ? <Sun size={isMobile ? 18 : 22} /> : <Moon size={isMobile ? 18 : 22} />}
                </IconButton>
              </Tooltip>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
                <Tooltip title="Manage Profile">
                  <IconButton 
                    onClick={() => navigate('/profile')} 
                    size="small" 
                    sx={{ 
                      p: 0.5, 
                      border: '1.5px solid', 
                      borderColor: (location.pathname === '/profile' ? 'primary.main' : alpha(theme.palette.divider, 0.1)),
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' }
                    }}
                  >
                    <Avatar 
                      src={user.photoURL} 
                      imgProps={{ loading: 'lazy' }}
                      sx={{ width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, bgcolor: 'primary.main', fontWeight: 600, fontSize: isMobile ? '0.85rem' : '1rem' }}
                    >
                      {user.displayName.charAt(0)}
                    </Avatar>
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Box 
          component="main"
          ref={mainRef}
          className="gpu-accelerated no-scrollbar"
          sx={{ 
            flexGrow: 1,
            p: { xs: 2, sm: 3, md: 4 },
            pb: { xs: 16, md: 4 }, 
            pt: location.pathname === '/' ? 0 : { xs: 11, sm: 12, md: 14 }, 
            overflowY: 'visible',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
          }}
        >
          <Container maxWidth="xl" sx={{ p: 0 }}>
            {isArchived && location.pathname !== '/profile' ? (
              <Box 
                component={motion.div}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                sx={{ 
                  height: 'calc(100vh - 200px)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.error.main, 0.05),
                  borderRadius: 6,
                  border: '2px dashed',
                  borderColor: 'error.light',
                  p: 4,
                  textAlign: 'center',
                  gap: 3
                }}
              >
                <Box sx={{ p: 3, bgcolor: 'error.main', borderRadius: '50%', color: 'white', mb: 2 }}>
                  <X size={48} />
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 900, color: 'error.main', letterSpacing: -1 }}>
                  ACCOUNT REMOVED
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, maxWidth: 600, opacity: 0.8 }}>
                  Your account has been deactivated or removed by the institute administration. 
                  Access to system features has been restricted.
                </Typography>
                
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button 
                    variant="contained" 
                    color="error" 
                    startIcon={<Download size={20} />}
                    onClick={downloadUserData}
                    sx={{ fontWeight: 900, borderRadius: 3, px: 4, py: 1.5 }}
                  >
                    Download My Data
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="inherit" 
                    onClick={() => navigate('/profile')}
                    sx={{ fontWeight: 900, borderRadius: 3, px: 4, py: 1.5 }}
                  >
                    View My Profile
                  </Button>
                  <Button 
                    variant="text" 
                    color="error" 
                    onClick={onLogout}
                    sx={{ fontWeight: 900, borderRadius: 3, px: 4, py: 1.5 }}
                  >
                    Logout
                  </Button>
                </Stack>
                
                <Typography variant="caption" sx={{ mt: 4, opacity: 0.5, fontWeight: 700 }}>
                  If you think this is a mistake, please contact administration.
                </Typography>
              </Box>
            ) : children}
          </Container>
        </Box>
      </Box>

      {/* Bottom Nav */}
      {showBottomNav && <Box className="no-print"><BottomNav user={user} unreadNotifications={unreadCount} visible={bottomNavVisible} logoUrl={logoUrl} /></Box>}

      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        `}
      </style>
    </Box>
  );
}
