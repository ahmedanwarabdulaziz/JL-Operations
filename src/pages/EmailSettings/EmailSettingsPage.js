import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Box,
  CircularProgress,
  Paper
} from '@mui/material';
import { Email as EmailIcon, CheckCircle as CheckCircleIcon, Error as ErrorIcon } from '@mui/icons-material';
import {
  getGmailConfigStatus,
  sendEmailWithGmail,
  ensureGmailAuthorized
} from '../../services/emailService';

const EmailSettingsPage = () => {
  const [configStatus, setConfigStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    setConfigStatus(getGmailConfigStatus());
  }, []);

  const handleSendTestEmail = async () => {
    setIsSending(true);
    setSendResult(null);
    try {
      await ensureGmailAuthorized();
      const testOrderData = {
        personalInfo: { customerName: 'Test Customer', email: 'test@example.com', phone: '123-456-7890' },
        orderDetails: { billInvoice: 'TEST-001', platform: 'Test', startDate: '2024-01-15', timeline: '2 weeks' },
        furnitureData: { groups: [{ furnitureType: 'Test Chair', materialCode: 'T1', materialPrice: 100, quantity: 1, labourWork: 50, labourNote: '', foamPrice: 0, foamThickness: '', foamNote: '', customerNote: '' }] },
        paymentData: { deposit: 0, amountPaid: 0, pickupDeliveryEnabled: false, pickupDeliveryCost: 0 }
      };
      const result = await sendEmailWithGmail(testOrderData, 'test@example.com', () => {});
      setSendResult(result);
      setConfigStatus(getGmailConfigStatus());
    } catch (error) {
      setSendResult({ success: false, message: error.message });
    } finally {
      setIsSending(false);
    }
  };

  const isConfigured = configStatus?.gmail?.configured;

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Email
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            App backend (same project)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Emails are sent by the backend in this project using your Gmail. No third-party services.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Local:</strong> In one terminal run <code>npm run start:api</code> and keep it running. In another run <code>npm start</code>.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            <strong>Production:</strong> Deploy the same server (e.g. Render, Railway) with GMAIL_USER, GMAIL_APP_PASSWORD, and EMAIL_API_SECRET in the environment.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Status
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {configStatus?.gmail?.message || 'Loading…'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendTestEmail}
            disabled={isSending || !isConfigured}
            startIcon={isSending ? <CircularProgress size={18} /> : <EmailIcon />}
          >
            {isSending ? 'Sending…' : 'Send test email'}
          </Button>
          {sendResult && (
            <Alert severity={sendResult.success ? 'success' : 'error'} sx={{ mt: 2 }} icon={sendResult.success ? <CheckCircleIcon /> : <ErrorIcon />}>
              {sendResult.message}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default EmailSettingsPage;
