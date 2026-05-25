import React, { useRef } from 'react';
import { 
  Dialog, DialogContent, Box, Button, IconButton, 
  Stack, Typography, alpha, useTheme 
} from '@mui/material';
import { X, Printer, Download, Share2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { Certificate } from '../types';
import CertificateTemplate from './CertificateTemplate';

interface CertificateModalProps {
  open: boolean;
  onClose: () => void;
  certificate: Certificate | null;
}

export default function CertificateModal({ open, onClose, certificate }: CertificateModalProps) {
  const theme = useTheme();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Certificate-${certificate?.studentName || 'Document'}`,
  });

  if (!certificate) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: { 
          bgcolor: 'rgba(0,0,0,0.8)', 
          boxShadow: 'none',
          backdropFilter: 'blur(20px)',
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
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={onClose} sx={{ color: 'white' }}><X /></IconButton>
          <Typography variant="h6" sx={{ fontWeight: 950 }}>Certificate Preview</Typography>
        </Stack>
        
        <Stack direction="row" spacing={2}>
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
            Print Certificate
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Download />} 
            sx={{ borderRadius: 10, px: 3, fontWeight: 900, borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            Export PDF
          </Button>
        </Stack>
      </Box>

      <DialogContent sx={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        p: 4,
        overflow: 'auto',
        '&::-webkit-scrollbar': { display: 'none' }
      }}>
        <Box sx={{ 
          transform: { xs: 'scale(0.3)', sm: 'scale(0.5)', md: 'scale(0.7)', lg: 'scale(0.85)', xl: 'scale(1)' },
          transformOrigin: 'center center',
          boxShadow: '0 50px 100px rgba(0,0,0,0.5)',
          borderRadius: 1,
          overflow: 'hidden'
        }}>
          <CertificateTemplate ref={printRef} certificate={certificate} />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
