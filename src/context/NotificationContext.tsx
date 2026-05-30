import React, { createContext, useContext, useState, useCallback } from 'react';
import { Box, Typography, alpha, useTheme, Paper } from '@mui/material';
import { Bell, Info, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

interface NotificationContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const theme = useTheme();

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 5000);
  }, []);

  return (
    <NotificationContext.Provider value={{ showToast }}>
      {children}
      <Box sx={{ 
        position: 'fixed', 
        top: { xs: 16, sm: 24 }, 
        right: { xs: 16, sm: 24 }, 
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        maxWidth: { xs: 'calc(100% - 32px)', sm: 380 },
        pointerEvents: 'none'
      }}>
        <AnimatePresence mode="popLayout">
          {toasts.slice(-3).map((toast, index) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.9, y: -20 }}
              animate={{ 
                opacity: 1, 
                x: 0, 
                scale: 1 - (toasts.slice(-3).length - 1 - index) * 0.05, 
                y: 0 
              }}
              exit={{ opacity: 0, scale: 0.9, x: 20, transition: { duration: 0.2 } }}
              style={{ 
                pointerEvents: 'auto',
                zIndex: index
              }}
            >
              <Paper
                elevation={6}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: '#FFFFFF', // Solid white background
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 6,
                    bgcolor: `${toast.type === 'error' ? 'error' : toast.type}.main`
                  }
                }}
              >
                <Box sx={{ 
                  p: 1, 
                  borderRadius: 2, 
                  bgcolor: alpha(theme.palette[toast.type === 'error' ? 'error' : toast.type].main, 0.1),
                  color: `${toast.type === 'error' ? 'error' : toast.type}.main`,
                  display: 'flex',
                  flexShrink: 0
                }}>
                  {toast.type === 'success' && <CheckCircle size={18} />}
                  {toast.type === 'info' && <Info size={18} />}
                  {toast.type === 'warning' && <AlertTriangle size={18} />}
                  {toast.type === 'error' && <X size={18} />}
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.2, lineHeight: 1.2, color: 'text.primary' }}>
                    {toast.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', lineHeight: 1.3 }}>
                    {toast.message}
                  </Typography>
                </Box>
                <IconButton 
                  size="small" 
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  sx={{ color: 'text.disabled', '&:hover': { color: 'text.primary' } }}
                >
                  <X size={16} />
                </IconButton>
              </Paper>
            </motion.div>
          ))}
        </AnimatePresence>
      </Box>
    </NotificationContext.Provider>
  );
}

import { IconButton } from '@mui/material';

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
