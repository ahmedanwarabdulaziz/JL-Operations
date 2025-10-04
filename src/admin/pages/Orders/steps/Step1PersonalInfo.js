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
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { Person as PersonIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';

const Step1PersonalInfo = ({ 
  personalInfo, 
  onPersonalInfoChange, 
  customers = [], 
  onUseExistingCustomer,
  formErrors = {},
  setFormErrors,
  onDuplicateCheck
}) => {
  const { showError } = useNotification();
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateCustomers, setDuplicateCustomers] = useState([]);

  // Auto-select functionality
  const handleFocus = useCallback((event) => {
    event.target.select();
  }, []);

  const handleInputChange = (field, value) => {
    onPersonalInfoChange(field, value);
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const checkForDuplicates = () => {
    const { customerName, phone, email } = personalInfo;
    
    // Only check for duplicates if we have meaningful data
    const hasName = customerName && customerName.trim().length > 0;
    const hasPhone = phone && phone.trim().length > 0;
    const hasEmail = email && email.trim().length > 0;
    
    // Need at least phone or email to check for duplicates
    if (!hasPhone && !hasEmail) {
      return false;
    }

    const duplicates = customers.filter(customer => {
      let hasMatch = false;
      
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
    const { customerName, phone, email } = personalInfo;
    
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
      <Typography variant="h5" gutterBottom>
        Personal Information
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Enter customer details or search for existing customers
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          fullWidth
          label="Customer Name *"
          value={personalInfo.customerName}
          onChange={(e) => handleInputChange('customerName', e.target.value)}
          onFocus={handleFocus}
          error={!!formErrors.customerName}
          helperText={formErrors.customerName}
          placeholder="Enter customer's full name"
          required
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: formErrors.customerName ? 'error.main' : 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.customerName ? 'error.main' : 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.customerName ? 'error.main' : 'primary.main',
              borderWidth: '2px',
            },
          }}
        />

        <TextField
          fullWidth
          label="Email Address *"
          type="email"
          value={personalInfo.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          onFocus={handleFocus}
          error={!!formErrors.email}
          helperText={formErrors.email}
          placeholder="Enter email address"
          required
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: formErrors.email ? 'error.main' : 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.email ? 'error.main' : 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.email ? 'error.main' : 'primary.main',
              borderWidth: '2px',
            },
          }}
        />

        <TextField
          fullWidth
          label="Phone Number"
          value={personalInfo.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          onFocus={handleFocus}
          error={!!formErrors.phone}
          helperText={formErrors.phone}
          placeholder="Enter phone number"
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: formErrors.phone ? 'error.main' : 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.phone ? 'error.main' : 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.phone ? 'error.main' : 'primary.main',
              borderWidth: '2px',
            },
          }}
        />

        <TextField
          fullWidth
          label="Address"
          multiline
          rows={3}
          value={personalInfo.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          onFocus={handleFocus}
          error={!!formErrors.address}
          helperText={formErrors.address}
          placeholder="Enter complete address"
          sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: formErrors.address ? 'error.main' : 'grey.300',
              borderRadius: 2,
            },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.address ? 'error.main' : 'primary.main',
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: formErrors.address ? 'error.main' : 'primary.main',
              borderWidth: '2px',
            },
          }}
        />
      </Box>

      {customers.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handleCustomerSearch}
            startIcon={<PersonIcon />}
            sx={{
              borderColor: '#e0e0e0',
              color: '#666',
              '&:hover': {
                borderColor: '#bdbdbd',
                backgroundColor: '#f5f5f5'
              }
            }}
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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon color="warning" sx={{ mr: 1 }} />
            <Typography variant="h6">
              {duplicateCustomers.length === 1 ? 'Existing Customer Found' : 'Multiple Customers Found'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
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
                          {getHighlightedText(customer.name, personalInfo.customerName)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Email: {getHighlightedText(customer.email, personalInfo.email)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Phone: {getHighlightedText(customer.phone, personalInfo.phone)}
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
                    variant="outlined"
                    size="small"
                    onClick={() => handleUseExistingCustomer(customer)}
                    sx={{
                      borderColor: '#e0e0e0',
                      color: '#666',
                      '&:hover': {
                        borderColor: '#bdbdbd',
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                  >
                    Use This Customer
                  </Button>
                </ListItem>
                {index < duplicateCustomers.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateNewCustomer} 
          sx={{ 
            background: 'linear-gradient(145deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
            color: '#000000',
            border: '3px solid #4CAF50',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)',
            position: 'relative',
            '&:hover': {
              background: 'linear-gradient(145deg, #e6c47a 0%, #d4af5a 50%, #b98f33 100%)',
              border: '3px solid #45a049',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.4)'
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
              borderRadius: '6px 6px 0 0',
              pointerEvents: 'none'
            }
          }}>
            Create New Customer
          </Button>
          <Button onClick={() => setDuplicateDialogOpen(false)}
          sx={{
            borderColor: '#e0e0e0',
            color: '#666',
            '&:hover': {
              borderColor: '#bdbdbd',
              backgroundColor: '#f5f5f5'
            }
          }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Step1PersonalInfo; 
