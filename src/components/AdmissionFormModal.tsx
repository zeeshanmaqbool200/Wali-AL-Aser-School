import React, { useRef, useState, useEffect } from 'react';
import { 
  Dialog, 
  Box, 
  Typography, 
  IconButton, 
  Button, 
  Stack, 
  Divider,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import { X, Printer, Shield, Download, FileText, CreditCard, Award, GraduationCap, CheckCircle } from 'lucide-react';
import { UserProfile, FeeReceipt, Course } from '../types';
import { useAuth } from '../context/AuthContext';
import { alpha, useTheme } from '@mui/material/styles';
import { QRCodeSVG } from 'qrcode.react';
import * as htmlToImage from 'html-to-image';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../lib/logger';

interface AdmissionFormModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile;
}

export default function AdmissionFormModal({ open, onClose, user }: AdmissionFormModalProps) {
  const theme = useTheme();
  const { instituteSettings } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);
  const [feeHistory, setFeeHistory] = useState<FeeReceipt[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user.uid) {
      fetchExtraData();
    }
  }, [open, user.uid]);

  const fetchExtraData = async () => {
    setLoading(true);
    try {
      // Fetch Fee History
      const feeQ = query(collection(db, 'receipts'), where('studentId', '==', user.uid));
      const feeSnap = await getDocs(feeQ);
      setFeeHistory(feeSnap.docs.map(d => ({ id: d.id, ...d.data() } as FeeReceipt)));

      // Fetch Courses for Milestones
      const coursesQ = query(collection(db, 'courses'));
      const coursesSnap = await getDocs(coursesQ);
      setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    } catch (e) {
      console.error('Failed to fetch printing assets');
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!formRef.current) return;
    setLoading(true);
    try {
      // 1. Wait for fonts to be ready (essential for Urdu/Custom fonts)
      await document.fonts.ready;
      
      const originalElement = formRef.current;
      
      // 2. Capture a clean clone to avoid UI/Dialog artifacts
      const clone = originalElement.cloneNode(true) as HTMLElement;
      
      // 3. Force clean background and layout for capture context
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.padding = '0'; 
      clone.style.background = '#ffffff';
      clone.style.width = '210mm';
      clone.style.height = 'auto'; // Let it grow for multi-page
      clone.style.visibility = 'visible';
      clone.style.opacity = '1';
      
      // Ensure all MUI sub-components don't have artifacts
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el: any) => {
        el.style.boxShadow = 'none';
      });

      document.body.appendChild(clone);
      
      // 4. Small delay to ensure layout calculates correctly in the new DOM position
      await new Promise(resolve => setTimeout(resolve, 800));

      const dataUrl = await htmlToImage.toPng(clone, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipAutoScale: true,
        cacheBust: true,
        style: {
          transform: 'none',
          left: '0',
          top: '0'
        }
      });

      document.body.removeChild(clone);

      const link = document.createElement('a');
      link.download = `Admission_Record_${user.displayName?.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      logger.success('Admission record exported as Image');
    } catch (error) {
      console.error('Error generating image:', error);
      logger.error('Export failed');
    } finally {
      setLoading(false);
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
              fontFamily: '"Noto Nastaliq Urdu", serif',
              textAlign: 'right',
              lineHeight: 1.2,
              letterSpacing: 'normal',
              fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1'
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

      <Box sx={{ p: { xs: 1, md: 4 }, bgcolor: '#f1f5f9', overflowX: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Box 
          ref={formRef}
          sx={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            width: '210mm',
            '@media print': {
              width: '100%',
              gap: 0
            }
          }}
        >
          {/* PAGE 1: ADMISSION FORM */}
          <Box 
            sx={{ 
              width: '210mm', 
              minHeight: '297mm', 
              bgcolor: 'white', 
              p: 8, 
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden',
              pageBreakAfter: 'always',
              '@media print': {
                boxShadow: 'none',
                p: '20mm',
                width: '100%',
                minHeight: '297mm',
                border: 'none'
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
                <Box component="img" src={instituteSettings.admissionWatermarkImageUrl} sx={{ width: '100%' }} crossOrigin="anonymous" />
              ) : instituteSettings?.logoUrl ? (
                <Box component="img" src={instituteSettings.logoUrl} sx={{ width: '100%' }} crossOrigin="anonymous" />
              ) : (
                <Shield size={450} />
              ) }
            </Box>

            <Box sx={{ position: 'relative', zIndex: 1, direction: 'ltr', '@media print': { p: 0 } }}>
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, borderBottom: '2.5px solid #0f172a', pb: 2 }}>
                {/* Left Logo */}
                <Box sx={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {instituteSettings?.admissionLeftImageUrl ? (
                    <Box component="img" src={instituteSettings.admissionLeftImageUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
                  ) : instituteSettings?.logoUrl ? (
                    <Box component="img" src={instituteSettings.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
                  ) : (
                    <Shield size={60} strokeWidth={1.5} />
                  )}
                </Box>

                <Box sx={{ textAlign: 'center', flex: 1, px: 2 }}>
                  <Typography sx={{ fontSize: '1.8rem', fontWeight: 950, letterSpacing: -1, lineHeight: 1, color: '#0f172a', fontFamily: '"Outfit", sans-serif' }}>
                     {instituteSettings?.instituteName || 'Institutional Academy'}
                  </Typography>
                  <Box sx={{ mt: 1, display: 'inline-block', bgcolor: '#0f172a', px: 3, py: 0.5, borderRadius: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 900, color: 'white', letterSpacing: 2 }}>
                       ADMISSION RECORD
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mt: 1, color: '#64748b' }}>
                     {instituteSettings?.address || 'Kashmir, India'}
                  </Typography>
                </Box>

                {/* Right Logo */}
                <Box sx={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {instituteSettings?.admissionRightImageUrl ? (
                    <Box component="img" src={instituteSettings.admissionRightImageUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
                  ) : instituteSettings?.logoUrl ? (
                    <Box component="img" src={instituteSettings.logoUrl} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
                  ) : (
                    <Shield size={60} strokeWidth={1.5} />
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
                      <Box component="img" src={user.photoURL} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
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
                  <Box component="span" dir="rtl" sx={{ 
                    display: 'block', 
                    mt: 1, 
                    fontWeight: 500, 
                    textAlign: 'right', 
                    fontSize: '1.1rem', 
                    fontFamily: '"Noto Nastaliq Urdu", serif',
                    lineHeight: 1.8, 
                    letterSpacing: 'normal',
                    fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1'
                  }}>
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
                      <QRCodeSVG 
                        value={JSON.stringify({
                          type: 'ADMISSION',
                          uid: user.uid,
                          name: user.displayName,
                          id: user.studentId || user.admissionNo,
                          v: '1.0'
                        })} 
                        size={80} 
                      />
                   </Box>
                </Box>
              </Paper>

              <Typography sx={{ mt: 6, textAlign: 'center', fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>
                Digitally Verified Record • Maktab Identity Ecosystem • {new Date().toLocaleDateString()}
              </Typography>
            </Box>
          </Box>

          {/* PAGE 2: FINANCIAL RECORD */}
          <Box 
            sx={{ 
              width: '210mm', 
              minHeight: '297mm', 
              bgcolor: 'white', 
              p: 8, 
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              position: 'relative',
              pageBreakAfter: 'always',
              '@media print': {
                boxShadow: 'none',
                p: '20mm',
                width: '100%',
                minHeight: '297mm',
                border: 'none',
                mt: 10
              }
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4, pb: 2, borderBottom: '2px solid #0f172a' }}>
               <CreditCard size={32} />
               <Box>
                  <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: -1 }}>FINANCIAL LEDGER</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>Academic Session {new Date().getFullYear()}</Typography>
               </Box>
            </Stack>

            <TableContainer component={Box}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 900 }}>DATE</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>RECEIPT #</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>FEE HEAD</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>MODE</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900 }}>AMOUNT</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {feeHistory.length > 0 ? feeHistory.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{fee.date}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{fee.receiptNumber}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{fee.feeHead}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>{fee.paymentMode}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.95rem', fontWeight: 950 }}>₹{fee.amount}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 10, opacity: 0.3 }}>
                         No financial transactions recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                     <TableCell colSpan={4} align="right" sx={{ fontWeight: 900 }}>TOTAL PAID</TableCell>
                     <TableCell align="right" sx={{ fontWeight: 950, fontSize: '1.1rem', color: 'primary.main' }}>
                        ₹{feeHistory.reduce((sum, f) => sum + f.amount, 0)}
                     </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 10, p: 3, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
               <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Shield size={16} /> Audit Information
               </Typography>
               <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>• This statement includes all cleared payments as of {new Date().toLocaleString()}.</Typography>
               <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>• Pending receipts or bank transfers in transit may not be reflected.</Typography>
               <Typography variant="caption" sx={{ display: 'block' }}>• For discrepancies, please contact the finance office with reference IDs.</Typography>
            </Box>
          </Box>

          {/* PAGE 3: ACADEMIC MILESTONES (Lessons Learned) */}
          <Box 
            sx={{ 
              width: '210mm', 
              minHeight: '297mm', 
              bgcolor: 'white', 
              p: 8, 
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              position: 'relative',
              '@media print': {
                boxShadow: 'none',
                p: '20mm',
                width: '100%',
                minHeight: '297mm',
                border: 'none',
                mt: 10
              }
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4, pb: 2, borderBottom: '2px solid #0f172a' }}>
               <Award size={32} />
               <Box>
                  <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: -1 }}>ACADEMIC MILESTONES</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>Learning Progress Report</Typography>
               </Box>
            </Stack>

            <Stack spacing={3}>
              {Object.entries(user.readingProgress || {}).map(([courseId, progress]) => {
                const course = courses.find(c => c.id === courseId);
                if (!course) return null;

                return (
                  <Paper key={courseId} variant="outlined" sx={{ p: 3, borderRadius: 3, borderColor: '#e2e8f0' }}>
                     <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
                        <Box>
                           <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>{course.name}</Typography>
                           <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Course ID: {courseId}</Typography>
                        </Box>
                        <Chip 
                          label={progress.completedAt ? "COMPLETED" : "IN PROGRESS"} 
                          color={progress.completedAt ? "success" : "warning"}
                          size="small"
                          sx={{ fontWeight: 900, fontSize: '0.65rem' }}
                        />
                     </Stack>
                     
                     <Box sx={{ mt: 3 }}>
                        <Grid container spacing={2}>
                           <Grid size={4}>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, opacity: 0.5 }}>STATUS</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                {progress.completedAt ? 'GRADUATED' : 'STUDYING'}
                              </Typography>
                           </Grid>
                           <Grid size={4}>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, opacity: 0.5 }}>LAST LESSON</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                 Chapter {progress.lastPosition + 1}
                              </Typography>
                           </Grid>
                           <Grid size={4}>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, opacity: 0.5 }}>UPDATED ON</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                 {new Date(progress.updatedAt).toLocaleDateString()}
                              </Typography>
                           </Grid>
                        </Grid>
                     </Box>

                     {progress.completedAt && (
                       <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
                          <CheckCircle size={16} />
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 900 }}>Certificate Issued</Typography>
                       </Box>
                     )}
                  </Paper>
                );
              })}
              
              {(!user.readingProgress || Object.keys(user.readingProgress).length === 0) && (
                <Box sx={{ py: 10, textAlign: 'center', border: '1px dashed #e2e8f0', borderRadius: 4 }}>
                   <GraduationCap size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                   <Typography sx={{ fontWeight: 900, opacity: 0.3 }}>No academic materials explored yet.</Typography>
                </Box>
              )}
            </Stack>

            <Box sx={{ mt: 'auto', pt: 10, textAlign: 'center' }}>
               <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.4 }}>
                  MAKATEB ACADEMIC ECOSYSTEM • VERIFIED STUDENT TRANSCRIPT
               </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
