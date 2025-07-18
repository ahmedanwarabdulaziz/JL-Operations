import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  Avatar,
  Chip,
  Alert
} from '@mui/material';
import { useAuth } from '../Auth/AuthContext';
import { useGmailAuth } from '../../contexts/GmailAuthContext';
import { Google as GoogleIcon } from '@mui/icons-material';

const Header = () => {
  const { user, logout } = useAuth();
  const { gmailSignedIn, gmailUser, signIn, signOut } = useGmailAuth();


  
  // Get user initials for fallback
  const getUserInitials = () => {
    if (user?.displayName) {
      return user.displayName.split(' ').map(name => name.charAt(0)).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <AppBar 
      position="static" 
      sx={{ 
        backgroundColor: '#fff',
        color: '#333',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          JL Operation
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Gmail Sign-in Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {gmailSignedIn ? (
              <Chip
                icon={<GoogleIcon />}
                label={`Gmail: ${gmailUser?.email || 'Signed In'}`}
                color="success"
                size="small"
                onClick={signOut}
                sx={{ cursor: 'pointer' }}
              />
            ) : (
              <Button
                variant="outlined"
                size="small"
                startIcon={<GoogleIcon />}
                onClick={signIn}
                sx={{ textTransform: 'none' }}
              >
                Sign in Gmail
              </Button>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar 
              sx={{ 
                width: 32, 
                height: 32,
                backgroundColor: '#1976d2',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {getUserInitials()}
            </Avatar>
            <Typography variant="body2">
              {user.displayName || user.email}
            </Typography>
          </Box>
          <Button 
            color="inherit" 
            onClick={handleLogout}
            sx={{ textTransform: 'none' }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header; 