import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, Typography, IconButton, Button, Paper, Stack, 
  Container, LinearProgress, Avatar, Tooltip, 
  Drawer, List, ListItem, ListItemButton, Divider, 
  useMediaQuery, Fade, Zoom, Chip, Skeleton, AppBar, Toolbar
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { 
  ArrowLeft, ChevronRight, ChevronLeft, Menu, 
  Settings as SettingsIcon, Bookmark, Share2, 
  Headphones, Play, Pause, 
  SkipForward, SkipBack, List as ListIcon, BookOpen, Clock, Heart,
  CheckCircle2, Volume2, RotateCcw, RotateCw, X, MoreHorizontal
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, CourseSection, UserProfile, QuizAttempt, InstituteSettings } from '../types';
import ContentRenderer from '../components/ContentRenderer';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { logger } from '../lib/logger';
import confetti from 'canvas-confetti';
import { updateEngagementTime, markLessonComplete, cleanupActiveUser } from '../lib/analytics';

export default function CourseReader() {
  const { courseId, sectionId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [course, setCourse] = useState<Course | null>(null);
  const [instituteSettings, setInstituteSettings] = useState<InstituteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [readingMode, setReadingMode] = useState<'light' | 'dark' | 'sepia'>(theme.palette.mode === 'dark' ? 'dark' : 'light');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large' | 'extra-large' | 'massive'>('medium');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engagementInterval = useRef<any>(null);

  // Fetch Institute Settings for Logo/Watermark
  useEffect(() => {
    const fetchSettings = async () => {
      const settingsRef = doc(db, 'settings', 'institute');
      const snap = await getDoc(settingsRef);
      if (snap.exists()) setInstituteSettings(snap.data() as InstituteSettings);
    };
    fetchSettings();
  }, []);

  // Handle Scroll Progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const progress = (scrollY / (documentHeight - windowHeight)) * 100;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Audio Logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setAudioProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [showAudioPlayer]);

  // Load Course and Resume Progress
  useEffect(() => {
    if (!courseId || !currentUser) return;

    // Track active engagement every 30 seconds
    engagementInterval.current = setInterval(() => {
      updateEngagementTime(courseId, 30);
    }, 30000);

    const fetchCourse = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'courses', courseId));
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Course;
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
                if (resumeIdx !== -1 && resumeIdx !== undefined) setActiveSectionIdx(resumeIdx);
              }
            }
          } else if (data.sections) {
            const idx = data.sections.findIndex(s => s.id === sectionId);
            if (idx !== -1) setActiveSectionIdx(idx);
          }
        }
      } catch (e) {
        logger.error('Failed to load course materials');
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();

    return () => {
      if (engagementInterval.current) clearInterval(engagementInterval.current);
      if (courseId) cleanupActiveUser(courseId);
    };
  }, [courseId, sectionId, currentUser?.uid]);

  const activeSection = useMemo(() => {
    if (!course?.sections || course.sections.length === 0) return null;
    return course.sections[activeSectionIdx];
  }, [course, activeSectionIdx]);

  const overallProgress = useMemo(() => {
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
      setIsPlaying(false);
      setAudioProgress(0);
    } else {
      if (courseId && activeSection) markLessonComplete(courseId, activeSection.id);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: [theme.palette.primary.main, '#E9C46A', '#2A9D8F']
      });
      navigate('/courses');
    }
  };

  const handlePrev = () => {
    if (activeSectionIdx > 0) {
      const prevIdx = activeSectionIdx - 1;
      setActiveSectionIdx(prevIdx);
      saveProgress(prevIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setIsPlaying(false);
      setAudioProgress(0);
    }
  };

  const activeStyles = useMemo(() => {
    if (readingMode === 'sepia') return { bg: '#F4ECD8', text: '#5D4037', primary: '#A67C52', secondary: '#8D6E63' };
    if (readingMode === 'dark') return { bg: '#0A0A0A', text: '#F5F5F5', primary: '#3B82F6', secondary: '#9CA3AF' };
    return { bg: '#FDFCFB', text: '#1A1A1A', primary: '#3B82F6', secondary: '#6B7280' };
  }, [readingMode]);

  if (loading) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: activeStyles.bg }}>
      <Skeleton variant="circular" width={60} height={60} />
    </Box>
  );

  if (!course || !activeSection) return null;

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: activeStyles.bg, 
      color: activeStyles.text, 
      transition: 'background-color 0.4s ease',
      pb: 12
    }}>
      {/* Background Watermark */}
      {instituteSettings?.logoUrl && (
        <Box sx={{ 
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-15deg)', 
          width: '60%', opacity: 0.03, pointerEvents: 'none', zIndex: 0,
          mixBlendMode: 'screen' 
        }}>
          <img src={instituteSettings.logoUrl} style={{ width: '100%', height: 'auto' }} />
        </Box>
      )}

      {/* Top Header */}
      <AppBar 
        position="fixed" 
        elevation={0} 
        sx={{ 
          bgcolor: alpha(activeStyles.bg, 0.8), 
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid',
          borderColor: alpha(activeStyles.text, 0.05),
          color: activeStyles.text,
          zIndex: 1100
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 4 } }}>
          <IconButton onClick={() => navigate('/courses')} sx={{ color: activeStyles.text }}>
            <ArrowLeft size={20} />
          </IconButton>
          
          <Box sx={{ textAlign: 'center', flex: 1, maxWidth: '60%', overflow: 'hidden' }}>
            <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.5, letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {course.name}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeSection.title}</Typography>
          </Box>

          <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: activeStyles.text }}>
             <SettingsIcon size={20} />
          </IconButton>
        </Toolbar>
        
        {/* Progress System */}
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 }}>
          <LinearProgress 
            variant="determinate" 
            value={overallProgress} 
            sx={{ 
              height: 2, 
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': { bgcolor: activeStyles.primary, opacity: 0.2 } 
            }} 
          />
          <LinearProgress 
            variant="determinate" 
            value={scrollProgress} 
            sx={{ 
              height: 2, 
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': { bgcolor: activeStyles.primary, boxShadow: `0 0 10px ${activeStyles.primary}` } 
            }} 
          />
        </Box>
      </AppBar>

      {/* Hero Header Area (Large Text) */}
      <Container maxWidth="sm" sx={{ pt: 18, pb: 4, position: 'relative', zIndex: 1 }}>
         <Typography 
          variant="h1" 
          sx={{ 
            fontWeight: 950, 
            mb: 4, 
            letterSpacing: -1.5, 
            fontFamily: readingMode === 'sepia' ? '"Playfair Display", serif' : 'inherit',
            fontSize: { xs: '2.5rem', sm: '3.5rem' },
            lineHeight: 1.1,
            color: activeStyles.text,
            textAlign: 'center'
          }}
        >
          {activeSection.title}
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 6 }}>
          <Chip 
            label={`Chapter ${activeSectionIdx + 1}`} 
            size="small" 
            sx={{ 
              fontWeight: 900, 
              bgcolor: alpha(activeStyles.primary, 0.1), 
              color: activeStyles.primary,
              borderRadius: 2
            }} 
          />
          <Chip 
            label={`${Math.max(1, Math.ceil(activeSection.content?.length / 1000 || 5))} min read`} 
            size="small" 
            variant="outlined" 
            sx={{ 
              fontWeight: 800, 
              color: activeStyles.secondary,
              borderColor: alpha(activeStyles.text, 0.1),
              borderRadius: 2
            }} 
          />
        </Stack>
      </Container>

      {/* Reader Content */}
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <ContentRenderer 
          section={activeSection} 
          readingMode={readingMode} 
          fontSize={fontSize}
          onQuizSubmit={() => handleNext()}
        />
        
        {/* Footer Nav */}
        <Box sx={{ mt: 10, pb: 10, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: alpha(activeStyles.text, 0.05), pt: 4 }}>
           <Button 
            disabled={activeSectionIdx === 0}
            onClick={handlePrev}
            sx={{ color: activeStyles.text, fontWeight: 800 }}
            startIcon={<ChevronLeft />}
          >
            Previous
          </Button>
          <Button 
            onClick={handleNext}
            sx={{ color: activeStyles.primary, fontWeight: 900 }}
            endIcon={<ChevronRight />}
          >
            {activeSectionIdx === course.sections!.length - 1 ? 'Finish' : 'Next Lesson'}
          </Button>
        </Box>
      </Container>

      {/* Floating Bottom Nav Controls */}
      <Paper 
        elevation={0}
        sx={{ 
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          width: { xs: '90%', sm: 400 }, borderRadius: 10,
          bgcolor: alpha(activeStyles.bg, 0.95),
          backdropFilter: 'blur(20px)',
          border: '1px solid', borderColor: alpha(activeStyles.text, 0.1),
          p: 1, zIndex: 1100,
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}
      >
        <IconButton sx={{ color: activeStyles.text }} onClick={() => setDrawerOpen(true)}>
          <ListIcon size={20} />
        </IconButton>
        
        {activeSection.audioUrl && (
          <Box 
            onClick={() => setShowAudioPlayer(!showAudioPlayer)}
            sx={{ 
              width: 56, height: 56, borderRadius: '50%', 
              bgcolor: activeStyles.primary, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: `0 8px 24px ${alpha(activeStyles.primary, 0.4)}`,
              transition: '0.3s',
              transform: showAudioPlayer ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            <Headphones size={24} />
          </Box>
        )}

        <IconButton sx={{ color: activeStyles.text }}>
          <Bookmark size={20} />
        </IconButton>
      </Paper>

      {/* Immersive Audio Player Overlay */}
      <AnimatePresence>
        {showAudioPlayer && activeSection.audioUrl && (
          <Box 
            component={motion.div}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            sx={{ 
              position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
              width: { xs: '90%', sm: 400 }, zIndex: 1200
            }}
          >
            <Paper 
              elevation={24}
              sx={{ 
                p: 3, borderRadius: 8, 
                bgcolor: activeStyles.bg, border: '1px solid', borderColor: alpha(activeStyles.text, 0.1),
                boxShadow: '0 30px 60px rgba(0,0,0,0.2)'
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5 }}>Immersive Listening</Typography>
                <IconButton size="small" onClick={() => setShowAudioPlayer(false)} sx={{ color: activeStyles.text }}><X size={16} /></IconButton>
              </Stack>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>{activeSection.title}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Reading by Academy AI</Typography>
              </Box>

              <Box sx={{ px: 1, mb: 2 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={audioProgress} 
                  sx={{ height: 6, borderRadius: 3, bgcolor: alpha(activeStyles.text, 0.05) }} 
                />
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.5 }}>
                    {new Date( (audioRef.current?.currentTime || 0) * 1000).toISOString().substr(14, 5)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.5 }}>
                    -{new Date( (audioDuration - (audioRef.current?.currentTime || 0)) * 1000).toISOString().substr(14, 5)}
                  </Typography>
                </Stack>
              </Box>

              <Stack direction="row" justifyContent="center" alignItems="center" spacing={3}>
                <IconButton size="small" sx={{ color: activeStyles.text }} onClick={() => audioRef.current && (audioRef.current.currentTime -= 10)}><RotateCcw size={20} /></IconButton>
                <IconButton 
                  onClick={() => setIsPlaying(!isPlaying)}
                  sx={{ 
                    bgcolor: activeStyles.primary, color: 'white', 
                    width: 64, height: 64,
                    '&:hover': { bgcolor: alpha(activeStyles.primary, 0.8) }
                  }}
                >
                  {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
                </IconButton>
                <IconButton size="small" sx={{ color: activeStyles.text }} onClick={() => audioRef.current && (audioRef.current.currentTime += 10)}><RotateCw size={20} /></IconButton>
              </Stack>
              
              <audio 
                ref={audioRef}
                src={activeSection.audioUrl} 
                autoPlay={isPlaying}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </Paper>
          </Box>
        )}
      </AnimatePresence>

      {/* Settings Drawer */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { 
            borderTopLeftRadius: 32, borderTopRightRadius: 32, 
            bgcolor: activeStyles.bg, p: 4, maxHeight: '80vh' 
          }
        }}
      >
        <Stack spacing={4}>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ width: 40, height: 4, bgcolor: alpha(activeStyles.text, 0.1), borderRadius: 2, mx: 'auto', mb: 3 }} />
            <Typography variant="h6" sx={{ fontWeight: 950 }}>Reader Preferences</Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.5, mb: 2, display: 'block' }}>APPEARANCE</Typography>
            <Stack direction="row" spacing={3} justifyContent="center">
              {(['light', 'sepia', 'dark'] as const).map(mode => (
                <Box 
                  key={mode}
                  onClick={() => setReadingMode(mode)}
                  sx={{ 
                    width: 60, height: 60, borderRadius: 3, 
                    bgcolor: mode === 'light' ? '#fff' : mode === 'sepia' ? '#F4ECD8' : '#121212',
                    border: '2px solid',
                    borderColor: readingMode === mode ? activeStyles.primary : 'divider',
                    cursor: 'pointer', transition: '0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 900, color: mode === 'dark' ? '#fff' : '#000' }}>Aa</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.5, mb: 2, display: 'block' }}>FONT SIZE</Typography>
            <Stack direction="row" spacing={1} sx={{ p: 1, bgcolor: alpha(activeStyles.text, 0.05), borderRadius: 3 }}>
              {(['small', 'medium', 'large', 'massive'] as const).map(size => (
                <Button 
                  key={size}
                  fullWidth
                  variant={fontSize === size ? "contained" : "text"}
                  onClick={() => setFontSize(size)}
                  sx={{ 
                    borderRadius: 2, textTransform: 'none', fontWeight: 800,
                    bgcolor: fontSize === size ? activeStyles.primary : 'transparent',
                    color: fontSize === size ? '#fff' : activeStyles.text
                  }}
                >
                  {size.charAt(0).toUpperCase()}
                </Button>
              ))}
            </Stack>
          </Box>

          <Box>
             <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.5, mb: 2, display: 'block' }}>CHAPTERS</Typography>
             <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {course.sections?.map((s, i) => (
                  <ListItemButton 
                    key={s.id} 
                    onClick={() => { setActiveSectionIdx(i); setDrawerOpen(false); }}
                    selected={activeSectionIdx === i}
                    sx={{ borderRadius: 3, mb: 1, bgcolor: activeSectionIdx === i ? alpha(activeStyles.primary, 0.1) : 'transparent' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>{i + 1}. {s.title}</Typography>
                  </ListItemButton>
                ))}
             </List>
          </Box>
        </Stack>
      </Drawer>
    </Box>
  );
}
