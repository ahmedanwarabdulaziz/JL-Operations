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

import { useNotification } from '../shared/components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../shared/firebase/config';
import { calculateOrderProfit } from '../shared/utils/orderCalculations';
import { formatCurrency } from '../shared/utils/plCalculations';
import { formatDate } from '../shared/utils/plCalculations';

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
    <Box sx={{ p: 3, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
          <CancelIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
          Cancelled Orders
        </Typography>
        <Typography variant="body1" sx={{ color: '#ffffff' }}>
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
            borderRight: '2px solid #333333',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#2a2a2a',
            border: '1px solid #333333'
          }}
        >
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: '2px solid #333333' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
              Cancelled Orders
            </Typography>
            <Typography variant="body2" sx={{ color: '#ffffff', mb: 2 }}>
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
                    <SearchIcon sx={{ color: '#b98f33' }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => handleSearch('')} sx={{ color: '#b98f33' }}>
                      <RefreshIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: '#3a3a3a',
                  '&:hover fieldset': { borderColor: '#b98f33' },
                  '&.Mui-focused fieldset': { borderColor: '#b98f33' }
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff'
                },
                '& .MuiInputLabel-root': {
                  color: '#b98f33'
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
                           backgroundColor: '#4a4a4a',
                           '&:hover': {
                             backgroundColor: '#4a4a4a',
                           },
                         },
                         '&:hover': {
                           backgroundColor: '#4a4a4a',
                         },
                       }}
                     >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
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
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                              {order.personalInfo?.customerName || 'Unknown Customer'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#b98f33' }}>
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
              <Card sx={{ mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
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
                    <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                      <PersonIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                      Customer Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Name:</Typography>
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>{selectedOrder.personalInfo?.customerName || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Phone:</Typography>
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>{selectedOrder.personalInfo?.phone || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Email:</Typography>
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>{selectedOrder.personalInfo?.email || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Address:</Typography>
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>{selectedOrder.personalInfo?.address || 'N/A'}</Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Financial Summary */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                      <TrendingDownIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                      Financial Summary
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <Card sx={{ 
                          background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                          border: '1px solid #333333',
                          boxShadow: 3
                        }}>
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                              {formatCurrency(calculateOrderTotals(selectedOrder).revenue)}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ffffff' }}>Original Revenue</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Card sx={{ 
                          background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                          border: '1px solid #333333',
                          boxShadow: 3
                        }}>
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                              {formatCurrency(calculateOrderTotals(selectedOrder).cost)}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ffffff' }}>Original Cost</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Card sx={{ 
                          background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                          border: '1px solid #333333',
                          boxShadow: 3
                        }}>
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                              $0.00
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ffffff' }}>Final Payment</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Cancellation Details */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                      <CancelIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                      Cancellation Details
                    </Typography>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                      border: '1px solid #333333',
                      boxShadow: 3
                    }}>
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Cancelled At:</Typography>
                            <Typography variant="body1" sx={{ color: '#ffffff' }}>
                              {formatDateDisplay(selectedOrder.cancelledAt)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Status Updated:</Typography>
                            <Typography variant="body1" sx={{ color: '#ffffff' }}>
                              {formatDateDisplay(selectedOrder.statusUpdatedAt)}
                            </Typography>
                          </Grid>
                          {selectedOrder.cancellationReason && (
                            <Grid item xs={12}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Cancellation Reason:</Typography>
                              <Typography variant="body1" sx={{ fontStyle: 'italic', color: '#ffffff' }}>
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
                    <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                      <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                      Order Details
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Description:</Typography>
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>
                          {selectedOrder.orderDetails?.description || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Platform:</Typography>
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>
                          {selectedOrder.orderDetails?.platform || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Timeline:</Typography>
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>
                          {selectedOrder.orderDetails?.timeline || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#b98f33' }}>Created:</Typography>
                        <Typography variant="body1" sx={{ color: '#ffffff' }}>
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
              <CancelIcon sx={{ fontSize: 64, color: '#b98f33', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#ffffff' }}>
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
