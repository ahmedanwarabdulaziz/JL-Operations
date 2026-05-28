import React from 'react';
import {
  Box,
  Typography,
  Switch,
  TextField,
  FormControlLabel,
  InputAdornment,
  Paper,
  Divider,
  Grid,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Percent as PercentIcon,
  Notes as NotesIcon,
  Calculate as CalculateIcon,
  LocalShipping as LocalShippingIcon,
} from '@mui/icons-material';

const QuoteStep4TaxNotes = ({ tax, onTaxChange, notes, onNotesChange, pickupDelivery, onPickupDeliveryChange }) => {
  // Calculate pickup & delivery total based on service type
  const calcPickupDeliveryTotal = (baseCost, serviceType) => {
    const cost = parseFloat(baseCost) || 0;
    return serviceType === 'both' ? cost * 2 : cost;
  };
  const handleTaxEnabledChange = (e) => {
    onTaxChange({ ...tax, enabled: e.target.checked });
  };

  const handleTaxPercentageChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
      onTaxChange({ ...tax, percentage: value });
    }
  };

  return (
    <Box>
      {/* Tax Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          border: tax.enabled
            ? '2px solid rgba(185,143,51,0.5)'
            : '1px solid rgba(0,0,0,0.12)',
          background: tax.enabled
            ? 'rgba(185,143,51,0.04)'
            : 'transparent',
          transition: 'all 0.3s ease',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CalculateIcon sx={{ color: '#b98f33' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Tax</Typography>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={tax.enabled}
              onChange={handleTaxEnabledChange}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#b98f33' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#b98f33',
                },
              }}
            />
          }
          label={
            <Typography sx={{ fontWeight: 500 }}>
              {tax.enabled ? 'Tax included in this quote' : 'No tax on this quote'}
            </Typography>
          }
          sx={{ mb: tax.enabled ? 2 : 0 }}
        />

        {tax.enabled && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Tax Percentage"
              value={tax.percentage}
              onChange={handleTaxPercentageChange}
              size="small"
              sx={{
                width: 180,
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#b98f33' },
                  '&.Mui-focused fieldset': { borderColor: '#b98f33' },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <PercentIcon fontSize="small" sx={{ color: '#b98f33' }} />
                  </InputAdornment>
                ),
                inputProps: { min: 0, max: 100, step: 0.5 },
              }}
            />
            <Typography variant="body2" color="text.secondary">
              Common: 13% (HST), 5% (GST), 15% (HST-NS)
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Pickup & Delivery Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          border: pickupDelivery?.enabled
            ? '2px solid rgba(185,143,51,0.5)'
            : '1px solid rgba(0,0,0,0.12)',
          background: pickupDelivery?.enabled
            ? 'rgba(185,143,51,0.04)'
            : 'transparent',
          transition: 'all 0.3s ease',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <LocalShippingIcon sx={{ color: '#b98f33' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Pickup &amp; Delivery</Typography>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={Boolean(pickupDelivery?.enabled)}
              onChange={(e) => onPickupDeliveryChange({ ...pickupDelivery, enabled: e.target.checked })}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#b98f33' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#b98f33',
                },
              }}
            />
          }
          label={
            <Typography sx={{ fontWeight: 500 }}>
              {pickupDelivery?.enabled ? 'Pickup &amp; delivery included in this quote' : 'No pickup &amp; delivery on this quote'}
            </Typography>
          }
          sx={{ mb: pickupDelivery?.enabled ? 2 : 0 }}
        />

        {pickupDelivery?.enabled && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <Select
                  value={pickupDelivery?.serviceType || 'both'}
                  onChange={(e) => onPickupDeliveryChange({ ...pickupDelivery, serviceType: e.target.value })}
                  displayEmpty
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: '2px',
                      borderColor: 'grey.300',
                      borderRadius: 2,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33', borderWidth: '2px' },
                  }}
                >
                  <MenuItem value="pickup">🚚 Pickup Only</MenuItem>
                  <MenuItem value="delivery">🚚 Delivery Only</MenuItem>
                  <MenuItem value="both">🚚 Pickup &amp; Delivery</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Service Cost (per trip)"
                type="number"
                value={pickupDelivery?.cost || ''}
                onChange={(e) => onPickupDeliveryChange({ ...pickupDelivery, cost: e.target.value })}
                onFocus={(e) => e.target.select()}
                inputProps={{ min: 0, step: 0.01 }}
                placeholder="Enter cost per service"
                helperText={`Total: $${calcPickupDeliveryTotal(pickupDelivery?.cost || 0, pickupDelivery?.serviceType || 'both').toFixed(2)} (${pickupDelivery?.serviceType === 'both' ? '2x service' : '1x service'})`}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderWidth: '2px', borderColor: 'grey.300', borderRadius: 2 },
                    '&:hover fieldset': { borderColor: '#b98f33' },
                    '&.Mui-focused fieldset': { borderColor: '#b98f33', borderWidth: '2px' },
                  },
                }}
              />
            </Grid>
          </Grid>
        )}
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* Notes Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <NotesIcon sx={{ color: '#b98f33' }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Notes</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add any additional information or special instructions for this quote.
      </Typography>
      <TextField
        fullWidth
        multiline
        minRows={5}
        maxRows={12}
        placeholder="E.g. This quote is based on the measurements provided on 2024-01-15. Final pricing may vary upon site confirmation..."
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        sx={{
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': { borderColor: '#b98f33' },
            '&.Mui-focused fieldset': { borderColor: '#b98f33' },
          },
        }}
      />
    </Box>
  );
};

export default QuoteStep4TaxNotes;
