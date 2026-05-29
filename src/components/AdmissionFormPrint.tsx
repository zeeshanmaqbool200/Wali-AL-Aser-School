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
        fontFamily: "'Inter', 'serif', 'Noto Nastaliq Urdu'",
        position: 'relative',
        display: 'none', 
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box',
        px: '15mm',
        py: '15mm',
        '@media print': {
          display: 'block',
          boxShadow: 'none',
          p: '15mm',
          width: '100%',
        },
      }}
    >
      {/* Watermark Logo */}
      {settings?.logoUrl && (
        <Box sx={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          opacity: 0.05, 
          zIndex: 0,
          pointerEvents: 'none',
          width: 500,
          height: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img src={settings.logoUrl} crossOrigin="anonymous" alt="" style={{ width: '100%', height: 'auto', maxHeight: '100%', objectFit: 'contain' }} />
        </Box>
      )}

      {/* Header */}
      <Box sx={{ borderBottom: '2px solid #000', pb: 2, mb: 4, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid size={{ xs: 3 }}>
            {settings?.receiptLeftImageUrl ? (
              <img src={settings.receiptLeftImageUrl} crossOrigin="anonymous" alt="Left Header" style={{ width: '100%', height: '80px', objectFit: 'contain' }} />
            ) : settings?.logoUrl ? (
              <img src={settings.logoUrl} crossOrigin="anonymous" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            ) : null}
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, textTransform: 'uppercase' }}>{settings?.instituteName || 'AL-ASAR INSTITUTE'}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main' }}>{settings?.tagline || 'Knowledge is Light'}</Typography>
            <Typography variant="body2" sx={{ fontSize: '0.75rem', maxWidth: '80%', mx: 'auto' }}>{settings?.address}</Typography>
          </Grid>
          <Grid size={{ xs: 3 }}>
            {settings?.receiptRightImageUrl ? (
              <img src={settings.receiptRightImageUrl} crossOrigin="anonymous" alt="Right Header" style={{ width: '100%', height: '80px', objectFit: 'contain' }} />
            ) : (
              <Box sx={{ border: '1px solid #ccc', width: 90, height: 110, mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc' }}>
                {user.photoURL ? (
                  <img src={user.photoURL} crossOrigin="anonymous" alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Typography variant="caption" color="text.secondary">Passport Photo</Typography>
                )}
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Typography variant="h5" align="center" sx={{ fontWeight: 950, mb: 4, py: 1, borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
          ADMISSION RECORD FORM / <span style={{ fontFamily: "'Noto Nastaliq Urdu', serif", letterSpacing: 'normal', fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1' }}>رجسٹریشن فارم</span>
        </Typography>

        {/* Content Sections */}
        <Box sx={{ textAlign: 'left' }}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 6 }}>
              <DetailRow labelEn="Full Name of Candidate" labelUr="نام / Name" value={user.displayName} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <DetailRow labelEn="Admission ID Number" labelUr="داخلہ نمبر / Reg No" value={user.studentId || user.admissionNo} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <DetailRow labelEn="Father / Guardian Name" labelUr="ولدیت / Father's Name" value={user.fatherName} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <DetailRow labelEn="Mother Name" labelUr="والدہ کا نام" value={user.motherName} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <DetailRow labelEn="Date of Birth" labelUr="تاریخ پیدائش / D.O.B" value={user.dob} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <DetailRow labelEn="Admission Date" labelUr="داخلہ تاریخ / Date" value={user.admissionDate} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <DetailRow labelEn="Permanent Residential Address" labelUr="پتہ / Address" value={user.address} />
            </Grid>
            <Grid size={{ xs: 6 }}>
               <DetailRow labelEn="Contact Number" labelUr="فون نمبر / Contact" value={user.contactNumber || user.phone || user.whatsapp} />
            </Grid>
            <Grid size={{ xs: 6 }}>
               <DetailRow labelEn="Applied Class / Grade" labelUr="کلاس / Class" value={user.classLevel} />
            </Grid>
          </Grid>

          <Box sx={{ mt: 6 }}>
             <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, pb: 1, borderBottom: '2px solid #000', display: 'inline-block' }}>
               مقررہ نصاب / Subjects Enrolled
             </Typography>
             <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {(user.subjectsEnrolled || []).map(s => (
                  <Typography key={s} sx={{ px: 2, py: 1, border: '1px solid #ddd', borderRadius: 1.5, fontWeight: 700, bgcolor: '#f8fafc' }}>{s}</Typography>
                ))}
             </Box>
          </Box>
        </Box>

        {/* Declaration */}
        <Box sx={{ mt: 8, p: 3, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #eee' }}>
           <Typography variant="caption" sx={{ fontWeight: 950, display: 'block', mb: 1, color: 'primary.main' }}>DECLARATION / <span style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: '0.8rem', letterSpacing: 'normal', fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1' }}>اقرار نامہ</span></Typography>
           <Typography variant="body2" sx={{ fontSize: '0.7rem', lineHeight: 1.6, opacity: 0.8 }}>
             I hereby declare that the information provided above is correct to the best of my knowledge. I agree to abide by the rules and regulations of {settings?.instituteName || 'the institute'}.
           </Typography>
           <Typography variant="body2" sx={{ fontSize: '1rem', lineHeight: 2, opacity: 1, mt: 2, textAlign: 'right', fontFamily: "'Noto Nastaliq Urdu', serif", letterSpacing: 'normal', fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1' }}>
             میں اقرار کرتا ہوں کہ فراہم کردہ تمام معلومات درست ہیں۔ میں ادارے کے تمام قواعد و ضوابط کی مکمل پاسداری کرنے کا وعدہ کرتا ہوں۔
           </Typography>
        </Box>
      </Box>

      {/* Footer Info */}
      <Box sx={{ position: 'absolute', bottom: '20mm', left: '15mm', right: '15mm', zIndex: 1 }}>
        <Divider sx={{ mb: 4, borderColor: '#000', borderWidth: 1 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
          <Box sx={{ textAlign: 'center', width: 220 }}>
            <Box sx={{ height: 60, borderBottom: '2px solid #000', mb: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
               <Typography variant="caption" sx={{ opacity: 0.2 }}>Signature</Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.65rem' }}>Student/Guardian Signature</Typography>
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <QRCodeSVG value={verificationUrl} size={90} />
            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontWeight: 900, fontSize: '0.55rem' }}>OFFICIAL VERIFICATION QR</Typography>
          </Box>

          <Box sx={{ textAlign: 'center', width: 220 }}>
            <Box sx={{ height: 60, borderBottom: '2px solid #000', mb: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
               <Typography variant="caption" sx={{ opacity: 0.2 }}>Seal</Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.65rem' }}>Institute Seal & Signature</Typography>
          </Box>
        </Stack>
      </Box>

      {/* Vertical Side Label */}
      <Box sx={{ position: 'absolute', right: '2mm', top: '50%', transform: 'translateY(-50%) rotate(90deg)', opacity: 0.03 }}>
         <Typography variant="h1" sx={{ fontWeight: 950, whiteSpace: 'nowrap' }}>MAKTAB OFFICIAL RECORD</Typography>
      </Box>
    </Box>
  );
});

function DetailRow({ labelEn, labelUr, value }: { labelEn: string, labelUr: string, value?: string }) {
  return (
    <Box sx={{ mb: 3, borderBottom: '1px solid #ddd', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ textAlign: 'left' }}>
        <Typography variant="caption" sx={{ fontWeight: 950, color: '#666', textTransform: 'uppercase', fontSize: '0.6rem', display: 'block', mb: 0.5 }}>{labelEn}</Typography>
        <Typography variant="body1" sx={{ fontWeight: 800, color: '#000', fontSize: '1.1rem' }}>{value || '_______________________'}</Typography>
      </Box>
      <Box sx={{ textAlign: 'right', minWidth: '40%' }}>
         <Typography variant="body1" sx={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: '1.25rem', color: '#000', lineHeight: 1.8, letterSpacing: 'normal', fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1' }}>{labelUr}</Typography>
      </Box>
    </Box>
  );
}

export default AdmissionFormPrint;
