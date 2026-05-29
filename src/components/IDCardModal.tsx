import React, { useRef, useState } from 'react';
import { Dialog, Box, Typography, Button, IconButton, Avatar, Paper, CircularProgress, Stack, Grid, useTheme, alpha, Chip } from '@mui/material';
import { X, Printer, User, Shield, Phone, GraduationCap, Download, QrCode } from 'lucide-react';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import * as htmlToImage from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { logger } from '../lib/logger';

interface IDCardModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export default function IDCardModal({ open, onClose, user }: IDCardModalProps) {
  const theme = useTheme();
  const { instituteSettings } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: cardRef,
    documentTitle: `ID_Card_${user?.displayName}`,
  });

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const originalElement = cardRef.current;
      
      // html-to-image is generally more reliable for modern CSS
      // We use a clone to ensure we capture a clean state without scaling artifacts
      const clone = originalElement.cloneNode(true) as HTMLElement;
      
      // Strip potentially problematic styles that cause "boxes" in foreignObject rendering
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.display = 'flex';
      clone.style.flexDirection = 'row';
      clone.style.gap = '40px';
      clone.style.padding = '40px';
      clone.style.background = '#f8fafc';
      clone.style.width = 'fit-content';
      clone.style.height = 'auto';
      clone.style.visibility = 'visible';
      clone.style.opacity = '1';
      
      // Fix MUI elevation/shadow artifacts by forcing solid borders for capture if needed
      // Strip shadows from EVERY element to avoid transparency/rendering artifacts
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el: any) => {
        el.style.boxShadow = 'none';
        el.style.textShadow = 'none';
      });

      const cards = clone.querySelectorAll('.MuiPaper-root');
      cards.forEach((c: any) => {
        c.style.border = '1px solid #e2e8f0';
      });

      document.body.appendChild(clone);
      
      // Wait for fonts and images to be ready
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const realDataUrl = await htmlToImage.toPng(clone, {
        quality: 1,
        pixelRatio: 2, // High DPI capture
        backgroundColor: '#f8fafc',
      });
      
      document.body.removeChild(clone);

      const link = document.createElement('a');
      link.download = `ID-CARD-${(user.displayName || 'STUDENT').replace(/\s+/g, '-')}.png`;
      link.href = realDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logger.success('HD Card downloaded successfully');
    } catch (error: any) {
      console.error('Failed to download ID card:', error);
      logger.error('Download failed. Please try "Print to PDF" instead.');
    } finally {
      setDownloading(false);
    }
  };

  const verificationUrl = `${window.location.origin}/verify/member/${user?.uid}`;

  if (!user) return null;

  const urduFontStyle = { 
    fontFamily: "'Noto Nastaliq Urdu', serif",
    direction: 'rtl' as const,
    lineHeight: 2.2,
    letterSpacing: 'normal',
    fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1'
  };

  const idText = user.admissionNo || user.studentId || user.teacherId || user.staffId || 'PENDING';
  const roleLabel = (user.role || 'student').replace('_', ' ').toUpperCase();

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md"
      fullWidth
      sx={{ 
        '& .MuiDialog-container': {
          alignItems: 'center'
        },
        '& .MuiDialog-paper': { 
          borderRadius: 4,
          bgcolor: 'background.paper',
          overflow: 'visible',
          m: { xs: 1, sm: 2 },
          width: 'auto',
          maxWidth: '100vw',
          backgroundImage: 'none'
        } 
      }}
    >
      <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 100, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', '@media print': { display: 'none' } }}>
        <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 1.5, letterSpacing: -0.5 }}>
          <Shield size={24} color={theme.palette.success.main} />
          Digital ID Asset
        </Typography>
        <IconButton onClick={onClose} sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main' }}>
          <X size={20} />
        </IconButton>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, mb: 10 }}>
        <Box 
          id="printable-card-content"
          ref={cardRef} 
          sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 4,
            width: 'fit-content',
            transform: { xs: 'scale(0.35)', sm: 'scale(0.5)', md: 'scale(0.65)', lg: 'scale(0.7)' },
            transformOrigin: 'top center',
            mb: { xs: -45, sm: -30, md: -20, lg: -15 }, // Offset for scaled content space
            '@media print': {
              display: 'block',
              flexDirection: 'column',
              gap: '0',
              m: '0 !important',
              transform: 'none !important',
              mb: '0 !important',
              p: '0 !important',
              width: '100%',
              '& > .MuiPaper-root': {
                 mb: '20mm', // Gap between front and back in print
                 breakInside: 'avoid',
                 mx: 'auto'
              }
            }
          }}
        >
          {/* FRONT SIDE */}
          <Paper 
            elevation={0}
            className="front-card"
            sx={{ 
              width: 350,
              height: 550,
              bgcolor: '#f1f5f9',
              borderRadius: 6,
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 25px 60px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              '@media print': {
                boxShadow: 'none',
                border: '1px solid #ddd'
              }
            }}
          >
            {/* Left Decorative Bar - Deep Indigo/Navy */}
            <Box sx={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              bottom: 0, 
              width: 65, 
              bgcolor: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pt: 6,
              zIndex: 2
            }}>
               <Typography variant="caption" sx={{ 
                 color: 'rgba(255,255,255,0.08)', 
                 fontWeight: 950, 
                 transform: 'rotate(-90deg)', 
                 whiteSpace: 'nowrap',
                 fontSize: '1.4rem',
                 mt: 24,
                 fontFamily: 'serif',
                 letterSpacing: 4
               }}>
                 MAKTAB PORTAL SYSTEM
               </Typography>
            </Box>

            <Box sx={{ ml: '65px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, bgcolor: 'white' }}>
              {/* Header Branding - Increased Padding and Height */}
              <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center', borderBottom: '1px solid', borderColor: '#f1f5f9', minHeight: 90 }}>
                <Box sx={{ 
                  width: 55, 
                  height: 55, 
                  bgcolor: 'transparent', 
                  borderRadius: 2, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {instituteSettings?.logoUrl ? (
                    <Box component="img" src={instituteSettings.logoUrl} crossOrigin="anonymous" sx={{ width: '100%', height: 'auto', maxHeight: '100%' }} />
                  ) : (
                    <Box sx={{ width: '100%', height: '100%', bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <Shield size={32} />
                    </Box>
                  )}
                </Box>
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: '#3b82f6', letterSpacing: 2, display: 'flex', gap: 1, textTransform: 'uppercase', fontSize: '0.6rem', alignItems: 'center' }}>
                    {instituteSettings?.instituteName?.split(' ')[0] || 'MAKTAB'} <Box component="span" sx={{ opacity: 0.5 }}>|</Box> <Box component="span" sx={{ ...urduFontStyle, fontSize: '0.9rem', mt: -0.5 }}>مکتب</Box>
                  </Typography>
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 950, 
                      lineHeight: 1.1, 
                      color: '#0f172a', 
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {instituteSettings?.instituteName || 'Institutional Academy'}
                  </Typography>
                </Box>
              </Box>

              {/* Identity Portrait */}
              <Box sx={{ px: 4, pt: 3, pb: 3, display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ 
                  width: 140, 
                  height: 170, 
                  borderRadius: 3, 
                  border: '4px solid #fff', 
                  p: 0.5,
                  bgcolor: '#fff',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.08)',
                  position: 'relative'
                }}>
                  <Box sx={{ width: '100%', height: '100%', borderRadius: 2, overflow: 'hidden', bgcolor: '#f8fafc' }}>
                    {user.photoURL ? (
                      <Box component="img" src={user.photoURL} crossOrigin="anonymous" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, color: '#334155' }}>
                        <User size={80} />
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>

              {/* Primary Data - Clearer Vertical Spacing */}
              <Box sx={{ px: 4, flex: 1, mt: 1 }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 950, 
                    color: '#0f172a', 
                    textAlign: 'center', 
                    mb: 1.5, 
                    fontFamily: 'serif', 
                    letterSpacing: -0.5,
                    fontSize: '1.3rem',
                    lineHeight: 1.2
                  }}
                >
                  {user.displayName}
                </Typography>

                <Box sx={{ borderBottom: '2.5px solid #3b82f6', width: 40, mx: 'auto', mb: 2.5 }} />

                <Stack spacing={1.2}>
                   {[
                     { en: 'S/O', ur: 'ولدیت', value: user.fatherName || 'N/A' },
                     { en: 'CLASS', ur: 'جماعت', value: user.role === 'student' ? (user.classLevel || 'Active Student') : roleLabel },
                     { en: 'ID NO', ur: 'شناختی نمبر', value: idText },
                     { en: 'DOB', ur: 'تاریخِ پیدائش', value: user.dob || 'N/A' },
                     { en: 'PHONE', ur: 'موبائل', value: user.phone || 'N/A' }
                   ].map((item, i) => (
                     <Box key={i} sx={{ borderBottom: '1px solid #f1f5f9', pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ fontWeight: 950, color: '#64748b', fontSize: '0.45rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            {item.en} |&nbsp;
                          </Typography>
                          <Typography variant="caption" sx={{ ...urduFontStyle, color: '#64748b', fontSize: '0.6rem', mt: -0.8, whiteSpace: 'nowrap' }}>
                            {item.ur}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: '#0f172a', fontSize: '0.65rem', maxWidth: '65%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.value}
                        </Typography>
                     </Box>
                   ))}
                </Stack>
              </Box>

              {/* Compliance & Verification Footer */}
              <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 'auto', bgcolor: '#f8fafc' }}>
                <Box>
                  <Box sx={{ width: 90, height: 35, borderBottom: '1px solid #cbd5e1', mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                    {/* Principal Signature Area */}
                    <Typography variant="caption" sx={{ fontSize: '0.45rem', fontWeight: 800 }}>AUTHORIZED</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 950, fontSize: '0.55rem', color: '#64748b' }}>Superadmin Signature</Typography>
                </Box>
                <Box sx={{ p: 0.5, bgcolor: 'white', borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <QRCodeSVG value={verificationUrl} size={64} level="H" />
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* BACK SIDE */}
          <Paper 
            elevation={0}
            sx={{ 
              width: 350,
              height: 550,
              bgcolor: '#0f172a',
              borderRadius: 6,
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 25px 60px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              color: 'white',
              '@media print': {
                boxShadow: 'none',
                border: '1px solid #ddd'
              }
            }}
          >
            <Box sx={{ 
              position: 'absolute', 
              top: 0, left: 0, right: 0, bottom: 0, 
              opacity: 0.05, 
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />

            <Box sx={{ p: 4, position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
               <Box sx={{ mb: 5, textAlign: 'center' }}>
                 <Box sx={{ 
                   width: 70, height: 70, borderRadius: 2.5, bgcolor: alpha('#fff', 0.1), 
                   mx: 'auto', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' 
                 }}>
                   <Shield size={36} color={theme.palette.primary.main} />
                 </Box>
                 <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                   MAKTAB <Box component="span" sx={{ opacity: 0.3, fontWeight: 300 }}>|</Box> <Box component="span" sx={{ ...urduFontStyle, fontSize: '1.4rem', mt: -0.5 }}>مکتب</Box>
                 </Typography>
                 <Typography variant="caption" sx={{ opacity: 0.5, letterSpacing: 4, fontWeight: 800, textTransform: 'uppercase' }}>Identity Ecosystem</Typography>
               </Box>

               <Stack spacing={4}>
                 <Box>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 950, letterSpacing: 1.5, borderBottom: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.3), pb: 0.5, display: 'inline-block' }}>TERMS OF USAGE</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.7, fontSize: '0.75rem', mt: 2, lineHeight: 1.7, fontWeight: 500 }}>
                      This document is an official identity issued by {instituteSettings?.instituteName || 'Maktab'}. Loss must be reported immediately. Misuse is subject to disciplinary action. Please return to the address below if found.
                    </Typography>
                 </Box>

                 <Box>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 950, letterSpacing: 1.5, borderBottom: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.3), pb: 0.5, display: 'inline-block' }}>CONTACT UTILITIES</Typography>
                    <Stack spacing={2} sx={{ mt: 2.5 }}>
                       {[
                         { icon: Phone, text: instituteSettings?.phone || '+92 300 0000000', label: 'Support Line' },
                         { icon: Download, text: instituteSettings?.website || 'portal.maktab.academy', label: 'Web Portal' },
                         { icon: Shield, text: instituteSettings?.address || 'Pakistan', label: 'Campus HQ' }
                       ].map((item, i) => (
                         <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Box sx={{ color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1), p: 1, borderRadius: 1.5 }}><item.icon size={16} /></Box>
                            <Box>
                               <Typography variant="caption" sx={{ opacity: 0.4, display: 'block', textTransform: 'uppercase', fontSize: '0.55rem', fontWeight: 900 }}>{item.label}</Typography>
                               <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.75rem' }}>{item.text}</Typography>
                            </Box>
                         </Box>
                       ))}
                    </Stack>
                 </Box>

                 <Box sx={{ mt: 'auto', pt: 4, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.4, fontWeight: 700, letterSpacing: 1 }}>
                      SECURE DIGITAL VERIFICATION ACTIVE
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.2, fontSize: '0.5rem', mt: 1, fontFamily: 'monospace' }}>
                      UID: {user.uid}
                    </Typography>
                 </Box>
               </Stack>
            </Box>
            
            <Box sx={{ height: 12, bgcolor: 'primary.main', width: '100%' }} />
          </Paper>
        </Box>
      </Box>

      {/* Sticky Footer for Actions */}
      <Box sx={{ 
        position: 'sticky', 
        bottom: 0, 
        bgcolor: alpha(theme.palette.background.paper, 0.9), 
        backdropFilter: 'blur(10px)',
        zIndex: 100, 
        p: 2, 
        borderTop: '1px solid', 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'center',
        gap: 2,
        '@media print': { display: 'none' }
      }}>
        <Button 
          variant="outlined" 
          startIcon={<Printer size={18} />}
          onClick={handlePrint}
          sx={{ borderRadius: 3, fontWeight: 900, flex: 1, maxWidth: 200 }}
        >
          Print ID
        </Button>
        <Button 
          variant="contained" 
          disableElevation
          startIcon={downloading ? <CircularProgress size={14} color="inherit" /> : <Download size={18} />}
          onClick={handleDownload}
          disabled={downloading}
          sx={{ borderRadius: 3, fontWeight: 900, flex: 1, maxWidth: 200 }}
        >
          {downloading ? 'Preparing...' : 'Download Image'}
        </Button>
      </Box>
    </Dialog>
  );
}
