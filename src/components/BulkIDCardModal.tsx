import React, { useRef } from 'react';
import { Dialog, Box, Typography, Button, IconButton, Paper, Stack, useTheme, alpha } from '@mui/material';
import { X, Printer, Shield, Phone, Download } from 'lucide-react';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';

interface BulkIDCardModalProps {
  open: boolean;
  onClose: () => void;
  users: UserProfile[];
}

export default function BulkIDCardModal({ open, onClose, users }: BulkIDCardModalProps) {
  const theme = useTheme();
  const { instituteSettings } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Bulk_ID_Cards_${new Date().toLocaleDateString()}`,
  });

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg"
      fullWidth
      sx={{ 
        '& .MuiDialog-paper': { 
          borderRadius: 4,
          bgcolor: 'background.paper',
          m: { xs: 1, sm: 2 },
          maxHeight: '90vh'
        } 
      }}
    >
      <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 100, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', '@media print': { display: 'none' } }}>
        <Typography variant="h6" sx={{ fontWeight: 950, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Shield size={24} color={theme.palette.primary.main} />
          Bulk ID Card Generator ({users.length})
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button 
            variant="contained" 
            startIcon={<Printer size={18} />}
            onClick={handlePrint}
            sx={{ borderRadius: 3, fontWeight: 900 }}
          >
            Print All
          </Button>
          <IconButton onClick={onClose} sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main' }}>
            <X size={20} />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 4 }, bgcolor: '#f1f5f9' }}>
        <Box 
          ref={printRef} 
          sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            '@media print': {
              display: 'block',
              p: 0,
              m: 0
            }
          }}
        >
          {users.map((user, idx) => (
             <Box 
               key={user.uid}
               sx={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '10mm',
                  mb: '10mm',
                  pageBreakInside: 'avoid',
                  '@media print': {
                    mb: (idx + 1) % 4 === 0 ? 0 : '10mm',
                    pageBreakAfter: (idx + 1) % 4 === 0 ? 'always' : 'auto'
                  }
               }}
             >
               <SingleIDCard user={user} instituteSettings={instituteSettings} />
               <BackIDCard user={user} instituteSettings={instituteSettings} />
             </Box>
          ))}
        </Box>
      </Box>
    </Dialog>
  );
}

const SingleIDCard = ({ user, instituteSettings }: { user: UserProfile, instituteSettings: any }) => {
  const roleLabel = (user.role || 'student').replace('_', ' ').toUpperCase();
  const idText = user.admissionNo || user.studentId || user.staffId || 'PENDING';
  const verificationUrl = `${window.location.origin}/verify/member/${user.uid}`;
  const urduFontStyle = { fontFamily: "'Noto Nastaliq Urdu', serif", direction: 'rtl' as const };

  return (
    <Paper 
      elevation={0}
      sx={{ 
        width: '54mm',
        height: '86mm',
        bgcolor: 'white',
        borderRadius: '3mm',
        overflow: 'hidden',
        position: 'relative',
        border: '0.1pt solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        mb: 4,
        mx: 'auto',
        boxSizing: 'border-box',
        '@media print': {
          boxShadow: 'none',
          border: '1px solid #ddd',
          mb: '5mm',
          mt: 0,
          pageBreakInside: 'avoid'
        }
      }}
    >
      <Box sx={{ 
        position: 'absolute', 
        left: 0, 
        top: 0, 
        bottom: 0, 
        width: '10mm', 
        bgcolor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pt: 2,
        zIndex: 2
      }}>
         <Typography variant="caption" sx={{ 
           color: 'rgba(255,255,255,0.08)', 
           fontWeight: 950, 
           transform: 'rotate(-90deg) translateY(100%)', 
           transformOrigin: 'top left',
           whiteSpace: 'nowrap',
           fontSize: '0.6rem',
           mt: 18,
           fontFamily: 'serif',
           letterSpacing: 1
         }}>
           MAKTAB PORTAL SYSTEM
         </Typography>
      </Box>

      <Box sx={{ ml: '10mm', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, bgcolor: 'white' }}>
        <Box sx={{ p: 1, display: 'flex', gap: 1, alignItems: 'center', borderBottom: '1px solid', borderColor: '#f1f5f9', minHeight: '15mm' }}>
          <Box sx={{ width: '10mm', height: '10mm', bgcolor: 'transparent', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {instituteSettings?.logoUrl ? (
              <Box component="img" src={instituteSettings.logoUrl} crossOrigin="anonymous" sx={{ width: '100%', height: 'auto', maxHeight: '100%' }} />
            ) : (
              <Box sx={{ width: '100%', height: '100%', bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Shield size={16} /></Box>
            )}
          </Box>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="caption" sx={{ fontWeight: 900, color: '#3b82f6', letterSpacing: 1, display: 'flex', gap: 0.5, textTransform: 'uppercase', fontSize: '0.4rem', alignItems: 'center' }}>
              {instituteSettings?.instituteName?.split(' ')[0] || 'MAKTAB'} <Box component="span" sx={{ opacity: 0.5 }}>|</Box> <Box component="span" sx={{ ...urduFontStyle, fontSize: '0.65rem', mt: -0.5 }}>مکتب</Box>
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 950, lineHeight: 1.1, color: '#0f172a', fontSize: '0.55rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {instituteSettings?.instituteName}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ px: 2, pt: 1.5, pb: 1, display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '22mm', height: '28mm', borderRadius: 1, border: '1px solid #fff', p: 0.2, bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Box sx={{ width: '100%', height: '100%', borderRadius: 1, overflow: 'hidden', bgcolor: '#f8fafc' }}>
              {user.photoURL ? (
                <Box component="img" src={user.photoURL} crossOrigin="anonymous" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, color: '#334155' }}><Printer size={24} /></Box>
              )}
            </Box>
          </Box>
        </Box>

        <Box sx={{ px: 2, flex: 1, mt: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 950, color: '#0f172a', textAlign: 'center', mb: 0.5, fontFamily: 'serif', fontSize: '0.75rem', lineHeight: 1.2 }}>{user.displayName}</Typography>
          <Box sx={{ borderBottom: '1.5px solid #3b82f6', width: '8mm', mx: 'auto', mb: 1 }} />
          <Stack spacing={0.4}>
             {[
               { en: 'S/O', ur: 'ولدیت', value: user.fatherName || 'N/A' },
               { en: 'CLASS', ur: 'جماعت', value: user.role === 'student' ? (user.classLevel || 'Active Student') : roleLabel },
               { en: 'ID NO', ur: 'شناختی نمبر', value: idText },
               { en: 'DOB', ur: 'تاریخِ پیدائش', value: user.dob || 'N/A' },
               { en: 'PHONE', ur: 'موبائل', value: user.phone || 'N/A' }
             ].map((item, i) => (
               <Box key={i} sx={{ borderBottom: '0.1pt solid #f1f5f9', pb: 0.2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 950, color: '#64748b', fontSize: '0.35rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{item.en} |&nbsp;</Typography>
                    <Typography variant="caption" sx={{ ...urduFontStyle, color: '#64748b', fontSize: '0.45rem', mt: -0.5, whiteSpace: 'nowrap' }}>{item.ur}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: '#0f172a', fontSize: '0.38rem', maxWidth: '65%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</Typography>
               </Box>
             ))}
          </Stack>
        </Box>

        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 'auto', bgcolor: '#f8fafc' }}>
          <Box>
            <Box sx={{ width: '15mm', height: '6mm', borderBottom: '0.5pt solid #cbd5e1', mb: 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
              <Typography variant="caption" sx={{ fontSize: '0.3rem', fontWeight: 800 }}>AUTHORIZED</Typography>
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 950, fontSize: '0.35rem', color: '#64748b' }}>Superadmin Sign</Typography>
          </Box>
          <Box sx={{ p: 0.2, bgcolor: 'white', borderRadius: 0.5, border: '0.5pt solid #e2e8f0' }}>
            <QRCodeSVG value={verificationUrl} size={32} level="H" />
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

const BackIDCard = ({ user, instituteSettings }: { user: UserProfile, instituteSettings: any }) => {
  const theme = useTheme();
  return (
    <Paper 
      elevation={0}
      sx={{ 
        width: '54mm',
        height: '86mm',
        bgcolor: '#0f172a',
        borderRadius: '3mm',
        overflow: 'hidden',
        position: 'relative',
        border: '0.1pt solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        color: 'white',
        mb: 8,
        mx: 'auto',
        boxSizing: 'border-box',
        '@media print': {
          boxShadow: 'none',
          border: '1px solid #ddd',
          mb: '5mm',
          mt: 0,
          pageBreakInside: 'avoid'
        }
      }}
    >
      <Box sx={{ 
        position: 'absolute', 
        top: 0, left: 0, right: 0, bottom: 0, 
        opacity: 0.05, 
        backgroundImage: `radial-gradient(circle at 1px 1px, white 0.5px, transparent 0)`,
        backgroundSize: '8mm 8mm'
      }} />

      <Box sx={{ p: 2, position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
         <Box sx={{ mb: 2, textAlign: 'center' }}>
           <Box sx={{ 
             width: '12mm', height: '12mm', borderRadius: 1.5, bgcolor: alpha('#fff', 0.1), 
             mx: 'auto', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' 
           }}>
             <Shield size={24} color={theme.palette.primary.main} />
           </Box>
           <Typography variant="subtitle2" sx={{ fontWeight: 950, letterSpacing: 1, fontSize: '0.7rem' }}>MAKTAB</Typography>
           <Typography variant="caption" sx={{ opacity: 0.5, letterSpacing: 2, fontWeight: 800, textTransform: 'uppercase', fontSize: '0.35rem' }}>Identity Ecosystem</Typography>
         </Box>

         <Stack spacing={2}>
           <Box>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 950, letterSpacing: 1, borderBottom: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.3), pb: 0.2, display: 'inline-block', fontSize: '0.4rem' }}>TERMS OF USAGE</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, fontSize: '0.45rem', mt: 1, lineHeight: 1.5, fontWeight: 500 }}>
                This document is an official identity issued by {instituteSettings?.instituteName || 'Maktab Academy'}. Loss must be reported immediately. Misuse is subject to disciplinary action. Please return if found.
              </Typography>
           </Box>

           <Box>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 950, letterSpacing: 1, borderBottom: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.3), pb: 0.2, display: 'inline-block', fontSize: '0.4rem' }}>CONTACT UTILITIES</Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                 {[
                   { icon: Phone, text: instituteSettings?.phone || '+92 300 0000000', label: 'Support' },
                   { icon: Download, text: instituteSettings?.website || 'portal.maktab.academy', label: 'Portal' },
                   { icon: Shield, text: instituteSettings?.address || 'Pakistan', label: 'Address' }
                 ].map((item, i) => (
                   <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Box sx={{ color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1), p: 0.5, borderRadius: 1 }}><item.icon size={10} /></Box>
                      <Box sx={{ overflow: 'hidden' }}>
                         <Typography variant="caption" sx={{ opacity: 0.4, display: 'block', textTransform: 'uppercase', fontSize: '0.3rem', fontWeight: 900 }}>{item.label}</Typography>
                         <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.4rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block', overflow: 'hidden' }}>{item.text}</Typography>
                      </Box>
                   </Box>
                 ))}
              </Stack>
           </Box>

           <Box sx={{ mt: 'auto', pt: 1, borderTop: '0.5pt solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.4, fontWeight: 700, letterSpacing: 0.5, fontSize: '0.3rem' }}>
                SECURE DIGITAL VERIFICATION ACTIVE
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.2, fontSize: '0.3rem', mt: 0.2, fontFamily: 'monospace' }}>
                UID: {user.uid}
              </Typography>
           </Box>
         </Stack>
      </Box>
      <Box sx={{ height: 4, bgcolor: 'primary.main', width: '100%', mt: 'auto' }} />
    </Paper>
  );
};
