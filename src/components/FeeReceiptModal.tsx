import React, { memo, useState, useEffect } from 'react';
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
    padding: 30,
    fontFamily: 'Noto Sans',
    backgroundColor: '#FFFFFF',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: '2pt solid #0d9488',
    paddingBottom: 15,
    position: 'relative',
    paddingTop: 10,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  headerText: {
    marginLeft: 15,
    flex: 1,
  },
  instituteName: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#0d9488',
  },
  maktabName: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#0f766e',
    marginVertical: 3,
  },
  address: {
    fontSize: 7,
    color: '#4b5563',
    lineHeight: 1.3,
  },
  receiptMeta: {
    textAlign: 'right',
  },
  receiptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#E5E7EB',
    marginBottom: 5,
  },
  receiptNo: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#0d9488',
  },
  date: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 15,
  },
  detailColumn: {
    flex: 1,
  },
  label: {
    fontSize: 7,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  value: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
  },
  subValue: {
    fontSize: 8,
    color: '#4b5563',
    marginTop: 1,
  },
  table: {
    width: '100%',
    marginVertical: 15,
    border: '1pt solid #E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1pt solid #E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottom: '1pt solid #f3f4f6',
  },
  tableFooter: {
    backgroundColor: '#f0f9f9',
    flexDirection: 'row',
    padding: 12,
  },
  colDesc: { flex: 3 },
  colAmount: { flex: 1, textAlign: 'right' },
  wordsBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 4,
    border: '1pt solid #E5E7EB',
    marginTop: 5,
  },
  footer: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureBox: {
    borderTop: '1pt solid #E5E7EB',
    width: 140,
    paddingTop: 5,
    textAlign: 'center',
  },
  signatureLabel: {
    fontSize: 7,
    color: '#4b5563',
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
  },
  qrCodeBox: {
    width: 60,
    height: 60,
    border: '0.5pt solid #E5E7EB',
    padding: 2,
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
  },
  verifiedBy: {
    fontSize: 6,
    color: '#4b5563',
    marginTop: 1,
  },
  disclaimer: {
    marginTop: 30,
    textAlign: 'center',
    fontSize: 6.5,
    color: '#9ca3af',
    borderTop: '1pt solid #f3f4f6',
    paddingTop: 10,
  }
});

const ReceiptPDF = ({ receipt, settings, qrCodeUrl }: { receipt: FeeReceipt, settings: InstituteSettings, qrCodeUrl?: string }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.header}>
        {/* Decorative corner images with safer positioning */}
        <View style={{ position: 'absolute', top: -20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
          {settings.receiptLeftImageUrl && (
            <Image src={settings.receiptLeftImageUrl} style={{ width: 70, height: 70, opacity: 0.3 }} />
          )}
          {settings.receiptRightImageUrl && (
            <Image src={settings.receiptRightImageUrl} style={{ width: 70, height: 70, opacity: 0.3 }} />
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {settings.logoUrl && (
            <Image src={settings.logoUrl} style={pdfStyles.logo} />
          )}
          <View style={pdfStyles.headerText}>
            <Text style={pdfStyles.instituteName}>{settings.name}</Text>
            <Text style={pdfStyles.maktabName}>{settings.maktabName}</Text>
            <Text style={pdfStyles.address}>{settings.address}</Text>
            <Text style={pdfStyles.address}>Ph: {settings.phone} • {settings.email}</Text>
          </View>
        </View>
        <View style={pdfStyles.receiptMeta}>
          <Text style={pdfStyles.receiptTitle}>RASEED</Text>
          <Text style={pdfStyles.receiptNo}>No: {receipt.receiptNo || receipt.receiptNumber}</Text>
          <Text style={pdfStyles.date}>Date: {format(new Date(receipt.date), 'dd MMM, yyyy')}</Text>
        </View>
      </View>

      <View style={pdfStyles.detailsGrid}>
        <View style={pdfStyles.detailColumn}>
          <Text style={pdfStyles.label}>Talib-e-Ilm Details</Text>
          <Text style={[pdfStyles.value, { fontSize: 12 }]}>{receipt.studentName}</Text>
          <Text style={pdfStyles.subValue}>Admission No: {receipt.studentOfficialId || receipt.studentId}</Text>
          <Text style={pdfStyles.subValue}>Maktab Level: {receipt.grade || 'N/A'}</Text>
        </View>
        <View style={[pdfStyles.detailColumn, { textAlign: 'right' }]}>
          <Text style={pdfStyles.label}>Adaigi ki Tafseel</Text>
          <Text style={[pdfStyles.value, { color: '#0d9488' }]}>{receipt.status.toUpperCase()}</Text>
          <Text style={pdfStyles.subValue}>Mode: {receipt.paymentMode}</Text>
          {receipt.transactionId && (
            <Text style={pdfStyles.subValue}>Ref: {receipt.transactionId}</Text>
          )}
        </View>
      </View>

      <View style={pdfStyles.table}>
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.colDesc, { fontSize: 8, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>Tafseel (Description)</Text>
          <Text style={[pdfStyles.colAmount, { fontSize: 8, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>Raqam (Amount)</Text>
        </View>
        <View style={pdfStyles.tableRow}>
          <View style={pdfStyles.colDesc}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }}>{receipt.feeHead}</Text>
            <Text style={{ fontSize: 7, color: '#4b5563', marginTop: 3 }}>{receipt.remarks || 'Standard fee payment for the current academic session.'}</Text>
          </View>
          <Text style={[pdfStyles.colAmount, { fontSize: 10, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>₹{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={pdfStyles.tableFooter}>
          <Text style={[pdfStyles.colDesc, { textAlign: 'right', fontSize: 9, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>Kul Ada-shuda Raqam</Text>
          <Text style={[pdfStyles.colAmount, { fontSize: 10, fontWeight: 'bold', fontFamily: 'Noto Sans Bold', color: '#0d9488' }]}>₹{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View style={[pdfStyles.wordsBox, { flex: 1 }]}>
          <Text style={pdfStyles.label}>Amount in Words</Text>
          <Text style={{ fontSize: 9, fontWeight: 'bold', fontFamily: 'Noto Sans Bold', textTransform: 'capitalize', marginTop: 3 }}>
            {numberToIndianWords(receipt.amount)}
          </Text>
        </View>
        {qrCodeUrl && (
          <View style={{ alignItems: 'center' }}>
            <Text style={[pdfStyles.label, { marginBottom: 2 }]}>SECURE SCAN</Text>
            <Image src={qrCodeUrl} style={pdfStyles.qrCodeBox} />
          </View>
        )}
      </View>

      <View style={pdfStyles.footer}>
        <View style={pdfStyles.signatureBox}>
          <Text style={pdfStyles.signatureLabel}>Talib-e-Ilm ke Dastakhat</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          {receipt.status === 'approved' && (
            <View style={pdfStyles.verifiedStamp}>
              <Text style={pdfStyles.verifiedText}>DIGITALLY VERIFIED</Text>
              <Text style={pdfStyles.verifiedBy}>By {receipt.approvedByName || 'System'}</Text>
            </View>
          )}
          <View style={pdfStyles.signatureBox}>
            <Text style={pdfStyles.signatureLabel}>Tasdiq-shuda Dastakhat</Text>
          </View>
        </View>
      </View>

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
  maktabName: 'MAKTAB WALI UL ASER',
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      PaperProps={{ 
        sx: { 
          borderRadius: { xs: 0, sm: 1 },
          m: { xs: 0, sm: 2 },
          bgcolor: 'background.paper',
          overflow: 'hidden',
          '@media print': {
            m: 0,
            p: 0,
            boxShadow: 'none',
            '& .MuiTypography-root, & .MuiBox-root, & .MuiGrid-root': { color: '#000 !important' },
            width: '100%',
            maxWidth: 'none',
            height: 'auto',
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
            Official Raseed - {receiptNo}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <X size={18} />
        </IconButton>
      </Box>

      <DialogContent sx={{ 
        p: { xs: 1, sm: 3 }, 
        bgcolor: 'background.default',
        '@media print': { p: 0, m: 0, bgcolor: 'white' }
      }}>
        <Box 
          id="printable-receipt"
          className="receipt-container"
          sx={{ 
            bgcolor: 'white', 
            p: { xs: 2.5, sm: 4 }, 
            borderRadius: 1, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            maxWidth: '100%',
            width: '800px',
            mx: 'auto',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
            '& *': { color: '#000000 !important' },
            '@media print': {
              boxShadow: 'none',
              border: 'none',
              p: 2,
              width: '100%',
              maxHeight: '100vh',
            }
          }}
        >
          {/* Receipt Corner Decorations */}
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            display: 'flex', 
            justifyContent: 'space-between', 
            pointerEvents: 'none', 
            zIndex: 0, 
            opacity: 0.3,
            px: 2
          }}>
            {settings.receiptLeftImageUrl && (
              <Box component="img" src={settings.receiptLeftImageUrl} sx={{ width: { xs: 50, sm: 100 }, height: 'auto', mixBlendMode: 'multiply' }} />
            )}
            {settings.receiptRightImageUrl && (
              <Box component="img" src={settings.receiptRightImageUrl} sx={{ width: { xs: 50, sm: 100 }, height: 'auto', mixBlendMode: 'multiply' }} />
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, borderBottom: '2px solid #0d9488', pb: 2, position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
              <Box component="img" src={settings.logoUrl} sx={{ width: { xs: 45, sm: 60 }, height: { xs: 45, sm: 60 } }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0d9488 !important', lineHeight: 1.2, fontFamily: 'var(--font-serif)', textTransform: 'uppercase' }}>{settings.name}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', textTransform: 'uppercase', fontSize: '0.6rem' }}>{settings.maktabName}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', display: { xs: 'none', sm: 'block' } }}>{settings.address}</Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#e5e7eb !important', letterSpacing: 2, fontFamily: 'var(--font-serif)' }}>RASEED</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#0d9488 !important' }}>No: {receiptNo}</Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>{format(new Date(receipt.date), 'dd MMM, yyyy')}</Typography>
            </Box>
          </Box>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={6}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important', letterSpacing: 0.5 }}>TALIB-E-ILM DETAILS</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.5 }}>{receipt.studentName}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>ID: {receipt.studentOfficialId || receipt.studentId}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Class: {receipt.grade || 'N/A'}</Typography>
            </Grid>
            <Grid size={6} sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important', letterSpacing: 0.5 }}>ADAIGI KI TAFSEEL</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.5, color: '#0d9488 !important' }}>{receipt.status.toUpperCase()}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Mode: {receipt.paymentMode}</Typography>
              {receipt.transactionId && (
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>Ref: {receipt.transactionId}</Typography>
              )}
            </Grid>
          </Grid>
          
          <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, mb: 3, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', bgcolor: '#f9fafb', p: 1, borderBottom: '1px solid #e5e7eb' }}>
              <Typography variant="caption" sx={{ flex: 3, fontWeight: 800 }}>TAFSEEL (DESCRIPTION)</Typography>
              <Typography variant="caption" sx={{ flex: 1, textAlign: 'right', fontWeight: 800 }}>RAQAM (AMOUNT)</Typography>
            </Box>
            <Box sx={{ display: 'flex', p: 1.5 }}>
              <Box sx={{ flex: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{receipt.feeHead}</Typography>
                <Typography variant="caption" sx={{ color: '#6b7280 !important', display: 'block', mt: 0.5 }}>
                  {receipt.remarks || 'Standard fee payment for the current academic session.'}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ flex: 1, textAlign: 'right', fontWeight: 800 }}>₹{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
            </Box>
            <Box sx={{ display: 'flex', bgcolor: '#f0f9f9', p: 1.5, borderTop: '1px solid #e5e7eb' }}>
              <Typography variant="body2" sx={{ flex: 3, textAlign: 'right', fontWeight: 800 }}>KUL ADA-SHUDA RAQAM</Typography>
              <Typography variant="subtitle2" sx={{ flex: 1, textAlign: 'right', fontWeight: 900, color: '#0d9488 !important' }}>₹{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
            </Box>
          </Box>
          
          <Box sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, mb: 4, border: '1px solid #e5e7eb' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important', letterSpacing: 0.5 }}>AMOUNT IN WORDS</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'capitalize', mt: 0.5 }}>{numberToIndianWords(receipt.amount)}</Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 6 }}>
            <Box sx={{ textAlign: 'center', width: 150 }}>
              <Box sx={{ borderTop: '1px solid #e5e7eb', pt: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.65rem' }}>TALIB-E-ILM KE DASTAKHAT</Typography>
              </Box>
            </Box>
            
            <Box sx={{ textAlign: 'center' }}>
              {receipt.status === 'approved' && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: '#22c55e !important', letterSpacing: 1, display: 'block' }}>DIGITALLY VERIFIED</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#6b7280 !important' }}>By {receipt.approvedByName || 'System'}</Typography>
                </Box>
              )}
              <Box sx={{ borderTop: '1px solid #e5e7eb', pt: 1, width: 150 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.65rem' }}>TASDIQ-SHUDA DASTAKHAT</Typography>
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
          Band Karein
        </Button>
        <Stack direction="row" spacing={1} sx={{ flex: 1, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Printer size={16} />}
            onClick={handlePrint}
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
                {pdfLoading ? 'Taiyar ho raha...' : 'PDF Download'}
              </Button>
            )}
          </PDFDownloadLink>
        </Stack>
      </DialogActions>
    </Dialog>
  );
});

export default FeeReceiptModal;
