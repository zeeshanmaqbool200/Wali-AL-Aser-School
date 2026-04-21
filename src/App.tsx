import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress, GlobalStyles, IconButton } from '@mui/material';
import { ThemeProviderWrapper } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationListener from './components/NotificationListener';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, X } from 'lucide-react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Fees from './pages/Fees';
import Notes from './pages/Notes';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Schedule from './pages/Schedule';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Exams from './pages/Exams';
import Courses from './pages/Courses';
import PaymentsSummary from './pages/PaymentsSummary';
import AdminLogs from './pages/AdminLogs';
import Profile from './pages/Profile';
import ErrorBoundary from './components/ErrorBoundary';
import ClassSelection from './components/ClassSelection';

const globalStyles = (
  <GlobalStyles
    styles={{
      '.glassmorphism': {
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
      },
      '.neumorphism': {
        background: '#f8fafc',
        boxShadow: '20px 20px 60px #d3d5d6, -20px -20px 60px #ffffff',
      },
      '@keyframes shimmer': {
        '0%': { backgroundPosition: '-1000px 0' },
        '100%': { backgroundPosition: '1000px 0' },
      },
      '.shimmer': {
        animation: 'shimmer 2s infinite linear',
        background: 'linear-gradient(to right, #f6f7f8 0%, #edeef1 20%, #f6f7f8 40%, #f6f7f8 100%)',
        backgroundSize: '1000px 100%',
      },
    }}
  />
);

interface ProtectedRouteProps {
  children: React.ReactNode;
  user: any;
  allowedRoles: string[];
}

function ProtectedRoute({ children, user, allowedRoles }: ProtectedRouteProps) {
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

import NotificationBanner from './components/NotificationBanner';
import PermissionAgent from './components/PermissionAgent';
import SyncNotifier from './components/SyncNotifier';

function AppContent() {
  const { user, loading, error, manualLogin, manualSignUp, logout } = useAuth();
  const location = useLocation();
  const [showClassSelection, setShowClassSelection] = React.useState(false);
  const [hidePendingBanner, setHidePendingBanner] = React.useState(false);
  const [selectionMade, setSelectionMade] = React.useState(false);

  React.useEffect(() => {
    setSelectionMade(false); // Reset when user changes
  }, [user?.uid]);

  React.useEffect(() => {
    // If student has NO active level AND NO pending level AND hasn't just made a selection
    if (user && user.role === 'student' && !user.maktabLevel && !user.pendingMaktabLevel && !selectionMade && !showClassSelection) {
      const timer = setTimeout(() => {
        // Double check condition before showing
        if (!selectionMade && !showClassSelection) {
          setShowClassSelection(true);
        }
      }, 5000); // 5 second "long" delay
      return () => clearTimeout(timer);
    }
  }, [user?.role, user?.maktabLevel, user?.pendingMaktabLevel, selectionMade, showClassSelection]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}
        >
          <CircularProgress size={60} thickness={4} />
        </motion.div>
      </Box>
    );
  }

  const fullAdminRoles = ['superadmin'];
  const staffRoles = ['superadmin', 'approved_mudaris'];
  const allAuthenticatedRoles = ['superadmin', 'approved_mudaris', 'pending_mudaris', 'student'];

  return (
    <Layout user={user} onLogout={logout}>
      <NotificationListener />
      <SyncNotifier />
      <NotificationBanner />
      <PermissionAgent />
      <AnimatePresence>
        {user && user.role === 'student' && !user.maktabLevel && user.pendingMaktabLevel && !hidePendingBanner && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            style={{ 
              position: 'fixed', top: 'env(safe-area-inset-top)', left: 0, right: 0, zIndex: 2000, 
              padding: '8px'
            }}
          >
            <Box sx={{ 
              bgcolor: 'warning.main', color: 'white', p: 1.5, borderRadius: 3,
              textAlign: 'center', fontWeight: 700, fontSize: '0.875rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
              position: 'relative'
            }}>
              <Clock size={16} />
              Your class selection ({user.pendingMaktabLevel}) is pending approval from a teacher.
              <IconButton 
                size="small" 
                onClick={() => setHidePendingBanner(true)}
                sx={{ position: 'absolute', right: 8, color: 'white' }}
              >
                <X size={16} />
              </IconButton>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
      <ClassSelection 
        open={showClassSelection} 
        userId={user?.uid || ''} 
        onComplete={() => {
          setSelectionMade(true);
          setShowClassSelection(false);
        }} 
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ height: '100%' }}
        >
          <Routes location={location}>
            {!user ? (
              <>
                <Route path="/login" element={<Login onLogin={manualLogin} onSignUp={manualSignUp} error={error} />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/attendance" element={
                  <ProtectedRoute user={user} allowedRoles={staffRoles}>
                    <Attendance />
                  </ProtectedRoute>
                } />
                <Route path="/fees" element={
                  <ProtectedRoute user={user} allowedRoles={allAuthenticatedRoles}>
                    <Fees />
                  </ProtectedRoute>
                } />
                <Route path="/notes" element={<Notes />} />
                <Route path="/users" element={
                  <ProtectedRoute user={user} allowedRoles={staffRoles}>
                    <Users />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute user={user} allowedRoles={allAuthenticatedRoles}>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/reports" element={
                  <ProtectedRoute user={user} allowedRoles={fullAdminRoles}>
                    <Reports />
                  </ProtectedRoute>
                } />
                <Route path="/exams" element={<Exams />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/payments-summary" element={
                  <ProtectedRoute user={user} allowedRoles={fullAdminRoles}>
                    <PaymentsSummary />
                  </ProtectedRoute>
                } />
                <Route path="/admin/logs" element={
                  <ProtectedRoute user={user} allowedRoles={fullAdminRoles}>
                    <AdminLogs />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute user={user} allowedRoles={allAuthenticatedRoles}>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProviderWrapper>
          <CssBaseline />
          {globalStyles}
          <NotificationProvider>
            <Router>
              <AppContent />
            </Router>
          </NotificationProvider>
        </ThemeProviderWrapper>
      </AuthProvider>
    </ErrorBoundary>
  );
}
