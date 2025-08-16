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
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../firebase/config';

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
      // Check if user is already signed in
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('⚠️ User already signed in. Signing out to get Gmail permissions...');
        await signOut(auth);
      }
      
      // Create a new Google provider with Gmail scopes
      const googleProvider = new GoogleAuthProvider();
      
      // Add basic scopes
      googleProvider.addScope('profile');
      googleProvider.addScope('email');
      googleProvider.addScope('openid');
      
      // Add Gmail scopes for email sending
      googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
      googleProvider.addScope('https://www.googleapis.com/auth/gmail.compose');
      
      // Configure Google provider to force consent
      googleProvider.setCustomParameters({
        prompt: 'consent',
        access_type: 'offline'
      });
      
      console.log('🔄 Starting Google sign-in with Gmail scopes...');
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Get the access token for Gmail API
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      
      console.log('Sign-in result:', result);
      console.log('Credential:', credential);
      console.log('Access token available:', !!accessToken);
      console.log('Access token length:', accessToken?.length || 0);
      
      console.log('User signed in:', user.email);
      console.log('Access token received:', !!accessToken);
      console.log('Full user object:', {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        uid: user.uid,
        providerData: user.providerData
      });
      
      // Store the access token for email service
      if (accessToken) {
        localStorage.setItem('gmailAccessToken', accessToken);
        localStorage.setItem('gmailUser', JSON.stringify({
          email: user.email,
          name: user.displayName,
          picture: user.photoURL,
        }));
        console.log('✅ Gmail access token stored for email sending');
        console.log('📧 Real email sending is now enabled!');
        
        // Check what scopes were granted
        try {
          const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
          const tokenData = await tokenInfo.json();
          console.log('🔍 Token scopes granted:', tokenData.scope);
        } catch (error) {
          console.log('Could not check token scopes:', error);
        }
      } else {
        console.log('⚠️ No Gmail access token received - email simulation will be used');
        console.log('💡 To enable real emails, sign out and sign in again');
        console.log('🔧 This might be because Gmail scopes were not requested in previous sign-in');
      }
      
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
                     <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3, color: '#000000', fontWeight: 'bold' }}>
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
             startIcon={loading ? <CircularProgress size={20} sx={{ color: '#000000' }} /> : <GoogleIcon sx={{ color: '#000000' }} />}
             onClick={handleGoogleSignIn}
             disabled={loading}
                          sx={{
                width: '100%',
                py: 2,
                background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                color: '#000000 !important',
                border: '3px solid #4CAF50',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 6px 12px rgba(0,0,0,0.3)',
                position: 'relative',
                '&:hover': {
                  background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
                  border: '3px solid #45a049',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.4)',
                  color: '#000000 !important'
                },
                '&:focus': {
                  color: '#000000 !important'
                },
                '&:disabled': {
                  background: 'linear-gradient(145deg, #a0a0a0 0%, #808080 50%, #606060 100%)',
                  border: '3px solid #666666',
                  color: '#666666 !important',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2)'
                },
                fontWeight: 'bold',
                fontSize: '1.1rem',
                textTransform: 'none',
                borderRadius: 2,
                '& .MuiButton-startIcon': {
                  color: '#000000'
                },
                '& .MuiButton-startIcon .MuiSvgIcon-root': {
                  color: '#000000'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                  borderRadius: '6px 6px 0 0',
                  pointerEvents: 'none'
                }
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