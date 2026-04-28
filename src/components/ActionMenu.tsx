import React, { useState } from 'react';
import { 
  IconButton, Menu, MenuItem, ListItemIcon, 
  ListItemText, Tooltip 
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

  const activeItems = items.filter(item => !item.disabled);

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
            minWidth: 180, 
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            border: '1px solid rgba(0,0,0,0.05)',
            mt: 0.5
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {activeItems.map((item, idx) => (
          <React.Fragment key={idx}>
            <MenuItem 
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                handleClose();
              }}
              sx={{ 
                py: 1.2,
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
                  fontWeight: 700,
                  color: item.color || 'text.primary'
                }} 
              />
            </MenuItem>
            {item.divider && <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.05)', margin: '4px 0' }} />}
          </React.Fragment>
        ))}
      </Menu>
    </>
  );
}
