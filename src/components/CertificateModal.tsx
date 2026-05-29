import React, { useRef, useState } from 'react';
import { 
  Dialog, DialogContent, Box, Button, IconButton, 
  Stack, Typography, alpha, useTheme 
} from '@mui/material';
import { X, Printer, Download, Share2, FileImage } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { Certificate } from '../types';
import CertificateTemplate from './CertificateTemplate';
import * as htmlToImage from 'html-to-image';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface CertificateModalProps {
  open: boolean;
  onClose: () => void;
  certificate: Certificate | null;
  onRevoke?: (id: string) => void;
}

export default function CertificateModal({ open, onClose, certificate, onRevoke }: CertificateModalProps) {
  const theme = useTheme();
  const themeContext = useAuth(); // Just to get isAdmin info if needed, but better pass from props
  const isAdmin = themeContext.user?.role === 'superadmin' || themeContext.user?.role === 'manager';
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Certificate-${certificate?.studentName || 'Document'}`,
  });

  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const originalElement = printRef.current;
      
      // html-to-image export with high quality
      const dataUrl = await htmlToImage.toPng(originalElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#fdfcf0',
      });

      const link = document.createElement('a');
      link.download = `Certificate-${(certificate?.studentName || 'Member').replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Certificate exported as PNG');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!certificate) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: { 
          bgcolor: 'rgba(0,0,0,0.9)', 
          boxShadow: 'none',
          backdropFilter: 'blur(30px)',
          margin: 0,
          maxHeight: '100vh',
          width: '100vw',
          height: '100vh',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={onClose} sx={{ color: 'white' }}><X /></IconButton>
          <Typography variant="h6" sx={{ fontWeight: 950 }}>Certificate Preview</Typography>
        </Stack>
        
        <Stack direction="row" spacing={2}>
          {isAdmin && onRevoke && certificate && (
            <Button 
              variant="outlined" 
              color="error"
              onClick={() => onRevoke(certificate.id)}
              sx={{ borderRadius: 10, px: 3, fontWeight: 900, borderColor: 'rgba(255,50,50,0.5)', color: '#ff6666' }}
            >
              Revoke & Delete
            </Button>
          )}
          <Button 
            variant="contained" 
            startIcon={<Printer />} 
            onClick={() => handlePrint()}
            sx={{ 
                borderRadius: 10, 
                px: 4, 
                fontWeight: 900, 
                bgcolor: 'white', 
                color: 'black',
                '&:hover': { bgcolor: '#f0f0f0' }
            }}
          >
            A4 Print
          </Button>
          <Button 
            variant="outlined" 
            disabled={exporting}
            startIcon={<FileImage />} 
            onClick={handleDownloadImage}
            sx={{ borderRadius: 10, px: 3, fontWeight: 900, borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            {exporting ? 'Exporting...' : 'Save PNG'}
          </Button>
        </Stack>
      </Box>

      <DialogContent sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'flex-start',
        p: { xs: 1, sm: 2, md: 4 },
        overflow: 'auto',
        bgcolor: 'transparent',
        '&::-webkit-scrollbar': { 
          width: '8px',
          height: '8px'
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(255,255,255,0.05)'
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '4px'
        }
      }}>
        <Box sx={{ 
          transform: { xs: 'scale(0.35)', sm: 'scale(0.55)', md: 'scale(0.75)', lg: 'scale(0.85)', xl: 'scale(1)' },
          transformOrigin: 'top center',
          boxShadow: '0 50px 100px rgba(0,0,0,0.8)',
          borderRadius: 1,
          mt: 4,
          mb: 12,
          flexShrink: 0,
          width: '210mm',
          height: '297mm',
          bgcolor: 'white'
        }}>
          <CertificateTemplate ref={printRef} certificate={certificate} />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
