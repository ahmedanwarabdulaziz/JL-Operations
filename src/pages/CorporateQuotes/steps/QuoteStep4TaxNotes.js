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
} from '@mui/material';
import {
  Percent as PercentIcon,
  Notes as NotesIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';

const QuoteStep4TaxNotes = ({ tax, onTaxChange, notes, onNotesChange }) => {
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
