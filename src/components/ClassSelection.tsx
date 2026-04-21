import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Typography, Grid, Card, CardActionArea, 
  CardContent, Box, alpha, useTheme 
} from '@mui/material';
import { BookOpen, CheckCircle } from 'lucide-react';
import { MaktabLevel } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';

interface ClassSelectionProps {
  open: boolean;
  userId: string;
  onComplete: () => void;
}

export default function ClassSelection({ open, userId, onComplete }: ClassSelectionProps) {
  const theme = useTheme();
  const [selected, setSelected] = useState<MaktabLevel | null>(null);
  const [loading, setLoading] = useState(false);

  const levels: MaktabLevel[] = [
    'Awal', 'Doum', 'Soam', 'Chaharum', 'panjum', 'shahsum', 
    'haftum', 'hashtum', 'dahum', 'Hafiz'
  ];

  const handleSelect = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        pendingMaktabLevel: selected
      });
      onComplete();
    } catch (error) {
      console.error("Error updating class selection:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      maxWidth="md" 
      fullWidth 
      PaperProps={{ sx: { borderRadius: 5, p: 2 } }}
    >
      <DialogTitle component="div" sx={{ textAlign: 'center', pt: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1.5 }}>
          Select Your Maktab Level
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontWeight: 500 }}>
          Please select the class you want to join. A teacher will approve your request.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Grid container spacing={2}>
          {levels.map((level) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={level}>
              <Card 
                sx={{ 
                  borderRadius: 4, 
                  border: '2px solid', 
                  borderColor: selected === level ? 'primary.main' : 'divider',
                  bgcolor: selected === level ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
                  transition: 'all 0.2s'
                }}
              >
                <CardActionArea onClick={() => setSelected(level)}>
                  <CardContent sx={{ p: 3, textAlign: 'center' }}>
                    <Box sx={{ 
                      display: 'inline-flex', 
                      p: 1.5, 
                      borderRadius: 3, 
                      bgcolor: selected === level ? 'primary.main' : 'grey.100',
                      color: selected === level ? 'white' : 'text.secondary',
                      mb: 2
                    }}>
                      <BookOpen size={24} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{level}</Typography>
                    {selected === level && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Box sx={{ color: 'primary.main', mt: 1 }}>
                          <CheckCircle size={20} />
                        </Box>
                      </motion.div>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 4, justifyContent: 'center' }}>
        <Button 
          variant="contained" 
          size="large"
          disabled={!selected || loading}
          onClick={handleSelect}
          sx={{ 
            borderRadius: 4, 
            px: 8, 
            py: 1.5, 
            fontWeight: 900,
            boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`
          }}
        >
          {loading ? 'Submitting...' : 'Confirm Selection'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
