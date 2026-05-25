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
  const showSidebar = isDesktop; // Sidebar only for desktop now based on request
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
    const timer = setTimeout(() => setNavLoading(false), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileAnchorEl(null);
  };

  const mainNavPaths = ['/', '/dashboard', '/users', '/fees', '/reports', '/settings', '/courses', '/expenses', '/attendance', '/notes', '/exams', '/schedule', '/profile', '/notifications'];
  const isInternalPage = !mainNavPaths.includes(location.pathname);
  const isImmersiveCoursePage = location.pathname.startsWith('/courses/') && !['/courses', '/courses/new'].includes(location.pathname);
  const hideNavigation = isImmersiveCoursePage;

  useEffect(() => {
    setBottomNavVisible(!isInternalPage && !hideNavigation);
  }, [location.pathname, isInternalPage, hideNavigation]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'institute'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.instituteName !== undefined) {
          setInstituteName(data.instituteName || '');
          document.title = data.instituteName || 'Idarah Wali Ul Aser';
        }
        if (data.tagline !== undefined) {
          setTagline(data.tagline || '');
        }
        if (data.logoUrl !== undefined) {
          const finalLogo = data.logoUrl || '';
          setLogoUrl(finalLogo);
          if (finalLogo) {
            const link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
            if (link) { link.href = finalLogo; }
            else {
              const newLink = document.createElement('link');
              newLink.rel = 'icon';
              newLink.href = finalLogo;
              document.head.appendChild(newLink);
            }
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || allNotifs.length === 0) return;
    const unread = allNotifs.filter(n => !n.readBy?.includes(user.uid)).length;
    setUnreadCount(unread);
  }, [user, allNotifs]);

  if (!user) return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>{children}</Box>;

  if (location.pathname.startsWith('/verify')) {
    return (
      <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', position: 'relative' }}>
      
      {isDesktop && !hideNavigation && (
        <Drawer
          variant="permanent"
          open={true}
          sx={{
            width: sidebarCollapsed ? 88 : 280,
            flexShrink: 0,
            '& .MuiDrawer-paper': { 
              width: sidebarCollapsed ? 88 : 280, 
              boxSizing: 'border-box',
              border: 'none',
              borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              transition: theme.transitions.create(['width'], {
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
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
            onLogout={onLogout}
            unreadNotifications={unreadCount}
            instituteName={instituteName}
            logoUrl={logoUrl}
            tagline={tagline}
          />
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!hideNavigation && (
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
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px', zIndex: 10,
                  '& .MuiLinearProgress-bar': { transition: 'none' }
                }} 
              />
            )}
            <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 60, md: 80 }, px: { xs: 1.5, md: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isMobile && !['/', '/dashboard', '/users', '/fees', '/reports', '/settings', '/courses', '/expenses', '/attendance', '/notes', '/exams', '/schedule', '/profile', '/notifications'].includes(location.pathname) && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton onClick={() => navigate(-1)} sx={{ color: 'primary.main' }}>
                      <ArrowLeft size={24} />
                    </IconButton>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, display: { xs: 'none', sm: 'block' } }}>Back</Typography>
                  </Stack>
                )}
                
                <AnimatePresence>
                  {(showBottomNav && !sidebarOpen) && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: (isDesktop || isXSmall) ? 'pointer' : 'default' }}
                      onClick={() => (isDesktop || isXSmall) && setSidebarOpen(true)}
                    >
                      <Box sx={{ width: { xs: 35, md: 45 }, height: { xs: 35, md: 45 }, borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
                        <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" referrerPolicy="no-referrer" />
                      </Box>
                      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 900, color: 'primary.main', lineHeight: 1 }}>{instituteName}</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.6rem' }}>{tagline}</Typography>
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 } }}>
                <Tooltip title="Notifications">
                  <IconButton onClick={() => navigate('/notifications')} size="large" sx={{ 
                      bgcolor: 'transparent', color: unreadCount > 0 ? 'primary.main' : 'text.secondary',
                      width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                      '&:hover': { transform: 'translateY(-2px)', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) }
                    }}>
                    <Badge badgeContent={unreadCount} color="error" sx={{ '& .MuiBadge-badge': { fontWeight: 900, border: `2px solid ${theme.palette.background.default}`, height: isMobile ? 16 : 20, minWidth: isMobile ? 16 : 20, fontSize: isMobile ? '0.6rem' : '0.75rem' } }}>
                      <Bell size={isMobile ? 18 : 22} />
                    </Badge>
                  </IconButton>
                </Tooltip>

                <Tooltip title={`Switch Theme`}>
                  <IconButton onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} size="large" sx={{ 
                      bgcolor: 'transparent', color: 'text.secondary', width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                      '&:hover': { transform: 'translateY(-2px)', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) }
                    }}>
                    {mode === 'dark' ? <Sun size={isMobile ? 18 : 22} /> : <Moon size={isMobile ? 18 : 22} />}
                  </IconButton>
                </Tooltip>

                <IconButton onClick={() => navigate('/profile')} size="small" sx={{ p: 0.5, border: '1.5px solid', borderColor: (location.pathname === '/profile' ? 'primary.main' : alpha(theme.palette.divider, 0.1)), transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' } }}>
                  <Avatar src={user.photoURL} sx={{ width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, bgcolor: 'primary.main', fontWeight: 600 }}>{user.displayName.charAt(0)}</Avatar>
                </IconButton>
              </Box>
            </Toolbar>
          </AppBar>
        )}

        <Box component="main" ref={mainRef} sx={{ 
          flexGrow: 1, 
          p: hideNavigation ? 0 : { xs: 2, sm: 3, md: 4 }, 
          pb: hideNavigation ? 0 : { xs: 16, md: 4 }, 
          pt: hideNavigation ? 0 : (location.pathname === '/' ? 0 : { xs: 11, sm: 12, md: 14 }), 
          position: 'relative' 
        }}>
          <Container maxWidth={hideNavigation ? false : "xl"} sx={{ p: 0 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              >
                {isArchived && location.pathname !== '/profile' ? (
                  <Box 
                    sx={{ 
                      height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      bgcolor: alpha(theme.palette.error.main, 0.05), borderRadius: 6, border: '2px dashed', borderColor: 'error.light', p: 4, textAlign: 'center', gap: 3
                    }}
                  >
                    <Box sx={{ p: 3, bgcolor: 'error.main', borderRadius: '50%', color: 'white', mb: 2 }}><X size={48} /></Box>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: 'error.main', letterSpacing: -1 }}>ACCOUNT REMOVED</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, maxWidth: 600, opacity: 0.8 }}>Your account has been deactivated or removed by the institute administration.</Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                      <Button variant="contained" color="error" startIcon={<Download size={20} />} onClick={downloadUserData} sx={{ fontWeight: 900, borderRadius: 3, px: 4, py: 1.5 }}>Download My Data</Button>
                      <Button variant="outlined" color="inherit" onClick={() => navigate('/profile')} sx={{ fontWeight: 900, borderRadius: 3, px: 4, py: 1.5 }}>View My Profile</Button>
                      <Button variant="text" color="error" onClick={onLogout} sx={{ fontWeight: 900, borderRadius: 3, px: 4, py: 1.5 }}>Logout</Button>
                    </Stack>
                  </Box>
                ) : children}
              </motion.div>
            </AnimatePresence>
          </Container>
        </Box>
      </Box>

      {showBottomNav && !isInternalPage && <Box className="no-print"><BottomNav user={user} unreadNotifications={unreadCount} visible={bottomNavVisible} logoUrl={logoUrl} /></Box>}
    </Box>
  );
}
