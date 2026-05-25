import React, { useRef } from 'react';
import { 
  Dialog, 
  Box, 
  Typography, 
  IconButton, 
  Button, 
  Stack, 
  Divider,
  Paper,
  Grid
} from '@mui/material';
import { X, Printer, Shield, Download } from 'lucide-react';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { alpha, useTheme } from '@mui/material/styles';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';

interface AdmissionFormModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile;
}

export default function AdmissionFormModal({ open, onClose, user }: AdmissionFormModalProps) {
  const theme = useTheme();
  const { instituteSettings } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!formRef.current) return;
    try {
      const canvas = await html2canvas(formRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Admission_Form_${user.displayName?.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating admission form image:', error);
    }
  };

  const Field = ({ label, value, urdu }: { label: string, value: any, urdu?: string }) => (
    <Box sx={{ pb: 0, flex: 1, minHeight: 50 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.2 }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
           {label} 
        </Typography>
        {urdu && (
          <Typography 
            dir="rtl" 
            sx={{ 
              fontSize: '1.25rem', 
              fontWeight: 500, 
              color: '#0f172a', 
              fontFamily: 'var(--font-urdu), "Noto Sans Arabic", serif',
              textAlign: 'right',
              lineHeight: 1,
              fontFeatureSettings: '"kern" 1, "liga" 1'
            }}
          >
             {urdu}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 950, color: '#0f172a', borderBottom: '1.5px solid #0f172a', width: '100%', pb: 0.5, minHeight: '1.8rem' }}>
         {value || '\u00A0'}
      </Typography>
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 2,
          bgcolor: '#f1f5f9',
          '@media print': {
            boxShadow: 'none',
            m: 0,
            width: '100%',
            maxWidth: 'none',
            bgcolor: 'white'
          }
        }
      }}
    >
      <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 10, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', '@media print': { display: 'none' } }}>
        <Typography variant="h6" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Shield size={20} color={theme.palette.primary.main} />
          Admission Form Preview
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button 
            startIcon={<Download size={18} />} 
            variant="outlined" 
            onClick={handleDownload} 
            sx={{ borderRadius: 2, fontWeight: 900 }}
          >
            Download
          </Button>
          <Button 
            startIcon={<Printer size={18} />} 
            variant="contained" 
            onClick={handlePrint} 
            sx={{ borderRadius: 2, fontWeight: 900 }}
          >
            Print
          </Button>
          <IconButton onClick={onClose}><X /></IconButton>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 1, md: 4 }, bgcolor: '#f1f5f9', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
        <Box 
          ref={formRef}
          sx={{ 
            width: '210mm', 
            minHeight: '297mm', 
            bgcolor: 'white', 
            p: 8, 
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
            position: 'relative',
            overflow: 'hidden',
            '@media print': {
              boxShadow: 'none',
              p: '20mm',
              width: '100%',
              minHeight: 'none'
            }
          }}
        >
          {/* Watermark Logo */}
          <Box sx={{ 
            position: 'absolute', 
            top: '55%', 
            left: '50%', 
            transform: 'translate(-50%, -50%) rotate(0deg)', 
            opacity: 0.04, 
            zIndex: 0,
            width: 450,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {instituteSettings?.admissionWatermarkImageUrl ? (
              <Box component="img" src={instituteSettings.admissionWatermarkImageUrl} sx={{ width: '100%' }} />
            ) : instituteSettings?.logoUrl ? (
              <Box component="img" src={instituteSettings.logoUrl} sx={{ width: '100%' }} />
            ) : (
              <Shield size={450} />
            )}
          </Box>

          <Box sx={{ position: 'relative', zIndex: 1, direction: 'ltr' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 6, borderBottom: '3px solid #0f172a', pb: 3 }}>
              {/* Left Logo */}
              <Box sx={{ width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {instituteSettings?.admissionLeftImageUrl ? (
                  <Box component="img" src={instituteSettings.admissionLeftImageUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : instituteSettings?.logoUrl ? (
                  <Box component="img" src={instituteSettings.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Shield size={70} strokeWidth={1.5} />
                )}
              </Box>

              <Box sx={{ textAlign: 'center', flex: 1, px: 2 }}>
                <Typography sx={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: -1.5, lineHeight: 1, color: '#0f172a', fontFamily: '"Outfit", sans-serif' }}>
                   {instituteSettings?.instituteName || 'Institutional Academy'}
                </Typography>
                <Box sx={{ mt: 1.5, display: 'inline-block', bgcolor: '#0f172a', px: 4, py: 0.75, borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: 'white', letterSpacing: 3 }}>
                     ADMISSION RECORD FORM
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, mt: 1.5, color: '#64748b' }}>
                   {instituteSettings?.address || 'Pakistan'}
                </Typography>
              </Box>

              {/* Right Logo */}
              <Box sx={{ width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {instituteSettings?.admissionRightImageUrl ? (
                  <Box component="img" src={instituteSettings.admissionRightImageUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : instituteSettings?.logoUrl ? (
                  <Box component="img" src={instituteSettings.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Shield size={70} strokeWidth={1.5} />
                )}
              </Box>
            </Box>

            {/* Photo & Basic Info Block */}
            <Grid container spacing={4} sx={{ mb: 6 }}>
              <Grid size={9}>
                <Stack spacing={3}>
                  <Field label="Full Name of Candidate" value={user.displayName} urdu="طالب علم کا نام" />
                  <Field label="Father's / Guardian Name" value={user.fatherName} urdu="والد / سرپرست کا نام" />
                  <Grid container spacing={3}>
                    <Grid size={6}><Field label="Date of Birth" value={user.dob} urdu="تاریخِ پیدائش" /></Grid>
                    <Grid size={6}><Field label="Admission No" value={user.admissionNo || user.studentId} urdu="داخلہ نمبر" /></Grid>
                  </Grid>
                </Stack>
              </Grid>
              <Grid size={3} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ 
                  width: 130, 
                  height: 160, 
                  border: '2px solid #0f172a', 
                  p: 0.5, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  bgcolor: '#f8fafc'
                }}>
                  {user.photoURL ? (
                    <Box component="img" src={user.photoURL} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textAlign: 'center', color: '#94a3b8' }}>
                      PASTE PHOTO<br/>HERE
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>

            {/* Rest of the form */}
            <Stack spacing={3} sx={{ mb: 6 }}>
              <Grid container spacing={3}>
                <Grid size={6}><Field label="Applied Class / Grade" value={user.classLevel} urdu="مجوزہ درجہ" /></Grid>
                <Grid size={6}><Field label="Session / Year" value={new Date().getFullYear()} urdu="تعلیمی سال" /></Grid>
              </Grid>
              <Grid container spacing={3}>
                <Grid size={6}><Field label="Contact Number" value={user.phone} urdu="رابطہ نمبر" /></Grid>
                <Grid size={6}><Field label="Alternate Number" value={user.whatsapp} urdu="متبادل نمبر" /></Grid>
              </Grid>
              <Field label="Residential Address" value={user.address} urdu="مکمل رہائشی پتہ" />
              <Field label="Last Institution Attended" value={user.qualifications} urdu="سابقہ درسگاہ" />
            </Stack>

            <Box sx={{ mt: 4, p: 3, border: '1px solid #0f172a', bgcolor: alpha('#f1f5f9', 0.5) }}>
              <Typography sx={{ fontWeight: 950, fontSize: '0.9rem', mb: 1.5, textAlign: 'center', textDecoration: 'underline' }}>DECLARATION & TERMS</Typography>
              <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.7, textAlign: 'justify', color: '#1e293b' }}>
                I hereby solemnly declare that the information provided is accurate. I agree to abide by the institution's discipline, academic protocols, and financial obligations. The administration reserves the right to cancel admission in case of violation.
                <Box component="span" dir="rtl" sx={{ display: 'block', mt: 1, fontWeight: 500, textAlign: 'right', fontSize: '1.1rem', fontFamily: 'var(--font-urdu), "Noto Sans Arabic", serif', lineHeight: 1.8, letterSpacing: 0 }}>
                  میں اقرار کرتا ہوں کہ فراہم کردہ تمام معلومات درست ہیں۔ میں ادارے کے تمام قوانین ، تعلیمی ضوابط اور مالی ذمہ داریوں کی مکمل پاسداری کرنے پر اتفاق کرتا ہوں۔ ادارہ خلاف ورزی کی صورت میں داخلہ منسوخ کرنے کا حق محفوظ رکھتا ہے۔
                </Box>
              </Typography>
            </Box>

            <Box sx={{ mt: 8, display: 'flex', justifyContent: 'space-between' }}>
               <Box sx={{ textAlign: 'center', pt: 8, borderTop: '1.5px solid #0f172a', width: 200 }}>
                 <Typography sx={{ fontWeight: 900, fontSize: '0.7rem' }}>CANDIDATE SIGNATURE</Typography>
               </Box>
               <Box sx={{ textAlign: 'center', pt: 8, borderTop: '1.5px solid #0f172a', width: 200 }}>
                 <Typography sx={{ fontWeight: 900, fontSize: '0.7rem' }}>PARENT/GUARDIAN SIGNATURE</Typography>
               </Box>
            </Box>

            <Paper elevation={0} sx={{ mt: 8, p: 3, border: '2px dashed #0f172a', borderRadius: 0 }}>
              <Typography sx={{ fontWeight: 950, fontSize: '1rem', mb: 2, textAlign: 'center', bgcolor: '#0f172a', color: 'white', py: 0.5 }}>OFFICE REGISTRATION RECORD</Typography>
              <Grid container spacing={3}>
                <Grid size={4}><Field label="Fee Receipt #" value="" /></Grid>
                <Grid size={4}><Field label="Account Status" value="PENDING" /></Grid>
                <Grid size={4}><Field label="Roll Number" value="" /></Grid>
              </Grid>
              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                 <Box sx={{ textAlign: 'center', pt: 4, borderTop: '1px solid #000', width: 150 }}>
                   <Typography sx={{ fontWeight: 800, fontSize: '0.6rem' }}>ADMISSION INCHARGE</Typography>
                 </Box>
                 <Box sx={{ p: 1, border: '1px solid #e2e8f0' }}>
                    <QRCodeSVG value={`MAKTAB:ADMISSION:${user.uid}`} size={80} />
                 </Box>
              </Box>
            </Paper>

            <Typography sx={{ mt: 6, textAlign: 'center', fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>
              Digitally Verified Record • Maktab Identity Ecosystem • {new Date().toLocaleDateString()}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
