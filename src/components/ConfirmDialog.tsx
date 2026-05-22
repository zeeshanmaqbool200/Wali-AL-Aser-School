import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  Button,
  useTheme,
  alpha
} from '@mui/material';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel',
  isDestructive = true
}) => {
  const theme = useTheme();

  return (
    <Dialog 
      open={isOpen} 
      onClose={onCancel}
      PaperProps={{
        sx: {
          borderRadius: 3,
          padding: 0.5,
          maxWidth: 320
        }
      }}
    >
      <DialogTitle sx={{ 
        fontWeight: 900, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        color: isDestructive ? 'error.main' : 'primary.main'
      }}>
        {isDestructive && <AlertTriangle size={24} />}
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button 
          onClick={onCancel} 
          sx={{ 
            borderRadius: 2, 
            fontWeight: 700,
            color: 'text.secondary',
            '&:hover': { bgcolor: alpha(theme.palette.text.secondary, 0.1) }
          }}
        >
          {cancelLabel}
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color={isDestructive ? 'error' : 'primary'}
          sx={{ 
            borderRadius: 2, 
            px: 3, 
            fontWeight: 700,
            boxShadow: isDestructive ? `0 8px 16px ${alpha(theme.palette.error.main, 0.25)}` : `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`
          }}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
