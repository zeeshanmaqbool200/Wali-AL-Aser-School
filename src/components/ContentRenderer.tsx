import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, Typography, Paper, Grid, Stack, Button, 
  Avatar, Alert, Fade, Radio, RadioGroup, 
  FormControlLabel, FormControl, IconButton
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  CheckCircle, Play, FileText, Headphones, 
  Image as ImageIcon, HelpCircle, ArrowRight, Check, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { CourseSection } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ContentRendererProps {
  section: CourseSection;
  readingMode?: 'light' | 'dark' | 'sepia';
  fontSize?: 'small' | 'medium' | 'large' | 'extra-large' | 'massive';
  onQuizSubmit?: (attempt: any) => void;
}

export default function ContentRenderer({ 
  section, 
  readingMode = 'light', 
  fontSize = 'medium', 
  onQuizSubmit 
}: ContentRendererProps) {
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const activeStyles = useMemo(() => {
    if (readingMode === 'sepia') return { bg: '#F4ECD8', text: '#5D4037', primary: '#A67C52', divider: 'rgba(93, 64, 55, 0.1)' };
    if (readingMode === 'dark') return { bg: '#0A0A0A', text: '#F5F5F5', primary: '#3B82F6', divider: 'rgba(255, 255, 255, 0.08)' };
    return { bg: '#FDFCFB', text: '#1A1A1A', primary: '#3B82F6', divider: 'rgba(0, 0, 0, 0.06)' };
  }, [readingMode]);

  const getFontSize = () => {
    switch (fontSize) {
      case 'small': return '1rem';
      case 'large': return '1.25rem';
      case 'massive': return '1.5rem';
      default: return '1.15rem';
    }
  };

  const renderMedia = () => {
    if (!section.mediaUrl) return null;

    if (section.type === 'video') {
      return (
        <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: 6, overflow: 'hidden', mb: 6, bgcolor: 'black', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}>
          <iframe
            src={section.mediaUrl}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          />
        </Box>
      );
    }

    if (section.type === 'image' || (section.mediaUrl && section.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/) != null) || section.mediaUrl?.startsWith('data:image')) {
      const isPng = section.mediaUrl.toLowerCase().includes('.png') || section.mediaUrl.includes('data:image/png');
      
      return (
        <Box sx={{ mb: 6, display: 'flex', justifyContent: 'center', width: '100%' }}>
          <Box 
            component="img"
            src={section.mediaUrl} 
            alt={section.title} 
            sx={{ 
              maxWidth: '100%', 
              maxHeight: '600px',
              borderRadius: isPng ? 0 : 6, 
              display: 'block',
              filter: isPng ? 'none' : 'drop-shadow(0 10px 40px rgba(0,0,0,0.05))',
              objectFit: 'contain'
            }} 
            referrerPolicy="no-referrer"
          />
        </Box>
      );
    }
    return null;
  };

  const questions = section.metadata?.quizQuestions || [];

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
    setShowResults(true);
    if (onQuizSubmit) onQuizSubmit({});
  };

  return (
    <Box sx={{ 
      width: '100%', 
      color: activeStyles.text,
      fontFamily: readingMode === 'sepia' ? '"Playfair Display", serif' : '"Inter", sans-serif',
      lineHeight: 1.8,
      fontSize: getFontSize(),
      '& p': { mb: 3, opacity: 0.9 },
      '& h1, & h2, & h3': { 
        fontFamily: '"Outfit", sans-serif', 
        letterSpacing: -0.5, 
        fontWeight: 950, 
        mb: 2, mt: 4,
        color: activeStyles.primary
      },
      '& blockquote': {
        borderLeft: '4px solid',
        borderColor: activeStyles.primary,
        pl: 3,
        py: 1,
        my: 4,
        fontStyle: 'italic',
        bgcolor: alpha(activeStyles.primary, 0.03),
        borderRadius: 1
      }
    }}>
      {renderMedia()}

      <Box sx={{ mb: 6, textAlign: 'justify' }}>
        <ReactMarkdown>{section.content}</ReactMarkdown>
      </Box>

      {/* Quiz Section */}
      {section.type === 'quiz' && questions.length > 0 && (
        <Paper 
          elevation={0}
          sx={{ 
            p: { xs: 3, sm: 5 }, 
            borderRadius: 8, 
            border: '1px solid', 
            borderColor: alpha(activeStyles.text, 0.1),
            bgcolor: alpha(activeStyles.text, 0.02),
            mt: 8
          }}
        >
          <Stack direction="row" spacing={2} sx={{ mb: 4 }} alignItems="center">
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(activeStyles.primary, 0.1), color: activeStyles.primary }}>
              <HelpCircle size={24} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 950, letterSpacing: -0.5 }}>Knowledge Check</Typography>
              <Typography variant="body2" sx={{ opacity: 0.6, fontWeight: 700 }}>Test your understanding of this module</Typography>
            </Box>
          </Stack>

          <Stack spacing={6}>
            {questions.map((q: any, qIdx: number) => (
              <Box key={qIdx}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 3, display: 'flex', gap: 2 }}>
                  <Box sx={{ opacity: 0.2 }}>{qIdx + 1}</Box>
                  {q.q}
                </Typography>
                
                <RadioGroup 
                  value={quizAnswers[qIdx] ?? ''}
                  onChange={(e) => !quizSubmitted && setQuizAnswers(p => ({ ...p, [qIdx]: parseInt(e.target.value) }))}
                >
                  <Grid container spacing={2}>
                    {q.options.map((opt: string, optIdx: number) => {
                      const isSelected = quizAnswers[qIdx] === optIdx;
                      const isCorrect = q.correct === optIdx;
                      const isWrong = isSelected && !isCorrect;
                      
                      let borderColor = alpha(activeStyles.text, 0.1);
                      let bgColor = 'transparent';
                      
                      if (showResults) {
                        if (isCorrect) {
                          borderColor = theme.palette.success.main;
                          bgColor = alpha(theme.palette.success.main, 0.1);
                        } else if (isWrong) {
                          borderColor = theme.palette.error.main;
                          bgColor = alpha(theme.palette.error.main, 0.1);
                        }
                      } else if (isSelected) {
                        borderColor = activeStyles.primary;
                        bgColor = alpha(activeStyles.primary, 0.05);
                      }

                      return (
                        <Grid size={12} key={optIdx}>
                          <Box 
                            sx={{ 
                              p: 2, borderRadius: 4, border: '2px solid', 
                              borderColor, bgcolor: bgColor,
                              transition: '0.2s', cursor: quizSubmitted ? 'default' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 2,
                              '&:hover': { bgcolor: quizSubmitted ? bgColor : alpha(activeStyles.primary, 0.05) }
                            }}
                            onClick={() => !quizSubmitted && setQuizAnswers(p => ({ ...p, [qIdx]: optIdx }))}
                          >
                             <Box sx={{ 
                              width: 24, height: 24, borderRadius: '50%', border: '2px solid', 
                              borderColor: isSelected ? activeStyles.primary : alpha(activeStyles.text, 0.2),
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {isSelected && <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: activeStyles.primary }} />}
                              {showResults && isCorrect && <Check size={16} color={theme.palette.success.main} />}
                              {showResults && isWrong && <X size={16} color={theme.palette.error.main} />}
                            </Box>
                            <Typography variant="body1" sx={{ fontWeight: 800 }}>{opt}</Typography>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </RadioGroup>

                {showResults && q.explanation && (
                  <Box sx={{ mt: 2, p: 2, borderRadius: 3, bgcolor: alpha(activeStyles.primary, 0.05), borderLeft: '4px solid', borderColor: activeStyles.primary }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{q.explanation}</Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Stack>

          {!quizSubmitted ? (
            <Button 
              variant="contained" 
              fullWidth 
              size="large" 
              onClick={handleQuizSubmit}
              disabled={Object.keys(quizAnswers).length < questions.length}
              sx={{ 
                mt: 6, py: 2, borderRadius: 4, fontWeight: 950, 
                bgcolor: activeStyles.primary,
                boxShadow: `0 10px 30px ${alpha(activeStyles.primary, 0.3)}` 
              }}
              endIcon={<ArrowRight size={20} />}
            >
              Submit Assessment
            </Button>
          ) : (
            <Button 
              variant="outlined" 
              fullWidth 
              size="large" 
              onClick={() => { setQuizSubmitted(false); setShowResults(false); setQuizAnswers({}); }}
              sx={{ mt: 4, borderRadius: 4, fontWeight: 900, color: activeStyles.text, borderColor: alpha(activeStyles.text, 0.2) }}
            >
              Retake Quiz
            </Button>
          )}
        </Paper>
      )}
    </Box>
  );
}
