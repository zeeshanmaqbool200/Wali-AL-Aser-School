import React, { useState } from 'react';
import { 
  IconButton, Menu, MenuItem, ListItemIcon, 
  ListItemText, Divider as MuiDivider
} from '@mui/material';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  tooltip?: string;
  divider?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  icon?: React.ReactNode;
  size?: 'small' | 'medium';
}

export default function ActionMenu({ items, icon, size = 'small' }: ActionMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (e?: any) => {
    if (e) e.stopPropagation();
    setAnchorEl(null);
  };

  const activeItems = items.filter(item => !item.disabled || item.divider);

  if (activeItems.length === 0) return null;

  return (
    <>
      <IconButton 
        size={size} 
        onClick={handleClick}
        sx={{ 
          transition: 'transform 0.2s',
          '&:hover': { transform: 'scale(1.1)' } 
        }}
      >
        {icon || <MoreVertical size={size === 'small' ? 18 : 22} />}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: { 
            borderRadius: 3, 
            minWidth: 200, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.05)',
            mt: 0.5,
            padding: '4px 0'
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {activeItems.map((item, idx) => (
          item.divider ? (
            <MuiDivider key={idx} sx={{ my: 1, opacity: 0.6 }} />
          ) : (
            <MenuItem 
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                handleClose();
              }}
              sx={{ 
                py: 1,
                px: 2,
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <ListItemIcon sx={{ color: item.color || 'text.secondary', minWidth: 36 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.label} 
                primaryTypographyProps={{ 
                  variant: 'body2', 
                  fontWeight: 600,
                  color: item.color || 'text.primary'
                }} 
              />
            </MenuItem>
          )
        ))}
      </Menu>
    </>
  );
}
