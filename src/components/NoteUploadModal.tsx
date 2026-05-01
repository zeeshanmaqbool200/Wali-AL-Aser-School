import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Box, Typography, Grid } from '@mui/material';
import { BookOpen, Upload, FileText, Tag, Users } from 'lucide-react';

interface NoteUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export default function NoteUploadModal({ open, onClose, onSubmit }: NoteUploadModalProps) {
  const [formData, setFormData] = React.useState({
    title: '',
    subject: '',
    classLevel: '',
    description: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name as string]: value }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <BookOpen size={24} color="#1976d2" />
        Upload Study Note
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <TextField
            name="title"
            label="Note Title"
            fullWidth
            value={formData.title}
            onChange={handleChange}
            InputProps={{
              startAdornment: <FileText size={18} style={{ marginRight: 12, color: '#666' }} />,
            }}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Subject</InputLabel>
                <Select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange as any}
                  label="Subject"
                  startAdornment={<Tag size={18} style={{ marginRight: 12, color: '#666' }} />}
                >
                  <MenuItem value="Mathematics">Mathematics</MenuItem>
                  <MenuItem value="Physics">Physics</MenuItem>
                  <MenuItem value="Computer Science">Computer Science</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Class Level</InputLabel>
                <Select
                  name="classLevel"
                  value={formData.classLevel}
                  onChange={handleChange as any}
                  label="Class Level"
                  startAdornment={<Users size={18} style={{ marginRight: 12, color: '#666' }} />}
                >
                  <MenuItem value="Mubtadi">Mubtadi</MenuItem>
                  <MenuItem value="Awal">Awal</MenuItem>
                  <MenuItem value="Doum">Doum</MenuItem>
                  <MenuItem value="Soum">Soum</MenuItem>
                  <MenuItem value="Chaharm">Chaharm</MenuItem>
                  <MenuItem value="Panjum">Panjum</MenuItem>
                  <MenuItem value="Shasham">Shasham</MenuItem>
                  <MenuItem value="Haftum">Haftum</MenuItem>
                  <MenuItem value="Hashtum">Hashtum</MenuItem>
                  <MenuItem value="Nahum">Nahum</MenuItem>
                  <MenuItem value="Dahum">Dahum</MenuItem>
                  <MenuItem value="Hafiz">Hafiz</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField
            name="description"
            label="Description"
            multiline
            rows={3}
            fullWidth
            value={formData.description}
            onChange={handleChange}
            placeholder="e.g. Chapter 4: Linear Equations"
          />

          <Button
            variant="outlined"
            component="label"
            startIcon={<Upload size={18} />}
            sx={{ py: 3, borderStyle: 'dashed', borderRadius: 2, textTransform: 'none' }}
          >
            Select PDF/Document
            <input type="file" hidden />
          </Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.title || !formData.subject || !formData.classLevel}
          sx={{ px: 4 }}
        >
          Upload Note
        </Button>
      </DialogActions>
    </Dialog>
  );
}
