import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Grid,
  Paper
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';

const FastOrderStep1 = ({ data, onUpdate, errors }) => {
  // Handle input changes
  const handleChange = (field) => (event) => {
    onUpdate({
      ...data,
      [field]: event.target.value
    });
  };

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f8f9fa' }}>
        <Box display="flex" alignItems="center">
          <PersonIcon sx={{ color: '#274290', mr: 1 }} />
          <Typography variant="h6" color="#274290">
            Customer Information
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mt={1}>
          Enter the customer details for this fast order.
        </Typography>
      </Paper>

      {/* Form Fields */}
      <Grid container spacing={3}>
        {/* Customer Name */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Customer Name"
            value={data.customerName}
            onChange={handleChange('customerName')}
            error={!!errors.customerName}
            helperText={errors.customerName}
            required
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#f27921',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#274290',
                },
              },
            }}
          />
        </Grid>

        {/* Phone Number */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Phone Number"
            value={data.phone}
            onChange={handleChange('phone')}
            error={!!errors.phone}
            helperText={errors.phone}
            required
            variant="outlined"
            type="tel"
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#f27921',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#274290',
                },
              },
            }}
          />
        </Grid>

        {/* Email Address */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email Address"
            value={data.email}
            onChange={handleChange('email')}
            error={!!errors.email}
            helperText={errors.email}
            variant="outlined"
            type="email"
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#f27921',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#274290',
                },
              },
            }}
          />
        </Grid>

        {/* Address */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Address"
            value={data.address}
            onChange={handleChange('address')}
            error={!!errors.address}
            helperText={errors.address}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: '#f27921',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#274290',
                },
              },
            }}
          />
        </Grid>
      </Grid>

      {/* Additional Info */}
      <Box mt={3}>
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          💡 <strong>Tip:</strong> Customer Name and Phone Number are required. Email and Address are optional but recommended for better service.
        </Typography>
      </Box>
    </Box>
  );
};

export default FastOrderStep1; 