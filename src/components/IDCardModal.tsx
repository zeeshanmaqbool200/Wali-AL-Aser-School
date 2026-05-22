import React, { useRef, useState } from 'react';
import { Dialog, Box, Typography, Button, IconButton, Avatar, Paper, CircularProgress, Stack, useTheme, alpha } from '@mui/material';
import { X, Printer, User, Shield, Phone, GraduationCap, Download, QrCode } from 'lucide-react';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';

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

  if (!user) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      // Small delay to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // 2 is usually enough and more reliable than 3
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `ID-CARD-${user.displayName?.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error: any) {
      console.error('Failed to download ID card:', error);
      alert('Could not download image. Please try taking a screenshot or use Print.');
    } finally {
      setDownloading(false);
    }
  };

  const idText = user.admissionNo || user.studentId || user.teacherId || user.staffId || 'PENDING';
  const roleLabel = (user.role || 'student').replace('_', ' ').toUpperCase();
  const verificationUrl = `${window.location.origin}/verify/member/${user.uid}`;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      scroll="body"
      sx={{ 
        '& .MuiDialog-paper': { 
          m: { xs: 1, sm: 2 },
          borderRadius: 4,
          overflow: 'visible', // Allow QR code to overflow slightly if needed
          bgcolor: 'transparent',
          boxShadow: 'none'
        } 
      }}
    >
      <Box sx={{ position: 'relative', p: { xs: 2, sm: 3 }, bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f8f9fa', borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Shield size={20} color={theme.palette.primary.main} />
            Digital Member ID
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } }}>
            <X size={20} />
          </IconButton>
        </Stack>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box ref={cardRef} sx={{ width: '100%', maxWidth: 320, bgcolor: 'white', borderRadius: 4, p: 0.5 }}>
            <Paper 
              elevation={0}
              sx={{ 
                width: '100%', 
                borderRadius: 3.5,
                overflow: 'hidden',
                bgcolor: 'white',
                color: '#1a1a1a',
                position: 'relative',
                aspectRatio: '1 / 1.58',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #f0f0f0',
              }}
            >
              {/* Header / Branding */}
              <Box sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                bgcolor: 'primary.main', 
                color: 'white', 
                textAlign: 'center',
                position: 'relative'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontSize: '0.85rem', letterSpacing: -0.5, lineHeight: 1.2, textTransform: 'uppercase' }}>
                  {instituteSettings?.instituteName || 'MAKHTAB WALI UL ASER'}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.9, letterSpacing: 1, display: 'block', fontSize: '0.6rem' }}>
                  OFFICIAL IDENTITY CARD
                </Typography>
              </Box>

              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2.5, pt: 2, pb: 1.5 }}>
                {/* Photo */}
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <Avatar 
                    src={user.photoURL} 
                    imgProps={{ crossOrigin: 'anonymous' }}
                    sx={{ width: 100, height: 100, border: '4px solid white', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  >
                    <User size={50} />
                  </Avatar>
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 900, textAlign: 'center', mb: 0.5, fontSize: '1.2rem', color: '#000' }}>
                  {user.displayName}
                </Typography>
                
                <Box sx={{ px: 2, py: 0.5, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main', mb: 2.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: 1, fontSize: '0.65rem' }}>
                    {roleLabel}
                  </Typography>
                </Box>

                {/* Details Grid */}
                <Stack spacing={1.5} sx={{ width: '100%', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ p: 0.6, borderRadius: 1.2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                      <Shield size={14} />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.5, fontWeight: 800, lineHeight: 1, fontSize: '0.55rem' }}>ID NUMBER</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 900, fontSize: '0.8rem' }}>{idText}</Typography>
                    </Box>
                  </Box>
                  
                  {user.classLevel && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ p: 0.6, borderRadius: 1.2, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main', display: 'flex' }}>
                        <GraduationCap size={14} />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.5, fontWeight: 800, lineHeight: 1, fontSize: '0.55rem' }}>CLASS / LEVEL</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 900, fontSize: '0.8rem' }}>{user.classLevel}</Typography>
                      </Box>
                    </Box>
                  )}

                  {user.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ p: 0.6, borderRadius: 1.2, bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', display: 'flex' }}>
                        <Phone size={14} />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.5, fontWeight: 800, lineHeight: 1, fontSize: '0.55rem' }}>CONTACT</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.8rem' }}>{user.phone}</Typography>
                      </Box>
                    </Box>
                  )}
                </Stack>

                {/* QR Section */}
                <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 2, width: '100%', pt: 1.5, borderTop: '1px dashed #e0e0e0' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 900, color: 'primary.main', fontSize: '0.6rem' }}>
                      VERIFIED IDENTITY
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.6, fontSize: '0.55rem', mt: 0.2, lineHeight: 1.2 }}>
                      Scan QR at walilms.org to verify authentication profile.
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.5, bgcolor: 'white', border: '1px solid #eee', borderRadius: 1.5, display: 'flex', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <QRCodeSVG 
                      value={verificationUrl} 
                      size={54}
                      level="H"
                    />
                  </Box>
                </Box>
              </Box>

              {/* Footer */}
              <Box sx={{ py: 1, px: 2, bgcolor: '#fbfbfb', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 800, fontSize: '0.55rem', letterSpacing: 0.5 }}>
                  WALI LEARNING MANAGEMENT SYSTEM
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Box>

        <Stack direction="row" spacing={2}>
          <Button 
            fullWidth
            variant="outlined" 
            startIcon={<Printer size={18} />}
            onClick={handlePrint}
            sx={{ borderRadius: 3, fontWeight: 900, py: 1.2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
          >
            PRINT
          </Button>
          <Button 
            fullWidth
            variant="contained" 
            startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <Download size={18} />}
            onClick={handleDownload}
            disabled={downloading}
            sx={{ 
              borderRadius: 3, 
              fontWeight: 900, 
              py: 1.2,
              bgcolor: 'primary.main',
              boxShadow: alpha(theme.palette.primary.main, 0.3) + ' 0 8px 24px',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
          >
            {downloading ? 'SAVING...' : 'DOWNLOAD'}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
