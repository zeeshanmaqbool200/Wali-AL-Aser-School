import React from 'react';
import { Box, Typography, Paper, Grid, Stack, Checkbox, FormControlLabel, Accordion, AccordionSummary, AccordionDetails, Button, Card, Avatar, Alert } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Info, AlertTriangle, CheckCircle, Lightbulb, Quote, Code, Bookmark, ChevronDown, Play, FileText, Headphones, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CourseSection } from '../types';

interface ContentRendererProps {
  section: CourseSection;
  readingMode?: 'light' | 'dark' | 'sepia';
  fontSize?: 'small' | 'medium' | 'large' | 'extra-large' | 'massive';
  onQuizSubmit?: (attempt: any) => void;
}

export default function ContentRenderer({ section, readingMode = 'light', fontSize = 'medium', onQuizSubmit }: ContentRendererProps) {
  const theme = useTheme();
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = React.useState(false);
  const startTime = React.useRef(Date.now());
  
  const handleQuizSubmit = () => {
    if (!section.quizData || !onQuizSubmit) return;
    
    let score = 0;
    const wrongAnswers: string[] = [];
    section.quizData.questions.forEach((q, idx) => {
      if (quizAnswers[q.id] === q.correctAnswer) {
        score++;
      } else {
        wrongAnswers.push(q.id);
      }
    });

    const attempt = {
      score,
      totalQuestions: section.quizData.questions.length,
      submittedAt: Date.now(),
      completionTimeSeconds: Math.floor((Date.now() - startTime.current) / 1000),
      wrongAnswersIds: wrongAnswers,
      answers: quizAnswers,
      performanceAnalytics: {
        accuracy: (score / section.quizData.questions.length) * 100
      }
    };

    setQuizSubmitted(true);
    onQuizSubmit(attempt);
  };
  
  const getFontSize = () => {
    switch (fontSize) {
      case 'small': return '0.9rem';
      case 'large': return '1.2rem';
      case 'extra-large': return '1.4rem';
      case 'massive': return '1.8rem';
      default: return '1.05rem';
    }
  };

  const getLineHeight = () => {
    switch (fontSize) {
      case 'massive': return 1.4;
      default: return 1.8;
    }
  };

  const renderMedia = () => {
    if (!section.mediaUrl) return null;

    if (section.type === 'video') {
      return (
        <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: 4, overflow: 'hidden', mb: 4, bgcolor: 'black' }}>
          <iframe
            src={section.mediaUrl}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          />
        </Box>
      );
    }

    if (section.type === 'image' || section.type === 'gallery') {
      return (
        <Box sx={{ mb: 4 }}>
          <img 
            src={section.mediaUrl} 
            alt={section.title} 
            style={{ width: '100%', borderRadius: 16, display: 'block' }} 
            referrerPolicy="no-referrer"
          />
        </Box>
      );
    }

    if (section.type === 'audio') {
      return (
        <Paper 
          elevation={0}
          sx={{ 
            p: 3, 
            borderRadius: 4, 
            mb: 4, 
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            gap: 3
          }}
        >
          <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'primary.main', color: 'white' }}>
            <Headphones size={24} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{section.title || 'Audio Lesson'}</Typography>
            <Typography variant="caption" color="text.secondary">Listen to the explanation</Typography>
            <audio controls style={{ width: '100%', height: 36, marginTop: 8 }}>
              <source src={section.mediaUrl} />
            </audio>
          </Box>
        </Paper>
      );
    }

    return null;
  };

  const renderSpecialBlocks = () => {
    switch (section.type) {
      case 'quiz':
        return (
          <Box sx={{ my: 4 }}>
            {!section.quizData ? (
              <Alert severity="warning" sx={{ borderRadius: 4 }}>Assessment data not found.</Alert>
            ) : (
              <Stack spacing={4}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: { xs: 2.5, sm: 4 }, 
                    borderRadius: 6, 
                    border: '1px solid', 
                    borderColor: readingMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'divider', 
                    bgcolor: readingMode === 'dark' ? 'rgba(255,255,255,0.03)' : readingMode === 'sepia' ? 'rgba(0,0,0,0.03)' : alpha(theme.palette.primary.main, 0.02) 
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 950, mb: 1 }}>Final Assessment</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.6, mb: 4 }}>Verify your understanding of this module to proceed.</Typography>
                  
                  <Stack spacing={4}>
                    {section.quizData.questions.map((q, idx) => (
                      <Box key={q.id}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, display: 'flex', gap: 1.5 }}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: 'primary.main', fontWeight: 900 }}>{idx + 1}</Avatar>
                          {q.question}
                        </Typography>
                        <Grid container spacing={2}>
                          {q.options.map((opt, optIdx) => (
                            <Grid size={{ xs: 12, sm: 6 }} key={optIdx}>
                              <Button 
                                fullWidth 
                                variant={quizAnswers[q.id] === optIdx ? "contained" : "outlined"} 
                                onClick={() => !quizSubmitted && setQuizAnswers(p => ({ ...p, [q.id]: optIdx }))}
                                disabled={quizSubmitted}
                                sx={{ 
                                  textAlign: 'left', justifyContent: 'flex-start', p: 2, borderRadius: 3,
                                  borderWidth: 2, fontWeight: 700,
                                  borderColor: quizAnswers[q.id] === optIdx ? 'primary.main' : alpha(theme.palette.divider, 0.5),
                                  '&:hover': { borderWidth: 2 }
                                }}
                              >
                                {opt}
                              </Button>
                            </Grid>
                          ))}
                        </Grid>
                        {quizSubmitted && quizAnswers[q.id] !== q.correctAnswer && (
                           <Typography variant="caption" sx={{ mt: 1, color: 'error.main', fontWeight: 700, display: 'block' }}>
                             Incorrect. Correct Answer: {q.options[q.correctAnswer]}
                           </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>

                  {!quizSubmitted && (
                    <Button 
                      variant="contained" 
                      fullWidth 
                      size="large" 
                      onClick={handleQuizSubmit}
                      disabled={Object.keys(quizAnswers).length < section.quizData.questions.length}
                      sx={{ mt: 6, py: 2, borderRadius: 10, fontWeight: 950, fontSize: '1rem', boxShadow: '0 10px 40px rgba(25, 118, 210, 0.2)' }}
                    >
                      Certify & Synchronize Profile
                    </Button>
                  )}
                </Paper>
              </Stack>
            )}
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
              <ReactMarkdown>{section.content}</ReactMarkdown>
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
        return (
          <Box 
            sx={{ 
              fontSize: getFontSize(), 
              lineHeight: getLineHeight(),
              '& h1, & h2, & h3': { mt: 4, mb: 2, fontWeight: 900, lineHeight: 1.2 },
              '& p': { mb: 2.5 },
              '& ul, & ol': { mb: 3, pl: 3 },
              '& li': { mb: 1.5 },
              textAlign: section.alignment || 'left',
              fontFamily: section.fontFamily === 'serif' ? '"Playfair Display", serif' : 
                          section.fontFamily === 'mono' ? 'monospace' : 'inherit',
              direction: section.isRTL ? 'rtl' : 'ltr'
            }}
          >
            <ReactMarkdown>{section.content}</ReactMarkdown>
          </Box>
        );
    }
  };

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: '100%',
      color: readingMode === 'dark' ? '#F5F5F5' : readingMode === 'sepia' ? '#5B4636' : 'text.primary',
    }}>
      {renderMedia()}
      {renderSpecialBlocks()}
    </Box>
  );
}
