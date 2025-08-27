import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { Person as PersonIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useNotification } from '../../components/Common/NotificationSystem';
import { buttonStyles } from '../../styles/buttonStyles';

const FastOrderStep1 = ({ 
  data, 
  onUpdate, 
  customers = [], 
  onUseExistingCustomer,
  errors = {} 
}) => {
  const { showError } = useNotification();
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateCustomers, setDuplicateCustomers] = useState([]);

  // Auto-select functionality
  const handleFocus = useCallback((event) => {
    event.target.select();
  }, []);

  const handleInputChange = (field, value) => {
    onUpdate({ ...data, [field]: value });
  };

  const checkForDuplicates = () => {
    const { customerName, phone, email } = data;
    
    // Only check for duplicates if we have meaningful data
    const hasName = customerName && customerName.trim().length > 0;
    const hasPhone = phone && phone.trim().length > 0;
    const hasEmail = email && email.trim().length > 0;
    
    // Need at least name to check for duplicates (email is optional)
    if (!hasName) {
      return false;
    }

    const duplicates = customers.filter(customer => {
      let hasMatch = false;
      
      // Check name match only if we have a name
      if (hasName && customer.name) {
        const nameMatch = customer.name.toLowerCase().trim() === customerName.toLowerCase().trim();
        if (nameMatch) hasMatch = true;
      }
      
      // Check phone match only if BOTH have a non-empty value and are equal
      const phoneMatch =
        phone && phone.trim().length > 0 &&
        customer.phone && customer.phone.trim().length > 0 &&
        customer.phone.trim() === phone.trim();
      if (phoneMatch) hasMatch = true;
      
      // Check email match only if we have an email
      if (hasEmail && customer.email) {
        const emailMatch = customer.email.toLowerCase().trim() === email.toLowerCase().trim();
        if (emailMatch) hasMatch = true;
      }
      
      return hasMatch;
    });

    if (duplicates.length > 0) {
      setDuplicateCustomers(duplicates);
      setDuplicateDialogOpen(true);
      return true;
    }

    return false;
  };

  const handleCustomerSearch = () => {
    const { customerName, phone, email } = data;
    
    // Check if we have meaningful search criteria
    const hasName = customerName && customerName.trim().length > 0;
    const hasPhone = phone && phone.trim().length > 0;
    const hasEmail = email && email.trim().length > 0;
    
    if (!hasName && !hasPhone && !hasEmail) {
      showError('Please enter at least one search criteria (name, phone, or email)');
      return;
    }

    const matchedCustomers = customers.filter(customer => {
      let hasMatch = false;
      
      // Check name match only if we have a name
      if (hasName && customer.name) {
        const nameMatch = customer.name.toLowerCase().includes(customerName.toLowerCase().trim());
        if (nameMatch) hasMatch = true;
      }
      
      // Check phone match only if BOTH have a non-empty value and customer includes input
      const phoneMatch =
        phone && phone.trim().length > 0 &&
        customer.phone && customer.phone.trim().length > 0 &&
        customer.phone.includes(phone.trim());
      if (phoneMatch) hasMatch = true;
      
      // Check email match only if we have an email
      if (hasEmail && customer.email) {
        const emailMatch = customer.email.toLowerCase().includes(email.toLowerCase().trim());
        if (emailMatch) hasMatch = true;
      }
      
      return hasMatch;
    });

    if (matchedCustomers.length === 0) {
      showError('No matching customers found. You can create a new customer.');
    } else if (matchedCustomers.length === 1) {
      onUseExistingCustomer(matchedCustomers[0]);
    } else {
      // Show dialog with multiple matches
      setDuplicateCustomers(matchedCustomers);
      setDuplicateDialogOpen(true);
    }
  };

  const handleUseExistingCustomer = (customer) => {
    onUseExistingCustomer(customer);
    setDuplicateDialogOpen(false);
    setDuplicateCustomers([]);
  };

  const handleCreateNewCustomer = () => {
    setDuplicateDialogOpen(false);
    setDuplicateCustomers([]);
  };

  const getHighlightedText = (text, searchTerm) => {
    if (!searchTerm || !text) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} style={{ backgroundColor: '#ffeb3b', fontWeight: 'bold' }}>
          {part}
        </span>
      ) : part
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: '#b98f33', fontWeight: 'bold' }}>
        Personal Information
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: '#ffffff' }}>
        Enter customer details or search for existing customers
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          fullWidth
          label="Customer Name *"
          value={data.customerName}
          onChange={(e) => handleInputChange('customerName', e.target.value)}
          onFocus={handleFocus}
          error={!!errors.customerName}
          helperText={errors.customerName}
          placeholder="Enter customer's full name"
          required
          sx={{
            backgroundColor: '#2a2a2a',
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: errors.customerName ? 'error.main' : '#333333',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.customerName ? 'error.main' : '#b98f33',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.customerName ? 'error.main' : '#b98f33',
              borderWidth: '2px',
            },
            '& .MuiInputLabel-root': {
              color: '#b98f33',
            },
            '& .MuiInputBase-input': {
              color: '#ffffff',
            },
          }}
        />

        <TextField
          fullWidth
          label="Email Address"
          type="email"
          value={data.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          onFocus={handleFocus}
          error={!!errors.email}
          helperText={errors.email}
          placeholder="Enter email address (optional)"
          sx={{
            backgroundColor: '#2a2a2a',
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: errors.email ? 'error.main' : '#333333',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.email ? 'error.main' : '#b98f33',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.email ? 'error.main' : '#b98f33',
              borderWidth: '2px',
            },
            '& .MuiInputLabel-root': {
              color: '#b98f33',
            },
            '& .MuiInputBase-input': {
              color: '#ffffff',
            },
          }}
        />

        <TextField
          fullWidth
          label="Phone Number"
          value={data.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          onFocus={handleFocus}
          error={!!errors.phone}
          helperText={errors.phone}
          placeholder="Enter phone number"
          sx={{
            backgroundColor: '#2a2a2a',
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: errors.phone ? 'error.main' : '#333333',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.phone ? 'error.main' : '#b98f33',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.phone ? 'error.main' : '#b98f33',
              borderWidth: '2px',
            },
            '& .MuiInputLabel-root': {
              color: '#b98f33',
            },
            '& .MuiInputBase-input': {
              color: '#ffffff',
            },
          }}
        />

        <TextField
          fullWidth
          label="Address"
          multiline
          rows={3}
          value={data.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          onFocus={handleFocus}
          error={!!errors.address}
          helperText={errors.address}
          placeholder="Enter complete address"
          sx={{
            backgroundColor: '#2a2a2a',
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: errors.address ? 'error.main' : '#333333',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.address ? 'error.main' : '#b98f33',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: errors.address ? 'error.main' : '#b98f33',
              borderWidth: '2px',
            },
            '& .MuiInputLabel-root': {
              color: '#b98f33',
            },
            '& .MuiInputBase-input': {
              color: '#ffffff',
            },
          }}
        />
      </Box>

      {customers.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            onClick={handleCustomerSearch}
            startIcon={<PersonIcon />}
            sx={buttonStyles.primaryButton}
          >
            Search Existing Customers
          </Button>
        </Box>
      )}

      {/* Duplicate Customer Dialog */}
      <Dialog 
        open={duplicateDialogOpen} 
        onClose={() => setDuplicateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1, color: '#000000' }} />
            <Typography variant="h6" sx={{ color: '#000000', fontWeight: 'bold' }}>
              {duplicateCustomers.length === 1 ? 'Existing Customer Found' : 'Multiple Customers Found'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#3a3a3a' }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {duplicateCustomers.length === 1 
              ? 'A customer with similar information already exists. You can use the existing customer or create a new one.'
              : `${duplicateCustomers.length} customers with similar information found. Please choose one or create a new customer.`
            }
          </Alert>
          
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
            Existing Customers:
          </Typography>
          
          <List>
            {duplicateCustomers.map((customer, index) => (
              <React.Fragment key={customer.id}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {getHighlightedText(customer.name, data.customerName)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Email: {getHighlightedText(customer.email, data.email)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Phone: {getHighlightedText(customer.phone, data.phone)}
                        </Typography>
                        {customer.address && (
                          <Typography variant="body2" color="text.secondary">
                            Address: {customer.address}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleUseExistingCustomer(customer)}
                    sx={buttonStyles.primaryButton}
                  >
                    Use This Customer
                  </Button>
                </ListItem>
                {index < duplicateCustomers.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={handleCreateNewCustomer}
            variant="contained"
            sx={{ 
              backgroundColor: '#b98f33',
              color: '#000000',
              border: '2px solid #8b6b1f',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 100%)',
              '&:hover': {
                backgroundColor: '#d4af5a',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)'
              },
              '&:disabled': {
                backgroundColor: '#666666',
                color: '#999999',
                border: '2px solid #555555'
              }
            }}
          >
            Create New Customer
          </Button>
          <Button 
            onClick={() => setDuplicateDialogOpen(false)}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FastOrderStep1; 