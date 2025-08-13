import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton as MuiIconButton
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
  CheckCircle as CheckCircleIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon
} from '@mui/icons-material';

import { useNotification } from '../../components/Common/NotificationSystem';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { calculateOrderProfit } from '../../utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../../utils/materialTaxRates';
import { formatCurrency } from '../../utils/plCalculations';
import { formatDate } from '../../utils/plCalculations';

const EndDonePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [materialTaxRates, setMaterialTaxRates] = useState({});

  const { showError } = useNotification();

  // Fetch orders with "done" end state
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      // First get all invoice statuses to identify "done" end states
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

      // Filter for orders with "done" end state status
      const doneStatuses = statusesData.filter(status => 
        status.isEndState && status.endStateType === 'done'
      );
      const doneStatusValues = doneStatuses.map(status => status.value);

      const doneOrders = ordersData.filter(order => 
        doneStatusValues.includes(order.invoiceStatus)
      );

      // Fetch material tax rates
      const taxRates = await fetchMaterialCompanyTaxRates();
      setMaterialTaxRates(taxRates);
      
      setOrders(doneOrders);
      setFilteredOrders(doneOrders);
    } catch (error) {
      console.error('Error fetching done orders:', error);
      showError('Failed to fetch completed orders');
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

  // Handle row expansion
  const handleRowToggle = (orderId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(orderId)) {
      newExpandedRows.delete(orderId);
    } else {
      newExpandedRows.add(orderId);
    }
    setExpandedRows(newExpandedRows);
  };

  // Get status info
  const getStatusInfo = (status) => {
    const statusObj = invoiceStatuses.find(s => s.value === status);
    return statusObj || { label: status, color: '#666' };
  };

  // Calculate order totals
  const calculateOrderTotals = (order) => {
    const profitData = calculateOrderProfit(order, materialTaxRates);
    return {
      revenue: profitData.revenue,
      cost: profitData.cost,
      profit: profitData.profit
    };
  };

  // Get allocation info
  const getAllocationInfo = (order) => {
    if (!order.allocation) return null;
    
    const totalAllocations = order.allocation.allocations?.length || 0;
    const method = order.allocation.method || 'unknown';
    const appliedAt = order.allocation.appliedAt;
    const originalRevenue = calculateOrderProfit(order, materialTaxRates).revenue;
    
    return {
      totalAllocations,
      method,
      originalRevenue,
      appliedAt: appliedAt?.toDate ? appliedAt.toDate() : new Date(appliedAt)
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
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33', mb: 1 }}>
          <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
          Completed Orders
        </Typography>
        <Typography variant="body1" sx={{ color: '#ffffff' }}>
          All orders that have been successfully completed and allocated
        </Typography>
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search completed orders..."
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
              backgroundColor: '#2a2a2a',
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

      {/* Orders Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', backgroundColor: '#2a2a2a', border: '1px solid #333333' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#b98f33' }}>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Customer</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Revenue</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Cost</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Profit</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Completed</TableCell>
                <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Alert severity="info">
                      {searchTerm ? 'No completed orders found matching your search' : 'No completed orders found'}
                    </Alert>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <React.Fragment key={order.id}>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                        #{order.orderDetails?.billInvoice || order.id}
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
                            {order.personalInfo?.customerName || 'Unknown Customer'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#b98f33' }}>
                            {order.personalInfo?.phone || 'No Phone'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                          {formatCurrency(calculateOrderTotals(order).revenue)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                          {formatCurrency(calculateOrderTotals(order).cost)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#b98f33', fontWeight: 'bold' }}>
                          {formatCurrency(calculateOrderTotals(order).profit)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusInfo(order.invoiceStatus).label}
                          size="small"
                          sx={{
                            backgroundColor: getStatusInfo(order.invoiceStatus).color,
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                                             <TableCell>
                         <Typography variant="body2" sx={{ color: '#ffffff' }}>
                           {formatDateDisplay(order.completedAt || order.statusUpdatedAt || order.updatedAt)}
                         </Typography>
                       </TableCell>
                      <TableCell>
                        <MuiIconButton
                          size="small"
                          onClick={() => handleRowToggle(order.id)}
                          sx={{ color: '#b98f33' }}
                        >
                          {expandedRows.has(order.id) ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </MuiIconButton>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                        <Collapse in={expandedRows.has(order.id)} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Card sx={{ mb: 2 }}>
                              <CardContent>
                                {/* Customer Information */}
                                <Box sx={{ mb: 3 }}>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <PersonIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Customer Information
                                  </Typography>
                                  <Card sx={{ 
                                    background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                    color: 'white',
                                    boxShadow: 3,
                                    border: '1px solid #333333'
                                  }}>
                                    <CardContent>
                                      <Grid container spacing={3}>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.personalInfo?.customerName || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Customer Name
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.personalInfo?.phone || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Phone Number
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.personalInfo?.email || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Email Address
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12}>
                                          <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                              {order.personalInfo?.address || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Delivery Address
                                            </Typography>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </CardContent>
                                  </Card>
                                </Box>

                                {/* Financial Summary */}
                                <Box sx={{ mb: 3 }}>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Financial Summary
                                  </Typography>
                                  <Grid container spacing={2}>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).revenue)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Revenue
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).cost)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Cost
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                      <Card sx={{ 
                                        background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                        color: 'white',
                                        boxShadow: 3,
                                        border: '1px solid #333333'
                                      }}>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#b98f33' }}>
                                            {formatCurrency(calculateOrderTotals(order).profit)}
                                          </Typography>
                                          <Typography variant="body2" sx={{ opacity: 0.9, color: '#ffffff' }}>
                                            Total Profit
                                          </Typography>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                  </Grid>
                                </Box>

                                {/* Allocation Information */}
                                {getAllocationInfo(order) && (
                                  <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                      <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                      Financial Allocation Details
                                    </Typography>
                                    <Card sx={{ 
                                      background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                      color: 'white',
                                      boxShadow: 3,
                                      border: '1px solid #333333'
                                    }}>
                                      <CardContent>
                                        <Grid container spacing={3}>
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {getAllocationInfo(order).method.toUpperCase()}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Allocation Method
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {getAllocationInfo(order).totalAllocations}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Month(s) Allocated
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {formatCurrency(getAllocationInfo(order).originalRevenue)}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Original Revenue
                                              </Typography>
                                            </Box>
                                          </Grid>
                                          <Grid item xs={12} sm={3}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {formatDateDisplay(getAllocationInfo(order).appliedAt)}
                                              </Typography>
                                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                                Applied Date
                                              </Typography>
                                            </Box>
                                          </Grid>
                                        </Grid>
                                      </CardContent>
                                    </Card>
                                  </Box>
                                )}

                                {/* Completion Details */}
                                <Box>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#b98f33' }}>
                                    <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#b98f33' }} />
                                    Completion Details
                                  </Typography>
                                  <Card sx={{ 
                                    background: 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)', 
                                    color: 'white',
                                    boxShadow: 3,
                                    border: '1px solid #333333'
                                  }}>
                                    <CardContent>
                                      <Grid container spacing={3}>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                                                                         <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                               {formatDateDisplay(order.completedAt || order.statusUpdatedAt || order.updatedAt)}
                                             </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Order Completed
                                            </Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ textAlign: 'center' }}>
                                                                                         <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                               {formatDateDisplay(order.statusUpdatedAt || order.updatedAt || order.completedAt)}
                                             </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                              Status Updated
                                            </Typography>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </CardContent>
                                  </Card>
                                </Box>
                              </CardContent>
                            </Card>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default EndDonePage; 