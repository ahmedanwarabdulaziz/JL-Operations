import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Chair as ChairIcon,
  LocalShipping as ShippingIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useNotification } from '../../components/Common/NotificationSystem';
// Removed useFirebase import since we're using direct Firebase functions
import { db } from '../../firebase/config';
import { collection, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';

const WorkshopPage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editPersonalDialog, setEditPersonalDialog] = useState(false);
  const [editOrderDialog, setEditOrderDialog] = useState(false);
  const [editPersonalData, setEditPersonalData] = useState({});
  const [editOrderData, setEditOrderData] = useState({});
  const { showError, showSuccess } = useNotification();
  // Remove useFirebase hook since it's causing issues

  // Fetch orders from Firebase
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const ordersRef = collection(db, 'orders');
        const ordersSnapshot = await getDocs(ordersRef);
        const ordersData = ordersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(ordersData || []);
        
        // Select first order by default if available
        if (ordersData && ordersData.length > 0 && !selectedOrder) {
          setSelectedOrder(ordersData[0]);
        }
      } catch (error) {
        showError('Failed to fetch orders');
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [showError]);

  // Sync customer data with orders
  const syncCustomerData = async (ordersList) => {
    try {
      const customersRef = collection(db, 'customers');
      const customersSnapshot = await getDocs(customersRef);
      const customers = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      for (const order of ordersList) {
        if (order.personalInfo?.email) {
          const existingCustomer = customers.find(customer => 
            customer.email === order.personalInfo.email
          );
          
          if (!existingCustomer) {
            // Create customer record if it doesn't exist
            await addDoc(collection(db, 'customers'), {
              name: order.personalInfo.name || '',
              email: order.personalInfo.email || '',
              phone: order.personalInfo.phone || '',
              address: order.personalInfo.address || ''
            });
          }
        }
      }
    } catch (error) {
      console.warn('Error syncing customer data:', error);
    }
  };

  // Calculate total order value
  const calculateOrderTotal = (order) => {
    let total = 0;
    
    if (order.furnitureData?.groups) {
      order.furnitureData.groups.forEach(group => {
        total += (parseFloat(group.materialPrice) || 0) * (parseInt(group.materialQnty) || 0);
        total += (parseFloat(group.labourPrice) || 0) * (parseInt(group.labourQnty) || 0);
        if (group.foamEnabled) {
          total += (parseFloat(group.foamPrice) || 0) * (parseInt(group.foamQnty) || 0);
        }
      });
    }

    if (order.paymentData?.pickupDeliveryEnabled) {
      total += parseFloat(order.paymentData.pickupDeliveryCost) || 0;
    }

    return total;
  };

  // Get status color
  const getStatusColor = (order) => {
    const total = calculateOrderTotal(order);
    const deposit = parseFloat(order.paymentData?.deposit) || 0;
    
    if (deposit >= total) return 'error';
    if (deposit > 0) return 'warning';
    return 'error';
  };

  // Get status text
  const getStatusText = (order) => {
    const total = calculateOrderTotal(order);
    const deposit = parseFloat(order.paymentData?.deposit) || 0;
    
    if (deposit >= total) return 'Not Paid';
    if (deposit > 0) return 'Partial';
    return 'Pending';
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle edit personal information
  const handleEditPersonal = () => {
    setEditPersonalData({
      name: selectedOrder.personalInfo?.name || '',
      email: selectedOrder.personalInfo?.email || '',
      phone: selectedOrder.personalInfo?.phone || '',
      address: selectedOrder.personalInfo?.address || ''
    });
    setEditPersonalDialog(true);
  };

  // Handle edit order details
  const handleEditOrder = () => {
    setEditOrderData({
      description: selectedOrder.orderDetails?.description || '',
      platform: selectedOrder.orderDetails?.platform || '',
      startDate: selectedOrder.orderDetails?.startDate || '',
      timeline: selectedOrder.orderDetails?.timeline || ''
    });
    setEditOrderDialog(true);
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

  const validatePersonalInfo = () => {
    const errors = {};

    if (!editPersonalData.name?.trim()) {
      errors.name = 'Name is required';
    } else if (editPersonalData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!editPersonalData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(editPersonalData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (editPersonalData.phone && !validatePhone(editPersonalData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (editPersonalData.address && editPersonalData.address.trim().length < 5) {
      errors.address = 'Address must be at least 5 characters';
    }

    return Object.keys(errors).length === 0;
  };

  const validateOrderDetails = () => {
    const errors = {};

    if (!editOrderData.startDate) {
      errors.startDate = 'Start date is required';
    }

    return Object.keys(errors).length === 0;
  };

  // Save personal information
  const handleSavePersonal = async () => {
    // Validate form
    if (!validatePersonalInfo()) {
      showError('Please fix the validation errors before saving');
      return;
    }

    try {
      const updatedOrder = {
        ...selectedOrder,
        personalInfo: editPersonalData
      };
      
      // Update the order in Firebase
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, { personalInfo: editPersonalData });
      
      // Also update the customer record if it exists
      try {
        // Check if customer exists by email, name, or phone
        const customersRef = collection(db, 'customers');
        const customersSnapshot = await getDocs(customersRef);
        const customers = customersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const existingCustomer = customers.find(customer => 
          customer.email === selectedOrder.personalInfo?.email ||
          customer.email === editPersonalData.email ||
          (customer.name === selectedOrder.personalInfo?.name && customer.phone === selectedOrder.personalInfo?.phone) ||
          (customer.name === editPersonalData.name && customer.phone === editPersonalData.phone)
        );
        
        if (existingCustomer) {
          // Update existing customer with new data
          const customerRef = doc(db, 'customers', existingCustomer.id);
          await updateDoc(customerRef, editPersonalData);
        } else {
          // Create new customer record
          await addDoc(collection(db, 'customers'), editPersonalData);
        }
      } catch (customerError) {
        console.warn('Could not update customer record:', customerError);
        // Don't fail the order update if customer update fails
      }
      
      // Update local state
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      
      setEditPersonalDialog(false);
      showSuccess('Personal information updated successfully. Customer data has been synchronized.');
    } catch (error) {
      console.error('Error updating personal information:', error);
      showError('Failed to update personal information');
    }
  };

  // Save order details
  const handleSaveOrder = async () => {
    // Validate form
    if (!validateOrderDetails()) {
      showError('Please fix the validation errors before saving');
      return;
    }

    try {
      const updatedOrder = {
        ...selectedOrder,
        orderDetails: {
          ...selectedOrder.orderDetails,
          ...editOrderData
        }
      };
      
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, { 
        orderDetails: {
          ...selectedOrder.orderDetails,
          ...editOrderData
        }
      });
      
      // Update local state
      setSelectedOrder(updatedOrder);
      setOrders(orders.map(order => 
        order.id === selectedOrder.id ? updatedOrder : order
      ));
      
      setEditOrderDialog(false);
      showSuccess('Order details updated successfully');
    } catch (error) {
      console.error('Error updating order details:', error);
      showError('Failed to update order details');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex' }}>
      {/* Left Sidebar - Orders List */}
      <Paper 
        sx={{ 
          width: 300, 
          height: '100%', 
          overflow: 'auto',
          borderRight: '2px solid #e0e0e0'
        }}
      >
        <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Workshop Orders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {orders.length} order{orders.length !== 1 ? 's' : ''} in queue
          </Typography>
        </Box>

        {orders.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Alert severity="info">
              No orders found. Create some orders first!
            </Alert>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {orders.map((order, index) => (
              <React.Fragment key={order.id}>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedOrder?.id === order.id}
                    onClick={() => setSelectedOrder(order)}
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: 'primary.light',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                        },
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box>
                          {/* Invoice Number - Big Font */}
                          <Typography 
                            variant="h4" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: 'primary.main',
                              mb: 1
                            }}
                          >
                            #{order.orderDetails?.billInvoice || 'N/A'}
                          </Typography>
                          
                          {/* Customer Details - Smaller Font */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <PersonIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {order.personalInfo?.name || 'No Name'}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {order.personalInfo?.email || 'No Email'}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <PhoneIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {order.personalInfo?.phone || 'No Phone'}
                            </Typography>
                          </Box>

                          {/* Status and Date */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Chip
                              label={getStatusText(order)}
                              color={getStatusColor(order)}
                              size="small"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(order.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                {index < orders.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Right Panel - Order Details */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        {selectedOrder ? (
          <Box>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                Order #{selectedOrder.orderDetails?.billInvoice}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                {selectedOrder.personalInfo?.name} • {formatDate(selectedOrder.createdAt)}
              </Typography>
            </Box>

            {/* Order Details Grid */}
            <Grid container spacing={3}>
              {/* Personal Information */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6">Personal Information</Typography>
                      </Box>
                      <IconButton
                        onClick={handleEditPersonal}
                        sx={{
                          border: '2px solid #1976d2',
                          backgroundColor: 'white',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                            borderColor: '#1565c0'
                          }
                        }}
                      >
                        <EditIcon sx={{ fontSize: 20, color: '#1976d2' }} />
                      </IconButton>
                    </Box>
                    <Box sx={{ space: 1 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Name:</strong> {selectedOrder.personalInfo?.name || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Email:</strong> {selectedOrder.personalInfo?.email || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Phone:</strong> {selectedOrder.personalInfo?.phone || 'N/A'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Address:</strong> {selectedOrder.personalInfo?.address || 'N/A'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Order Details */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6">Order Details</Typography>
                      </Box>
                      <IconButton
                        onClick={handleEditOrder}
                        sx={{
                          border: '2px solid #1976d2',
                          backgroundColor: 'white',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                            borderColor: '#1565c0'
                          }
                        }}
                      >
                        <EditIcon sx={{ fontSize: 20, color: '#1976d2' }} />
                      </IconButton>
                    </Box>
                    <Box sx={{ space: 1 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Description:</strong> {selectedOrder.orderDetails?.description || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Platform:</strong> {selectedOrder.orderDetails?.platform || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Start Date:</strong> {selectedOrder.orderDetails?.startDate || 'N/A'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Timeline:</strong> {selectedOrder.orderDetails?.timeline || 'N/A'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Furniture Details */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <ChairIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6">Furniture Details</Typography>
                    </Box>
                    {selectedOrder.furnitureData?.groups && selectedOrder.furnitureData.groups.length > 0 ? (
                      <Box>
                        {selectedOrder.furnitureData.groups.map((group, index) => (
                          <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                              {group.furnitureType || 'Furniture Item'} #{index + 1}
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                  <strong>Material:</strong> {group.materialCompany} - {group.materialCode}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                  <strong>Material Price:</strong> ${group.materialPrice} x {group.materialQnty}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                  <strong>Labour:</strong> ${group.labourPrice} x {group.labourQnty}
                                </Typography>
                                {group.foamEnabled && (
                                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    <strong>Foam:</strong> ${group.foamPrice} x {group.foamQnty}
                                  </Typography>
                                )}
                              </Grid>
                            </Grid>
                            {group.customerNote && (
                              <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                                <strong>Note:</strong> {group.customerNote}
                              </Typography>
                            )}
                          </Box>
                        ))}
                        {selectedOrder.furnitureData.customerNote && (
                          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
                            <strong>General Note:</strong> {selectedOrder.furnitureData.customerNote}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No furniture items added
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Payment & Notes */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <PaymentIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6">Payment & Notes</Typography>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Deposit:</strong> ${selectedOrder.paymentData?.deposit || '0'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Total Value:</strong> ${calculateOrderTotal(selectedOrder).toFixed(2)}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Status:</strong> 
                          <Chip 
                            label={getStatusText(selectedOrder)} 
                            color={getStatusColor(selectedOrder)} 
                            size="small" 
                            sx={{ ml: 1 }}
                          />
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        {selectedOrder.paymentData?.pickupDeliveryEnabled && (
                          <Box sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                              <ShippingIcon sx={{ fontSize: 16, mr: 1 }} />
                              <Typography variant="body2">
                                <strong>Pickup & Delivery:</strong> ${selectedOrder.paymentData.pickupDeliveryCost}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        {selectedOrder.paymentData?.notes && (
                          <Typography variant="body2">
                            <strong>Notes:</strong> {selectedOrder.paymentData.notes}
                          </Typography>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="h6" color="text.secondary">
              Select an order from the left panel to view details
            </Typography>
          </Box>
        )}
      </Box>

      {/* Edit Personal Information Dialog */}
      <Dialog open={editPersonalDialog} onClose={() => setEditPersonalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Personal Information</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={editPersonalData.name || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, name: e.target.value })}
              required
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={editPersonalData.email || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, email: e.target.value })}
              required
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
            <TextField
              fullWidth
              label="Phone"
              value={editPersonalData.phone || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, phone: e.target.value })}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={3}
              value={editPersonalData.address || ''}
              onChange={(e) => setEditPersonalData({ ...editPersonalData, address: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPersonalDialog(false)}>Cancel</Button>
          <Button onClick={handleSavePersonal} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Order Details Dialog */}
      <Dialog open={editOrderDialog} onClose={() => setEditOrderDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Order Details</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Order Description"
              value={editOrderData.description || ''}
              onChange={(e) => setEditOrderData({ ...editOrderData, description: e.target.value })}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Select
                value={editOrderData.platform || ''}
                onChange={(e) => setEditOrderData({ ...editOrderData, platform: e.target.value })}
                displayEmpty
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '2px',
                    borderColor: 'grey.300',
                    borderRadius: 2,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              >
                <MenuItem value="" disabled>
                  Platform
                </MenuItem>
                {['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok', 'YouTube', 'Website', 'Other'].map((platform) => (
                  <MenuItem key={platform} value={platform}>
                    {platform}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={editOrderData.startDate || ''}
              onChange={(e) => setEditOrderData({ ...editOrderData, startDate: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
              required
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
            <TextField
              fullWidth
              label="Timeline"
              value={editOrderData.timeline || ''}
              onChange={(e) => setEditOrderData({ ...editOrderData, timeline: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '2px',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOrderDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveOrder} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkshopPage; 