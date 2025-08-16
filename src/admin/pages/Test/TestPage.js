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
  Divider,
  CircularProgress
} from '@mui/material';
import {
  sendEmailWithGmail,
  sendDepositEmailWithGmail,
  loadGmailConfig,
  requestGmailPermissions,
  getGmailConfigStatus,
  ensureGmailAuthorized
} from '../shared/services/emailService';

const TestPage = () => {
  const [gmailConfig, setGmailConfig] = useState({ userEmail: '', accessToken: '' });
  const [authResult, setAuthResult] = useState(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
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

  const handleSendDepositEmail = async () => {
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
          amountPaid: 250,
          pickupDeliveryEnabled: true,
          pickupDeliveryCost: 30
        }
      };

      const result = await sendDepositEmailWithGmail(
        testOrderData,
        'test@example.com',
        (message) => console.log('Progress:', message)
      );

      setSendResult(result);
    } catch (error) {
      setSendResult({ success: false, message: `❌ Deposit email failed: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#1A1A1A', fontWeight: 'bold', mb: 3 }}>
        Email Test Page
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Gmail Configuration
          </Typography>
          
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
              startIcon={isAuthorizing ? <CircularProgress size={16} /> : null}
              sx={{
                backgroundColor: '#4285F4',
                '&:hover': { backgroundColor: '#3367D6' }
              }}
            >
              {isAuthorizing ? 'Authorizing...' : 'Authorize Gmail'}
            </Button>
          </Box>
          
          {authResult && (
            <Alert 
              severity={authResult.success ? 'success' : 'error'} 
              sx={{ mt: 2 }}
            >
              {authResult.message}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Test Email Sending
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Test sending emails using your Gmail account. Make sure you've authorized Gmail access first.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Button 
              variant="outlined" 
              onClick={handleSendTestEmail}
              disabled={isSending || !gmailConfig.accessToken}
              startIcon={isSending ? <CircularProgress size={16} /> : null}
            >
              {isSending ? 'Sending...' : 'Send Test Order Email'}
            </Button>
            <Button 
              variant="outlined" 
              onClick={handleSendDepositEmail}
              disabled={isSending || !gmailConfig.accessToken}
              startIcon={isSending ? <CircularProgress size={16} /> : null}
            >
              {isSending ? 'Sending...' : 'Send Test Deposit Email'}
            </Button>
          </Box>
          
          {sendResult && (
            <Alert 
              severity={sendResult.success ? 'success' : 'error'} 
              sx={{ mt: 2 }}
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
            <Box sx={{ p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Gmail Status:</strong> {configStatus.gmail.configured ? 'Configured' : 'Not Configured'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>User Email:</strong> {configStatus.gmail.userEmail}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Access Token:</strong> {configStatus.gmail.accessToken}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {configStatus.gmail.message}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default TestPage; 
