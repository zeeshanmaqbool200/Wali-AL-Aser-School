import React, { memo, useState, useEffect, useRef } from 'react';
import { 
  Dialog, DialogContent, Box, Typography, Button, Divider, 
  Grid, IconButton, Chip, DialogActions, useMediaQuery,
  Stack, CircularProgress
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Printer, Download, X, FileText, CheckCircle, Clock, QrCode } from 'lucide-react';
import { FeeReceipt, InstituteSettings } from '../types';
import { numberToIndianWords } from '../lib/indianNumberSystem';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import QRCode from 'qrcode';
import { 
  Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image, Font 
} from '@react-pdf/renderer';

// Register fonts that support Unicode characters like ₹ and Roman Urdu
Font.register({
  family: 'Noto Sans',
  src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@master/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
});

Font.register({
  family: 'Noto Sans Bold',
  src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@master/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
});

const pdfStyles = StyleSheet.create({
  page: {
    padding: 35,
    fontFamily: 'Noto Sans',
    backgroundColor: '#FFFFFF',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottom: '2pt solid #0d9488',
    paddingBottom: 15,
    width: '100%',
  },
  logo: {
    width: 65,
    height: 65,
    objectFit: 'contain',
  },
  headerText: {
    marginLeft: 15,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  instituteName: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#0d9488',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  instituteSubtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#0f766e',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  address: {
    fontSize: 8.5,
    color: '#4b5563',
    lineHeight: 1.4,
    width: '100%',
  },
  receiptMeta: {
    textAlign: 'right',
    width: 140,
    marginLeft: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  receiptTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#F3F4F6',
    marginBottom: 6,
    letterSpacing: 4,
  },
  receiptNo: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#0d9488',
  },
  date: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    marginTop: 15,
    gap: 20,
  },
  detailColumn: {
    flex: 1,
  },
  label: {
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
  },
  subValue: {
    fontSize: 9,
    color: '#4b5563',
    marginTop: 2,
  },
  table: {
    width: '100%',
    marginVertical: 15,
    border: '0.5pt solid #E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    padding: 10,
    borderBottom: '0.5pt solid #E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottom: '0.5pt solid #f3f4f6',
  },
  tableFooter: {
    backgroundColor: '#f0f9f9',
    flexDirection: 'row',
    padding: 12,
  },
  colDesc: { flex: 4 },
  colAmount: { flex: 1.5, textAlign: 'right' },
  wordsBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 6,
    border: '0.5pt solid #E5E7EB',
    marginTop: 10,
  },
  footer: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureBox: {
    borderTop: '1pt solid #E5E7EB',
    width: 150,
    paddingTop: 8,
    textAlign: 'center',
  },
  signatureLabel: {
    fontSize: 6.5,
    color: '#4b5563',
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    textTransform: 'uppercase',
  },
  qrCodeBox: {
    width: 50,
    height: 50,
    border: '0.5pt solid #E5E7EB',
    padding: 3,
  },
  verifiedStamp: {
    textAlign: 'center',
    marginBottom: 8,
  },
  verifiedText: {
    fontSize: 7,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#22c55e',
    letterSpacing: 0.5,
  },
  verifiedBy: {
    fontSize: 5,
    color: '#6b7280',
    marginTop: 0.5,
  },
  disclaimer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 6,
    color: '#9ca3af',
    borderTop: '0.5pt solid #f3f4f6',
    paddingTop: 8,
    lineHeight: 1.2,
  }
});

const ReceiptPDF = ({ receipt, settings, qrCodeUrl }: { receipt: FeeReceipt, settings: InstituteSettings, qrCodeUrl?: string }) => (
  <Document title={`Receipt_${receipt.receiptNo || receipt.receiptNumber}`}>
    <Page size="A4" style={pdfStyles.page}>
      {/* Watermark Logo */}
      <View style={{ position: 'absolute', top: '35%', left: '20%', right: '20%', opacity: 0.05, zIndex: -2 }}>
        {settings.logoUrl && (
          <Image src={settings.logoUrl} style={{ width: '100%', height: 'auto' }} />
        )}
      </View>

      <View style={pdfStyles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {settings.receiptLeftImageUrl && (
            <View style={{ width: 60, height: 60, marginRight: 10, justifyContent: 'center' }}>
              <Image src={settings.receiptLeftImageUrl} style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            </View>
          )}
          <View style={pdfStyles.headerText}>
            <Text style={pdfStyles.instituteName}>{settings.name}</Text>
            <Text style={pdfStyles.instituteSubtitle}>{settings.instituteName}</Text>
            <Text style={pdfStyles.address}>{settings.address}</Text>
            <Text style={pdfStyles.address}>Ph: {settings.phone} • {settings.email}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
            {settings.receiptRightImageUrl ? (
              <Image src={settings.receiptRightImageUrl} style={{ width: 60, height: 60, objectFit: 'contain' }} />
            ) : null}
          </View>
        </View>
        <View style={pdfStyles.receiptMeta}>
          <Text style={pdfStyles.receiptTitle}>RECEIPT</Text>
          <Text style={pdfStyles.receiptNo}>No: {receipt.receiptNo || receipt.receiptNumber}</Text>
          <Text style={pdfStyles.date}>Date: {format(new Date(receipt.date), 'dd MM yyyy')}</Text>
        </View>
      </View>

      <View style={pdfStyles.detailsGrid}>
        <View style={pdfStyles.detailColumn}>
          <Text style={pdfStyles.label}>Student Details</Text>
          <Text style={[pdfStyles.value, { fontSize: 13 }]}>{receipt.studentName}</Text>
          <Text style={pdfStyles.subValue}>Admission No: {receipt.studentOfficialId || receipt.studentId}</Text>
          <Text style={pdfStyles.subValue}>Class Level: {receipt.classLevel || 'N/A'}</Text>
        </View>
        <View style={[pdfStyles.detailColumn, { textAlign: 'right' }]}>
          <Text style={pdfStyles.label}>Payment Details</Text>
          <Text style={[pdfStyles.value, { color: '#0d9488' }]}>{(receipt.status || 'approved').toUpperCase()}</Text>
          <Text style={pdfStyles.subValue}>Mode: {receipt.paymentMode}</Text>
          {receipt.transactionId && (
            <Text style={pdfStyles.subValue}>Ref: {receipt.transactionId}</Text>
          )}
        </View>
      </View>

      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.colDesc, { fontSize: 8, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>DESCRIPTION</Text>
          <Text style={[pdfStyles.colAmount, { fontSize: 8, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>AMOUNT</Text>
        </View>
        <View style={pdfStyles.tableRow}>
          <View style={pdfStyles.colDesc}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }}>{receipt.feeHead}</Text>
            <Text style={{ fontSize: 8, color: '#4b5563', marginTop: 4 }}>{receipt.remarks || 'Standard fee payment for the current academic session.'}</Text>
          </View>
          <Text style={[pdfStyles.colAmount, { fontSize: 11, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>Rs.{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={pdfStyles.tableFooter}>
          <Text style={[pdfStyles.colDesc, { textAlign: 'right', fontSize: 10, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>TOTAL PAID AMOUNT</Text>
          <Text style={[pdfStyles.colAmount, { fontSize: 11, fontWeight: 'bold', fontFamily: 'Noto Sans Bold', color: '#0d9488' }]}>Rs.{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View style={[pdfStyles.wordsBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>Amount in Words</Text>
          <Text style={{ fontSize: 10, fontWeight: 'bold', fontFamily: 'Noto Sans Bold', textTransform: 'capitalize', marginTop: 4 }}>
            {numberToIndianWords(receipt.amount)}
          </Text>
        </View>
        {qrCodeUrl && (
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={[pdfStyles.label, { marginBottom: 4 }]}>SECURE SCAN</Text>
            <Image src={qrCodeUrl} style={pdfStyles.qrCodeBox} />
          </View>
        )}
      </View>

      <View style={pdfStyles.footer}>
        <View style={pdfStyles.signatureBox}>
          <Text style={pdfStyles.signatureLabel}>Student Signature</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          {receipt.status === 'approved' && (
            <View style={pdfStyles.verifiedStamp}>
              <Text style={pdfStyles.verifiedText}>DIGITALLY VERIFIED</Text>
              <Text style={pdfStyles.verifiedBy}>By {receipt.approvedByName || 'System'}</Text>
            </View>
          )}
          <View style={pdfStyles.signatureBox}>
            <Text style={pdfStyles.signatureLabel}>Authorized Signature</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <Text style={pdfStyles.disclaimer}>
        This is a computer-generated document. No physical signature is required for digitally verified receipts.
        {"\n"}© {new Date().getFullYear()} {settings.name}. All Rights Reserved.
      </Text>
    </Page>
  </Document>
);

interface FeeReceiptModalProps {
  open: boolean;
  onClose: () => void;
  receipt: FeeReceipt | null;
  settings?: InstituteSettings;
}

const defaultSettings: InstituteSettings = {
  name: 'EDUFEE TRACK',
  instituteName: 'Wali Ul Aser Institute',
  tagline: 'First Step Towards Building Taqwa',
  address: 'Banpora Chattergam 191113, Kashmir',
  phone: '+91 7006123456',
  email: 'idarahwaliulaser@gmail.com',
  logoUrl: 'https://idarahwaliulaser.netlify.app/img/logo.png',
  primaryColor: '#0d9488',
  secondaryColor: '#0f766e',
  website: 'idarahwaliulaser.netlify.app',
  receiptPrefix: 'WUA',
  mission: 'Mission of Sayyed Mustafa Hamadani RA. Bringing Innovative and authentic Islamic knowledge and holding new competitions to boost interests of Gen-Z and Gen-X students.',
  founded: '2005',
  greeting: 'Asslamualikum',
  team: {
    chairman: '',
    financeManager: '',
    supervisor: '',
    organizer: '',
    secretary: '',
    mediaConsultant: '',
    socialMediaManager: '',
    mediaIncharge: ''
  },
  id: 'default'
};

const FeeReceiptModal = memo(({ open, onClose, receipt, settings: propSettings }: FeeReceiptModalProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const settings = propSettings || defaultSettings;
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  
  useEffect(() => {
    if (receipt) {
      // Generate QR code content (verification link)
      const verificationLink = `https://${window.location.host}/verify/receipt/${receipt.receiptNo || receipt.id}`;
      QRCode.toDataURL(verificationLink, {
        margin: 1,
        width: 200,
        color: {
          dark: '#0d9488',
          light: '#ffffff',
        },
      }).then(url => setQrCodeUrl(url));
    }
  }, [receipt]);

  if (!receipt) return null;

  const receiptNo = receipt.receiptNo || receipt.receiptNumber;
  const contentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Receipt_${receiptNo}`,
  });

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      PaperProps={{ 
        sx: { 
          borderRadius: { xs: 0, sm: 4 },
          m: { xs: 0, sm: 2 },
          p: isMobile ? 0 : 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          '@media print': {
            m: 0,
            p: 0,
            boxShadow: 'none',
            borderRadius: 0,
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            overflow: 'visible',
            position: 'absolute',
            top: 0,
            left: 0,
          }
        } 
      }}
    >
      <Box sx={{ 
        p: { xs: 1, sm: 2 }, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid', 
        borderColor: 'divider',
        bgcolor: 'background.paper',
        '@media print': { display: 'none' }
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ p: 0.8, borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <FileText size={isMobile ? 14 : 18} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5, fontSize: { xs: '0.9rem', sm: '1.1rem' } }}>
            Official Receipt - {receiptNo}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <X size={18} />
        </IconButton>
      </Box>

      <DialogContent sx={{ 
        p: { xs: 1, sm: 3 }, 
        bgcolor: 'background.default',
        '@media print': { p: 0, m: 0, bgcolor: 'white', overflow: 'visible' }
      }}>
        <Box 
          id="printable-receipt"
          className="receipt-container"
          ref={contentRef}
          sx={{ 
            bgcolor: 'white', 
            p: { xs: 2, sm: 3 }, 
            borderRadius: 1, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            maxWidth: '800px',
            width: '100%',
            mx: 'auto',
            position: 'relative',
            overflow: 'visible', // Changed from hidden to allow content to flow naturally
            border: '1px solid #e5e7eb',
            '& *': { color: '#000000 !important', wordBreak: 'keep-all' }, // Unified word breaking rule
            '@media print': {
              boxShadow: 'none',
              border: 'none',
              p: '20px',
              width: '100%',
              pageBreakInside: 'avoid',
              overflow: 'visible',
            }
          }}
        >
          {/* Watermark Logo */}
          <Box sx={{ 
            position: 'absolute', 
            top: '55%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            width: '70%', 
            opacity: 0.05, 
            pointerEvents: 'none', 
            zIndex: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Box component="img" src={settings.logoUrl} sx={{ width: '100%', height: 'auto', filter: 'grayscale(100%) brightness(1.2)' }} />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, borderBottom: '2.5px solid #0d9488', pb: 2, position: 'relative', zIndex: 1 }}>
            <Box sx={{ width: { xs: 50, sm: 90 }, flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
              {settings.receiptLeftImageUrl && (
                <Box component="img" src={settings.receiptLeftImageUrl} sx={{ width: '100%', height: 'auto', maxHeight: 85, objectFit: 'contain' }} />
              )}
            </Box>
            
            <Box sx={{ flex: 1, textAlign: 'center', px: 2 }}>
              <Typography variant="h5" sx={{ 
                fontWeight: 900, 
                color: '#0d9488 !important', 
                lineHeight: 1.1, 
                fontFamily: 'var(--font-serif)', 
                textTransform: 'uppercase', 
                fontSize: { xs: '1.2rem', sm: '1.9rem' },
                mb: 0.5
              }}>
                {settings.name}
              </Typography>
              <Typography variant="subtitle1" sx={{ 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                fontSize: { xs: '0.75rem', sm: '1rem' }, 
                color: '#0f766e !important',
                mb: 1
              }}>
                {settings.instituteName}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.85rem' }, display: 'block', color: '#4b5563 !important', lineHeight: 1.3, fontWeight: 600 }}>
                {settings.address}
                <br />
                Ph: {settings.phone} • {settings.email}
              </Typography>
            </Box>

            <Box sx={{ width: { xs: 60, sm: 95 }, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
              {settings.receiptRightImageUrl ? (
                <Box component="img" src={settings.receiptRightImageUrl} sx={{ width: '100%', height: 'auto', maxHeight: 85, objectFit: 'contain' }} />
              ) : null}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, zIndex: 1, position: 'relative' }}>
            <Box>
              <Typography variant="h4" sx={{ 
                fontWeight: 900, 
                color: '#e5e7eb !important', 
                letterSpacing: { xs: 4, sm: 8 }, 
                fontFamily: 'var(--font-serif)', 
                lineHeight: 1,
                fontSize: { xs: '1.5rem', sm: '2.5rem' }
              }}>
                RECEIPT
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0d9488 !important', mt: 1, fontSize: { xs: '0.9rem', sm: '1.1rem' } }}>
                No: {receiptNo}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#6b7280 !important', mt: 0.5 }}>
                Date: {format(new Date(receipt.date), 'dd MM yyyy')}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Chip 
                label={(receipt.status || 'approved').toUpperCase()} 
                color={receipt.status === 'approved' ? 'success' : 'warning'} 
                size="small" 
                sx={{ fontWeight: 900, borderRadius: 1 }}
              />
            </Box>
          </Box>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={6}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important', letterSpacing: 0.5 }}>STUDENT DETAILS</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.5 }}>{receipt.studentName}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>ID: {receipt.studentOfficialId || receipt.studentId}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Class: {receipt.classLevel || 'N/A'}</Typography>
            </Grid>
            <Grid size={6} sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important', letterSpacing: 0.5 }}>PAYMENT DETAILS</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.5, color: '#0d9488 !important' }}>{(receipt.status || 'approved').toUpperCase()}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Mode: {receipt.paymentMode}</Typography>
              {receipt.transactionId && (
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Ref: {receipt.transactionId}</Typography>
              )}
            </Grid>
          </Grid>
          
          <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, mb: 3, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', bgcolor: '#f9fafb', p: 1, borderBottom: '1px solid #e5e7eb' }}>
              <Typography variant="caption" sx={{ flex: 3, fontWeight: 800 }}>DESCRIPTION</Typography>
              <Typography variant="caption" sx={{ flex: 1, textAlign: 'right', fontWeight: 800 }}>AMOUNT</Typography>
            </Box>
            <Box sx={{ display: 'flex', p: 1.5 }}>
              <Box sx={{ flex: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{receipt.feeHead}</Typography>
                <Typography variant="caption" sx={{ color: '#6b7280 !important', display: 'block', mt: 0.5 }}>
                  {receipt.remarks || 'Standard fee payment for the current academic session.'}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ flex: 1, textAlign: 'right', fontWeight: 800 }}>Rs.{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
            </Box>
            <Box sx={{ display: 'flex', bgcolor: '#f0f9f9', p: 1.5, borderTop: '1px solid #e5e7eb' }}>
              <Typography variant="body2" sx={{ flex: 3, textAlign: 'right', fontWeight: 800 }}>TOTAL PAID AMOUNT</Typography>
              <Typography variant="subtitle2" sx={{ flex: 1, textAlign: 'right', fontWeight: 900, color: '#0d9488 !important' }}>Rs.{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 4 }}>
            <Box sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, flex: 1, border: '1px solid #e5e7eb' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important', letterSpacing: 0.5 }}>AMOUNT IN WORDS</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'capitalize', mt: 0.5 }}>{numberToIndianWords(receipt.amount)}</Typography>
            </Box>
            {qrCodeUrl && (
              <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>SECURE SCAN</Typography>
                <Box component="img" src={qrCodeUrl} sx={{ width: 65, height: 65, border: '1px solid #e5e7eb', p: 0.5, borderRadius: 1, bgcolor: 'white' }} />
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 6 }}>
            <Box sx={{ textAlign: 'center', width: 160 }}>
              <Box sx={{ borderTop: '1px solid #e5e7eb', pt: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase' }}>Student Signature</Typography>
              </Box>
            </Box>
            
            <Box sx={{ textAlign: 'center' }}>
              {receipt.status === 'approved' && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: '#22c55e !important', letterSpacing: 1, display: 'block', textTransform: 'uppercase' }}>Digitally Verified</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#6b7280 !important' }}>By {receipt.approvedByName || 'System'}</Typography>
                </Box>
              )}
              <Box sx={{ borderTop: '1px solid #e5e7eb', pt: 1, width: 160 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase' }}>Authorized Signature</Typography>
              </Box>
            </Box>
          </Box>

          <Typography variant="caption" sx={{ color: '#9ca3af !important', display: 'block', textAlign: 'center', mt: 4, fontSize: '0.65rem', borderTop: '1px solid #f3f4f6', pt: 1.5 }}>
            This is a computer-generated document. No physical signature is required for digitally verified receipts.
            <br />
            &copy; {new Date().getFullYear()} {settings.name}. All Rights Reserved.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: { xs: 1.5, sm: 2 }, 
        gap: { xs: 1, sm: 1.5 }, 
        bgcolor: 'background.paper',
        flexDirection: { xs: 'column-reverse', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        '@media print': { display: 'none' }
      }}>
        <Button 
          onClick={onClose} 
          size="small"
          sx={{ 
            fontWeight: 800,
            py: 1
          }}
        >
          Close
        </Button>
        <Stack direction="row" spacing={1} sx={{ flex: 1, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            size="small"
            className="print-button"
            startIcon={<Printer size={16} />}
            onClick={() => handlePrint()}
            sx={{ borderRadius: 2, fontWeight: 800 }}
          >
            Direct Print
          </Button>
          <PDFDownloadLink 
            document={<ReceiptPDF receipt={receipt} settings={settings} qrCodeUrl={qrCodeUrl} />} 
            fileName={`Receipt_${receiptNo}.pdf`}
            style={{ textDecoration: 'none' }}
          >
            {({ loading: pdfLoading }) => (
              <Button 
                variant="contained" 
                size="small"
                disabled={pdfLoading}
                startIcon={<Download size={16} />}
                sx={{ 
                  borderRadius: 2, 
                  fontWeight: 800,
                  whiteSpace: 'nowrap'
                }}
              >
                {pdfLoading ? 'Preparing...' : 'PDF Download'}
              </Button>
            )}
          </PDFDownloadLink>
        </Stack>
      </DialogActions>
    </Dialog>
  );
});

export default FeeReceiptModal;
