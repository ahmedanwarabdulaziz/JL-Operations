import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel
} from '@mui/material';

const Step4PaymentNotes = ({
  paymentDetails,
  onPaymentChange,
  formErrors = {},
  setFormErrors
}) => {
  const handleInputChange = (field, value) => {
    onPaymentChange(field, value);
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFocus = (event) => {
    // Select all text when field is focused
    event.target.select();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Payment & Notes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Set payment details and additional notes for the order.
      </Typography>

      {/* Required Deposit Amount */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Required Deposit Amount"
          type="number"
          value={paymentDetails.deposit}
          onChange={(e) => handleInputChange('deposit', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
          onFocus={handleFocus}
          inputProps={{ min: 0, step: 0.01 }}
          placeholder="Enter required deposit amount"
          helperText="Amount the customer needs to pay"
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

      {/* Amount Paid */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Amount Paid by Customer"
          type="number"
          value={paymentDetails.amountPaid}
          onChange={(e) => handleInputChange('amountPaid', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
          onFocus={handleFocus}
          inputProps={{ min: 0, step: 0.01 }}
          placeholder="Enter amount actually paid"
          helperText="Amount the customer has actually paid"
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
      
      {/* Pickup & Delivery Toggle */}
      <Box sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={paymentDetails.pickupDeliveryEnabled}
              onChange={(e) => handleInputChange('pickupDeliveryEnabled', e.target.checked)}
            />
          }
          label="Enable Pickup & Delivery"
        />
      </Box>

      {/* Pickup & Delivery Cost */}
      {paymentDetails.pickupDeliveryEnabled && (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Pickup & Delivery Cost"
            type="number"
            value={paymentDetails.pickupDeliveryCost}
            onChange={(e) => handleInputChange('pickupDeliveryCost', parseFloat(e.target.value) || 0)}
            onFocus={handleFocus}
            error={!!formErrors.pickupDeliveryCost}
            helperText={formErrors.pickupDeliveryCost}
            inputProps={{ min: 0, step: 0.01 }}
            placeholder="Enter pickup & delivery cost"
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '2px',
                borderColor: formErrors.pickupDeliveryCost ? 'error.main' : 'grey.300',
                borderRadius: 2,
              },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: formErrors.pickupDeliveryCost ? 'error.main' : 'primary.main',
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: formErrors.pickupDeliveryCost ? 'error.main' : 'primary.main',
                borderWidth: '2px',
              },
            }}
          />
        </Box>
      )}

      {/* Additional Notes */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Additional Notes"
          multiline
          rows={4}
          value={paymentDetails.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          placeholder="Enter any additional notes or special instructions"
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