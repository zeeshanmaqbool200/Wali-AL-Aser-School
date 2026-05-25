import React from 'react';
import { AvatarGroup, Avatar, Tooltip, Box, Typography, alpha, useTheme } from '@mui/material';
import { motion } from 'motion/react';

interface AvatarStackProps {
  users: {
    uid: string;
    displayName: string;
    photoURL?: string;
    lastActiveAt?: number;
    isOnline?: boolean;
  }[];
  max?: number;
  size?: number;
}

export default function AvatarStack({ users, max = 4, size = 32 }: AvatarStackProps) {
  const theme = useTheme();
  
  if (!users || users.length === 0) return null;

  const displayUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <AvatarGroup 
        max={max}
        sx={{
          '& .MuiAvatar-root': {
            width: size,
            height: size,
            fontSize: size * 0.4,
            border: `2px solid ${theme.palette.background.paper}`,
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'translateY(-4px)',
              zIndex: 10,
            }
          }
        }}
      >
        {displayUsers.map((user) => (
          <Tooltip 
            key={user.uid} 
            title={
              <Box sx={{ p: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{user.displayName}</Typography>
                {user.lastActiveAt && (
                   <Typography variant="caption" sx={{ opacity: 0.7 }}>
                     {user.isOnline ? 'Active Now' : `Last seen ${new Date(user.lastActiveAt).toLocaleTimeString()}`}
                   </Typography>
                )}
              </Box>
            }
            arrow
          >
            <Avatar 
              src={user.photoURL} 
              alt={user.displayName}
              component={motion.div}
              whileHover={{ scale: 1.1 }}
            >
              {user.displayName.charAt(0)}
            </Avatar>
          </Tooltip>
        ))}
      </AvatarGroup>
      
      {remainingCount > 0 && (
        <Typography 
          variant="caption" 
          sx={{ 
            fontWeight: 800, 
            color: 'text.secondary',
            bgcolor: alpha(theme.palette.text.secondary, 0.05),
            px: 1,
            py: 0.5,
            borderRadius: 10
          }}
        >
          +{remainingCount} more
        </Typography>
      )}
    </Box>
  );
}
