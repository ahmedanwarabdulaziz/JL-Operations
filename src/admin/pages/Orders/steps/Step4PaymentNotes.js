import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  FormControl,
  Select,
  MenuItem,
  Grid
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

  // Calculate pickup & delivery cost based on service type
  const calculatePickupDeliveryCost = (baseCost, serviceType) => {
    const cost = parseFloat(baseCost) || 0;
    switch (serviceType) {
      case 'pickup':
      case 'delivery':
        return cost; // Single service
      case 'both':
        return cost * 2; // Both services
      default:
        return cost;
    }
  };

  // Handle pickup & delivery service type change
  const handleServiceTypeChange = (serviceType) => {
    // Don't change the base cost in the field, just update service type
    onPaymentChange('pickupDeliveryServiceType', serviceType);
  };

  // Handle pickup & delivery cost change
  const handlePickupDeliveryCostChange = (cost) => {
    // Store the base cost directly
    onPaymentChange('pickupDeliveryCost', cost);
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

      {/* Amount Paid Toggle */}
      <Box sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(paymentDetails.amountPaidEnabled)}
              onChange={(e) => handleInputChange('amountPaidEnabled', e.target.checked)}
            />
          }
          label="Enable Amount Paid by Customer"
        />
      </Box>

      {/* Amount Paid */}
      {paymentDetails.amountPaidEnabled && (
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
      )}
      
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
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <Select
                  value={paymentDetails.pickupDeliveryServiceType || 'both'}
                  onChange={(e) => handleServiceTypeChange(e.target.value)}
                  displayEmpty
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
                >
                  <MenuItem value="pickup">🚚 Pickup Only</MenuItem>
                  <MenuItem value="delivery">🚚 Delivery Only</MenuItem>
                  <MenuItem value="both">🚚 Pickup & Delivery</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Service Cost"
                type="number"
                value={paymentDetails.pickupDeliveryCost || 0}
                onChange={(e) => handlePickupDeliveryCostChange(parseFloat(e.target.value) || 0)}
                onFocus={handleFocus}
                error={!!formErrors.pickupDeliveryCost}
                helperText={formErrors.pickupDeliveryCost || 
                  `Total: $${calculatePickupDeliveryCost(paymentDetails.pickupDeliveryCost || 0, paymentDetails.pickupDeliveryServiceType || 'both')} (${paymentDetails.pickupDeliveryServiceType === 'both' ? '2x service' : '1x service'})`}
                inputProps={{ min: 0, step: 0.01 }}
                placeholder="Enter service cost"
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
            </Grid>
          </Grid>
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
