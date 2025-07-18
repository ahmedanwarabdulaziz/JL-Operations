import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Avatar,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  FlashOn as FlashOnIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/Common/NotificationSystem';
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Step5Review from './steps/Step5Review';
import FastOrderModal from '../../components/FastOrder/FastOrderModal';
import { calculateOrderTotal, formatFurnitureDetails, isRapidOrder } from '../../utils/orderCalculations';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [fastOrderModalOpen, setFastOrderModalOpen] = useState(false);

  const { showSuccess, showError, showConfirm } = useNotification();
  const navigate = useNavigate();

  // Sort orders by bill number (highest to lowest)
  const sortOrdersByBillNumber = (ordersList) => {
    return ordersList.sort((a, b) => {
      const billA = parseInt(a.orderDetails?.billInvoice || '0', 10);
      const billB = parseInt(b.orderDetails?.billInvoice || '0', 10);
      return billB - billA; // Descending order (highest first)
    });
  };

  // Fetch orders from Firebase
  const fetchOrders = useCallback(async () => {
    try {
      console.log('Starting to fetch orders...');
      setLoading(true);
      
      // Add a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const ordersCollection = collection(db, 'orders');
      const ordersQuery = query(ordersCollection, orderBy('orderDetails.billInvoice', 'desc'));
      const ordersDataPromise = getDocs(ordersQuery);
      
      const ordersSnapshot = await Promise.race([ordersDataPromise, timeoutPromise]);
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log('Orders data received:', ordersData);
      
      // Sort by bill number (highest to lowest)
      const sortedOrders = sortOrdersByBillNumber(ordersData);
      console.log('Sorted orders:', sortedOrders);
      
      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError(`Failed to fetch orders: ${error.message}`);
      // Set empty arrays to prevent infinite loading
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Global search function
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    
    if (!searchValue.trim()) {
      setFilteredOrders(sortOrdersByBillNumber([...orders]));
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const filtered = orders.filter(order => {
      // Search in bill number (Step 2)
      const orderDetails = order.orderDetails || {};
      if (orderDetails.billInvoice?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Search in personal info (Step 1)
      const personalInfo = order.personalInfo || {};
      if (
        personalInfo.customerName?.toLowerCase().includes(searchLower) ||
        personalInfo.email?.toLowerCase().includes(searchLower) ||
        personalInfo.phone?.toLowerCase().includes(searchLower) ||
        personalInfo.address?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }

      // Search in payment data (Step 4)
      const paymentData = order.paymentData || {};
      if (
        paymentData.notes?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }

      // Search in furniture data (Step 3)
      const furnitureData = order.furnitureData || {};
      if (furnitureData.groups) {
        return furnitureData.groups.some(group => 
          group.furnitureType?.toLowerCase().includes(searchLower) ||
          group.materialCompany?.toLowerCase().includes(searchLower) ||
          group.materialCode?.toLowerCase().includes(searchLower) ||
          group.labourNote?.toLowerCase().includes(searchLower) ||
          group.foamNote?.toLowerCase().includes(searchLower) ||
          group.customerNote?.toLowerCase().includes(searchLower)
        );
      }

      return false;
    });

    // Sort filtered results by bill number (highest to lowest)
    const sortedFiltered = sortOrdersByBillNumber(filtered);
    setFilteredOrders(sortedFiltered);
  };

  // Handle order deletion
  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      setDeleting(true);
      const ordersCollection = collection(db, 'orders');
      await deleteDoc(doc(ordersCollection, orderToDelete.id));
      
      setOrders(prev => prev.filter(order => order.id !== orderToDelete.id));
      setFilteredOrders(prev => prev.filter(order => order.id !== orderToDelete.id));
      
      showSuccess('Order deleted successfully');
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error('Error deleting order:', error);
      showError('Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  // Using shared calculateOrderTotal utility for consistency

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      let dateObj;
      
      // Handle Firebase timestamp
      if (date && typeof date === 'object' && date.toDate) {
        dateObj = date.toDate();
      } else {
        dateObj = new Date(date);
      }
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'Date value:', date);
      return 'Invalid Date';
    }
  };

  // Handle fast order submission
  const handleFastOrderSubmit = async (orderData) => {
    try {
      // Add the order to Firebase
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Refresh the orders list
      await fetchOrders();
      
      showSuccess('Fast order created successfully!');
      setFastOrderModalOpen(false);
    } catch (error) {
      console.error('Error creating fast order:', error);
      showError('Failed to create fast order. Please try again.');
      throw error; // Re-throw to let the modal handle it
    }
  };

  // Get status chip color
  const getStatusColor = (order) => {
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    
    // Ensure amounts are valid numbers
    const validAmountPaid = isNaN(amountPaid) ? 0 : amountPaid;
    const validRequiredDeposit = isNaN(requiredDeposit) ? 0 : requiredDeposit;
    
    if (validAmountPaid >= validRequiredDeposit && validRequiredDeposit > 0) return 'success';
    if (validAmountPaid > 0) return 'warning';
    return 'error';
  };

  // Get status text
  const getStatusText = (order) => {
    const total = calculateOrderTotal(order);
    const requiredDeposit = parseFloat(order.paymentData?.deposit) || 0;
    const amountPaid = parseFloat(order.paymentData?.amountPaid) || 0;
    
    console.log('Order Status Debug:', {
      orderId: order.id,
      customerName: order.personalInfo?.customerName,
      total: total,
      requiredDeposit: requiredDeposit,
      amountPaid: amountPaid,
      amountPaidType: typeof order.paymentData?.amountPaid,
      rawAmountPaid: order.paymentData?.amountPaid,
      isAmountPaidZero: amountPaid === 0,
      isAmountPaidPositive: amountPaid > 0,
      isAmountPaidEnough: amountPaid >= requiredDeposit
    });
    
    // Ensure amounts are valid numbers
    const validAmountPaid = isNaN(amountPaid) ? 0 : amountPaid;
    const validRequiredDeposit = isNaN(requiredDeposit) ? 0 : requiredDeposit;
    
    if (validAmountPaid >= validRequiredDeposit && validRequiredDeposit > 0) return 'Paid';
    if (validAmountPaid > 0) return 'Partial';
    return 'Not Paid';
  };

  if (loading) {
    console.log('Orders page is in loading state');
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

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
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#274290' }}>
            Orders Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage and review all customer orders • Click column headers to sort
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<FlashOnIcon />}
            onClick={() => setFastOrderModalOpen(true)}
            sx={{
              minWidth: 150,
              px: 3,
              backgroundColor: '#f27921',
              '&:hover': {
                backgroundColor: '#e06810'
              },
              flexShrink: 0
            }}
          >
            Fast Order
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/orders/new')}
            sx={{
              minWidth: 150,
              px: 3,
              backgroundColor: '#274290',
              '&:hover': {
                backgroundColor: '#1e2d5a'
              },
              flexShrink: 0
            }}
          >
            Add Order
          </Button>
        </Box>
      </Box>

      {/* Search and Stats */}
      <Grid container spacing={3} sx={{ mb: 3, flexShrink: 0 }}>
        <Grid xs={12} md={8}>
          <TextField
            fullWidth
            placeholder="Search by bill number, name, email, phone, address, or any field..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleSearch('')}>
                    <RefreshIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'background.paper',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }
            }}
          />
        </Grid>
        <Grid xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {filteredOrders.length}
              </Typography>
              <Typography variant="body2">
                {searchTerm ? 'Filtered Orders' : 'Total Orders'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Orders Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#274290' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Total Invoice</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Deposit Required</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Total Paid</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary">
                      {searchTerm ? 'No orders found matching your search' : 'No orders found'}
                    </Typography>
                    {!searchTerm && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/orders/new')}
                        sx={{ mt: 2 }}
                      >
                        Create First Order
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                          <PersonIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {order.personalInfo?.customerName || 'N/A'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {order.personalInfo?.email || 'No email'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {order.personalInfo?.phone || 'No phone'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {order.orderDetails?.billInvoice || 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#f27921' }}>
                        ${calculateOrderTotal(order).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        ${order.paymentData?.deposit || 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        ${order.paymentData?.amountPaid || 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {order.orderDetails?.financialStatus ? (
                        <Chip
                          label={order.orderDetails.financialStatus}
                          color={
                            order.orderDetails.financialStatus === 'Deposit Paid' ? 'warning' :
                            order.orderDetails.financialStatus === 'Deposit Not Paid' ? 'error' : 'default'
                          }
                          size="small"
                          sx={{ fontWeight: 'bold' }}
                        />
                      ) : (
                        <Chip
                          label={getStatusText(order)}
                          color={getStatusColor(order)}
                          size="small"
                          sx={{ fontWeight: 'bold' }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {formatDate(order.createdAt)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              setSelectedOrder(order);
                              setViewDialogOpen(true);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Order">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              // Navigate to edit order page with order data and go directly to review step
                              navigate('/orders/new', { 
                                state: { 
                                  editMode: true, 
                                  orderData: order,
                                  activeStep: 4 // Go directly to review step (Step 5)
                                } 
                              });
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Order">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setOrderToDelete(order);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

      {/* View Order Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Order Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ mt: 2 }}>
              <Step5Review
                personalInfo={selectedOrder.personalInfo || {}}
                orderDetails={selectedOrder.orderDetails || {}}
                furnitureGroups={selectedOrder.furnitureData?.groups || []}
                paymentDetails={selectedOrder.paymentData || {}}
                onEditStep={(stepIndex) => {
                  setViewDialogOpen(false);
                  // Navigate to edit order page with order data and specific step
                  navigate('/orders/new', { 
                    state: { 
                      editMode: true, 
                      orderData: selectedOrder,
                      activeStep: 4 // Go directly to review step
                    } 
                  });
                }}
                showEditButtons={false}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. The order will be permanently deleted.
          </Alert>
          <Typography>
            Are you sure you want to delete the order for{' '}
            <strong>{orderToDelete?.personalInfo?.customerName}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteOrder}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fast Order Modal */}
      <FastOrderModal
        open={fastOrderModalOpen}
        onClose={() => setFastOrderModalOpen(false)}
        onSubmit={handleFastOrderSubmit}
      />
    </Box>
  );
};

export default OrdersPage; 