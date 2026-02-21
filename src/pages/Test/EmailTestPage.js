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
  Switch,
  FormControlLabel,
  Paper
} from '@mui/material';
import {
  sendCompletionEmailWithGmail,
  loadGmailConfig,
  getGmailConfigStatus,
  ensureGmailAuthorized
} from '../../services/emailService';

const EmailTestPage = () => {
  const [configStatus, setConfigStatus] = useState(null);
  const [authResult, setAuthResult] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [customerName, setCustomerName] = useState('Test Customer');
  const [orderNumber, setOrderNumber] = useState('TEST-001');
  const [includeReview, setIncludeReview] = useState(true);
  const [treatments, setTreatments] = useState('Leather Treatment, Fabric Protection');

  useEffect(() => {
    loadGmailConfig();
    setConfigStatus(getGmailConfigStatus());
  }, []);

  const handleCheckAuth = async () => {
    setIsCheckingAuth(true);
    setAuthResult(null);
    try {
      await ensureGmailAuthorized();
      setConfigStatus(getGmailConfigStatus());
      setAuthResult({ success: true, message: '✅ You are logged in. Email can be sent from the server.' });
    } catch (error) {
      setAuthResult({ success: false, message: `❌ ${error.message}` });
    } finally {
      setIsCheckingAuth(false);
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
      const testOrderData = {
        personalInfo: { customerName, email: testEmail },
        orderDetails: { billInvoice: orderNumber },
        furnitureData: {
          groups: treatments.split(',').map((treatment) => ({
            treatment: treatment.trim(),
            furnitureType: `Test ${treatment.trim()} Item`
          }))
        },
        paymentData: { totalAmount: 1500 }
      };
      const onProgress = (message) => setSendResult({ success: true, message: `📧 ${message}` });
      const result = await sendCompletionEmailWithGmail(
        testOrderData,
        testEmail,
        includeReview,
        onProgress
      );
      setSendResult(result);
    } catch (error) {
      setSendResult({ success: false, message: `Error: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  const isConfigured = configStatus?.gmail?.configured;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Email Testing Page
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Email status
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {configStatus?.gmail?.message || 'Loading...'}
              </Typography>
              <Button
                variant="outlined"
                onClick={handleCheckAuth}
                disabled={isCheckingAuth}
                startIcon={isCheckingAuth ? <CircularProgress size={20} /> : null}
              >
                {isCheckingAuth ? 'Checking...' : 'Check session'}
              </Button>
              {authResult && (
                <Alert severity={authResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                  {authResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

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
                control={<Switch checked={includeReview} onChange={(e) => setIncludeReview(e.target.checked)} />}
                label="Include Review Request"
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleTestCompletionEmail}
                disabled={isSending || !testEmail.trim() || !isConfigured}
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

        <Grid item xs={12}>
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <Typography variant="body2" color="text.secondary">
              Emails are sent from the server. Log in with your PIN to send. Check the browser console (F12) for progress logs.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmailTestPage;
