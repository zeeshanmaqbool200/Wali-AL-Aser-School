import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress, GlobalStyles, IconButton, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ThemeProviderWrapper } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationListener from './components/NotificationListener';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, X, BookOpen } from 'lucide-react';
import Layout from './components/Layout';
import PWAUpdater from './components/PWAUpdater';
import Login from './pages/Login';

// Lazy load pages for performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Fees = lazy(() => import('./pages/Fees'));
const Notes = lazy(() => import('./pages/Notes'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Reports = lazy(() => import('./pages/Reports'));
const Exams = lazy(() => import('./pages/Exams'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseReader = lazy(() => import('./pages/CourseReader'));
const CourseEditor = lazy(() => import('./pages/CourseEditor'));
const PaymentsSummary = lazy(() => import('./pages/PaymentsSummary'));
const AdminLogs = lazy(() => import('./pages/AdminLogs'));
const Profile = lazy(() => import('./pages/Profile'));
const UserProfileView = lazy(() => import('./pages/UserProfileView'));
const FormManager = lazy(() => import('./pages/Forms/FormManager'));
const FormBuilder = lazy(() => import('./pages/Forms/FormBuilder'));
const FormView = lazy(() => import('./pages/Forms/FormView'));
const FormResults = lazy(() => import('./pages/Forms/FormResults'));

import ErrorBoundary from './components/ErrorBoundary';
import ClassSelection from './components/ClassSelection';

const PageLoading = () => (
  <Box sx={{ 
    width: '100%', 
    height: '100%', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    minHeight: '200px'
  }}>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <CircularProgress thickness={5} size={30} sx={{ color: 'primary.main', opacity: 0.5 }} />
    </motion.div>
  </Box>
);

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
        boxShadow: '2px 2px 6px #cbd5e1, -2px -2px 6px #ffffff',
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
import RateLimitOverlay from './components/RateLimitOverlay';

import LoadingScreen from './components/LoadingScreen';

const Verify = React.lazy(() => import('./pages/Verify'));

function AppContent() {
  const { user, loading, error, manualLogin, manualSignUp, logout, instituteSettings } = useAuth();
  const location = useLocation();
  const [showClassSelection, setShowClassSelection] = React.useState(false);
  const [hidePendingBanner, setHidePendingBanner] = React.useState(false);
  const [selectionMade, setSelectionMade] = React.useState(false);
  const [appReady, setAppReady] = React.useState(false);

  React.useEffect(() => {
    if (!loading && instituteSettings) {
      setAppReady(true);
    }
  }, [loading, instituteSettings]);

  React.useEffect(() => {
    setSelectionMade(false); // Reset when user changes
  }, [user?.uid]);

  if (!appReady) {
    return <LoadingScreen />;
  }

  const systemAdminRoles = ['superadmin'];
  const fullAdminRoles = ['superadmin', 'manager'];
  const staffRoles = ['superadmin', 'manager', 'teacher'];
  const allAuthenticatedRoles = ['superadmin', 'manager', 'teacher', 'pending_teacher', 'student'];
  const reportRoles = ['superadmin', 'manager'];
  const brandingSettingsRoles = ['superadmin'];

  const isFormView = location.pathname.startsWith('/forms/view/') || location.pathname.startsWith('/verify/');

  const routes = (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        style={{ height: '100%', width: '100%' }}
      >
        <Suspense fallback={<PageLoading />}>
          <Routes location={location}>
            <Route path="/verify/:type/:id" element={<Verify />} />
            {/* Public Form View - Accessible outside login if form allows */}
            <Route path="/forms/view/:id" element={<FormView />} />
            
            {!user ? (
              <>
                <Route path="/login" element={<Login onLogin={manualLogin} onSignUp={manualSignUp} error={error} />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/courses/new" element={
                  <ProtectedRoute user={user} allowedRoles={staffRoles}>
                    <CourseEditor />
                  </ProtectedRoute>
                } />
                <Route path="/courses/:courseId" element={<CourseReader />} />
                <Route path="/courses/:courseId/section/:sectionId" element={<CourseReader />} />
                <Route path="/courses/:courseId/edit" element={
                  <ProtectedRoute user={user} allowedRoles={staffRoles}>
                    <CourseEditor />
                  </ProtectedRoute>
                } />
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
                <Route path="/users/:uid" element={
                  <ProtectedRoute user={user} allowedRoles={staffRoles}>
                    <UserProfileView />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute user={user} allowedRoles={allAuthenticatedRoles}>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/reports" element={
                  <ProtectedRoute user={user} allowedRoles={reportRoles}>
                    <Reports />
                  </ProtectedRoute>
                } />
                <Route path="/exams" element={<Exams />} />
                <Route path="/forms" element={<FormManager />} />
                <Route path="/forms/build" element={
                  <ProtectedRoute user={user} allowedRoles={staffRoles}>
                    <FormBuilder />
                  </ProtectedRoute>
                } />
                {/* redundant but kept for consistency inside login too */}
                <Route path="/forms/view/:id" element={<FormView />} /> 
                <Route path="/forms/results/:id" element={
                  <ProtectedRoute user={user} allowedRoles={staffRoles}>
                    <FormResults />
                  </ProtectedRoute>
                } />
                <Route path="/expenses" element={
                  <ProtectedRoute user={user} allowedRoles={fullAdminRoles}>
                    <Expenses />
                  </ProtectedRoute>
                } />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/payments-summary" element={
                  <ProtectedRoute user={user} allowedRoles={reportRoles}>
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
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );

  if (isFormView) {
    return (
      <Box sx={{ minHeight: '100vh', width: '100vw' }}>
        {routes}
      </Box>
    );
  }

  return (
    <Layout user={user} onLogout={logout}>
      <NotificationListener />
      <SyncNotifier />
      <RateLimitOverlay />
      <NotificationBanner />
      <PermissionAgent />
      <AnimatePresence>
        {user && user.role === 'student' && !user.classLevel && user.pendingClassLevel && !hidePendingBanner && (
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
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
              position: 'relative'
            }}>
              <Clock size={16} />
              Your class selection ({user.pendingClassLevel}) is pending approval from a teacher.
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
      {routes}
    </Layout>
  );
}

import { ScrollRestoration } from './components/ScrollRestoration';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <ThemeProviderWrapper>
            <CssBaseline />
            {globalStyles}
            <NotificationProvider>
              <Router>
                <PWAUpdater />
                <ScrollRestoration />
                <AppContent />
              </Router>
            </NotificationProvider>
          </ThemeProviderWrapper>
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
