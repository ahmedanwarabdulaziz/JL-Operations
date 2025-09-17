import React, { useState, useEffect } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  Avatar,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import { useAuth } from '../Auth/AuthContext';
import { Google as GoogleIcon } from '@mui/icons-material';
import { isGmailConfigured, getCurrentGmailConfig } from '../../services/emailService';

const Header = () => {
  const { user, logout } = useAuth();
  const [gmailConfig, setGmailConfig] = useState(getCurrentGmailConfig());

  // Update Gmail config when user changes
  useEffect(() => {
    const updateGmailConfig = () => {
      const config = getCurrentGmailConfig();
      setGmailConfig(config);
    };

    // Update immediately
    updateGmailConfig();

    // Update when user changes
    if (user) {
      updateGmailConfig();
    }
  }, [user]);
  
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

  // Gmail is now automatically configured during login

  return (
    <AppBar 
      position="static" 
      sx={{ 
        backgroundColor: 'background.paper',
        color: 'text.primary',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          JL Upholstery
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Gmail Sign-in Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {user && (gmailConfig.isConfigured || localStorage.getItem('gmailAccessToken')) ? (
              <Chip
                icon={<GoogleIcon />}
                label={`Gmail: ${gmailConfig.userEmail || user.email || 'Ready'}`}
                color="success"
                size="small"
                sx={{ cursor: 'default' }}
              />
            ) : (
              <Chip
                icon={<GoogleIcon />}
                label="Gmail: Ready"
                color="info"
                size="small"
                sx={{ cursor: 'default' }}
              />
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
            onClick={handleLogout}
            sx={{ 
              textTransform: 'none',
              color: '#000000',
              backgroundColor: '#b98f33',
              '&:hover': {
                backgroundColor: '#d4af5a',
                color: '#000000'
              },
              '&:focus': {
                color: '#000000',
                backgroundColor: '#b98f33'
              }
            }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header; 