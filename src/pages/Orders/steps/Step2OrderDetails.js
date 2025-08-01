import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Button,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { usePlatforms } from '../../../hooks/usePlatforms';

const Step2OrderDetails = ({
  orderDetails,
  formErrors,
  onOrderDetailsChange,
  onRefreshBillNumber,
  isEditMode = false
}) => {
  const { platforms, loading: platformsLoading } = usePlatforms();

  // Auto-select functionality
  const handleFocus = useCallback((event) => {
    event.target.select();
  }, []);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Order Details
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please provide the order details and timeline information.
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          fullWidth
          label="Order Description"
          value={orderDetails.description}
          onChange={(e) => onOrderDetailsChange('description', e.target.value)}
          onFocus={handleFocus}
          error={!!formErrors.description}
          helperText={formErrors.description}
          placeholder="Describe the order details"
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: formErrors.description ? 'error.main' : 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.description ? 'error.main' : 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.description ? 'error.main' : 'primary.main',
              borderWidth: '2px',
            },
          }}
        />

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Bill number is automatically generated from the highest existing bill number (6 digits)
            </Typography>
            {onRefreshBillNumber && !isEditMode && (
              <Tooltip title="Refresh bill number">
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={onRefreshBillNumber}
                  variant="outlined"
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Refresh
                </Button>
              </Tooltip>
            )}
          </Box>
          <TextField
            fullWidth
            label="Bill Invoice *"
            value={orderDetails.billInvoice}
            onChange={(e) => onOrderDetailsChange('billInvoice', e.target.value)}
            onFocus={handleFocus}
            error={!!formErrors.billInvoice}
            helperText={formErrors.billInvoice || 'Must be exactly 6 digits'}
            required
            inputProps={{ 
              maxLength: 6,
              pattern: '[0-9]{6}'
            }}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '2px',
                borderColor: formErrors.billInvoice ? 'error.main' : 'grey.300',
                borderRadius: 2,
              },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: formErrors.billInvoice ? 'error.main' : 'primary.main',
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: formErrors.billInvoice ? 'error.main' : 'primary.main',
                borderWidth: '2px',
              },
            }}
          />
        </Box>

        <FormControl fullWidth error={!!formErrors.platform}>
          <Select
            value={orderDetails.platform}
            onChange={(e) => onOrderDetailsChange('platform', e.target.value)}
            displayEmpty
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '2px',
                borderColor: formErrors.platform ? 'error.main' : 'grey.300',
                borderRadius: 2,
              },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: formErrors.platform ? 'error.main' : 'primary.main',
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: formErrors.platform ? 'error.main' : 'primary.main',
                borderWidth: '2px',
              },
            }}
          >
            <MenuItem value="" disabled>
              {platformsLoading ? 'Loading platforms...' : 'Select Platform'}
            </MenuItem>
            {platforms.map((platform) => (
              <MenuItem key={platform.id} value={platform.name}>
                {platform.name}
              </MenuItem>
            ))}
          </Select>
          {formErrors.platform && (
            <Typography variant="caption" color="error">
              {formErrors.platform}
            </Typography>
          )}
        </FormControl>

        <TextField
          fullWidth
          label="Start Date *"
          type="date"
          value={orderDetails.startDate}
          onChange={(e) => onOrderDetailsChange('startDate', e.target.value)}
          error={!!formErrors.startDate}
          helperText={formErrors.startDate}
          InputLabelProps={{
            shrink: true,
          }}
          required
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: formErrors.startDate ? 'error.main' : 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.startDate ? 'error.main' : 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.startDate ? 'error.main' : 'primary.main',
              borderWidth: '2px',
            },
          }}
        />

        <TextField
          fullWidth
          label="Timeline"
          value={orderDetails.timeline}
          onChange={(e) => onOrderDetailsChange('timeline', e.target.value)}
          error={!!formErrors.timeline}
          helperText={formErrors.timeline}
          placeholder="e.g., 2 weeks, 1 month, etc."
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: formErrors.timeline ? 'error.main' : 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.timeline ? 'error.main' : 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.timeline ? 'error.main' : 'primary.main',
              borderWidth: '2px',
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default Step2OrderDetails; 