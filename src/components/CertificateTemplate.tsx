import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Award, ShieldCheck, Bookmark } from 'lucide-react';
import { Certificate } from '../types';

export default React.forwardRef<HTMLDivElement, { certificate: Certificate }>(({ certificate }, ref) => {
  return (
    <Box 
      ref={ref}
      sx={{ 
        width: '297mm', // A4 Landscape
        height: '210mm',
        bgcolor: 'white',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20mm',
        overflow: 'hidden',
        boxSizing: 'border-box',
        '@media print': {
          width: '297mm',
          height: '210mm',
        }
      }}
    >
      {/* Premium Islamic Border */}
      <Box sx={{ 
        position: 'absolute', 
        inset: '10mm', 
        border: '12px double #B8860B',
        pointerEvents: 'none',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '-20px',
          border: '2px solid #B8860B',
          opacity: 0.5
        }
      }} />

      {/* Decorative Corners */}
      {[
        { top: 0, left: 0 }, { top: 0, right: 0 }, 
        { bottom: 0, left: 0 }, { bottom: 0, right: 0 }
      ].map((pos, i) => (
        <Box key={i} sx={{ 
          position: 'absolute', ...pos, width: 100, height: 100, 
          bgcolor: 'transparent', border: '5px solid #B8860B',
          transform: i === 0 ? 'rotate(0deg)' : i === 1 ? 'rotate(90deg)' : i === 2 ? 'rotate(-90deg)' : 'rotate(180deg)',
          clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          margin: '15mm'
        }} />
      ))}

      {/* Background Watermark */}
      <Box sx={{ 
        position: 'absolute', 
        opacity: 0.03, 
        zIndex: 0, 
        transform: 'scale(1.5)',
        color: '#B8860B'
      }}>
        <ShieldCheck size={400} />
      </Box>

      <Stack spacing={4} alignItems="center" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <Box sx={{ color: '#B8860B', mb: 2 }}>
          <Award size={80} strokeWidth={1} />
        </Box>

        <Typography variant="h2" sx={{ 
          fontFamily: '"Playfair Display", serif', 
          fontWeight: 900, 
          color: '#2d3748',
          letterSpacing: 4,
          textTransform: 'uppercase'
        }}>
          Certificate of Completion
        </Typography>

        <Typography variant="h6" sx={{ color: '#718096', fontStyle: 'italic', maxWidth: 600 }}>
          This certifies that the esteemed candidate has successfully fulfilled the required curriculum and demonstrated exceptional understanding in the field of
        </Typography>

        <Typography variant="h1" sx={{ 
          fontFamily: '"Playfair Display", serif', 
          fontWeight: 950, 
          color: '#B8860B',
          my: 4,
          borderBottom: '2px solid #E2E8F0',
          pb: 2,
          px: 4
        }}>
          {certificate.studentName}
        </Typography>

        <Typography variant="h4" sx={{ fontWeight: 800, color: '#4a5568' }}>
          {certificate.courseName}
        </Typography>

        <Typography variant="body1" sx={{ color: '#a0aec0', maxWidth: 700 }}>
          Issued by the Academic Board of Maktab Portal on this day {new Date(certificate.issueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}. This document serves as an official testimony of academic achievement and learning consistency.
        </Typography>

        <Stack direction="row" spacing={12} sx={{ mt: 10, width: '100%', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ width: 200, borderTop: '2px solid #2d3748', pt: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{certificate.issuedBy || 'Academic Dean'}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>Official Signature</Typography>
            </Box>
          </Box>
          
          <Box sx={{ textAlign: 'center', position: 'relative' }}>
             <Box sx={{ 
                position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
                width: 120, height: 120, border: '4px double #B8860B', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8860B',
                opacity: 0.8, bgcolor: 'white'
             }}>
                <Box sx={{ textAlign: 'center' }}>
                   <Typography sx={{ fontSize: 10, fontWeight: 900 }}>OFFICIAL</Typography>
                   <Bookmark size={30} fill="currentColor" />
                   <Typography sx={{ fontSize: 10, fontWeight: 900 }}>SEAL</Typography>
                </Box>
             </Box>
             <Box sx={{ width: 200, borderTop: '2px solid #2d3748', pt: 1, mt: 4 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Registrar</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>Official Verification</Typography>
             </Box>
          </Box>
        </Stack>

        <Typography variant="caption" sx={{ mt: 8, fontFamily: 'monospace', opacity: 0.3, letterSpacing: 2 }}>
           REG NO: {certificate.certificateNumber} • VERIFY AT MAKTABPORTAL.ACADEMY
        </Typography>
      </Stack>
    </Box>
  );
});
