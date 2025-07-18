import React, { useState, useRef } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Alert,
  Grid,
  CircularProgress
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import { GMAIL_CONFIG, GMAIL_SCOPES, GMAIL_DISCOVERY_DOC } from '../../config/gmail';

const TestPage = () => {
  const [formData, setFormData] = useState({
    to: '',
    subject: 'Test Email from JL Upholstery',
    body: 'This is a test email to verify the email functionality is working properly.\n\nBest regards,\nJL Upholstery Team'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const gisInitialized = useRef(false);

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  // Google Identity Services sign-in
  const handleGoogleSignIn = () => {
    setSigningIn(true);
    setResult(null);
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      setResult({ type: 'error', message: 'Google Identity Services not loaded. Please refresh the page.' });
      setSigningIn(false);
      return;
    }
    window.google.accounts.oauth2.initTokenClient({
      client_id: GMAIL_CONFIG.CLIENT_ID,
      scope: GMAIL_SCOPES.join(' '),
      callback: (response) => {
        if (response.error) {
          setResult({ type: 'error', message: 'Google sign-in failed: ' + response.error });
          setSigningIn(false);
          return;
        }
        setToken(response.access_token);
        // Get user info
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + response.access_token }
        })
          .then(res => res.json())
          .then(data => setUser(data))
          .catch(() => setUser(null));
        setSigningIn(false);
      },
    }).requestAccessToken();
  };

  const handleSignOut = () => {
    setToken(null);
    setUser(null);
    setResult(null);
  };

  // Send email using Gmail API
  const handleSendEmail = async () => {
    setLoading(true);
    setResult(null);
    try {
      if (!token) throw new Error('You must sign in with Google first.');
      // Load Gmail API
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Google API loading timeout. Please refresh the page and try again.'));
        }, 10000);
        window.gapi.load('client', async () => {
          try {
            clearTimeout(timeout);
            await window.gapi.client.init({
              discoveryDocs: [GMAIL_DISCOVERY_DOC],
            });
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
      // Set the access token for Gmail API
      window.gapi.client.setToken({ access_token: token });
      // Create email content
      const emailContent = [
        `From: \"JL Upholstery\" <${user?.email || 'jlupholstery@jloperation.com'}>`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        `To: ${formData.to}`,
        `Subject: ${formData.subject}`,
        '',
        formData.body
      ].join('\r\n');
      // Encode email for Gmail API
      const encodedEmail = btoa(emailContent).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      // Send email using Gmail API
      const response = await window.gapi.client.gmail.users.messages.send({
        userId: 'me',
        resource: { raw: encodedEmail }
      });
      setResult({
        type: 'success',
        message: `Test email sent successfully to ${formData.to}! Gmail Message ID: ${response.result.id}`
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: `Failed to send email: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Email Test Page
      </Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon color="primary" />
          Send Test Email
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Test the email functionality by sending a test email with sender name "JL Upholstery".
        </Typography>
        {result && (
          <Alert severity={result.type} sx={{ mb: 3 }}>
            {result.message}
          </Alert>
        )}
        {!token ? (
          <Button
            variant="contained"
            color="primary"
            onClick={handleGoogleSignIn}
            startIcon={<EmailIcon />}
            disabled={signingIn}
            sx={{ mb: 2 }}
          >
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </Button>
        ) : (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="success.main">
              Signed in as {user?.email || 'Google User'}
            </Typography>
            <Button variant="outlined" color="secondary" onClick={handleSignOut} size="small">Sign Out</Button>
          </Box>
        )}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="To Email"
              value={formData.to}
              onChange={handleInputChange('to')}
              placeholder="Enter recipient email address"
              type="email"
              required
              sx={{ mb: 2 }}
              disabled={!token}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="From"
              value={user?.email || 'jlupholstery@jloperation.com'}
              disabled
              sx={{ mb: 2 }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Subject"
              value={formData.subject}
              onChange={handleInputChange('subject')}
              sx={{ mb: 2 }}
              disabled={!token}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Message Body"
              value={formData.body}
              onChange={handleInputChange('body')}
              multiline
              rows={6}
              sx={{ mb: 3 }}
              disabled={!token}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              onClick={handleSendEmail}
              disabled={loading || !formData.to || !token}
              sx={{
                py: 1.5,
                px: 4,
                backgroundColor: '#1976d2',
                '&:hover': {
                  backgroundColor: '#1565c0',
                },
              }}
              fullWidth
            >
              {loading ? 'Sending...' : 'Send Test Email'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Email Configuration Details
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <strong>Sender Name:</strong> JL Upholstery<br />
          <strong>Sender Email:</strong> {user?.email || 'jlupholstery@jloperation.com'}<br />
          <strong>Default Subject:</strong> Test Email from JL Upholstery<br />
          <strong>Status:</strong> {token ? 'Signed in' : 'Sign in required'}
        </Typography>
      </Paper>
    </Box>
  );
};

export default TestPage; 