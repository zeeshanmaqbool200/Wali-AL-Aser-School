import React from 'react';
import { 
  Dialog, DialogContent, Box, Typography, Button, Divider, 
  Grid, IconButton, Chip, DialogActions, useMediaQuery,
  useTheme, alpha
} from '@mui/material';
import { Printer, Download, X, FileText, CheckCircle, Clock } from 'lucide-react';
import { FeeReceipt, InstituteSettings } from '../types';
import { numberToIndianWords } from '../lib/indianNumberSystem';
import { format } from 'date-fns';
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
    padding: 40,
    fontFamily: 'Noto Sans',
    backgroundColor: '#FFFFFF',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: '2pt solid #0d9488',
    paddingBottom: 20,
    position: 'relative',
    paddingTop: 10,
  },
  receiptCorners: {
    position: 'absolute',
    top: -30,
    left: -30,
    right: -30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 60,
    zIndex: -1,
  },
  cornerImage: {
    width: 100,
    height: 100,
    opacity: 0.6,
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
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#0d9488',
  },
  maktabName: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#0f766e',
    marginVertical: 4,
  },
  address: {
    fontSize: 8,
    color: '#4b5563',
    lineHeight: 1.4,
  },
  receiptMeta: {
    textAlign: 'right',
  },
  receiptTitle: {
    fontSize: 24,
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
    marginBottom: 30,
    marginTop: 20,
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
    letterSpacing: 1,
    marginBottom: 5,
  },
  value: {
    fontSize: 11,
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
    marginVertical: 20,
    border: '1pt solid #E5E7EB',
    borderRadius: 2,
  },
  tableHeader: {
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    padding: 10,
    borderBottom: '1pt solid #E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 15,
    borderBottom: '1pt solid #f3f4f6',
  },
  tableFooter: {
    backgroundColor: '#f0f9f9',
    flexDirection: 'row',
    padding: 15,
  },
  colDesc: { flex: 3 },
  colAmount: { flex: 1, textAlign: 'right' },
  wordsBox: {
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 4,
    border: '1pt solid #E5E7EB',
    marginTop: 10,
  },
  footer: {
    marginTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureBox: {
    borderTop: '1pt solid #E5E7EB',
    width: 150,
    paddingTop: 5,
    textAlign: 'center',
  },
  signatureLabel: {
    fontSize: 8,
    color: '#4b5563',
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
  },
  verifiedStamp: {
    textAlign: 'center',
    marginBottom: 10,
  },
  verifiedText: {
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'Noto Sans Bold',
    color: '#22c55e',
  },
  verifiedBy: {
    fontSize: 7,
    color: '#4b5563',
    marginTop: 2,
  },
  disclaimer: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    borderTop: '1pt solid #f3f4f6',
    paddingTop: 15,
  }
});

const ReceiptPDF = ({ receipt, settings }: { receipt: FeeReceipt, settings: InstituteSettings }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.header}>
        {/* Corner Images */}
        <View style={{ position: 'absolute', top: -35, left: -35, right: -35, flexDirection: 'row', justifyContent: 'space-between', width: '110%' }}>
          {settings.receiptLeftImageUrl && (
            <Image src={settings.receiptLeftImageUrl} style={{ width: 80, height: 80, opacity: 0.4 }} />
          )}
          {settings.receiptRightImageUrl && (
            <Image src={settings.receiptRightImageUrl} style={{ width: 80, height: 80, opacity: 0.4 }} />
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
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
          <Text style={[pdfStyles.value, { fontSize: 13 }]}>{receipt.studentName}</Text>
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
          <Text style={[pdfStyles.colDesc, { fontSize: 9, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>Tafseel (Description)</Text>
          <Text style={[pdfStyles.colAmount, { fontSize: 9, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>Raqam (Amount)</Text>
        </View>
        <View style={pdfStyles.tableRow}>
          <View style={pdfStyles.colDesc}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }}>{receipt.feeHead}</Text>
            <Text style={{ fontSize: 8, color: '#4b5563', marginTop: 4 }}>{receipt.remarks || 'Standard fee payment for the current academic session.'}</Text>
          </View>
          <Text style={[pdfStyles.colAmount, { fontSize: 11, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>₹{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={pdfStyles.tableFooter}>
          <Text style={[pdfStyles.colDesc, { textAlign: 'right', fontSize: 10, fontWeight: 'bold', fontFamily: 'Noto Sans Bold' }]}>Kul Ada-shuda Raqam</Text>
          <Text style={[pdfStyles.colAmount, { fontSize: 12, fontWeight: 'bold', fontFamily: 'Noto Sans Bold', color: '#0d9488' }]}>₹{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <View style={pdfStyles.wordsBox}>
        <Text style={pdfStyles.label}>Amount in Words</Text>
        <Text style={{ fontSize: 10, fontWeight: 'bold', fontFamily: 'Noto Sans Bold', textTransform: 'capitalize', marginTop: 5 }}>
          {numberToIndianWords(receipt.amount)}
        </Text>
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
    chairman: 'Shabir Ahmad',
    financeManager: 'Bashir Ahmad',
    supervisor: 'Irfan Hussain',
    organizer: 'Mudasir Ahmad',
    secretary: 'Showkat Ahmad',
    mediaConsultant: 'Yawar Abbas',
    socialMediaManager: 'Bilal A',
    mediaIncharge: 'Yawar Abbas'
  },
  id: 'default'
};

export default function FeeReceiptModal({ open, onClose, receipt, settings: propSettings }: FeeReceiptModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const settings = propSettings || defaultSettings;
  
  if (!receipt) return null;

  const receiptNo = receipt.receiptNo || receipt.receiptNumber;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      PaperProps={{ 
        sx: { 
          borderRadius: { xs: 0, sm: 2 },
          m: { xs: 0, sm: 2 },
          bgcolor: 'background.paper',
          overflow: 'hidden'
        } 
      }}
    >
      <Box sx={{ 
        p: { xs: 1.5, sm: 2.5 }, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid', 
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <FileText size={isMobile ? 16 : 20} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Official Raseed - {receiptNo}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size={isMobile ? 'small' : 'medium'}>
          <X size={20} />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 1, sm: 4 }, bgcolor: 'background.default' }}>
        <Box sx={{ 
          bgcolor: 'white', 
          p: { xs: 2, sm: 6 }, 
          borderRadius: 2, 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxWidth: '800px',
          mx: 'auto',
          position: 'relative',
          overflow: 'hidden',
          // Force black text for PDF preview on white background
          '& *': { color: '#000000 !important' },
          border: '1px solid #e5e7eb'
        }}>
          {/* Receipt Corner Decorations for UI Preview */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', zIndex: 0, opacity: 0.5 }}>
            {settings.receiptLeftImageUrl && (
              <Box component="img" src={settings.receiptLeftImageUrl} sx={{ width: { xs: 60, sm: 120 }, height: 'auto', mixBlendMode: 'multiply' }} />
            )}
            {settings.receiptRightImageUrl && (
              <Box component="img" src={settings.receiptRightImageUrl} sx={{ width: { xs: 60, sm: 120 }, height: 'auto', mixBlendMode: 'multiply' }} />
            )}
          </Box>

          {/* Visual Preview Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, borderBottom: '2px solid #0d9488', pb: 2, position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box component="img" src={settings.logoUrl} sx={{ width: 60, height: 60 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#0d9488 !important' }}>{settings.name}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{settings.maktabName}</Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#e5e7eb !important' }}>RASEED</Typography>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#0d9488 !important' }}>No: {receiptNo}</Typography>
            </Box>
          </Box>

          {/* Body Preview */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid size={6}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important' }}>TALIB-E-ILM</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>{receipt.studentName}</Typography>
              <Typography variant="body2">ID: {receipt.studentOfficialId || receipt.studentId}</Typography>
            </Grid>
            <Grid size={6} sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important' }}>AMOUNT</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#0d9488 !important' }}>₹{receipt.amount.toLocaleString()}</Typography>
              <Typography variant="body2">{receipt.feeHead}</Typography>
            </Grid>
          </Grid>
          
          <Box sx={{ bgcolor: '#f9fafb', p: 2, borderRadius: 1, mb: 4 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#9ca3af !important' }}>IN WORDS</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>{numberToIndianWords(receipt.amount)}</Typography>
          </Box>
          
          <Typography variant="caption" sx={{ color: '#9ca3af !important', display: 'block', textAlign: 'center', mt: 4 }}>
            Please download the official PDF for a complete, verified document.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: { xs: 2, sm: 3 }, 
        gap: { xs: 1, sm: 2 }, 
        bgcolor: 'background.paper',
        flexDirection: { xs: 'column-reverse', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' }
      }}>
        <Button 
          onClick={onClose} 
          sx={{ 
            fontWeight: 800,
            py: { xs: 1.5, sm: 1 } 
          }}
        >
          Band Karein
        </Button>
        <PDFDownloadLink 
          document={<ReceiptPDF receipt={receipt} settings={settings} />} 
          fileName={`Receipt_${receiptNo}.pdf`}
          style={{ textDecoration: 'none' }}
        >
          {({ loading: pdfLoading }) => (
            <Button 
              fullWidth={isMobile}
              variant="contained" 
              disabled={pdfLoading}
              startIcon={<Download size={18} />}
              sx={{ 
                borderRadius: 2, 
                fontWeight: 800, 
                px: 4,
                py: { xs: 1.5, sm: 1 },
                whiteSpace: 'nowrap'
              }}
            >
              {pdfLoading ? 'PDF Bana rahe hain...' : 'PDF Download Karein'}
            </Button>
          )}
        </PDFDownloadLink>
      </DialogActions>
    </Dialog>
  );
}
