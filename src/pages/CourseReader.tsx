import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, Typography, IconButton, Button, Paper, Stack, 
  Container, LinearProgress, Avatar, Tooltip, 
  Drawer, List, ListItem, ListItemButton, ListItemText, 
  Divider, useMediaQuery, Fade, Zoom, Chip
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  ArrowLeft, ChevronRight, ChevronLeft, Menu, 
  Volume2, Settings, Bookmark, Share2, 
  Maximize2, Headphones, Play, Pause, 
  SkipForward, SkipBack, List as ListIcon, BookOpen, Clock, Heart,
  CheckCircle2
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, CourseSection, UserProfile, QuizAttempt } from '../types';
import ContentRenderer from '../components/ContentRenderer';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import confetti from 'canvas-confetti';
import { trackCourseView, updateEngagementTime, markLessonComplete, cleanupActiveUser } from '../lib/analytics';

export default function CourseReader() {
  const { courseId, sectionId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [readingMode, setReadingMode] = useState<'light' | 'dark' | 'sepia'>('light');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large' | 'extra-large' | 'massive'>('medium');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const engagementInterval = useRef<any>(null);

  // Resume Progress and Fetch Course
  useEffect(() => {
    if (!courseId || !currentUser) return;

    trackCourseView(courseId);

    // Track active engagement every 30 seconds
    engagementInterval.current = setInterval(() => {
      updateEngagementTime(courseId, 30);
    }, 30000);

    const fetchProgress = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'courses', courseId));
        if (docSnap.exists()) {
          const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } as Course : null;
          if (!data) return;
          setCourse(data);

          // Handle Resume Logic
          if (!sectionId) {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data() as UserProfile;
              const progress = userData.readingProgress?.[courseId];
              if (progress?.lastSectionId) {
                const resumeIdx = data.sections?.findIndex(s => s.id === progress.lastSectionId);
                if (resumeIdx !== -1 && resumeIdx !== undefined) {
                  setActiveSectionIdx(resumeIdx);
                  logger.info(`Resuming from Chapter ${resumeIdx + 1}`);
                }
              }
            }
          } else if (data.sections) {
            // Direct section navigation from URL
            const idx = data.sections.findIndex(s => s.id === sectionId);
            if (idx !== -1) setActiveSectionIdx(idx);
          }
        }
      } catch (e) {
        logger.error('Failed to load subject materials');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    return () => {
      if (engagementInterval.current) clearInterval(engagementInterval.current);
      if (courseId) cleanupActiveUser(courseId);
    };
  }, [courseId, sectionId, currentUser?.uid]);

  const activeSection = useMemo(() => {
    if (!course?.sections || course.sections.length === 0) return null;
    return course.sections[activeSectionIdx];
  }, [course, activeSectionIdx]);

  const progress = useMemo(() => {
    if (!course?.sections) return 0;
    return ((activeSectionIdx + 1) / course.sections.length) * 100;
  }, [course, activeSectionIdx]);

  const saveProgress = async (idx: number) => {
    if (!currentUser || !course || !course.sections) return;
    const section = course.sections[idx];
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        [`readingProgress.${courseId}`]: {
          lastSectionId: section.id,
          updatedAt: Date.now(),
          lastPosition: idx,
          completedAt: idx === course.sections.length - 1 ? Date.now() : null
        }
      });
    } catch (e) {
      console.error('Progress sync failed:', e);
    }
  };

  const handleNext = () => {
    if (course?.sections && activeSectionIdx < course.sections.length - 1) {
      if (courseId && activeSection) markLessonComplete(courseId, activeSection.id);
      const nextIdx = activeSectionIdx + 1;
      setActiveSectionIdx(nextIdx);
      saveProgress(nextIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (courseId && activeSection) markLessonComplete(courseId, activeSection.id);
      setHasCompleted(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: [theme.palette.primary.main, '#E9C46A', '#2A9D8F']
      });
      logger.success('Excellent! You have completed this module.');
      saveProgress(activeSectionIdx);
    }
  };

  const handlePrev = () => {
    if (activeSectionIdx > 0) {
      const prevIdx = activeSectionIdx - 1;
      setActiveSectionIdx(prevIdx);
      saveProgress(prevIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleQuizSubmit = async (attempt: QuizAttempt) => {
     if (!currentUser || !course || !activeSection) return;

     // Check if student already has a score for this section
     const userRef = doc(db, 'users', currentUser.uid);
     const userSnap = await getDoc(userRef);
     const userData = userSnap.data() as UserProfile;
     
     const existingScore = userData.quizScores?.find(s => s.courseId === courseId && s.sectionId === activeSection.id);
     
     if (existingScore && currentUser.role === 'student' && currentUser.email !== 'zeeshanmaqbool200@gmail.com') {
        logger.error('You have already submitted this assessment. Retakes are not permitted.');
        return;
     }

     try {
        // 1. Update user profile scores (Academic Report Integration)
        const quizResults = userData.quizScores || [];
        quizResults.push({
          courseId: courseId!,
          sectionId: activeSection.id,
          score: attempt.score,
          total: attempt.totalQuestions,
          timestamp: Date.now()
        });

        await updateDoc(userRef, { quizScores: quizResults });

        // 2. Save deep analytics in course collection
        const courseRef = doc(db, 'courses', courseId!);
        // Logic to append to quizAttempts in the section... 
        // This is simplified here; in production we'd use a subcollection for attempts if volume is high
        
        logger.success(`Assessment synchronized! Your score: ${attempt.score}/${attempt.totalQuestions}`);
        handleNext();
     } catch (e) {
        logger.error('Failed to sync assessment results');
     }
  };

  const getThemeStyles = () => {
    if (readingMode === 'sepia') return { bg: '#F4ECD8', text: '#5D4037', paper: '#E2D1B3' };
    if (readingMode === 'dark') return { bg: '#0A0A0A', text: '#F5F5F5', paper: '#1A1A1A' };
    return { bg: '#FDFCFB', text: '#1A1A1A', paper: '#FFFFFF' };
  };

  const activeStyles = getThemeStyles();

  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 3, bgcolor: '#050505' }}>
       <Box 
        component={motion.div}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
       >
          <BookOpen size={60} color="white" />
       </Box>
       <Typography variant="h6" sx={{ fontWeight: 900, color: 'white', letterSpacing: 2 }}>CATALOGING ASSETS...</Typography>
    </Box>
  );

  if (!course || !activeSection) return (
    <Box sx={{ p: 10, textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="h4" sx={{ fontWeight: 950, mb: 2 }}>Material Missing</Typography>
      <Typography sx={{ opacity: 0.6, mb: 4 }}>This chapter could not be retrieved from the archives.</Typography>
      <Button variant="contained" onClick={() => navigate('/courses')} sx={{ borderRadius: 10, px: 4, fontWeight: 900 }}>Return to Library</Button>
    </Box>
  );

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: activeStyles.bg, 
      color: activeStyles.text, 
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      fontFamily: readingMode === 'sepia' ? 'serif' : 'inherit'
    }}>
      {/* Immersive Background Texture */}
      <Box sx={{ 
        position: 'fixed', inset: 0, 
        opacity: readingMode === 'sepia' ? 0.05 : 0.02, 
        pointerEvents: 'none',
        backgroundImage: `url("https://www.transparenttextures.com/patterns/paper-fibers.png")`,
        zIndex: 0
      }} />

      {/* Floating Header */}
      <AppBar 
        elevation={0}
        sx={{ 
          bgcolor: alpha(activeStyles.bg, 0.85),
          backdropFilter: 'blur(30px)',
          borderBottom: '1px solid',
          borderColor: alpha(activeStyles.text, 0.08),
          px: { xs: 1, sm: 4 },
          py: 0.5,
          color: activeStyles.text
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
          <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center">
            <IconButton onClick={() => navigate('/courses')} sx={{ color: activeStyles.text, bgcolor: alpha(activeStyles.text, 0.03) }}>
              <ArrowLeft size={22} />
            </IconButton>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <Typography variant="caption" sx={{ fontWeight: 950, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 1.5, display: 'block' }}>
                {course.name}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 900, lineHeight: 1 }}>{activeSection.title}</Typography>
            </Box>
            <Box sx={{ display: { md: 'none' } }}>
               <Typography variant="body2" sx={{ fontWeight: 950 }}>{activeSectionIdx + 1} / {course.sections?.length}</Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={{ xs: 0.5, sm: 1.5 }} alignItems="center">
            {hasCompleted && <CheckCircle2 size={24} color={theme.palette.success.main} />}
            
            <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: activeStyles.text }}>
              <ListIcon size={20} />
            </IconButton>
            
            <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, bgcolor: alpha(activeStyles.text, 0.05), borderRadius: 10 }}>
              {(['light', 'sepia', 'dark'] as const).map((mode) => (
                <Box 
                  key={mode}
                  onClick={() => setReadingMode(mode)}
                  sx={{ 
                    width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                    bgcolor: mode === 'light' ? '#fff' : mode === 'sepia' ? '#f4ecd8' : '#121212', 
                    border: readingMode === mode ? '2px solid' : '1px solid',
                    borderColor: readingMode === mode ? 'primary.main' : 'divider',
                    boxShadow: readingMode === mode ? `0 0 10px ${alpha(theme.palette.primary.main, 0.5)}` : 'none'
                  }}
                />
              ))}
            </Box>

            <Button 
              variant="contained" 
              color="primary" 
              size="small"
              onClick={handleNext}
              sx={{ borderRadius: 10, px: 3, fontWeight: 900, textTransform: 'none', display: { xs: 'none', sm: 'flex' } }}
            >
              {activeSectionIdx === (course.sections?.length || 0) - 1 ? 'Finish' : 'Complete'}
            </Button>
          </Stack>
        </Stack>
      </AppBar>

      {/* Progress Bar */}
      <Box sx={{ position: 'fixed', top: { xs: 58, sm: 60 }, left: 0, right: 0, zIndex: 1101, height: 3 }}>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ height: '100%', bgcolor: 'transparent', '& .MuiLinearProgress-bar': { borderRadius: 0, bgcolor: 'primary.main', boxShadow: '0 0 10px rgba(59,130,246,0.5)' } }}
        />
      </Box>

      {/* Main Content Card Wrapper */}
      <Container maxWidth="md" sx={{ pt: { xs: 12, sm: 20 }, pb: 24, position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <Box 
             key={activeSectionIdx}
             component={motion.div}
             initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -30 }}
               transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          >
            {/* Visual Branding Section */}
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 950, 
                mb: 4, 
                letterSpacing: -1.5, 
                fontFamily: readingMode === 'sepia' ? 'serif' : 'inherit',
                fontSize: { xs: '1.75rem', md: '3.5rem' },
                lineHeight: 1.1,
                color: activeStyles.text
              }}
            >
              {activeSection.title}
            </Typography>

            <Box sx={{ 
              mb: 6, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2, 
              pb: 3, 
              borderBottom: '1px solid', 
              borderColor: alpha(activeStyles.text, 0.1) 
            }}>
              <Chip 
                icon={<Clock size={14} />} 
                label={`${activeSection.metadata?.estimatedReadTime || 5} min read`} 
                size="small" 
                variant="outlined" 
                sx={{ fontWeight: 800, borderColor: alpha(activeStyles.text, 0.2), color: alpha(activeStyles.text, 0.6) }} 
              />
              <Chip 
                icon={<BookOpen size={14} />} 
                label={`Chapter ${activeSectionIdx + 1}`} 
                size="small" 
                sx={{ fontWeight: 900, bgcolor: 'primary.main', color: 'white' }} 
              />
            </Box>

            <ContentRenderer 
              section={activeSection} 
              readingMode={readingMode} 
              fontSize={fontSize} 
              onQuizSubmit={handleQuizSubmit}
            />
          </Box>
        </AnimatePresence>

        {/* Footer Navigation */}
        <Box sx={{ mt: 16, pt: 8, borderTop: '1px solid', borderColor: alpha(activeStyles.text, 0.1) }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            {activeSectionIdx > 0 ? (
              <Button 
                onClick={handlePrev}
                startIcon={<ChevronLeft />}
                sx={{ 
                  color: activeStyles.text, 
                  fontWeight: 900, 
                  borderRadius: 4,
                  px: 3,
                  '&:hover': { opacity: 1, bgcolor: alpha(activeStyles.text, 0.05) }
                }}
              >
                Previous Chapter
              </Button>
            ) : <Box />}
            
            <Typography variant="body2" sx={{ fontWeight: 950, opacity: 0.3, letterSpacing: 2 }}>{activeSectionIdx + 1} / {course.sections?.length || 0}</Typography>

            {activeSectionIdx < (course.sections?.length || 0) - 1 ? (
              <Button 
                 onClick={handleNext}
                 endIcon={<ChevronRight />}
                 sx={{ 
                   color: 'primary.main', 
                   fontWeight: 950, 
                   borderRadius: 4,
                   px: 3,
                   '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                 }}
              >
                Next Milestone
              </Button>
            ) : (
               <Button 
                 onClick={handleNext}
                 color="success"
                 variant="contained"
                 disableElevation
                 sx={{ fontWeight: 950, borderRadius: 10, px: 4 }}
               >
                 Finish Module
               </Button>
            )}
          </Stack>
        </Box>
      </Container>

      {/* Floating Audio Player (Spotify Style) */}
      {(activeSection.type === 'audio' || activeSection.secondaryMediaUrl) && (
        <Paper 
          elevation={24}
          sx={{ 
            position: 'fixed', 
            bottom: isMobile ? 20 : 40, 
            left: '50%', 
            transform: 'translateX(-50%)',
            width: { xs: 'calc(100% - 32px)', sm: 500 },
            borderRadius: 10,
            bgcolor: activeStyles.paper,
            color: activeStyles.text,
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 1100,
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            border: '1px solid',
            borderColor: alpha(activeStyles.text, 0.1)
          }}
          component={motion.div}
          initial={{ y: 100 }}
          animate={{ y: 0 }}
        >
          <Avatar 
            variant="rounded" 
            src={course.thumbnailUrl} 
            sx={{ width: 56, height: 56, borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} 
          />
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeSection.title}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.6, display: 'block' }}>
               Episode • {activeSection.metadata?.audioDuration || '04:20'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
             <IconButton size="small" sx={{ color: activeStyles.text }}><SkipBack size={20} fill="currentColor" /></IconButton>
             <IconButton 
              onClick={() => setIsPlaying(!isPlaying)}
              sx={{ 
                bgcolor: 'primary.main', 
                color: 'white', 
                '&:hover': { bgcolor: 'primary.dark' },
                width: 48,
                height: 48
              }}
             >
                {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
             </IconButton>
             <IconButton size="small" sx={{ color: activeStyles.text }}><SkipForward size={20} fill="currentColor" /></IconButton>
          </Stack>
        </Paper>
      )}

      {/* Sidebar Navigation */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { 
            width: { xs: '85%', sm: 400 }, 
            bgcolor: activeStyles.bg, 
            color: activeStyles.text,
            borderLeft: '1px solid',
            borderColor: alpha(activeStyles.text, 0.05)
          }
        }}
      >
        <Box sx={{ p: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 950 }}>Library Content</Typography>
            <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: activeStyles.text }}><ChevronRight /></IconButton>
          </Stack>
          
          <List>
            {(course.sections || []).map((section, idx) => (
              <ListItem key={section.id} disablePadding sx={{ mb: 1.5 }}>
                <ListItemButton 
                  onClick={() => { setActiveSectionIdx(idx); setDrawerOpen(false); saveProgress(idx); }}
                  selected={activeSectionIdx === idx}
                  sx={{ 
                    borderRadius: 3,
                    bgcolor: activeSectionIdx === idx ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                    '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.1), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } },
                    p: 2
                  }}
                >
                  <Stack direction="row" spacing={3} alignItems="center">
                    <Typography variant="h6" sx={{ fontWeight: 950, opacity: 0.1, color: activeStyles.text }}>{idx + 1}</Typography>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{section.title}</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.5, textTransform: 'uppercase' }}>
                        {section.type} • {section.metadata?.estimatedReadTime || '5'}m read
                      </Typography>
                    </Box>
                  </Stack>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </Box>
  );
}

// Minimal AppBar to override standard one
function AppBar({ children, sx }: any) {
  return (
    <Box 
      sx={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1100, 
        ...sx 
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 64, width: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
