import React, { useRef, useState } from 'react';
import { Dialog, Box, Typography, Button, IconButton, Avatar, Paper, CircularProgress, Stack, Grid, useTheme, alpha, Chip } from '@mui/material';
import { X, Printer, User, Shield, Phone, GraduationCap, Download, QrCode } from 'lucide-react';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

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
      // Small delay to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 3, // High scale for crisp download
        logging: false,
        backgroundColor: '#ffffff',
        width: 638,
        height: 404,
        onclone: (clonedDoc) => {
          // Reset any responsive scaling for the capture
          const card = clonedDoc.querySelector('#printable-card-content');
          if (card) {
            (card as HTMLElement).style.transform = 'none';
          }
        }
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `ID-CARD-${(user.displayName || 'MEMBER').replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error: any) {
      console.error('Failed to download ID card:', error);
    } finally {
      setDownloading(false);
    }
  };

  const verificationUrl = `${window.location.origin}/verify/member/${user?.uid}`;

  if (!user) return null;

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
          alignItems: { xs: 'center', sm: 'center' }
        },
        '& .MuiDialog-paper': { 
          borderRadius: 2,
          bgcolor: 'transparent',
          boxShadow: 'none',
          overflow: 'visible',
          m: { xs: 1, sm: 2 },
          width: 'auto',
          maxWidth: '100vw'
        } 
      }}
    >
      <Box sx={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', mb: 1 }}>
           <IconButton 
            onClick={onClose} 
            sx={{ 
              bgcolor: 'white', 
              color: 'text.primary', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              borderRadius: 1,
              '&:hover': { bgcolor: '#f0f0f0' } 
            }}
          >
            <X size={20} />
          </IconButton>
        </Box>

        <Box sx={{ 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'center', 
          mb: 4,
          overflow: 'visible'
        }}>
          {/* CR80 Standard Horizontal Ratio: 1.58:1 (approx 638x404 px) */}
          <Box 
            id="printable-card-content"
            ref={cardRef} 
            sx={{ 
              width: 638,
              height: 404,
              background: '#fff',
              borderRadius: 1.5, 
              overflow: 'hidden',
              boxShadow: '0 30px 90px rgba(0,0,0,0.4)',
              display: 'flex',
              position: 'relative',
              userSelect: 'none',
              transform: { xs: 'scale(0.5)', sm: 'scale(0.8)', md: 'scale(1)' },
              transformOrigin: 'center center',
              flexShrink: 0,
              // Add a fixed aspect ratio wrapper for CSS layout to reserve space
              my: { xs: -10, sm: -4, md: 0 },
              '@media print': {
                transform: 'none',
                boxShadow: 'none',
                border: '1px solid #ccc',
                position: 'fixed',
                top: '50mm',
                left: '50mm',
                zIndex: 9999
              }
            }}
          >
            {/* Left accent bar with gradient */}
            <Box sx={{ width: 18, height: '100%', background: `linear-gradient(to bottom, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` }} />
            
            {/* Main content area */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Header Section */}
              <Box sx={{ 
                p: { xs: 2, sm: 3 }, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1.5px solid rgba(0,0,0,0.04)',
                bgcolor: alpha(theme.palette.primary.main, 0.02)
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {instituteSettings?.logoUrl ? (
                    <Box 
                      component="img" 
                      src={instituteSettings.logoUrl} 
                      crossOrigin="anonymous"
                      sx={{ height: 44, width: 'auto', maxHeight: 44 }} 
                    />
                  ) : (
                    <Shield size={32} color={theme.palette.primary.main} />
                  )}
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 950, fontSize: { xs: '0.8rem', sm: '1.1rem' }, color: '#000', lineHeight: 1, mb: 0.5 }}>
                      {instituteSettings?.instituteName || 'WALI ACADEMY'}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: 2, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      Identity Tracking System
                    </Typography>
                  </Box>
                </Box>
                <Chip label={roleLabel} size="small" variant="filled" sx={{ fontWeight: 950, letterSpacing: 1, height: 24, borderRadius: 1, fontSize: '0.6rem' }} />
              </Box>

              {/* Identity Section */}
              <Box sx={{ flex: 1, p: { xs: 2, sm: 4 }, display: 'flex', gap: { xs: 2, sm: 4 }, alignItems: 'center' }}>
                 {/* Profile Photo */}
                 <Box sx={{ position: 'relative' }}>
                    <Box sx={{ 
                      width: { xs: 90, sm: 160 }, 
                      height: { xs: 90, sm: 180 },
                      borderRadius: 1,
                      border: '4px solid #fff',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      overflow: 'hidden',
                      bgcolor: '#f8fafc'
                    }}>
                      {user.photoURL ? (
                        <Box 
                          component="img"
                          src={user.photoURL}
                          crossOrigin="anonymous"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: alpha(theme.palette.primary.main, 0.2) }}>
                          <User size={80} />
                        </Box>
                      )}
                    </Box>
                 </Box>

                 {/* Information Details */}
                 <Stack spacing={2} sx={{ flex: 1 }}>
                    <Box>
                      <Typography variant="h4" sx={{ 
                        fontWeight: 950, 
                        color: '#1e293b', 
                        fontSize: { xs: '1.3rem', sm: '2.2rem' }, 
                        letterSpacing: -1.5,
                        lineHeight: 1,
                        mb: 1
                      }}>
                        {user.displayName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1), px: 1, borderRadius: 0.5 }}>
                          ID NUM: {idText}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Stack spacing={1.5}>
                       {[
                         { icon: Phone, label: 'Contact', value: user.phone || 'N/A' },
                         { icon: GraduationCap, label: 'Status', value: user.classLevel || user.role || 'Member' }
                       ].map((item, i) => (
                         <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                           <Box sx={{ display: 'flex', color: 'text.secondary', opacity: 0.5 }}>
                             <item.icon size={16} />
                           </Box>
                           <Box>
                             <Typography variant="caption" sx={{ display: 'block', fontWeight: 900, fontSize: '0.6rem', color: 'text.secondary', textTransform: 'uppercase' }}>{item.label}</Typography>
                             <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1 }}>{item.value}</Typography>
                           </Box>
                         </Box>
                       ))}
                    </Stack>
                 </Stack>

                 {/* Vertical QR Section */}
                 <Box sx={{ 
                   p: 1.5, 
                   bgcolor: '#f8fafc', 
                   borderRadius: 1, 
                   border: '1.5px solid #e2e8f0',
                   display: 'flex', 
                   flexDirection: 'column', 
                   alignItems: 'center',
                   gap: 1
                 }}>
                    <QRCodeSVG value={verificationUrl} size={84} level="H" includeMargin={true} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ fontSize: '0.55rem', fontWeight: 950, color: '#64748b', display: 'block', lineHeight: 1 }}>VERIFY</Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.45rem', fontWeight: 700, color: '#94a3b8' }}>SCAN QR</Typography>
                    </Box>
                 </Box>
              </Box>

              {/* Footer Section */}
              <Box sx={{ 
                px: 3, py: 1.5, 
                bgcolor: '#f1f5f9', 
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <QrCode size={14} color="#64748b" />
                    <Typography variant="caption" sx={{ fontWeight: 900, color: '#64748b', letterSpacing: 0.5, fontSize: '0.6rem' }}>
                      DIGITAL IDENTITY PORTAL VALIDATION
                    </Typography>
                 </Box>
                 <Typography variant="caption" sx={{ fontWeight: 800, color: '#94a3b8', fontSize: '0.6rem' }}>
                   Ref: {user.uid?.slice(0, 8).toUpperCase()}
                 </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Stack direction="row" spacing={2} justifyContent="center" sx={{ px: 2, pb: { xs: 12, sm: 6 }, width: '100%', maxWidth: 500 }}>
          <Button 
            variant="outlined" 
            fullWidth
            startIcon={<Printer size={16} />}
            onClick={handlePrint}
            sx={{ 
              borderRadius: 0.5, color: 'white', borderColor: 'rgba(255,255,255,0.3)', 
              fontWeight: 900, px: 2, py: 1, backdropFilter: 'blur(10px)',
              fontSize: { xs: '0.65rem', sm: '0.75rem' },
              '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            PRINT
          </Button>
          <Button 
            variant="contained" 
            fullWidth
            disableElevation
            startIcon={downloading ? <CircularProgress size={14} color="inherit" /> : <Download size={16} />}
            onClick={handleDownload}
            disabled={downloading}
            sx={{ 
              borderRadius: 0.5, bgcolor: 'primary.main', fontWeight: 900, px: 2, py: 1,
              boxShadow: theme.shadows[4],
              fontSize: { xs: '0.65rem', sm: '0.75rem' },
              '&:hover': { bgcolor: 'primary.dark' }
            }}
          >
            {downloading ? 'WAIT...' : 'SAVE IMAGE'}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
