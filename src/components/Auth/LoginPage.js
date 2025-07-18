import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Alert,
  Container,
  CircularProgress
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase/config';

// List of authorized email addresses
const AUTHORIZED_EMAILS = [
  'ahmedanwarabdulaziz@gmail.com',
  'jl@jlupholstery.com',
];

const LoginPage = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Configure Google provider to get profile picture
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      console.log('User signed in:', user.email);
      console.log('Full user object:', {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        uid: user.uid,
        providerData: user.providerData
      });
      
      // Log detailed provider information
      if (user.providerData && user.providerData.length > 0) {
        console.log('Provider data details:', user.providerData[0]);
        console.log('Provider photo URL:', user.providerData[0].photoURL);
      }
      
      // Check if user's email is authorized
      if (!AUTHORIZED_EMAILS.includes(user.email)) {
        console.log('Unauthorized email:', user.email);
        await signOut(auth);
        setError(`Access denied. Email ${user.email} is not authorized to use this application.`);
        return;
      }
      
      console.log('User authorized, proceeding...');
      // Success - user is authorized
      onLoginSuccess(user);
      
    } catch (error) {
      console.error('Sign-in error:', error);
      setError(`Sign-in failed: ${error.message}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            width: '100%',
            maxWidth: 400,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
            JL Operation
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Sign in to access your dashboard
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
            onClick={handleGoogleSignIn}
            disabled={loading}
            sx={{
              width: '100%',
              py: 1.5,
              backgroundColor: '#4285f4',
              '&:hover': {
                backgroundColor: '#3367d6',
              },
            }}
          >
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Only authorized users can access this application
          </Typography>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Authorized emails: {AUTHORIZED_EMAILS.join(', ')}
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage; 