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
import { useAuth } from '../../components/Auth/AuthContext';
import { Google as GoogleIcon } from '@mui/icons-material';
import { isGmailConfigured, getCurrentGmailConfig, ensureGmailAuthorized, signOutGmail } from '../../services/emailService';

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
      const result = await ensureGmailAuthorized();
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
          JL Upholstery
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
                sx={{ 
                  textTransform: 'none',
                  color: '#000000 !important',
                  borderColor: '#000000 !important',
                  '& .MuiButton-startIcon': {
                    color: '#000000 !important'
                  },
                  '&:hover': {
                    borderColor: '#333333 !important',
                    backgroundColor: 'rgba(0, 0, 0, 0.04) !important',
                    color: '#000000 !important'
                  },
                  '&:focus': {
                    color: '#000000 !important',
                    borderColor: '#000000 !important'
                  }
                }}
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
          <Box
            component="button"
            onClick={handleLogout}
            sx={{
              background: '#000000',
              border: '2px solid #000000',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#ffffff',
              textTransform: 'none',
              fontFamily: 'Roboto, Arial, sans-serif',
              transition: 'all 0.2s ease-in-out',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              '&:hover': {
                backgroundColor: '#333333',
                borderColor: '#333333',
                color: '#ffffff',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
              },
              '&:focus': {
                outline: '2px solid #ffffff',
                outlineOffset: '2px',
                color: '#ffffff'
              }
            }}
          >
            Logout
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header; 
