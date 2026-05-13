import React, { useState, useRef } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Box, Typography, IconButton, alpha, useTheme,
  Stack, Tab, Tabs
} from '@mui/material';
import { Camera, Image as ImageIcon, X, Check, RefreshCw } from 'lucide-react';
import Webcam from 'react-webcam';

interface ImageCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onCapture: (base64: string) => void;
  title?: string;
  aspectRatio?: number;
}

export default function ImageCaptureDialog({ 
  open, 
  onClose, 
  onCapture, 
  title = "Update Photo",
  aspectRatio = 1
}: ImageCaptureDialogProps) {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const handleCapture = () => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) setCapturedImage(shot);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 800;

        if (width > height) {
          if (width > max) { height *= max / width; width = max; }
        } else {
          if (height > max) { width *= max / height; height = max; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, width, height);
        onCapture(canvas.toDataURL('image/jpeg', 0.8));
        onClose();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 4, overflow: 'hidden' }
      }}
    >
      <DialogTitle sx={{ 
        fontWeight: 900, 
        bgcolor: alpha(theme.palette.primary.main, 0.05),
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        {title}
        <IconButton onClick={onClose} size="small"><X size={20} /></IconButton>
      </DialogTitle>
      
      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)} 
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<ImageIcon size={20} />} label="Gallery" sx={{ fontWeight: 800 }} />
        <Tab icon={<Camera size={20} />} label="Webcam" sx={{ fontWeight: 800 }} />
      </Tabs>

      <DialogContent sx={{ p: 4 }}>
        {tab === 0 ? (
          <Box sx={{ 
            height: 300, 
            border: '2px dashed', 
            borderColor: 'divider', 
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            transition: '0.2s',
            '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.02) }
          }} component="label">
            <input type="file" hidden accept="image/*" onChange={handleFileChange} />
            <Box sx={{ 
              width: 64, height: 64, 
              borderRadius: '50%', 
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'primary.main'
            }}>
              <ImageIcon size={32} />
            </Box>
            <Typography sx={{ fontWeight: 800 }}>Choose from Gallery</Typography>
            <Typography variant="caption" color="text.secondary">PNG, JPG or JPEG (Max 5MB)</Typography>
          </Box>
        ) : (
          <Box sx={{ position: 'relative', borderRadius: 4, overflow: 'hidden', height: 300, bgcolor: 'black' }}>
            {capturedImage ? (
              <img src={capturedImage} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  facingMode: "user"
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            
            <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2 }}>
              {!capturedImage ? (
                <Button 
                  variant="contained" 
                  onClick={handleCapture}
                  startIcon={<Camera size={18} />}
                  sx={{ borderRadius: 10, px: 4, fontWeight: 900, bgcolor: 'white', color: 'black', '&:hover': { bgcolor: '#f0f0f0' } }}
                >
                  Capture
                </Button>
              ) : (
                <Stack direction="row" spacing={2}>
                  <Button 
                    variant="contained" 
                    color="inherit"
                    onClick={() => setCapturedImage(null)}
                    startIcon={<RefreshCw size={18} />}
                    sx={{ borderRadius: 10, px: 2, fontWeight: 900 }}
                  >
                    Retake
                  </Button>
                  <Button 
                    variant="contained" 
                    color="primary"
                    onClick={handleConfirm}
                    startIcon={<Check size={18} />}
                    sx={{ borderRadius: 10, px: 4, fontWeight: 900 }}
                  >
                    Use Photo
                  </Button>
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 3, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        <Button onClick={onClose} sx={{ fontWeight: 800 }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
