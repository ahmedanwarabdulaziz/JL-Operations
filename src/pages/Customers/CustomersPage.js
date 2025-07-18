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
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';

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

  // Find all orders for a specific customer
  const findCustomerOrders = async (customerData) => {
    try {
      const ordersRef = collection(db, 'orders');
      const orders = [];
      const querySnapshot = await getDocs(ordersRef);
      
      querySnapshot.forEach(doc => {
        const orderData = doc.data();
        const orderCustomer = orderData.personalInfo;
        
        if (orderCustomer) {
          let hasMatch = false;
          
          // Check name match only if we have meaningful data
          if (orderCustomer.customerName && customerData.name) {
            const nameMatch = orderCustomer.customerName.toLowerCase().trim() === customerData.name.toLowerCase().trim();
            if (nameMatch) hasMatch = true;
          }
          
          // Check phone match only if BOTH have a non-empty value and are equal
          const phoneMatch =
            orderCustomer.phone && orderCustomer.phone.trim().length > 0 &&
            customerData.phone && customerData.phone.trim().length > 0 &&
            orderCustomer.phone.trim() === customerData.phone.trim();
          if (phoneMatch) hasMatch = true;
          
          // Check email match only if we have meaningful data
          if (orderCustomer.email && customerData.email) {
            const emailMatch = orderCustomer.email.toLowerCase().trim() === customerData.email.toLowerCase().trim();
            if (emailMatch) hasMatch = true;
          }
          
          if (hasMatch) {
            orders.push({ id: doc.id, ...orderData });
          }
        }
      });
      
      return orders;
    } catch (error) {
      console.error('Error finding customer orders:', error);
      return [];
    }
  };

  // Handle delete customer
  const handleDelete = async (id) => {
    try {
      await deleteDocument('customers', id);
      setCustomers(prev => prev.filter(customer => customer.id !== id));
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
      
      if (editingCustomer) {
        // Create a batch to update multiple documents atomically
        const batch = writeBatch(db);
        
        // 1. Update customer record
        const customerRef = doc(db, 'customers', editingCustomer.id);
        const customerUpdateData = {
          ...formData,
          updatedAt: new Date()
        };
        batch.update(customerRef, customerUpdateData);
        
        // 2. Find and update ALL orders for this customer
        const customerOrders = await findCustomerOrders(editingCustomer);
        
        customerOrders.forEach(order => {
          const orderRef = doc(db, 'orders', order.id);
          const updatedOrderData = {
            ...order,
            personalInfo: {
              customerName: formData.name,
              phone: formData.phone,
              email: formData.email,
              address: formData.address
            },
            updatedAt: new Date()
          };
          batch.update(orderRef, updatedOrderData);
        });
        
        // Execute all updates atomically
        await batch.commit();
        
        // Update local state
        setCustomers(prev => prev.map(customer => 
          customer.id === editingCustomer.id 
            ? { ...customer, ...formData }
            : customer
        ));
        
        const orderCount = customerOrders.length;
        showSuccess(`Customer updated successfully! Updated ${orderCount} order${orderCount > 1 ? 's' : ''} for this customer.`);
      } else {
        await addDocument('customers', formData);
        await fetchCustomers(); // Refresh the list
        showSuccess('Customer added successfully');
      }
      
      setOpenDialog(false);
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
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
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
        <Typography variant="body2" color="text.secondary">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'phone',
      headerName: 'Phone',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || 'N/A'}
        </Typography>
      )
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary" sx={{ 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {params.value || 'N/A'}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEdit(params.row)}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(params.row.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h4" component="h1" sx={{ minWidth: 0, flexShrink: 1 }}>
          Customers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          sx={{ flexShrink: 0 }}
        >
          Add Customer
        </Button>
      </Box>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 3, flexShrink: 0 }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { xs: 'stretch', sm: 'center' }
        }}>
          <TextField
            fullWidth
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            sx={{ minWidth: 0 }}
          />
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ 
              whiteSpace: 'nowrap',
              textAlign: { xs: 'center', sm: 'left' }
            }}
          >
            {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
          </Typography>
        </Box>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ 
        flex: 1, 
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
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
              }
            }}
          />
        </Box>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCancel} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
            />
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
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              error={!!formErrors.phone}
              helperText={formErrors.phone}
              placeholder="+1 (555) 123-4567"
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
            />
          </Box>
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