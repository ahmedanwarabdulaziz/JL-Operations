import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  IconButton,
  Tooltip,
  useTheme,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useNotification } from '../../components/Common/NotificationSystem';
import { useFirebase } from '../../hooks/useFirebase';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { buttonStyles } from '../../styles/buttonStyles';

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [crudLoading, setCrudLoading] = useState(false);

  const { showSuccess, showError } = useNotification();
  const { loading, addDocument, updateDocument, deleteDocument, getDocuments } = useFirebase();
  const theme = useTheme();

  // Fetch customers from Firebase
  const fetchCustomers = async () => {
    try {
      setInitialLoading(true);
      const customersData = await getDocuments('customers');
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      console.error('Error fetching customers:', error);
      showError('Failed to fetch customers');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filter customers based on search term
  useEffect(() => {
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    );
    setFilteredCustomers(filtered);
  }, [customers, searchTerm]);

  // Handle add new customer
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

  // Handle edit customer
  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || ''
    });
    setFormErrors({});
    setOpenDialog(true);
  };

  // Find customer orders before deletion
  const findCustomerOrders = async (customerData) => {
    try {
      const ordersRef = collection(db, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      const orders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Check if customer has any orders
      const customerOrders = orders.filter(order => 
        order.personalInfo?.customerName === customerData.name &&
        order.personalInfo?.email === customerData.email
      );

      return customerOrders;
    } catch (error) {
      console.error('Error finding customer orders:', error);
      return [];
    }
  };

  // Handle delete customer
  const handleDelete = async (id) => {
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) return;

      const customerOrders = await findCustomerOrders(customer);
      
      if (customerOrders.length > 0) {
        showError(`Cannot delete customer. They have ${customerOrders.length} order(s) associated with them.`);
        return;
      }

      await deleteDocument('customers', id);
      setCustomers(prev => prev.filter(c => c.id !== id));
      setFilteredCustomers(prev => prev.filter(c => c.id !== id));
      showSuccess('Customer deleted successfully');
    } catch (error) {
      console.error('Error deleting customer:', error);
      showError('Failed to delete customer');
    }
  };

  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate phone format
  const validatePhone = (phone) => {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setCrudLoading(true);

      const customerData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || '',
        address: formData.address.trim() || '',
        createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingCustomer) {
        // Update existing customer
        await updateDocument('customers', editingCustomer.id, customerData);
        setCustomers(prev => prev.map(c => 
          c.id === editingCustomer.id 
            ? { ...c, ...customerData }
            : c
        ));
        setFilteredCustomers(prev => prev.map(c => 
          c.id === editingCustomer.id 
            ? { ...c, ...customerData }
            : c
        ));
        showSuccess('Customer updated successfully');
      } else {
        // Add new customer
        const newCustomerId = await addDocument('customers', customerData);
        const newCustomer = { id: newCustomerId, ...customerData };
        setCustomers(prev => [...prev, newCustomer]);
        setFilteredCustomers(prev => [...prev, newCustomer]);
        showSuccess('Customer added successfully');
      }

      setOpenDialog(false);
      setEditingCustomer(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: ''
      });
      setFormErrors({});
    } catch (error) {
      console.error('Error saving customer:', error);
      showError('Failed to save customer');
    } finally {
      setCrudLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setOpenDialog(false);
    setEditingCustomer(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: ''
    });
    setFormErrors({});
  };

  // Define columns for DataGrid
  const columns = [
    {
      field: 'name',
      headerName: 'Customer Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
          <PersonIcon sx={{ fontSize: 20, mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      minWidth: 250,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
          <EmailIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'phone',
      headerName: 'Phone',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
          <PhoneIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {params.value || 'N/A'}
          </Typography>
        </Box>
      )
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
          <LocationIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary" sx={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {params.value || 'N/A'}
          </Typography>
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', width: '100%', height: '100%' }}>
          <Tooltip title="Edit Customer">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEdit(params.row)}
              sx={{
                '&:hover': {
                  backgroundColor: '#e3f2fd'
                }
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
                      <Tooltip title="Delete Customer">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDelete(params.row.id)}
                sx={{
                  '&:hover': {
                    backgroundColor: '#ffebee'
                  }
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
        </Box>
      )
    }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* Professional Header */}
      <Card sx={{ 
        mb: 3,
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderRadius: 2,
        border: '1px solid #333333'
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2
          }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Customer Management
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Manage your customer database and contact information
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              sx={{ 
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.light',
                }
              }}
            >
              Add Customer
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Search and Stats Section */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 3,
            alignItems: { xs: 'stretch', sm: 'center' }
          }}>
            {/* Search Bar */}
            <TextField
              fullWidth
              placeholder="Search customers by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton 
                      size="small" 
                      onClick={() => setSearchTerm('')}
                      sx={{ color: 'text.secondary' }}
                    >
                      <RefreshIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'background.paper'
                }
              }}
            />
            
            {/* Stats */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2,
              flexShrink: 0
            }}>
              <Chip
                label={`${filteredCustomers.length} customer${filteredCustomers.length !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 'bold' }}
              />
              {searchTerm && (
                <Chip
                  label="Filtered"
                  color="secondary"
                  size="small"
                />
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card sx={{ 
        flex: 1, 
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2
      }}>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGrid
            rows={filteredCustomers}
            columns={columns}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            disableSelectionOnClick
            loading={initialLoading}
            autoHeight={false}
            density="comfortable"
            disableColumnMenu={false}
            disableColumnFilter={false}
            disableColumnSelector={false}
            components={{
              LoadingOverlay: () => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <CircularProgress size={40} />
                  <Typography sx={{ ml: 2 }}>Loading customers...</Typography>
                </Box>
              ),
              NoRowsOverlay: () => (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No customers found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>
                    {searchTerm ? 'No customers match your search criteria.' : 'Get started by adding your first customer.'}
                  </Typography>
                  {!searchTerm && (
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAdd}
                                             sx={{ 
                         backgroundColor: '#274290',
                         '&:hover': {
                           backgroundColor: '#1e2d5a'
                         }
                       }}
                    >
                      Add First Customer
                    </Button>
                  )}
                </Box>
              )
            }}
            sx={{
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px'
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'background.paper',
                borderBottom: '2px solid #333333',
                fontWeight: 'bold'
              },
              '& .MuiDataGrid-root': {
                border: 'none'
              },
              '& .MuiDataGrid-main': {
                width: '100%'
              },
              '& .MuiDataGrid-virtualScroller': {
                width: '100% !important'
              },
              '& .MuiDataGrid-virtualScrollerContent': {
                width: '100% !important'
              },
              '& .MuiDataGrid-virtualScrollerRenderZone': {
                width: '100% !important'
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: '#3a3a3a'
              },
              '& .MuiDataGrid-cell:focus': {
                outline: 'none'
              },
              '& .MuiDataGrid-cell:focus-within': {
                outline: 'none'
              }
            }}
          />
        </Box>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCancel} maxWidth="md" fullWidth>
        <DialogTitle sx={{ 
          backgroundColor: '#b98f33',
          color: '#000000'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PersonIcon sx={{ mr: 1, color: '#000000' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <TextField
              fullWidth
              label="Customer Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={!!formErrors.email}
              helperText={formErrors.email}
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            <TextField
              fullWidth
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              error={!!formErrors.phone}
              helperText={formErrors.phone}
              placeholder="+1 (555) 123-4567"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={handleCancel} 
            disabled={crudLoading}
            sx={buttonStyles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={crudLoading}
            sx={buttonStyles.primaryButton}
          >
            {crudLoading ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Add Customer')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomersPage; 