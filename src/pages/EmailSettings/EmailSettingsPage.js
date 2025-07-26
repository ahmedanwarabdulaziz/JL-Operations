import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Box,
  Grid,
  CircularProgress,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Google as GoogleIcon
} from '@mui/icons-material';
import {
  loadGmailConfig,
  saveGmailConfig,
  requestGmailPermissions,
  sendEmailWithGmail,
  getGmailConfigStatus,
  ensureGmailAuthorized
} from '../../services/emailService';

const EmailSettingsPage = () => {
  const [gmailConfig, setGmailConfig] = useState({
    userEmail: '',
    accessToken: ''
  });
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [authResult, setAuthResult] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [configStatus, setConfigStatus] = useState(null);

  useEffect(() => {
    const config = loadGmailConfig();
    setGmailConfig({
      userEmail: config.userEmail || '',
      accessToken: config.accessToken ? 'Set' : ''
    });
    setConfigStatus(getGmailConfigStatus());
  }, []);

  const handleAuthorizeGmail = async () => {
    setIsAuthorizing(true);
    setAuthResult(null);
    
    try {
      const result = await requestGmailPermissions();
      setGmailConfig({
        userEmail: result.userEmail,
        accessToken: 'Set'
      });
      setAuthResult({ success: true, message: '✅ Gmail authorization successful!' });
      setConfigStatus(getGmailConfigStatus());
    } catch (error) {
      setAuthResult({ success: false, message: `❌ Gmail authorization failed: ${error.message}` });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleSendTestEmail = async () => {
    setIsSending(true);
    setSendResult(null);
    
    try {
      // Auto-check and authorize Gmail if needed
      await ensureGmailAuthorized();
      setGmailConfig(getCurrentGmailConfig());
      
      const testOrderData = {
        personalInfo: {
          customerName: 'Test Customer',
          email: 'test@example.com',
          phone: '123-456-7890'
        },
        orderDetails: {
          billInvoice: 'TEST-001',
          platform: 'Test Platform',
          startDate: '2024-01-15',
          timeline: '2 weeks'
        },
        furnitureData: {
          groups: [{
            furnitureType: 'Test Chair',
            materialCode: 'TEST001',
            materialPrice: 100,
            quantity: 2,
            labourWork: 50,
            labourNote: 'Basic upholstery',
            foamPrice: 25,
            foamThickness: '2 inch',
            foamNote: 'High density',
            customerNote: 'Test order'
          }]
        },
        paymentData: {
          deposit: 500,
          amountPaid: 0,
          pickupDeliveryEnabled: true,
          pickupDeliveryCost: 30
        }
      };

      const result = await sendEmailWithGmail(
        testOrderData,
        'test@example.com',
        (message) => console.log('Progress:', message)
      );
      
      setSendResult(result);
    } catch (error) {
      setSendResult({ success: false, message: `❌ Test email failed: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#1A1A1A', fontWeight: 'bold', mb: 3 }}>
        Gmail Email Configuration
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          <strong>Gmail Setup Instructions:</strong>
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><InfoIcon color="info" /></ListItemIcon>
            <ListItemText primary="1. Click 'Authorize Gmail' to grant email sending permissions" />
          </ListItem>
          <ListItem>
            <ListItemIcon><InfoIcon color="info" /></ListItemIcon>
            <ListItemText primary="2. Sign in with your Google account when prompted" />
          </ListItem>
          <ListItem>
            <ListItemIcon><InfoIcon color="info" /></ListItemIcon>
            <ListItemText primary="3. Grant permission to send emails on your behalf" />
          </ListItem>
          <ListItem>
            <ListItemIcon><InfoIcon color="info" /></ListItemIcon>
            <ListItemText primary="4. Test sending an email to verify everything works" />
          </ListItem>
        </List>
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <GoogleIcon sx={{ mr: 1, color: '#4285F4' }} />
            <Typography variant="h6">
              Gmail Authorization
            </Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Gmail Account"
                value={gmailConfig.userEmail}
                InputProps={{ readOnly: true }}
                placeholder="Not authorized"
                sx={{ mb: 2 }}
                helperText="Your Gmail account (set after authorization)"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Access Token"
                value={gmailConfig.accessToken}
                InputProps={{ readOnly: true }}
                placeholder="Not set"
                sx={{ mb: 2 }}
                helperText="Gmail API access token (set after authorization)"
              />
            </Grid>
          </Grid>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Button 
              variant="contained" 
              onClick={handleAuthorizeGmail}
              disabled={isAuthorizing}
              startIcon={isAuthorizing ? <CircularProgress size={16} /> : <GoogleIcon />}
              sx={{
                backgroundColor: '#4285F4',
                '&:hover': { backgroundColor: '#3367D6' }
              }}
            >
              {isAuthorizing ? 'Authorizing...' : 'Authorize Gmail'}
            </Button>
            <Button 
              variant="outlined" 
              onClick={handleSendTestEmail}
              disabled={isSending || !gmailConfig.accessToken}
              startIcon={isSending ? <CircularProgress size={16} /> : <EmailIcon />}
            >
              {isSending ? 'Sending...' : 'Send Test Email'}
            </Button>
          </Box>
          
          {authResult && (
            <Alert 
              severity={authResult.success ? 'success' : 'error'} 
              sx={{ mt: 2 }}
              icon={authResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
            >
              {authResult.message}
            </Alert>
          )}
          
          {sendResult && (
            <Alert 
              severity={sendResult.success ? 'success' : 'error'} 
              sx={{ mt: 2 }}
              icon={sendResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
            >
              {sendResult.message}
            </Alert>
          )}
        </CardContent>
      </Card>

      {configStatus && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configuration Status
            </Typography>
            <Paper sx={{ p: 2, backgroundColor: '#f8f9fa' }}>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Gmail Status:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                User Email: {configStatus.gmail.userEmail}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Access Token: {configStatus.gmail.accessToken}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {configStatus.gmail.message}
              </Typography>
            </Paper>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default EmailSettingsPage; 