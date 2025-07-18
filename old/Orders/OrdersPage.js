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
  Phone as PhoneIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/Common/NotificationSystem';

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

  const { showSuccess, showError } = useNotification();
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
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));
      
      // Sort by bill number (highest to lowest)
      const sortedOrders = sortOrdersByBillNumber(ordersData);
      
      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Global search function
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    
    if (!searchValue.trim()) {
      setFilteredOrders(sortOrdersByBillNumber([...orders]));
      return;
    }

    const searchLower = searchValue.toLowerCase();
    const filtered = orders.filter(order => {
      // Search in personal info (Step 1)
      const personalInfo = order.personalInfo || {};
      if (
        personalInfo.name?.toLowerCase().includes(searchLower) ||
        personalInfo.email?.toLowerCase().includes(searchLower) ||
        personalInfo.phone?.toLowerCase().includes(searchLower) ||
        personalInfo.address?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }

      // Search in order details (Step 2)
      const orderDetails = order.orderDetails || {};
      if (
        orderDetails.billInvoice?.toLowerCase().includes(searchLower) ||
        orderDetails.description?.toLowerCase().includes(searchLower) ||
        orderDetails.platform?.toLowerCase().includes(searchLower) ||
        orderDetails.timeline?.toLowerCase().includes(searchLower)
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
      await deleteDoc(doc(db, 'orders', orderToDelete.id));
      
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

  // Calculate total order value
  const calculateOrderTotal = (order) => {
    let total = 0;
    
    // Add furniture costs
    if (order.furnitureData?.groups) {
      order.furnitureData.groups.forEach(group => {
        total += (parseFloat(group.materialPrice) || 0) * (parseInt(group.materialQnty) || 0);
        total += (parseFloat(group.labourPrice) || 0) * (parseInt(group.labourQnty) || 0);
        if (group.foamEnabled) {
          total += (parseFloat(group.foamPrice) || 0) * (parseInt(group.foamQnty) || 0);
        }
      });
    }

    // Add pickup & delivery cost
    if (order.paymentData?.pickupDeliveryEnabled) {
      total += parseFloat(order.paymentData.pickupDeliveryCost) || 0;
    }

    return total;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status chip color
  const getStatusColor = (order) => {
    const total = calculateOrderTotal(order);
    const deposit = parseFloat(order.paymentData?.deposit) || 0;
    
    if (deposit >= total) return 'success';
    if (deposit > 0) return 'warning';
    return 'error';
  };

  // Get status text
  const getStatusText = (order) => {
    const total = calculateOrderTotal(order);
    const deposit = parseFloat(order.paymentData?.deposit) || 0;
    
    if (deposit >= total) return 'Paid';
    if (deposit > 0) return 'Partial';
    return 'Pending';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
            Orders Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and review all customer orders
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/orders/new')}
          sx={{
            background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1565c0, #1976d2)'
            }
          }}
        >
          New Order
        </Button>
      </Box>

      {/* Search and Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth
            placeholder="Search orders by invoice, name, email, phone, address, description, platform, timeline, or any field..."
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
        <Grid item xs={12} md={4}>
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
      <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Order Details</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Total Value</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
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
                            {order.personalInfo?.name || 'N/A'}
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
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {order.orderDetails?.description || 'No description'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Platform: {order.orderDetails?.platform || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Timeline: {order.orderDetails?.timeline || 'N/A'}
                        </Typography>
                        <Chip 
                          label={`${order.furnitureData?.groups?.length || 0} items`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        ${calculateOrderTotal(order).toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Deposit: ${order.paymentData?.deposit || 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(order)}
                        color={getStatusColor(order)}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {formatDate(order.createdAt)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
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
                            onClick={() => navigate(`/orders/edit/${order.id}`)}
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
      </Card>

      {/* View Order Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
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
              <Grid container spacing={3}>
                {/* Personal Information */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Customer Information
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {selectedOrder.personalInfo?.name || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <EmailIcon sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {selectedOrder.personalInfo?.email || 'No email'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PhoneIcon sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {selectedOrder.personalInfo?.phone || 'No phone'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {selectedOrder.personalInfo?.address || 'No address'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Order Details */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Order Information
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {selectedOrder.orderDetails?.billInvoice || 'N/A'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Description:</strong> {selectedOrder.orderDetails?.description || 'No description'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Platform:</strong> {selectedOrder.orderDetails?.platform || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Timeline:</strong> {selectedOrder.orderDetails?.timeline || 'N/A'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Start Date:</strong> {selectedOrder.orderDetails?.startDate || 'N/A'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Furniture Details */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Furniture Items ({selectedOrder.furnitureData?.groups?.length || 0})
                      </Typography>
                      {selectedOrder.furnitureData?.groups?.map((group, index) => (
                        <Box key={group.id} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {group.furnitureType || `Item ${index + 1}`}
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2">
                                <strong>Material:</strong> {group.materialCompany} - {group.materialCode}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Qty:</strong> {group.materialQnty} | <strong>Price:</strong> ${group.materialPrice}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2">
                                <strong>Labour:</strong> ${group.labourPrice} | <strong>Qty:</strong> {group.labourQnty}
                              </Typography>
                              {group.foamEnabled && (
                                <Typography variant="body2">
                                  <strong>Foam:</strong> ${group.foamPrice} | <strong>Qty:</strong> {group.foamQnty}
                                </Typography>
                              )}
                            </Grid>
                          </Grid>
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Payment Summary */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ backgroundColor: '#f8f9fa' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Payment Summary
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            Total Value: ${calculateOrderTotal(selectedOrder).toFixed(2)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Deposit: ${selectedOrder.paymentData?.deposit || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Chip
                            label={getStatusText(selectedOrder)}
                            color={getStatusColor(selectedOrder)}
                            sx={{ fontWeight: 'bold' }}
                          />
                          {selectedOrder.paymentData?.pickupDeliveryEnabled && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Pickup & Delivery: ${selectedOrder.paymentData.pickupDeliveryCost}
                            </Typography>
                          )}
                        </Grid>
                      </Grid>
                      {selectedOrder.paymentData?.notes && (
                        <Box sx={{ mt: 2, p: 2, backgroundColor: 'white', borderRadius: 1 }}>
                          <Typography variant="body2">
                            <strong>Notes:</strong> {selectedOrder.paymentData.notes}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setViewDialogOpen(false);
              navigate(`/orders/edit/${selectedOrder?.id}`);
            }}
          >
            Edit Order
          </Button>
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
            <strong>{orderToDelete?.personalInfo?.name}</strong>?
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
    </Box>
  );
};

export default OrdersPage; 