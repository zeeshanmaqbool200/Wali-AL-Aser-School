import React from 'react';
import { Box, Typography, Paper, Grid, Stack, Checkbox, FormControlLabel, Accordion, AccordionSummary, AccordionDetails, Button, Card, Avatar, Alert, Fade } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Info, AlertTriangle, CheckCircle, Lightbulb, Quote, Code, Bookmark, ChevronDown, Play, FileText, Headphones, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { CourseSection } from '../types';

interface ContentRendererProps {
  section: CourseSection;
  readingMode?: 'light' | 'dark' | 'sepia';
  fontSize?: 'small' | 'medium' | 'large' | 'extra-large' | 'massive';
  onQuizSubmit?: (attempt: any) => void;
  activeHighlightIdx?: number | null;
}

export default function ContentRenderer({ section, readingMode = 'light', fontSize = 'medium', onQuizSubmit, activeHighlightIdx = null }: ContentRendererProps) {
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = React.useState(false);
  const [persistedAttempt, setPersistedAttempt] = React.useState<any>(null);
  const startTime = React.useRef(Date.now());

  React.useEffect(() => {
    if (currentUser?.quizScores && section.id) {
      const existing = currentUser.quizScores.find(s => s.sectionId === section.id);
      if (existing) {
        setPersistedAttempt(existing);
        setQuizSubmitted(true);
      }
    }
  }, [currentUser?.uid, section.id]);
  
  const handleQuizSubmit = () => {
    const questions = section.metadata?.quizQuestions || section.quizData?.questions || [];
    if (questions.length === 0 || !onQuizSubmit) return;
    
    let score = 0;
    const wrongAnswers: string[] = [];
    questions.forEach((q: any, idx: number) => {
      const qId = q.id || idx.toString();
      if (quizAnswers[qId] === q.correctAnswer || quizAnswers[qId] === q.correct) {
        score++;
      } else {
        wrongAnswers.push(qId);
      }
    });

    const attempt = {
      score,
      totalQuestions: questions.length,
      submittedAt: Date.now(),
      completionTimeSeconds: Math.floor((Date.now() - startTime.current) / 1000),
      wrongAnswersIds: wrongAnswers,
      answers: quizAnswers,
      performanceAnalytics: {
        accuracy: (score / questions.length) * 100
      }
    };

    setQuizSubmitted(true);
    onQuizSubmit(attempt);
  };
  
  const getFontSize = () => {
    switch (fontSize) {
      case 'small': return '0.9rem';
      case 'large': return '1.25rem';
      case 'extra-large': return '1.5rem';
      case 'massive': return '2rem';
      default: return '1.15rem';
    }
  };

  const getLineHeight = () => {
    switch (fontSize) {
      case 'massive': return 1.3;
      default: return 1.8;
    }
  };

  const getFontFamily = () => {
     const pairing = section.theme?.fontPairing || section.fontFamily;
     switch (pairing) {
       case 'premium-serif':
       case 'serif': 
         return '"Playfair Display", serif';
       case 'classic-book':
       case 'ebook-serif':
         return '"Lora", serif';
       case 'modern-sans':
         return '"Outfit", sans-serif';
       case 'mono':
         return '"JetBrains Mono", monospace';
       default:
         return 'inherit';
     }
  };

  const renderMedia = () => {
    if (!section.mediaUrl) return null;

    if (section.type === 'video' || section.mediaUrl.includes('youtube.com') || section.mediaUrl.includes('vimeo.com')) {
      return (
        <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: 4, overflow: 'hidden', mb: 4, bgcolor: 'black', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
          <iframe
            src={section.mediaUrl}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          />
        </Box>
      );
    }

    if (section.type === 'image' || section.type === 'gallery' || section.mediaUrl.match(/\.(jpeg|jpg|gif|png)$/) != null || section.mediaUrl.startsWith('data:image')) {
      return (
        <Box sx={{ mb: 6 }}>
          <img 
            src={section.mediaUrl} 
            alt={section.title} 
            style={{ width: '100%', borderRadius: 12, display: 'block', boxShadow: '0 15px 40px rgba(0,0,0,0.1)' }} 
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        </Box>
      );
    }

    return null;
  };

  const renderSpecialBlocks = () => {
    const questions = section.metadata?.quizQuestions || section.quizData?.questions || [];

    switch (section.type) {
      case 'quiz':
      case 'text': // Also check for quiz at the end of text
        if (questions.length === 0 && section.type === 'quiz') {
           return <Alert severity="warning" sx={{ borderRadius: 4 }}>Integrated Quiz questions not found.</Alert>;
        }
        
        // If type is text, we only render the quiz at the end of the text if specifically asked or via this check
        if (section.type === 'text' && questions.length === 0) return null;

        return (
          <Box sx={{ my: 8 }}>
            <Stack spacing={4}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: { xs: 3, sm: 5 }, 
                    borderRadius: 8, 
                    border: '1px solid', 
                    borderColor: readingMode === 'dark' ? 'rgba(255,255,255,0.1)' : alpha(theme.palette.primary.main, 0.1), 
                    bgcolor: readingMode === 'dark' ? 'rgba(255,255,255,0.02)' : alpha(theme.palette.primary.main, 0.01),
                    boxShadow: '0 30px 60px rgba(0,0,0,0.03)'
                  }}
                >
                  <Stack direction="row" spacing={2} sx={{ mb: 4 }} alignItems="center">
                    <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                      <CheckCircle size={24} />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -1 }}>Section Completion Assessment</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.6 }}>Verify your understanding to synchronize your academic progress.</Typography>
                    </Box>
                  </Stack>

                  {persistedAttempt && (
                    <Box sx={{ mb: 4, p: 4, borderRadius: 4, bgcolor: alpha(theme.palette.success.main, 0.05), border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.1) }}>
                       <Stack direction="row" spacing={4} alignItems="center">
                          <Avatar sx={{ width: 80, height: 80, bgcolor: 'success.main', fontSize: '1.5rem', fontWeight: 950 }}>
                            {Math.round((persistedAttempt.score / persistedAttempt.total) * 100)}%
                          </Avatar>
                          <Box>
                             <Typography variant="h6" sx={{ fontWeight: 900 }}>Assessment Completed</Typography>
                             <Typography variant="body1" sx={{ opacity: 0.8 }}>Score: {persistedAttempt.score} Correct out of {persistedAttempt.total}</Typography>
                          </Box>
                       </Stack>
                    </Box>
                  )}
                  
                  {!persistedAttempt && (
                    <Stack spacing={5}>
                      {questions.map((q: any, idx: number) => {
                        const qId = q.id || idx.toString();
                        const correctIdx = q.correctAnswer !== undefined ? q.correctAnswer : q.correct;
                        const isCorrect = quizSubmitted && quizAnswers[qId] === correctIdx;
                        const isWrong = quizSubmitted && quizAnswers[qId] !== correctIdx;

                        return (
                          <Box key={qId}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 3, display: 'flex', gap: 2, fontSize: '1.15rem' }}>
                              <Box component="span" sx={{ opacity: 0.2 }}>0{idx + 1}</Box>
                              {q.question || q.q}
                            </Typography>
                            <Grid container spacing={2}>
                              {q.options.map((opt: string, optIdx: number) => {
                                let btnColor: any = "primary";
                                if (quizSubmitted) {
                                  if (optIdx === correctIdx) btnColor = "success";
                                  else if (quizAnswers[qId] === optIdx) btnColor = "error";
                                }

                                return (
                                  <Grid size={{ xs: 12, sm: 6 }} key={optIdx}>
                                    <Button 
                                      fullWidth 
                                      variant={quizAnswers[qId] === optIdx ? "contained" : "outlined"} 
                                      color={btnColor}
                                      onClick={() => !quizSubmitted && setQuizAnswers(p => ({ ...p, [qId]: optIdx }))}
                                      disabled={quizSubmitted}
                                      sx={{ 
                                        textAlign: 'left', justifyContent: 'flex-start', p: 2, borderRadius: 4,
                                        borderWidth: 2, fontWeight: 800,
                                        '&:hover': { borderWidth: 2 }
                                      }}
                                    >
                                      {opt}
                                    </Button>
                                  </Grid>
                                );
                              })}
                            </Grid>
                            
                            {quizSubmitted && q.explanation && (
                              <Fade in={true}>
                                <Alert 
                                  severity={isCorrect ? "success" : "info"} 
                                  sx={{ mt: 2, borderRadius: 3, fontWeight: 600 }}
                                >
                                  {q.explanation}
                                </Alert>
                              </Fade>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  )}

                  {!quizSubmitted && !persistedAttempt && (
                    <Button 
                      variant="contained" 
                      fullWidth 
                      size="large" 
                      onClick={handleQuizSubmit}
                      disabled={Object.keys(quizAnswers).length < questions.length}
                      sx={{ mt: 8, py: 2.5, borderRadius: 10, fontWeight: 950, fontSize: '1.1rem', boxShadow: '0 12px 48px rgba(25, 118, 210, 0.3)' }}
                    >
                      Certify Result & Sync Profile
                    </Button>
                  )}
                </Paper>
            </Stack>
          </Box>
        );

      case 'callout':
        const calloutType = section.metadata?.calloutType || 'info';
        const colors = {
          info: { main: theme.palette.info.main, bg: alpha(theme.palette.info.main, 0.05), icon: <Info size={20} /> },
          warning: { main: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.05), icon: <AlertTriangle size={20} /> },
          error: { main: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.05), icon: <AlertTriangle size={20} /> },
          success: { main: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.05), icon: <CheckCircle size={20} /> },
          tip: { main: theme.palette.secondary.main, bg: alpha(theme.palette.secondary.main, 0.05), icon: <Lightbulb size={20} /> },
        };
        const activeColor = colors[calloutType] || colors.info;
        
        return (
          <Box sx={{ 
            p: 3, 
            my: 4, 
            borderRadius: 4, 
            bgcolor: activeColor.bg, 
            borderLeft: `6px solid ${activeColor.main}`,
            display: 'flex',
            gap: 2
          }}>
            <Box sx={{ color: activeColor.main, mt: 0.5 }}>{activeColor.icon}</Box>
            <Box sx={{ flex: 1 }}>
              {calloutType === 'tip' ? (
                 <Typography variant="body1" sx={{ fontStyle: 'italic', opacity: 0.9 }}>
                    "{section.content}"
                 </Typography>
              ) : (
                 <ReactMarkdown>{section.content}</ReactMarkdown>
              )}
            </Box>
          </Box>
        );

      case 'quote':
        return (
          <Box sx={{ my: 6, textAlign: 'center', position: 'relative' }}>
            <Box sx={{ opacity: 0.1, color: 'primary.main', position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)' }}>
              <Quote size={80} />
            </Box>
            <Typography 
              variant="h5" 
              sx={{ 
                fontStyle: 'italic', 
                fontWeight: 600, 
                lineHeight: 1.6, 
                position: 'relative', 
                zIndex: 1,
                color: readingMode === 'dark' ? '#F5F5F5' : readingMode === 'sepia' ? '#5B4636' : 'text.primary',
                px: 4
              }}
            >
              {section.content}
            </Typography>
            {section.metadata?.quoteAuthor && (
              <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 800, color: 'primary.main' }}>
                — {section.metadata.quoteAuthor}
              </Typography>
            )}
          </Box>
        );

      case 'code':
        return (
          <Box sx={{ my: 4, borderRadius: 4, overflow: 'hidden', bgcolor: '#1E1E1E', p: 3, position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
               <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>
                 {section.metadata?.codeLanguage || 'code'}
               </Typography>
               <Code size={14} color="rgba(255,255,255,0.4)" />
            </Box>
            <Typography 
              component="pre" 
              sx={{ 
                fontFamily: 'monospace', 
                color: '#D4D4D4', 
                fontSize: '0.9rem', 
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}
            >
              <code>{section.content}</code>
            </Typography>
          </Box>
        );

      case 'flashcard':
        return (
          <Card 
            elevation={0}
            sx={{ 
              my: 4, 
              p: 4, 
              borderRadius: 6, 
              textAlign: 'center', 
              bgcolor: alpha(theme.palette.secondary.main, 0.05),
              border: '2px dashed',
              borderColor: alpha(theme.palette.secondary.main, 0.2),
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              '&:hover': { transform: 'scale(1.02)', borderColor: 'secondary.main' }
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{section.content}</Typography>
            <Accordion sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ChevronDown />}>
                <Typography variant="caption" sx={{ fontWeight: 900, color: 'secondary.main', textTransform: 'uppercase' }}>Show Explanation</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1">{section.metadata?.flashcardBack}</Typography>
              </AccordionDetails>
            </Accordion>
          </Card>
        );

      default:
        const paragraphs = section.content.split(/\n\n+/);
        return (
          <Box 
            sx={{ 
              fontSize: getFontSize(), 
              lineHeight: getLineHeight(),
              '& h1, & h2, & h3': { mt: 3, mb: 1.5, fontWeight: 900, lineHeight: 1.2, transition: 'all 0.3s' },
              '& p': { mb: 2 },
              '& ul, & ol': { mb: 2, pl: 3 },
              '& li': { mb: 1 },
              textAlign: section.alignment || 'left',
              fontFamily: section.fontFamily === 'serif' ? '"Playfair Display", serif' : 
                          section.fontFamily === 'mono' ? 'monospace' : 'inherit',
              direction: section.isRTL ? 'rtl' : 'ltr'
            }}
          >
            {paragraphs.map((para, pIdx) => (
              <Box 
                key={pIdx}
                sx={{ 
                  mb: 2,
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: activeHighlightIdx !== null && activeHighlightIdx !== pIdx % paragraphs.length ? 0.3 : 1,
                  scale: activeHighlightIdx !== null && activeHighlightIdx === pIdx % paragraphs.length ? '1.02' : '1',
                  bgcolor: activeHighlightIdx !== null && activeHighlightIdx === pIdx % paragraphs.length 
                    ? alpha(theme.palette.primary.main, 0.05) 
                    : 'transparent',
                  borderRadius: 2,
                  p: activeHighlightIdx !== null && activeHighlightIdx === pIdx % paragraphs.length ? 1.5 : 0,
                  mx: activeHighlightIdx !== null && activeHighlightIdx === pIdx % paragraphs.length ? -1.5 : 0,
                }}
              >
                <ReactMarkdown>{para}</ReactMarkdown>
              </Box>
            ))}
          </Box>
        );
    }
  };

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: '100%',
      color: readingMode === 'dark' ? '#F5F5F5' : readingMode === 'sepia' ? '#5B4636' : 'text.primary',
      fontFamily: getFontFamily(),
    }}>
      {renderMedia()}
      {renderSpecialBlocks()}
    </Box>
  );
}
