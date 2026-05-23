import React from 'react';
import { Box, Typography, Grid, Divider, Stack } from '@mui/material';
import { ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile, InstituteSettings } from '../types';

interface Props {
  user: UserProfile;
  settings: InstituteSettings | null;
}

const AdmissionFormPrint = React.forwardRef<HTMLDivElement, Props>(({ user, settings }, ref) => {
  if (!user) return null;

  const verificationUrl = `https://${window.location.host}/verify/student/${user.studentId || user.uid}`;

  return (
    <Box 
      ref={ref} 
      className="a4-print-page"
      sx={{ 
        bgcolor: 'white',
        color: 'black',
        fontFamily: 'serif',
        position: 'relative',
        display: 'none', 
        '@media print': {
          display: 'block',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ border: '2px solid #000', p: 2, mb: 4, textAlign: 'center' }}>
        <Grid container alignItems="center">
          <Grid size={{ xs: 2 }}>
            {settings?.logoUrl && <img src={settings.logoUrl} alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />}
          </Grid>
          <Grid size={{ xs: 8 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>{settings?.instituteName || 'AL-ASAR INSTITUTE'}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{settings?.tagline || 'Knowledge is Light'}</Typography>
            <Typography variant="body2">{settings?.address}</Typography>
          </Grid>
          <Grid size={{ xs: 2 }}>
            <Box sx={{ border: '1px solid #ccc', width: 100, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Typography variant="caption" color="text.secondary">Passport Photo</Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>

      <Typography variant="h5" align="center" sx={{ fontWeight: 900, mb: 4, textDecoration: 'underline' }}>ADMISSION FORM / رجسٹریشن فارم</Typography>

      {/* RTL Content Sections */}
      <Box sx={{ dir: 'rtl', textAlign: 'right' }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 6 }}>
            <DetailRow label="نام / Name" value={user.displayName} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <DetailRow label="داخلہ نمبر / Reg No" value={user.studentId || user.admissionNo} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <DetailRow label="ولدیت / Father's Name" value={user.fatherName} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <DetailRow label="والدہ کا نام / Mother Name" value={user.motherName} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <DetailRow label="تاریخ پیدائش / D.O.B" value={user.dob} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <DetailRow label="داخلہ تاریخ / Date" value={user.admissionDate} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <DetailRow label="پتہ / Address" value={user.address} />
          </Grid>
          <Grid size={{ xs: 6 }}>
             <DetailRow label="فون نمبر / Contact" value={user.contactNumber || user.phone || user.whatsapp} />
          </Grid>
          <Grid size={{ xs: 6 }}>
             <DetailRow label="کلاس / Class" value={user.classLevel} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 6 }}>
           <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, borderBottom: '1px solid #000' }}>مقررہ نصاب / Subjects Enrolled</Typography>
           <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {(user.subjectsEnrolled || []).map(s => (
                <Typography key={s} sx={{ p: 1, border: '1px solid #ddd', borderRadius: 1 }}>{s}</Typography>
              ))}
           </Box>
        </Box>
      </Box>

      {/* Footer Info */}
      <Box sx={{ position: 'absolute', bottom: '40mm', left: '15mm', right: '15mm' }}>
        <Divider sx={{ mb: 4, borderColor: '#000' }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box sx={{ textAlign: 'center', width: 200 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Student/Guardian Signature</Typography>
            <Box sx={{ height: 60, borderBottom: '1px solid #000', mt: 2 }} />
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <QRCodeSVG value={verificationUrl} size={80} />
            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>Scan to Verify Admission</Typography>
          </Box>

          <Box sx={{ textAlign: 'center', width: 200 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Institute Seal & Signature</Typography>
            <Box sx={{ height: 60, borderBottom: '1px solid #000', mt: 2 }} />
            <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main' }}>Approved by Administration</Typography>
          </Box>
        </Stack>
      </Box>

      {/* Vertical Side Label */}
      <Box sx={{ position: 'absolute', right: '5mm', top: '100mm', transform: 'rotate(90deg)', opacity: 0.1 }}>
         <Typography variant="h2" sx={{ fontWeight: 900 }}>OFFICIAL RECORD</Typography>
      </Box>
    </Box>
  );
});

function DetailRow({ label, value }: { label: string, value?: string }) {
  return (
    <Box sx={{ mb: 1.5, borderBottom: '1px dotted #ccc', pb: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 950, color: '#444' }}>{label}:</Typography>
      <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.5 }}>{value || '_______________________'}</Typography>
    </Box>
  );
}

export default AdmissionFormPrint;
