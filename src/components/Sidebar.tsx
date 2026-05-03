import React from 'react';
import { 
  Box, List, ListItem, ListItemButton, ListItemIcon, 
  ListItemText, Typography, Divider, Drawer, IconButton, 
  Tooltip, Badge
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  LayoutDashboard, Users, Calendar, BookOpen, 
  Settings, CreditCard, Bell, LogOut, ChevronLeft, 
  ChevronRight, GraduationCap, ClipboardList, MessageSquare,
  Award, BarChart2, FileText, BarChart3, ClipboardCheck,
  IndianRupee, Terminal, Shield
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  role: UserRole;
  open: boolean;
  onToggle: () => void;
  onLogout: () => void;
  unreadNotifications?: number;
  instituteName?: string;
  logoUrl?: string;
}

export default function Sidebar({ role, open, onToggle, onLogout, unreadNotifications = 0, instituteName = 'WALI UL ASER INSTITUTE', logoUrl = 'https://raw.githubusercontent.com/zeeshanmaqbool/waliulaser/main/public/img/logo.png' }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { permissions } = useAuth();

  const isSuperAdmin = role === 'superadmin';

  const menuItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={22} />, path: '/', roles: ['student', 'teacher', 'superadmin', 'manager'], permission: 'view_dashboard' },
    { label: 'Students', icon: <Users size={22} />, path: '/users', roles: ['superadmin', 'manager'], permission: 'manage_students' },
    { label: 'Courses', icon: <BookOpen size={22} />, path: '/courses', roles: ['student', 'teacher', 'superadmin', 'manager'] },
    { label: role === 'student' ? 'My Payments' : 'Fees & Payments', icon: <IndianRupee size={22} />, path: '/fees', roles: ['student', 'teacher', 'superadmin', 'manager'], permission: 'manage_fees' },
    { label: 'Attendance', icon: <ClipboardCheck size={22} />, path: '/attendance', roles: ['teacher', 'manager', 'superadmin'], permission: 'manage_attendance' },
    { label: 'Expenses', icon: <CreditCard size={22} />, path: '/expenses', roles: ['superadmin', 'manager'], permission: 'manage_expenses' },
    { label: 'Reports', icon: <BarChart3 size={22} />, path: '/reports', roles: ['superadmin'], permission: 'manage_reports' },
    { label: 'Notifications', icon: <Badge badgeContent={unreadNotifications} color="error"><Bell size={22} /></Badge>, path: '/notifications', roles: ['student', 'teacher', 'superadmin', 'manager'] },
    { label: 'System Logs', icon: <Terminal size={22} />, path: '/admin/logs', roles: ['superadmin'] },
    { label: 'Roles', icon: <Shield size={22} />, path: '/roles', roles: ['superadmin'] },
    { label: 'Settings', icon: <Settings size={22} />, path: '/settings', roles: ['student', 'teacher', 'superadmin', 'manager'], permission: 'system_settings' },
  ];

  const filteredMenu = menuItems.filter(item => {
    // Basic role check
    const hasRole = item.roles.includes(role);
    if (!hasRole) return false;

    // Special case for superadmin (always allow if role matches)
    if (isSuperAdmin) return true;

    // Permission check
    if (item.permission) {
      return (permissions as any)[item.permission] === true;
    }

    return true;
  });

  return (
    <Drawer
      variant="permanent"
      className="no-print"
      sx={{
        width: open ? 280 : 88,
        flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? 280 : 88,
            boxSizing: 'border-box',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
            bgcolor: 'background.paper',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            p: 2,
            boxShadow: 'none',
            borderRight: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: open ? 'space-between' : 'center', mb: 4, height: 64, px: open ? 1 : 0 }}>
          <motion.div
            initial={false}
            animate={{ x: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: open ? 'auto' : '100%', justifyContent: open ? 'flex-start' : 'center' }}
          >
            <Box sx={{ 
              bgcolor: 'transparent', 
              p: 0, 
              display: 'flex',
              overflow: 'hidden',
              width: open ? 50 : 40,
              height: open ? 50 : 40,
              transition: 'all 0.3s ease',
              flexShrink: 0
            }}>
              <img 
                src={logoUrl} 
                alt="Logo" 
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }}
                referrerPolicy="no-referrer"
                onError={(e: any) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg></div>';
                }}
              />
            </Box>
            {open && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, letterSpacing: -0.5, color: 'text.primary', lineHeight: 1.1, fontSize: '1rem', fontFamily: 'var(--font-serif)', textTransform: 'uppercase' }}>
                  {instituteName}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.6rem' }}>
                  Institute
                </Typography>
              </Box>
            )}
          </motion.div>
          <IconButton 
            onClick={onToggle} 
            sx={{ 
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) } 
            }}
          >
            {open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </IconButton>
        </Box>

        <List sx={{ px: 0, flexGrow: 1 }}>
          {filteredMenu.map((item) => {
            const active = location.pathname === item.path;
            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5, px: open ? 1.5 : 1 }}>
                <Tooltip title={!open ? item.label : ''} placement="right">
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{
                      minHeight: 48,
                      justifyContent: open ? 'initial' : 'center',
                      px: 2,
                      borderRadius: 1,
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                      color: active ? 'primary.main' : 'text.secondary',
                      border: active ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}` : '1px solid transparent',
                      '&:hover': {
                        bgcolor: active ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.text.primary, 0.03),
                        color: active ? 'primary.main' : 'text.primary',
                        transform: 'translateX(2px)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: open ? 2 : 'auto',
                        justifyContent: 'center',
                        color: active ? 'primary.main' : 'inherit',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {open && (
                      <ListItemText 
                        primary={item.label} 
                        primaryTypographyProps={{ 
                          fontWeight: active ? 800 : 600,
                          fontSize: '0.9rem',
                          letterSpacing: active ? -0.2 : 0,
                        }} 
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ mt: 'auto', p: open ? 1 : 0 }}>
          <Divider sx={{ mb: 2, borderColor: alpha(theme.palette.divider, 0.05) }} />
          <ListItemButton
            onClick={onLogout}
            sx={{
              minHeight: 52,
              justifyContent: open ? 'initial' : 'center',
              px: 2.5,
              borderRadius: 1,
              color: 'error.main',
              '&:hover': { 
                bgcolor: alpha(theme.palette.error.main, 0.08),
                transform: 'translateX(4px)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: open ? 2 : 'auto', justifyContent: 'center', color: 'inherit' }}>
              <LogOut size={20} />
            </ListItemIcon>
            {open && <ListItemText primary="Log Out" primaryTypographyProps={{ fontWeight: 800, fontSize: '0.9rem' }} />}
          </ListItemButton>
        </Box>
    </Drawer>
  );
}
