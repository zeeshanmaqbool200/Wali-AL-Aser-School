import React from 'react';
import { 
  Box, List, ListItem, ListItemButton, ListItemIcon, 
  ListItemText, Typography, Divider, Drawer, IconButton, 
  Tooltip, Badge, alpha, useTheme
} from '@mui/material';
import { 
  LayoutDashboard, Users, Calendar, BookOpen, 
  Settings, CreditCard, Bell, LogOut, ChevronLeft, 
  ChevronRight, GraduationCap, ClipboardList, MessageSquare,
  Award, BarChart2, FileText, BarChart3, ClipboardCheck,
  DollarSign, Terminal
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserRole } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  role: UserRole;
  open: boolean;
  onToggle: () => void;
  onLogout: () => void;
  unreadNotifications?: number;
  instituteName?: string;
  logoUrl?: string;
}

export default function Sidebar({ role, open, onToggle, onLogout, unreadNotifications = 0, instituteName = 'MAKTAB WALI UL ASER', logoUrl = 'https://idarahwaliulaser.netlify.app/img/logo.png' }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const menuItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={22} />, path: '/', roles: ['student', 'approved_mudaris', 'pending_mudaris', 'superadmin'] },
    { label: 'Tulab-e-Ilm', icon: <Users size={22} />, path: '/users', roles: ['superadmin', 'approved_mudaris'] },
    { label: role === 'student' ? 'My Payments' : 'Fees & Adaigi', icon: <DollarSign size={22} />, path: '/fees', roles: ['student', 'approved_mudaris', 'superadmin'] },
    { label: 'Haziri (Attendance)', icon: <ClipboardCheck size={22} />, path: '/attendance', roles: ['approved_mudaris', 'superadmin'] },
    { label: 'Reports', icon: <BarChart3 size={22} />, path: '/reports', roles: ['approved_mudaris', 'superadmin'] },
    { label: 'Ittila\'at', icon: <Badge badgeContent={unreadNotifications} color="error"><Bell size={22} /></Badge>, path: '/notifications', roles: ['student', 'approved_mudaris', 'pending_mudaris', 'superadmin'] },
    { label: 'System Logs', icon: <Terminal size={22} />, path: '/admin/logs', roles: ['superadmin'] },
    { label: 'Settings', icon: <Settings size={22} />, path: '/settings', roles: ['student', 'approved_mudaris', 'pending_mudaris', 'superadmin'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));

  return (
    <Drawer
      variant="permanent"
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
          {open && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <Box sx={{ 
                bgcolor: 'transparent', 
                p: 0, 
                display: 'flex',
                overflow: 'hidden',
                width: 48,
                height: 48,
              }}>
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                  referrerPolicy="no-referrer"
                  onError={(e: any) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg></div>';
                  }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, letterSpacing: -1, color: 'text.primary', lineHeight: 1.1, fontSize: '1rem' }}>
                  {instituteName}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.6rem' }}>
                  Institute
                </Typography>
              </Box>
            </motion.div>
          )}
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
