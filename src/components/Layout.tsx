import React, { useState, useEffect } from 'react';
import { 
  Box, Container, AppBar, Toolbar, Typography, IconButton, 
  Avatar, useMediaQuery, useTheme, Badge, 
  Tooltip, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider,
  InputBase, alpha, Paper, Menu, MenuItem
} from '@mui/material';
import { 
  LogOut, User, Bell, Menu as MenuIcon, Search,
  LayoutDashboard, Users, Calendar, BookOpen, CreditCard, ClipboardList, FileText,
  ChevronRight, X, Shield
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, Notification as NotificationType } from '../types';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import { collection, query, onSnapshot, orderBy, limit, updateDoc, doc, arrayUnion, getDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { InstituteSettings } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile | null;
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [instituteName, setInstituteName] = useState('Maktab Wali Ul Aser');
  const [logoUrl, setLogoUrl] = useState('https://idarahwaliulaser.netlify.app/img/logo.png');
  const [bottomNavVisible, setBottomNavVisible] = useState(true);
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);
  const mainRef = React.useRef<HTMLDivElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileAnchorEl(null);
  };

  useEffect(() => {
    // Nav should always be visible on mobile to avoid confusion
    setBottomNavVisible(true);
  }, []);

  useEffect(() => {
    // Real-time listener for institute settings
    const unsubscribe = onSnapshot(doc(db, 'settings', 'institute'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.maktabName !== undefined) {
          setInstituteName(data.maktabName || 'Maktab Wali Ul Aser');
          document.title = data.maktabName || 'Maktab Wali Ul Aser';
        }
        if (data.logoUrl !== undefined) {
          const finalLogo = data.logoUrl || 'https://idarahwaliulaser.netlify.app/img/logo.png';
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
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
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
          sx={{ 
            zIndex: theme.zIndex.drawer + 1,
            bgcolor: alpha(theme.palette.background.default, 0.7),
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 72, md: 88 }, px: { xs: 2, md: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {isMobile && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: -1.5 }}>
                    {instituteName}
                  </Typography>
                </motion.div>
              )}
              {!isMobile && (
                <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: -1.5 }}>
                  {location.pathname === '/' ? 'Dashboard' : 
                   location.pathname === '/attendance' ? 'Haziri' :
                   location.pathname === '/fees' ? 'Fees & Adaigi' :
                   location.pathname === '/users' ? 'Tulab-e-Ilm' :
                   location.pathname === '/reports' ? 'Reports' :
                   location.pathname === '/admin/logs' ? 'System Logs' :
                   location.pathname.substring(1).split('/')[0].charAt(0).toUpperCase() + location.pathname.substring(1).split('/')[0].slice(1)}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 } }}>
              {/* Global Search */}
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
                      ? 'inset 4px 4px 8px #060a12, inset -4px -4px 8px #182442'
                      : 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:focus-within': {
                      width: 340,
                      boxShadow: theme.palette.mode === 'dark'
                        ? 'inset 6px 6px 12px #060a12, inset -6px -6px 12px #182442'
                        : 'inset 6px 6px 12px #d1d9e6, inset -6px -6px 12px #ffffff',
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

              <Tooltip title="Notifications">
                <IconButton 
                  onClick={() => navigate('/notifications')} 
                  size="large"
                  sx={{ 
                    bgcolor: 'background.default',
                    color: unreadCount > 0 ? 'primary.main' : 'text.secondary',
                    boxShadow: theme.palette.mode === 'dark'
                      ? '4px 4px 8px #060a12, -4px -4px 8px #182442'
                      : '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                    '&:hover': { 
                      transform: 'scale(1.1)',
                      color: 'primary.main' 
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
                        border: `2px solid ${theme.palette.background.default}`
                      } 
                    }}
                  >
                    <Bell size={22} />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
                <IconButton 
                  onClick={handleProfileMenuOpen} 
                  size="small" 
                  sx={{ 
                    p: 0.5, 
                    border: '2px solid', 
                    borderColor: profileAnchorEl ? 'primary.main' : (location.pathname === '/profile' ? 'primary.main' : 'divider'),
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'primary.main' }
                  }}
                >
                  <Avatar 
                    src={user.photoURL} 
                    sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontWeight: 600, fontSize: '1rem' }}
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
                        ? '10px 10px 20px #060a12, -10px -10px 20px #182442'
                        : '10px 10px 20px #d1d9e6, -10px -10px 20px #ffffff',
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
            pb: { xs: 12, md: 4 }, // Optimized padding for mobile
            overflowY: 'visible', // Changed from auto to let window scroll
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
          }}
        >
          <Container maxWidth="xl" sx={{ p: 0 }}>
            {children}
          </Container>
        </Box>
      </Box>

      {/* Bottom Nav for Mobile - Fixed position, so can be outside flex */}
      {isMobile && <BottomNav user={user} unreadNotifications={unreadCount} visible={bottomNavVisible} />}

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
