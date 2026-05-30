import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Award, ShieldCheck, Bookmark } from 'lucide-react';
import { Certificate } from '../types';
import { useAuth } from '../context/AuthContext';

export default React.forwardRef<HTMLDivElement, { certificate: Certificate }>(({ certificate }, ref) => {
  const { instituteSettings } = useAuth();
  const urduStyle = {
    fontFamily: "'Noto Nastaliq Urdu', serif",
    direction: 'rtl' as const,
    letterSpacing: 'normal',
    fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
    lineHeight: 1.8
  };

  return (
    <Box 
      ref={ref}
      sx={{ 
        width: '210mm', // A4 Portrait
        height: '297mm',
        bgcolor: '#fdfcf0', // Classic parchment cream
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '15mm',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(184, 134, 11, 0.05) 0%, transparent 70%),
          url("https://www.transparenttextures.com/patterns/natural-paper.png")
        `,
        '@media print': {
          width: '210mm',
          height: '297mm',
          printColorAdjust: 'exact',
          WebkitPrintColorAdjust: 'exact',
        }
      }}
    >
      {/* Intricate Islamic Outer Border */}
      <Box sx={{ 
        position: 'absolute', 
        inset: '5mm', 
        border: '3px solid #8B4513', // Deep wood/brown
        zIndex: 5,
        pointerEvents: 'none'
      }} />

      {/* Main Ornate Frame */}
      <Box sx={{ 
        position: 'absolute', 
        inset: '10mm', 
        border: '15px double #B8860B', // Gold
        zIndex: 5,
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.1)',
        pointerEvents: 'none',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0',
          border: '1px solid #B8860B',
          opacity: 0.5
        }
      }} />

      {/* Central Watermark */}
      <Box sx={{ 
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-15deg)', 
        width: '50%', opacity: 0.04, pointerEvents: 'none', zIndex: 0 
      }}>
        {instituteSettings?.logoUrl && (
          <Box component="img" src={instituteSettings.logoUrl} sx={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
        )}
      </Box>

      {/* Decorative Corner Flowers/Motifs */}
      {[
        { top: -20, left: -20 }, { top: -20, right: -20 }, 
        { bottom: -20, left: -20 }, { bottom: -20, right: -20 }
      ].map((pos, i) => (
        <Box key={i} sx={{ 
          position: 'absolute', ...pos, 
          width: 150, height: 150, 
          zIndex: 10,
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/floral-paper.png")',
          backgroundSize: 'contain',
          opacity: 0.1,
          transform: i === 1 ? 'rotate(90deg)' : i === 2 ? 'rotate(-90deg)' : i === 3 ? 'rotate(180deg)' : 'none'
        }} />
      ))}

      {/* Header with Religious Icons/Leaders (Traditional) */}
      <Stack direction="row" justifyContent="space-between" sx={{ width: '100%', mt: 2, px: 6, position: 'relative', zIndex: 10 }}>
        <Box sx={{ 
          width: 90, height: 110, p: 0.5, bgcolor: 'white', 
          border: '4px solid #B8860B', boxShadow: 3,
          borderRadius: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          {instituteSettings?.leftImageUrl ? (
            <img 
              src={instituteSettings.leftImageUrl} 
              alt="Leader"
              loading="eager"
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/a/ae/Ruhollah_Khomeini.jpg"
              alt="Khomeini"
              loading="eager"
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )}
        </Box>

        <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
           {instituteSettings?.logoUrl ? (
             <img 
               src={instituteSettings.logoUrl} 
               alt="Logo"
               loading="eager"
               crossOrigin="anonymous"
               style={{ width: 90, height: 90, objectFit: 'contain', marginBottom: 6 }} 
             />
           ) : (
             <Award size={65} color="#B8860B" style={{ marginBottom: 6 }} />
           )}
           <Typography sx={{ 
             fontFamily: urduStyle.fontFamily, 
             fontSize: '1.8rem', 
             color: '#1a365d',
             fontWeight: 900
           }}>
             بسم اللہ الرحمن الرحیم
           </Typography>
           <Typography sx={{ 
             fontFamily: urduStyle.fontFamily, 
             fontSize: '2.5rem', 
             color: '#B8860B',
             mt: 1,
             textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
           }}>
             لوح تقدیر
           </Typography>
        </Box>

        <Box sx={{ 
          width: 90, height: 110, p: 0.5, bgcolor: 'white', 
          border: '4px solid #B8860B', boxShadow: 3,
          borderRadius: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          {instituteSettings?.rightImageUrl ? (
            <img 
              src={instituteSettings.rightImageUrl} 
              alt="Leader"
              loading="eager"
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/f/ff/Ali_Khamenei.jpg"
              alt="Khamenei"
              loading="eager"
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )}
        </Box>
      </Stack>

      {/* Main Content Area */}
      <Stack spacing={2.5} alignItems="center" sx={{ position: 'relative', zIndex: 10, textAlign: 'center', mt: 3, px: 6, flex: 1, width: '100%' }}>
        
        {/* Title / Header Decoration */}
        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
           <Box sx={{ flex: 1, height: '2.5px', background: 'linear-gradient(90deg, transparent, #B8860B)' }} />
           <Typography variant="h6" sx={{ color: '#2d3748', fontWeight: 800, letterSpacing: 2, fontSize: '0.9rem' }}>
             PLACCARD OF APPRECIATION
           </Typography>
           <Box sx={{ flex: 1, height: '2.5px', background: 'linear-gradient(270deg, transparent, #B8860B)' }} />
        </Box>

        <Typography sx={{ 
          ...urduStyle, 
          fontSize: '1.2rem', 
          color: '#1a365d',
          fontWeight: 700,
          mt: 0.5
        }}>
          کار گزار و کارگر گرامی جناب
        </Typography>

        <Box sx={{ position: 'relative', my: 0.5 }}>
          <Typography variant="h2" sx={{ 
            fontFamily: '"Playfair Display", serif', 
            fontWeight: 950, 
            color: '#1a365d',
            borderBottom: '4px double #B8860B',
            pb: 0.5,
            px: 4,
            fontSize: '2.8rem'
          }}>
            {certificate.studentName}
          </Typography>
        </Box>

        <Typography sx={{ 
          ...urduStyle,
          fontSize: '1rem',
          color: '#4a5568',
          lineHeight: 1.6,
          textAlign: 'justify',
          maxWidth: '90%'
        }}>
          کار و تلاش ارزشمندترین سرمایہ هر جامعہ پویا است و شما یکی از برجستہ ترین مصادیق این تلاش صادقانہ هستید. کوشش بی وفقہ، روحیہ تعاون، صداقت در رفتار و دقت در انجام امور، همواره از ویژگی‌های شاخص شما بوده است.
        </Typography>

        <Typography sx={{ 
          ...urduStyle,
          fontSize: '1rem',
          color: '#4a5568',
          lineHeight: 1.6,
          textAlign: 'justify',
          maxWidth: '90%',
          mt: 1
        }}>
          این لوح تقدیر بہ پاس خدمات ارزشمند شما کہ سهم مهمی در رشد و تعالی مجموعہ داشتہ است تقدیم میگردد. از درگاہ خداوند کریم برایتان سلامتی، توفیق و شکوفایی روزافزون آرزو داریم.
        </Typography>

        {/* Dynamic Course/Subject Information */}
        <Box sx={{ mt: 1, p: 2, border: '2.5px solid #E2E8F0', borderRadius: 4, bgcolor: alpha('#B8860B', 0.03) }}>
          <Typography variant="caption" sx={{ fontWeight: 900, color: '#B8860B', display: 'block', mb: 0.5, letterSpacing: 2 }}>
            AESTEEMED ACHIEVEMENT IN
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#1a365d' }}>
            {certificate.courseName}
          </Typography>
        </Box>

        {/* Footer Area */}
        <Stack direction="row" justifyContent="space-between" sx={{ width: '100%', mt: 'auto', mb: 4, position: 'relative', zIndex: 10 }}>
          <Box sx={{ textAlign: 'center', minWidth: 140, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>ISSUE DATE</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#1a365d' }}>{new Date(certificate.issueDate).toLocaleDateString()}</Typography>
            <Box sx={{ width: '100%', height: '2px', bgcolor: '#4a5568', mt: 1, mb: 0.5 }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Authorized Date</Typography>
          </Box>

          {/* Official Seal/Emblem */}
          <Box sx={{ 
            width: 140, height: 140, 
            border: '6px double #B8860B', 
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            bgcolor: 'white',
            boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
            mx: 2,
            zIndex: 20
          }}>
            <Box sx={{ textAlign: 'center', p: 1, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {instituteSettings?.stampUrl ? (
                <img 
                  src={instituteSettings.stampUrl} 
                  alt="Official Stamp"
                  crossOrigin="anonymous"
                  style={{ width: '90%', height: '90%', objectFit: 'contain' }} 
                />
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 9, fontWeight: 950, color: '#B8860B', letterSpacing: 0.5 }}>OFFICIAL</Typography>
                  <Award size={45} color="#B8860B" />
                  <Typography sx={{ fontSize: 9, fontWeight: 950, color: '#B8860B', letterSpacing: 0.5 }}>STAMP</Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ position: 'absolute', inset: -8, border: '1.5px solid #B8860B', borderRadius: '50%', opacity: 0.25 }} />
          </Box>

          <Box sx={{ textAlign: 'center', minWidth: 140, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>DIRECTOR</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#1a365d' }}>{certificate.issuedBy || 'Academic Head'}</Typography>
            <Box sx={{ width: '100%', height: '2px', bgcolor: '#4a5568', mt: 1, mb: 0.5 }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Authorized Signature</Typography>
          </Box>
        </Stack>

        <Typography variant="caption" sx={{ mt: 4, mb: -2, fontFamily: 'monospace', opacity: 0.4, letterSpacing: 1, fontSize: '0.7rem' }}>
           CERTIFICATE ID: {certificate.certificateNumber} • VERIFICATION CODE: {certificate.id.slice(-8).toUpperCase()}
        </Typography>
      </Stack>

      {/* Decorative Florals along borders */}
      <Box sx={{ 
        position: 'absolute', bottom: 40, left: -40, width: 300, height: 300, 
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/floral-paper.png")',
        opacity: 0.05, transform: 'rotate(45deg)', pointerEvents: 'none'
      }} />
      <Box sx={{ 
        position: 'absolute', top: 100, right: -40, width: 250, height: 250, 
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/floral-paper.png")',
        opacity: 0.05, transform: 'rotate(-15deg)', pointerEvents: 'none'
      }} />
    </Box>
  );
});
