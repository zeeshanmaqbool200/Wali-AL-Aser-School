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
  ChevronRight, X, Shield, Sun, Moon, School, Download
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, Notification as NotificationType } from '../types';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
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
  const { mode, setMode } = useThemeContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [instituteName, setInstituteName] = useState('Wali Ul Aser Institute');
  const [logoUrl, setLogoUrl] = useState('https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png');
  const [bottomNavVisible, setBottomNavVisible] = useState(false);
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);
  const [navLoading, setNavLoading] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

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
      exportToCSV(myData, `WaliUlAser_Member_Export_${user.uid}`);
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
          setInstituteName(data.instituteName || 'Wali Ul Aser Institute');
          document.title = data.instituteName || 'Wali Ul Aser Institute';
        }
        if (data.logoUrl !== undefined) {
          const finalLogo = data.logoUrl || 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png';
          setLogoUrl(finalLogo);
          // Dynamically update favicon
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
    }, (error) => {
      // Don't use handleFirestoreError for this passive background task
      // as it would throw and potentially crash the SDK loop or React render
      // console.warn('Institute settings listener failed:', error.message);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    let q;
    const isSuperAdmin = user.email === 'zeeshanmaqbool200@gmail.com';
    const isManagerRole = user.role === 'manager';
    const isTeacherRole = user.role === 'teacher';
    
    if (isSuperAdmin || isManagerRole || isTeacherRole) {
      q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    } else {
      q = query(
        collection(db, 'notifications'),
        or(
          where('targetType', '==', 'all'),
          where('targetId', '==', user.uid),
          where('targetId', '==', user.classLevel || 'none'),
          where('targetId', '==', user.classLevel || 'none')
        ),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationType[];
      const unread = notifs.filter(n => !n.readBy.includes(user.uid)).length;
      setUnreadCount(unread);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
    return () => unsubscribe();
  }, [user]);

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
      {/* Sidebar for Desktop */}
      {!isMobile && (
        <Sidebar 
          role={user.role} 
          open={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)} 
          onLogout={onLogout}
          unreadNotifications={unreadCount}
          instituteName={instituteName}
          logoUrl={logoUrl}
        />
      )}

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top App Bar */}
        <AppBar 
          position="sticky" 
          color="inherit" 
          elevation={0} 
          className="no-print"
          sx={{ 
            zIndex: theme.zIndex.drawer + 1,
            bgcolor: alpha(theme.palette.background.default, 0.9),
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
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
          <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 60, md: 80 }, px: { xs: 2, md: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => navigate('/')}
              >
                <Box sx={{ 
                  width: { xs: 32, md: 45 }, 
                  height: { xs: 32, md: 45 }, 
                  overflow: 'hidden', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  bgcolor: 'transparent',
                  borderRadius: 0,
                  p: 0,
                  boxShadow: 'none',
                  border: 'none'
                }}>
                  {logoUrl ? (
                    <Box 
                      component="img" 
                      src={logoUrl} 
                      alt="Institute Logo" 
                      loading="lazy"
                      sx={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        bgcolor: 'transparent'
                      }} 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <School size={isMobile ? 24 : 32} color={theme.palette.primary.main} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h5" sx={{ 
                    fontWeight: 900, 
                    color: 'primary.main', 
                    letterSpacing: -0.5, 
                    fontFamily: 'var(--font-serif)', 
                    fontSize: { xs: '1rem', md: '1.4rem' },
                    lineHeight: 1
                  }}>
                    {instituteName}
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    fontWeight: 700, 
                    color: 'text.secondary', 
                    fontSize: '0.65rem', 
                    letterSpacing: 0.5,
                    display: { xs: 'none', md: 'block' }
                  }}>
                    Religious & Academic Excellence
                  </Typography>
                </Box>
              </motion.div>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 } }}>
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
                        ? '1px 1px 3px #060a12, -1px -1px 3px #182442'
                        : '1px 1px 3px rgba(0,0,0,0.05)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:focus-within': {
                        width: 340,
                        boxShadow: theme.palette.mode === 'dark'
                          ? '2px 2px 4px #060a12, -2px -2px 4px #182442'
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
                <IconButton 
                  onClick={handleProfileMenuOpen} 
                  size="small" 
                  sx={{ 
                    p: 0.5, 
                    border: '1.5px solid', 
                    borderColor: profileAnchorEl ? 'primary.main' : (location.pathname === '/profile' ? 'primary.main' : alpha(theme.palette.divider, 0.1)),
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
                <Menu
                  anchorEl={profileAnchorEl}
                  open={Boolean(profileAnchorEl)}
                  onClose={handleProfileMenuClose}
                  onClick={handleProfileMenuClose}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                  PaperProps={{
                    sx: {
                      mt: 1.5,
                      borderRadius: 1,
                      minWidth: 200,
                      boxShadow: theme.palette.mode === 'dark'
                        ? '4px 4px 10px #060a12, -4px -4px 10px #182442'
                        : '4px 4px 10px rgba(0,0,0,0.1)',
                      border: '1px solid',
                      borderColor: 'divider',
                      '& .MuiMenuItem-root': {
                        py: 1.5,
                        px: 2,
                        borderRadius: 1,
                        mx: 1,
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                      }
                    }
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{user.displayName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{user.email}</Typography>
                  </Box>
                  <Divider sx={{ my: 1, opacity: 0.5 }} />
                  <MenuItem onClick={() => navigate('/profile')}>
                    <ListItemIcon><User size={18} /></ListItemIcon>
                    Manage Profile
                  </MenuItem>
                  <MenuItem onClick={() => navigate('/settings?tab=security')}>
                    <ListItemIcon><Shield size={18} /></ListItemIcon>
                    Security & Privacy
                  </MenuItem>
                  <Divider sx={{ my: 1, opacity: 0.5 }} />
                  <MenuItem onClick={onLogout} sx={{ color: 'error.main' }}>
                    <ListItemIcon><LogOut size={18} color={theme.palette.error.main} /></ListItemIcon>
                    Logout Account
                  </MenuItem>
                </Menu>
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
            pt: { xs: 9, sm: 10, md: 4 }, // Added top padding for fixed AppBar
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

      {/* Bottom Nav for Mobile - Fixed position, so can be outside flex */}
      {isMobile && <Box className="no-print"><BottomNav user={user} unreadNotifications={unreadCount} visible={bottomNavVisible} logoUrl={logoUrl} /></Box>}

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
