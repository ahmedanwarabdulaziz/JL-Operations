import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Send as SendIcon,
  EditNote as DraftIcon,
} from '@mui/icons-material';

const statusOptions = [
  { value: 'draft', label: 'Draft', description: 'Save as a draft (not yet sent to the customer)', color: '#757575' },
  { value: 'sent', label: 'Sent', description: 'Mark as sent — the quote has been delivered to the customer', color: '#1976d2' },
];

const QuoteStep6Submit = ({ quoteStatus, onStatusChange, isVersionMode, loading }) => {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>Submit Quote</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        {isVersionMode
          ? 'Choose the status for this new version of the quote, then submit.'
          : 'Choose an initial status for this quote, then submit.'}
      </Typography>

      <FormControl fullWidth sx={{ mb: 3, maxWidth: 360 }}>
        <InputLabel>Quote Status</InputLabel>
        <Select
          value={quoteStatus}
          label="Quote Status"
          onChange={e => onStatusChange(e.target.value)}
          sx={{
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#b98f33' },
          }}
        >
          {statusOptions.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color }} />
                <Box>
                  <Typography fontWeight="bold">{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Alert severity="info" icon={quoteStatus === 'draft' ? <DraftIcon /> : <SendIcon />}>
        {quoteStatus === 'draft'
          ? 'The quote will be saved as a draft. You can update the status later from the quotes list.'
          : 'The quote will be marked as sent. You can still edit it or create a new version.'}
      </Alert>
    </Box>
  );
};

export default QuoteStep6Submit;
