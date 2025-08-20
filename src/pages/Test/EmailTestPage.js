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
  CircularProgress,
  Switch,
  FormControlLabel,
  Paper
} from '@mui/material';
import {
  sendCompletionEmailWithGmail,
  loadGmailConfig,
  requestGmailPermissions,
  getGmailConfigStatus,
  ensureGmailAuthorized
} from '../../services/emailService';

const EmailTestPage = () => {
  const [gmailConfig, setGmailConfig] = useState({ userEmail: '', accessToken: '' });
  const [authResult, setAuthResult] = useState(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [configStatus, setConfigStatus] = useState(null);
  
  // Test email fields
  const [testEmail, setTestEmail] = useState('');
  const [customerName, setCustomerName] = useState('Test Customer');
  const [orderNumber, setOrderNumber] = useState('TEST-001');
  const [includeReview, setIncludeReview] = useState(true);
  const [treatments, setTreatments] = useState('Leather Treatment, Fabric Protection');

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

  const handleTestCompletionEmail = async () => {
    if (!testEmail.trim()) {
      setSendResult({ success: false, message: 'Please enter a test email address' });
      return;
    }

    setIsSending(true);
    setSendResult(null);
    
    try {
      // Create test order data
      const testOrderData = {
        personalInfo: {
          customerName: customerName,
          email: testEmail
        },
        orderDetails: {
          billInvoice: orderNumber
        },
        furnitureData: {
          groups: treatments.split(',').map(treatment => ({
            treatment: treatment.trim()
          }))
        },
        paymentData: {
          totalAmount: 1500
        }
      };

      console.log('🧪 Test - Sending completion email with data:', testOrderData);

      const onProgress = (message) => {
        console.log('🧪 Test - Email progress:', message);
        setSendResult({ success: true, message: `📧 ${message}` });
      };

      const result = await sendCompletionEmailWithGmail(
        testEmail,
        testOrderData,
        includeReview,
        onProgress
      );
      
      console.log('🧪 Test - Email result:', result);
      setSendResult(result);
      
    } catch (error) {
      console.error('🧪 Test - Error:', error);
      setSendResult({ success: false, message: `Error: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  const handleTestGmailAuth = async () => {
    setIsAuthorizing(true);
    setAuthResult(null);
    
    try {
      console.log('🧪 Test - Testing Gmail authorization...');
      const config = await ensureGmailAuthorized();
      console.log('🧪 Test - Gmail config:', config);
      setAuthResult({ success: true, message: '✅ Gmail authorization test successful!' });
    } catch (error) {
      console.error('🧪 Test - Gmail auth error:', error);
      setAuthResult({ success: false, message: `❌ Gmail authorization test failed: ${error.message}` });
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🧪 Email Testing Page
      </Typography>
      
      <Grid container spacing={3}>
        {/* Gmail Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Gmail Configuration
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Status: {configStatus?.isConfigured ? '✅ Configured' : '❌ Not Configured'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Email: {gmailConfig.userEmail || 'Not set'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Token: {gmailConfig.accessToken || 'Not set'}
                </Typography>
              </Box>
              
              <Button
                variant="contained"
                onClick={handleAuthorizeGmail}
                disabled={isAuthorizing}
                startIcon={isAuthorizing ? <CircularProgress size={20} /> : null}
                sx={{ mr: 1 }}
              >
                {isAuthorizing ? 'Authorizing...' : 'Authorize Gmail'}
              </Button>
              
              <Button
                variant="outlined"
                onClick={handleTestGmailAuth}
                disabled={isAuthorizing}
              >
                Test Auth
              </Button>
              
              {authResult && (
                <Alert severity={authResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                  {authResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Completion Email Test */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Completion Email Test
              </Typography>
              
              <TextField
                fullWidth
                label="Test Email Address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Order Number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Treatments (comma-separated)"
                value={treatments}
                onChange={(e) => setTreatments(e.target.value)}
                placeholder="Leather Treatment, Fabric Protection"
                sx={{ mb: 2 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={includeReview}
                    onChange={(e) => setIncludeReview(e.target.checked)}
                  />
                }
                label="Include Review Request"
                sx={{ mb: 2 }}
              />
              
              <Button
                variant="contained"
                color="primary"
                onClick={handleTestCompletionEmail}
                disabled={isSending || !testEmail.trim()}
                startIcon={isSending ? <CircularProgress size={20} /> : null}
                fullWidth
              >
                {isSending ? 'Sending...' : 'Send Test Completion Email'}
              </Button>
              
              {sendResult && (
                <Alert severity={sendResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                  {sendResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Debug Information */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <Typography variant="h6" gutterBottom>
              🔍 Debug Information
            </Typography>
            <Typography variant="body2" paragraph>
              Check the browser console (F12) for detailed debug logs when testing emails.
            </Typography>
            <Typography variant="body2" paragraph>
              Common issues to check:
            </Typography>
            <ul>
              <li>Gmail authorization status</li>
              <li>Customer email address format</li>
              <li>Order data structure</li>
              <li>Network connectivity</li>
              <li>Gmail API quotas</li>
            </ul>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmailTestPage;
