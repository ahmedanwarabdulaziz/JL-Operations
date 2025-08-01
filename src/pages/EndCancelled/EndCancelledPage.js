import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
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
  IconButton,
  InputAdornment,
  Avatar,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { Grid } from '@mui/material';

import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Chair as ChairIcon,
  LocalShipping as ShippingIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';

import { useNotification } from '../../components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { calculateOrderProfit } from '../../utils/orderCalculations';
import { formatCurrency } from '../../utils/plCalculations';
import { formatDate } from '../../utils/plCalculations';

const EndCancelledPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);

  const { showError } = useNotification();

  // Fetch orders with "cancelled" end state
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      // First get all invoice statuses to identify "cancelled" end states
      const statusesRef = collection(db, 'invoiceStatuses');
      const statusesSnapshot = await getDocs(statusesRef);
      const statusesData = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvoiceStatuses(statusesData);

      // Get all orders
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter for orders with "cancelled" end state status
      const cancelledStatuses = statusesData.filter(status => 
        status.isEndState && status.endStateType === 'cancelled'
      );
      const cancelledStatusValues = cancelledStatuses.map(status => status.value);

      const cancelledOrders = ordersData.filter(order => 
        cancelledStatusValues.includes(order.invoiceStatus)
      );

      setOrders(cancelledOrders);
      setFilteredOrders(cancelledOrders);
    } catch (error) {
      console.error('Error fetching cancelled orders:', error);
      showError('Failed to fetch cancelled orders');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle search
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    if (!searchValue.trim()) {
      setFilteredOrders(orders);
      return;
    }

    const filtered = orders.filter(order => {
      const searchLower = searchValue.toLowerCase();
      return (
        order.orderDetails?.billInvoice?.toLowerCase().includes(searchLower) ||
        order.personalInfo?.customerName?.toLowerCase().includes(searchLower) ||
        order.personalInfo?.phone?.includes(searchValue) ||
        order.personalInfo?.email?.toLowerCase().includes(searchLower)
      );
    });

    setFilteredOrders(filtered);
  };

  // Handle order selection
  const handleOrderSelection = (order) => {
    setSelectedOrder(order);
  };

  // Get status info
  const getStatusInfo = (status) => {
    const statusObj = invoiceStatuses.find(s => s.value === status);
    return statusObj || { label: status, color: '#666' };
  };

  // Calculate order totals
  const calculateOrderTotals = (order) => {
    const profitData = calculateOrderProfit(order);
    return {
      revenue: profitData.revenue,
      cost: profitData.cost,
      profit: profitData.profit
    };
  };

  // Format date
  const formatDateDisplay = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#e6e7e8', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#274290', mb: 1 }}>
          <CancelIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#f44336' }} />
          Cancelled Orders
        </Typography>
        <Typography variant="body1" color="text.secondary">
          All orders that have been cancelled and removed from active workflow
        </Typography>
      </Box>

      <Box sx={{ 
        height: 'calc(100vh - 200px)', 
        display: 'flex'
      }}>
        {/* Left Sidebar - Orders List */}
        <Paper 
          sx={{ 
            width: 400, 
            height: '100%', 
            overflow: 'auto',
            borderRight: '2px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: '2px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
              Cancelled Orders
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {filteredOrders.length} cancelled order{filteredOrders.length !== 1 ? 's' : ''}
            </Typography>
            
            {/* Search */}
            <TextField
              fullWidth
              placeholder="Search cancelled orders..."
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
                  backgroundColor: 'background.paper'
                }
              }}
            />
          </Box>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Alert severity="info">
                {searchTerm ? 'No cancelled orders found matching your search' : 'No cancelled orders found'}
              </Alert>
            </Box>
          ) : (
            <List sx={{ p: 0, flex: 1 }}>
              {filteredOrders.map((order, index) => (
                <React.Fragment key={order.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      selected={selectedOrder?.id === order.id}
                      onClick={() => handleOrderSelection(order)}
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
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                              #{order.orderDetails?.billInvoice || order.id}
                            </Typography>
                            <Chip
                              label={getStatusInfo(order.invoiceStatus).label}
                              size="small"
                              sx={{
                                backgroundColor: getStatusInfo(order.invoiceStatus).color,
                                color: 'white',
                                fontWeight: 'bold'
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                              {order.personalInfo?.customerName || 'Unknown Customer'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatCurrency(calculateOrderProfit(order).revenue)} • {formatDateDisplay(order.cancelledAt)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < filteredOrders.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>

        {/* Right Side - Order Details */}
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          {selectedOrder ? (
            <Box>
              {/* Order Header */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#274290' }}>
                      Order #{selectedOrder.orderDetails?.billInvoice || selectedOrder.id}
                    </Typography>
                    <Chip
                      label={getStatusInfo(selectedOrder.invoiceStatus).label}
                      sx={{
                        backgroundColor: getStatusInfo(selectedOrder.invoiceStatus).color,
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    />
                  </Box>

                  {/* Customer Info */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                      <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Customer Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Name:</Typography>
                        <Typography variant="body1">{selectedOrder.personalInfo?.customerName || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Phone:</Typography>
                        <Typography variant="body1">{selectedOrder.personalInfo?.phone || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Email:</Typography>
                        <Typography variant="body1">{selectedOrder.personalInfo?.email || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Address:</Typography>
                        <Typography variant="body1">{selectedOrder.personalInfo?.address || 'N/A'}</Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Financial Summary */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                      <TrendingDownIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Financial Summary
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <Card sx={{ backgroundColor: '#fff3e0', border: '1px solid #ff9800' }}>
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>
                              {formatCurrency(calculateOrderTotals(selectedOrder).revenue)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Original Revenue</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Card sx={{ backgroundColor: '#ffebee', border: '1px solid #f44336' }}>
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
                              {formatCurrency(calculateOrderTotals(selectedOrder).cost)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Original Cost</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Card sx={{ backgroundColor: '#f3e5f5', border: '1px solid #9c27b0' }}>
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>
                              $0.00
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Final Payment</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Cancellation Details */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                      <CancelIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#f44336' }} />
                      Cancellation Details
                    </Typography>
                    <Card sx={{ backgroundColor: '#ffebee', border: '1px solid #f44336' }}>
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Cancelled At:</Typography>
                            <Typography variant="body1">
                              {formatDateDisplay(selectedOrder.cancelledAt)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Status Updated:</Typography>
                            <Typography variant="body1">
                              {formatDateDisplay(selectedOrder.statusUpdatedAt)}
                            </Typography>
                          </Grid>
                          {selectedOrder.cancellationReason && (
                            <Grid item xs={12}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Cancellation Reason:</Typography>
                              <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                                "{selectedOrder.cancellationReason}"
                              </Typography>
                            </Grid>
                          )}
                        </Grid>
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Order Details */}
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2, color: '#274290' }}>
                      <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Order Details
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Description:</Typography>
                        <Typography variant="body1">
                          {selectedOrder.orderDetails?.description || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Platform:</Typography>
                        <Typography variant="body1">
                          {selectedOrder.orderDetails?.platform || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Timeline:</Typography>
                        <Typography variant="body1">
                          {selectedOrder.orderDetails?.timeline || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Created:</Typography>
                        <Typography variant="body1">
                          {formatDateDisplay(selectedOrder.createdAt)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              flexDirection: 'column'
            }}>
              <CancelIcon sx={{ fontSize: 64, color: '#f44336', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Select a cancelled order to view details
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default EndCancelledPage; 