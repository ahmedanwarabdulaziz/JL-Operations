import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import { useNotification } from '../../../components/Common/NotificationSystem';

const Step1PersonalInfo = ({ 
  personalInfo, 
  onPersonalInfoChange, 
  customers = [], 
  onUseExistingCustomer,
  formErrors = {},
  setFormErrors 
}) => {
  const { showError } = useNotification();

  const handleInputChange = (field, value) => {
    onPersonalInfoChange(field, value);
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCustomerSearch = () => {
    const { customerName, phone, email } = personalInfo;
    
    if (!customerName && !phone && !email) {
      showError('Please enter at least one search criteria (name, phone, or email)');
      return;
    }

    const matchedCustomers = customers.filter(customer => {
      const nameMatch = customer.customerName?.toLowerCase().includes(customerName.toLowerCase());
      const phoneMatch = customer.phone?.includes(phone);
      const emailMatch = customer.email?.toLowerCase().includes(email.toLowerCase());
      
      return nameMatch || phoneMatch || emailMatch;
    });

    if (matchedCustomers.length === 0) {
      showError('No matching customers found. You can create a new customer.');
    } else if (matchedCustomers.length === 1) {
      onUseExistingCustomer(matchedCustomers[0]);
    } else {
      // Show dialog with multiple matches
      // This would need to be implemented with a state for dialog
      showError(`Found ${matchedCustomers.length} matching customers. Please be more specific.`);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Personal Information
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Enter customer details or search for existing customers
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Customer Name"
            value={personalInfo.customerName}
            onChange={(e) => handleInputChange('customerName', e.target.value)}
            error={!!formErrors.customerName}
            helperText={formErrors.customerName}
            placeholder="Enter customer&apos;s full name"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Phone Number"
            value={personalInfo.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            error={!!formErrors.phone}
            helperText={formErrors.phone}
            placeholder="Enter phone number"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={personalInfo.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            error={!!formErrors.email}
            helperText={formErrors.email}
            placeholder="Enter email address"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Address"
            multiline
            rows={3}
            value={personalInfo.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            error={!!formErrors.address}
            helperText={formErrors.address}
            placeholder="Enter complete address"
          />
        </Grid>
      </Grid>

      {customers.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handleCustomerSearch}
            startIcon={<PersonIcon />}
          >
            Search Existing Customers
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default Step1PersonalInfo; 