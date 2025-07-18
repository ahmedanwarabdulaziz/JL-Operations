import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Switch,
  Card,
  CardContent
} from '@mui/material';

const Step4PaymentNotes = ({ paymentData, onPaymentChange }) => {
  const [paymentInfo, setPaymentInfo] = useState(paymentData || {
    deposit: '',
    pickupDeliveryEnabled: false,
    pickupDeliveryCost: '',
    notes: ''
  });

  const handlePaymentChange = (field, value) => {
    const updatedPayment = { ...paymentInfo, [field]: value };
    setPaymentInfo(updatedPayment);
    onPaymentChange(updatedPayment);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Payment and Notes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set payment details and additional notes for the order.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Deposit */}
        <TextField
          fullWidth
          label="Deposit"
          type="number"
          value={paymentInfo.deposit}
          onChange={(e) => handlePaymentChange('deposit', e.target.value)}
          inputProps={{ min: 0, step: 0.01 }}
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
              borderWidth: '2px',
            },
          }}
        />

        {/* Pickup & Delivery Toggle */}
        <Card sx={{ p: 2 }}>
          <CardContent>
            <FormControlLabel
              control={
                <Switch
                  checked={paymentInfo.pickupDeliveryEnabled}
                  onChange={(e) => handlePaymentChange('pickupDeliveryEnabled', e.target.checked)}
                  color="primary"
                />
              }
              label="Pickup & Delivery Each"
            />
            
            {paymentInfo.pickupDeliveryEnabled && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ height: 1, backgroundColor: 'divider', mb: 2 }} />
                <TextField
                  fullWidth
                  label="Cost of Pickup & Delivery Each"
                  type="number"
                  value={paymentInfo.pickupDeliveryCost}
                  onChange={(e) => handlePaymentChange('pickupDeliveryCost', e.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '2px',
                      borderColor: 'grey.300',
                      borderRadius: 2,
                    },
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                      borderWidth: '2px',
                    },
                  }}
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <TextField
          fullWidth
          label="Notes"
          multiline
          rows={4}
          value={paymentInfo.notes}
          onChange={(e) => handlePaymentChange('notes', e.target.value)}
          placeholder="Add any additional notes or special instructions..."
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
              borderWidth: '2px',
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default Step4PaymentNotes; 