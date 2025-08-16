import React, { useState } from 'react';
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
import { useAuth } from '../shared/components/Auth/AuthContext';
import { Google as GoogleIcon } from '@mui/icons-material';
import { isGmailConfigured, getCurrentGmailConfig, requestGmailPermissions, signOutGmail } from '../shared/services/emailService';

const Header = () => {
  const { user, logout } = useAuth();
  const [gmailConfig, setGmailConfig] = useState(getCurrentGmailConfig());
  const [isAuthorizing, setIsAuthorizing] = useState(false);


  
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

  const handleGmailSignIn = async () => {
    setIsAuthorizing(true);
    try {
      const result = await requestGmailPermissions();
      setGmailConfig(result);
    } catch (error) {
      console.error('Gmail authorization failed:', error);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleGmailSignOut = () => {
    signOutGmail();
    setGmailConfig(getCurrentGmailConfig());
  };

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
          JL Operation
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Gmail Sign-in Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {gmailConfig.isConfigured ? (
              <Chip
                icon={<GoogleIcon />}
                label={`Gmail: ${gmailConfig.userEmail || 'Authorized'}`}
                color="success"
                size="small"
                onClick={handleGmailSignOut}
                sx={{ cursor: 'pointer' }}
              />
            ) : (
              <Button
                variant="outlined"
                size="small"
                startIcon={isAuthorizing ? <CircularProgress size={16} /> : <GoogleIcon />}
                onClick={handleGmailSignIn}
                disabled={isAuthorizing}
                sx={{ textTransform: 'none' }}
              >
                {isAuthorizing ? 'Authorizing...' : 'Authorize Gmail'}
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
