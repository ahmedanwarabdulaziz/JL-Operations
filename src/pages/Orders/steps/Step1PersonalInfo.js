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
  Divider,
  InputAdornment,
  Card,
  CardContent
} from '@mui/material';
import { 
  Person as PersonIcon, 
  Warning as WarningIcon, 
  Search as SearchIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { useNotification } from '../../../shared/components/Common/NotificationSystem';
import { buttonStyles } from '../../../styles/buttonStyles';

const Step1PersonalInfo = ({ 
  personalInfo, 
  onPersonalInfoChange, 
  customers = [], 
  onUseExistingCustomer,
  formErrors = {},
  setFormErrors,
  onDuplicateCheck,
  onOpenSearchDialog
}) => {
  const { showError } = useNotification();
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateCustomers, setDuplicateCustomers] = useState([]);
  
  // Enhanced search dialog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState({
    name: '',
    email: '',
    phone: ''
  });

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

  // Enhanced search functionality
  const handleOpenSearchDialog = () => {
    setSearchDialogOpen(true);
    setSearchCriteria({ name: '', email: '', phone: '' });
    setSearchResults([]);
  };

  const handleSearchCriteriaChange = (field, value) => {
    setSearchCriteria(prev => ({ ...prev, [field]: value }));
  };

  const performCustomerSearch = () => {
    const { name, email, phone } = searchCriteria;
    
    // Check if we have at least one search criteria
    if (!name.trim() && !email.trim() && !phone.trim()) {
      showError('Please enter at least one search criteria (name, email, or phone)');
      return;
    }

    setSearchLoading(true);
    
    // Perform search
    const results = customers.filter(customer => {
      let hasMatch = false;
      
      // Check name match
      if (name.trim() && customer.name) {
        const nameMatch = customer.name.toLowerCase().includes(name.toLowerCase().trim());
        if (nameMatch) hasMatch = true;
      }
      
      // Check email match
      if (email.trim() && customer.email) {
        const emailMatch = customer.email.toLowerCase().includes(email.toLowerCase().trim());
        if (emailMatch) hasMatch = true;
      }
      
      // Check phone match
      if (phone.trim() && customer.phone) {
        const phoneMatch = customer.phone.includes(phone.trim());
        if (phoneMatch) hasMatch = true;
      }
      
      return hasMatch;
    });

    setSearchResults(results);
    setSearchLoading(false);
    
    if (results.length === 0) {
      showError('No customers found matching your search criteria');
    }
  };

  const handleSelectCustomer = (customer) => {
    onUseExistingCustomer(customer);
    setSearchDialogOpen(false);
    setSearchResults([]);
    setSearchCriteria({ name: '', email: '', phone: '' });
  };

  const handleCloseSearchDialog = () => {
    setSearchDialogOpen(false);
    setSearchResults([]);
    setSearchCriteria({ name: '', email: '', phone: '' });
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


      {/* Enhanced Customer Search Dialog */}
      <Dialog 
        open={searchDialogOpen} 
        onClose={handleCloseSearchDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#3a3a3a',
            border: '2px solid #b98f33',
            borderRadius: '10px',
            color: '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #b98f33 0%, #8b6b1f 100%)',
          color: '#000000',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid #b98f33'
        }}>
          <SearchIcon sx={{ color: '#000000', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
            Search Existing Customers
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#3a3a3a', color: '#ffffff', p: 3 }}>
          <Typography variant="body2" sx={{ mb: 3, color: '#ffffff', fontWeight: 500 }}>
            Enter search criteria to find existing customers. You can search by name, email, or phone number.
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <TextField
              fullWidth
              label="Customer Name"
              value={searchCriteria.name}
              onChange={(e) => handleSearchCriteriaChange('name', e.target.value)}
              placeholder="Enter customer name..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: '#666' }} />
                  </InputAdornment>
                ),
              }}
            />
            
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={searchCriteria.email}
              onChange={(e) => handleSearchCriteriaChange('email', e.target.value)}
              placeholder="Enter email address..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: '#666' }} />
                  </InputAdornment>
                ),
              }}
            />
            
            <TextField
              fullWidth
              label="Phone Number"
              value={searchCriteria.phone}
              onChange={(e) => handleSearchCriteriaChange('phone', e.target.value)}
              placeholder="Enter phone number..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon sx={{ color: '#666' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Button
              variant="contained"
              onClick={performCustomerSearch}
              disabled={searchLoading}
              startIcon={<SearchIcon />}
              sx={buttonStyles.primaryButton}
            >
              {searchLoading ? 'Searching...' : 'Search Customers'}
            </Button>
          </Box>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: '#b98f33' }}>
                Search Results ({searchResults.length} found):
              </Typography>
              
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {searchResults.map((customer, index) => (
                  <React.Fragment key={customer.id}>
                    <ListItem sx={{ 
                      border: '1px solid #b98f33', 
                      borderRadius: 2, 
                      mb: 1,
                      backgroundColor: '#2a2a2a',
                      '&:hover': {
                        backgroundColor: '#333333',
                        borderColor: '#d4af5a'
                      }
                    }}>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                              {customer.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <EmailIcon sx={{ fontSize: 16, color: '#b98f33' }} />
                              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                {customer.email}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <PhoneIcon sx={{ fontSize: 16, color: '#b98f33' }} />
                              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                {customer.phone}
                              </Typography>
                            </Box>
                            {customer.address && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <LocationIcon sx={{ fontSize: 16, color: '#b98f33' }} />
                                <Typography variant="body2" sx={{ color: '#ffffff' }}>
                                  {customer.address}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        }
                      />
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleSelectCustomer(customer)}
                        sx={buttonStyles.primaryButton}
                      >
                        Select
                      </Button>
                    </ListItem>
                    {index < searchResults.length - 1 && <Divider sx={{ my: 1 }} />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}
          
          {searchResults.length === 0 && searchCriteria.name && !searchLoading && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No customers found matching your search criteria. You can create a new customer by filling out the form below.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#3a3a3a' }}>
          <Button 
            onClick={handleCloseSearchDialog} 
            sx={buttonStyles.cancelButton}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

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
          <Button onClick={() => setDuplicateDialogOpen(false)} sx={buttonStyles.cancelButton}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Step1PersonalInfo; 