import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useNotification } from '../../components/Common/NotificationSystem';
import { useFirebase } from '../../hooks/useFirebase';

const CustomersPage = () => {
  const theme = useTheme();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { loading: crudLoading, addDocument, updateDocument, deleteDocument, getDocuments } = useFirebase();
  
  const [customers, setCustomers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  // Load customers from Firebase
  useEffect(() => {
    const fetchCustomers = async () => {
      setInitialLoading(true);
      try {
        const customersData = await getDocuments('customers');
        setCustomers(customersData);
      } catch (error) {
        showError('Failed to fetch customers');
        console.error('Error fetching customers:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchCustomers();
  }, [getDocuments, showError]);

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
    { field: 'phone', headerName: 'Phone', flex: 1, minWidth: 150 },
    { field: 'address', headerName: 'Address', flex: 1, minWidth: 250 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handleEdit(params.row)}
              color="primary"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDelete(params.row.id)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  const handleAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: ''
    });
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address
    });
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleDelete = async (id) => {
    showConfirm(
      'Delete Customer',
      'Are you sure you want to delete this customer? This action cannot be undone.',
      async () => {
        try {
          await deleteDocument('customers', id);
          setCustomers(customers.filter(customer => customer.id !== id));
          showSuccess('Customer deleted successfully');
        } catch (error) {
          showError('Failed to delete customer: ' + error.message);
        }
      }
    );
  };

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
  };

  const validateForm = () => {
    const errors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Phone validation
    if (formData.phone && !validatePhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    // Address validation
    if (formData.address && formData.address.trim().length < 5) {
      errors.address = 'Address must be at least 5 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      if (editingCustomer) {
        // Update existing customer
        await updateDocument('customers', editingCustomer.id, formData);
        setCustomers(customers.map(customer =>
          customer.id === editingCustomer.id
            ? { ...customer, ...formData }
            : customer
        ));
        showSuccess('Customer updated successfully');
      } else {
        // Add new customer
        console.log('Adding new customer:', formData);
        const docRef = await addDocument('customers', formData);
        console.log('Document added with ID:', docRef.id);
        const newCustomer = {
          id: docRef.id,
          ...formData
        };
        setCustomers([newCustomer, ...customers]);
        showSuccess('Customer added successfully');
      }

      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving customer:', error);
      showError('Failed to save customer: ' + error.message);
    }
  };

  const handleCancel = () => {
    setOpenDialog(false);
    setEditingCustomer(null);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Customers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          Add Customer
        </Button>
      </Box>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredCustomers}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          disableSelectionOnClick
          loading={initialLoading}
          components={{
            LoadingOverlay: () => (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography>Loading customers...</Typography>
              </Box>
            ),
            NoRowsOverlay: () => (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No customers found
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {searchTerm ? 'No customers match your search criteria.' : 'Get started by adding your first customer.'}
                </Typography>
                {!searchTerm && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAdd}
                    sx={{ mt: 2 }}
                  >
                    Add First Customer
                  </Button>
                )}
              </Box>
            )
          }}
          sx={{
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #e0e0e0'
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: theme.palette.grey[50],
              borderBottom: '2px solid #e0e0e0'
            }
          }}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCancel} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!!formErrors.name}
                helperText={formErrors.name}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={!!formErrors.email}
                helperText={formErrors.email}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={!!formErrors.phone}
                helperText={formErrors.phone}
                placeholder="+1 (555) 123-4567"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                error={!!formErrors.address}
                helperText={formErrors.address}
                placeholder="Enter full address"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={crudLoading}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={crudLoading}
          >
            {crudLoading ? 'Saving...' : (editingCustomer ? 'Update' : 'Add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomersPage; 