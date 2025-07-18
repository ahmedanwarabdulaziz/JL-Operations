import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MonetizationOnIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  PictureAsPdf as PdfIcon,
  Refresh as RefreshIcon,
  DateRange as DateRangeIcon,
  FilterList as FilterListIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/Common/NotificationSystem';
import { calculateOrderTotal, calculateOrderCost, calculateOrderProfit } from '../../utils/orderCalculations';

// Invoice statuses will be loaded dynamically from database

const FinancePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [invoiceStatuses, setInvoiceStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingStatus, setEditingStatus] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  
  // Date filtering state - default to current month
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
  });
  const [financialSummary, setFinancialSummary] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    averageProfitMargin: 0,
    paidAmount: 0,
    pendingAmount: 0,
    totalOrders: 0
  });

  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  // Fetch orders and statuses from Firebase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch orders
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('orderDetails.billInvoice', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Add default invoice status if not present
        invoiceStatus: doc.data().invoiceStatus || 'in_progress'
      }));
      
      setOrders(ordersData);
      setFilteredOrders(ordersData);
      calculateFinancialSummary(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Fetch invoice statuses from database
  const fetchInvoiceStatuses = async () => {
    try {
      const statusesRef = collection(db, 'invoiceStatuses');
      const querySnapshot = await getDocs(statusesRef);
      const statusesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by sortOrder
      statusesData.sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1));
      setInvoiceStatuses(statusesData);
    } catch (error) {
      console.error('Error fetching invoice statuses:', error);
      // Fallback to default statuses if database fetch fails
      setInvoiceStatuses([
        { value: 'in_progress', label: 'In Progress', color: '#2196f3' },
        { value: 'done', label: 'Done', color: '#4caf50' }
      ]);
    }
  };

  // Calculate financial summary
  const calculateFinancialSummary = (ordersData) => {
    const summary = ordersData.reduce((acc, order) => {
      const profitData = calculateOrderProfit(order);
      const paidAmount = parseFloat(order.paymentData?.amountPaid) || 0;
      
      acc.totalRevenue += profitData.revenue;
      acc.totalCost += profitData.cost;
      acc.totalProfit += profitData.profit;
      acc.paidAmount += paidAmount;
      acc.pendingAmount += (profitData.revenue - paidAmount);
      acc.totalOrders += 1;
      
      return acc;
    }, { 
      totalRevenue: 0, 
      totalCost: 0, 
      totalProfit: 0, 
      paidAmount: 0, 
      pendingAmount: 0, 
      totalOrders: 0 
    });
    
    // Calculate average profit margin
    summary.averageProfitMargin = summary.totalRevenue > 0 ? 
      (summary.totalProfit / summary.totalRevenue) * 100 : 0;
    
    setFinancialSummary(summary);
  };

  // Search and filter logic
  useEffect(() => {
    let filtered = orders;
    
    // Apply date range filter
    if (dateFrom && dateTo) {
      filtered = filtered.filter(order => {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        
        // Set time to start/end of day for accurate comparison
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        
        return orderDate >= fromDate && orderDate <= toDate;
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.personalInfo?.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderDetails?.billInvoice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.personalInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.personalInfo?.phone?.includes(searchTerm)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.invoiceStatus === statusFilter);
    }
    
    setFilteredOrders(filtered);
    calculateFinancialSummary(filtered);
  }, [searchTerm, statusFilter, orders, dateFrom, dateTo]);

  // Update invoice status
  const updateInvoiceStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { invoiceStatus: newStatus });
      
      // Update local state
      const updatedOrders = orders.map(order =>
        order.id === orderId ? { ...order, invoiceStatus: newStatus } : order
      );
      setOrders(updatedOrders);
      
      showSuccess('Invoice status updated successfully');
      setStatusDialogOpen(false);
      setEditingStatus(null);
    } catch (error) {
      console.error('Error updating invoice status:', error);
      showError('Failed to update invoice status');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get status info
  const getStatusInfo = (status) => {
    return invoiceStatuses.find(s => s.value === status) || 
           { value: status, label: status, color: '#757575' };
  };

  // Get payment status
  const getPaymentStatus = (order) => {
    const total = calculateOrderTotal(order);
    const paid = parseFloat(order.paymentData?.amountPaid) || 0;
    const deposit = parseFloat(order.paymentData?.deposit) || 0;
    
    if (paid >= total) return { status: 'Fully Paid', color: '#4caf50' };
    if (paid >= deposit && deposit > 0) return { status: 'Deposit Paid', color: '#ff9800' };
    if (paid > 0) return { status: 'Partial Payment', color: '#f44336' };
    return { status: 'Not Paid', color: '#757575' };
  };

  useEffect(() => {
    fetchOrders();
    fetchInvoiceStatuses();
  }, []);

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
      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccountBalanceIcon sx={{ fontSize: 32, color: '#274290', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#274290' }}>
            Financial Management
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          onClick={() => navigate('/status-management')}
          sx={{ 
            color: '#274290',
            borderColor: '#274290',
            '&:hover': { borderColor: '#274290', backgroundColor: '#f5f8ff' }
          }}
        >
          Manage Statuses
        </Button>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => {
            fetchOrders();
            fetchInvoiceStatuses();
          }}
          sx={{ 
            backgroundColor: '#f27921',
            '&:hover': { backgroundColor: '#e66a1a' }
          }}
        >
          Refresh Data
        </Button>
      </Box>

      {/* Status Integration Info */}
      {invoiceStatuses.length === 0 && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => navigate('/status-management')}
              sx={{ color: '#274290' }}
            >
              Setup Statuses
            </Button>
          }
        >
          <strong>No custom statuses found.</strong> Create custom invoice statuses in Status Management for better workflow control.
        </Alert>
      )}

      {/* Financial Summary Cards - Compact Single Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3} md={1.5}>
          <Card sx={{ backgroundColor: '#274290', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 24, mb: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Total Revenue
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem' }}>
                  {formatCurrency(financialSummary.totalRevenue)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3} md={1.5}>
          <Card sx={{ backgroundColor: '#ff9800', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <AccountBalanceIcon sx={{ fontSize: 24, mb: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Total Costs
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem' }}>
                  {formatCurrency(financialSummary.totalCost)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3} md={1.5}>
          <Card sx={{ backgroundColor: '#f27921', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 24, mb: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Total Profit
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem' }}>
                  {formatCurrency(financialSummary.totalProfit)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.65rem' }}>
                  {financialSummary.averageProfitMargin.toFixed(1)}% margin
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3} md={1.5}>
          <Card sx={{ backgroundColor: '#4caf50', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <MonetizationOnIcon sx={{ fontSize: 24, mb: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Paid Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem' }}>
                  {formatCurrency(financialSummary.paidAmount)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3} md={1.5}>
          <Card sx={{ backgroundColor: '#f44336', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <ReceiptIcon sx={{ fontSize: 24, mb: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Pending
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem' }}>
                  {formatCurrency(financialSummary.pendingAmount)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3} md={1.5}>
          <Card sx={{ backgroundColor: '#9c27b0', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <ReceiptIcon sx={{ fontSize: 24, mb: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Total Orders
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem' }}>
                  {financialSummary.totalOrders}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3} md={1.5}>
          <Card sx={{ backgroundColor: '#607d8b', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <MonetizationOnIcon sx={{ fontSize: 24, mb: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Avg Order
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem' }}>
                  {formatCurrency(financialSummary.totalOrders > 0 ? financialSummary.totalRevenue / financialSummary.totalOrders : 0)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3} md={1.5}>
          <Card sx={{ backgroundColor: '#795548', color: 'white', height: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <AccountBalanceIcon sx={{ fontSize: 24, mb: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                  Collection %
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5, fontSize: '1.1rem' }}>
                  {financialSummary.totalRevenue > 0 ? 
                    ((financialSummary.paidAmount / financialSummary.totalRevenue) * 100).toFixed(1) : 0}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterListIcon sx={{ color: '#274290', mr: 1 }} />
          <Typography variant="h6" sx={{ color: '#274290', fontWeight: 'bold' }}>
            Filters & Search
          </Typography>
        </Box>
        
        <Grid container spacing={3} alignItems="center">
          {/* Search Field */}
          <Grid item xs={12} lg={4}>
            <TextField
              fullWidth
              placeholder="Search by customer name, invoice number, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#274290' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' }
                }
              }}
            />
          </Grid>

          {/* Date Range Filters */}
          <Grid item xs={12} sm={6} lg={2}>
            <TextField
              fullWidth
              label="From Date"
              type="date"
              value={dateFrom ? dateFrom.toISOString().split('T')[0] : ''}
              onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value) : null)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DateRangeIcon sx={{ color: '#274290' }} />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#274290' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' }
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} lg={2}>
            <TextField
              fullWidth
              label="To Date"
              type="date"
              value={dateTo ? dateTo.toISOString().split('T')[0] : ''}
              onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value) : null)}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': { borderColor: '#274290' },
                  '&.Mui-focused fieldset': { borderColor: '#274290' }
                }
              }}
            />
          </Grid>

          {/* Status Filter */}
          <Grid item xs={12} sm={6} lg={2.5}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#274290' }}>Invoice Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Invoice Status"
                sx={{
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#274290' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#274290' }
                }}
              >
                <MenuItem value="all">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: '#757575',
                        mr: 2
                      }}
                    />
                    All Statuses
                  </Box>
                </MenuItem>
                {invoiceStatuses.map(status => (
                  <MenuItem key={status.value} value={status.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: status.color,
                          mr: 2
                        }}
                      />
                      {status.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Quick Date Filters & Results */}
          <Grid item xs={12} lg={1.5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const now = new Date();
                    setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                    setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                  }}
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#274290',
                    borderColor: '#274290',
                    '&:hover': { borderColor: '#274290', backgroundColor: '#f5f8ff' }
                  }}
                >
                  This Month
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const now = new Date();
                    setDateFrom(new Date(now.getFullYear(), 0, 1));
                    setDateTo(new Date(now.getFullYear(), 11, 31));
                  }}
                  sx={{ 
                    fontSize: '0.75rem',
                    color: '#274290',
                    borderColor: '#274290',
                    '&:hover': { borderColor: '#274290', backgroundColor: '#f5f8ff' }
                  }}
                >
                  This Year
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> orders
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Active Filters Display */}
        {(statusFilter !== 'all' || searchTerm || (dateFrom && dateTo)) && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Typography variant="body2" sx={{ mb: 1, color: '#274290', fontWeight: 'bold' }}>
              Active Filters:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {statusFilter !== 'all' && (
                <Chip
                  label={`Status: ${invoiceStatuses.find(s => s.value === statusFilter)?.label}`}
                  onDelete={() => setStatusFilter('all')}
                  color="primary"
                  size="small"
                />
              )}
              {searchTerm && (
                <Chip
                  label={`Search: "${searchTerm}"`}
                  onDelete={() => setSearchTerm('')}
                  color="primary"
                  size="small"
                />
              )}
              {dateFrom && dateTo && (
                <Chip
                  label={`Date: ${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()}`}
                  onDelete={() => {
                    const now = new Date();
                    setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                    setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                  }}
                  color="primary"
                  size="small"
                />
              )}
              <Button
                size="small"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  const now = new Date();
                  setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
                  setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
                }}
                sx={{ color: '#f27921', fontSize: '0.75rem' }}
              >
                Clear All
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Orders Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#274290' }}>
            <TableRow>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice #</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Revenue</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Cost</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Profit</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Profit %</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Paid</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Balance</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Payment Status</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice Status</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.map((order) => {
              const profitData = calculateOrderProfit(order);
              const paidAmount = parseFloat(order.paymentData?.amountPaid) || 0;
              const balance = profitData.revenue - paidAmount;
              const paymentStatus = getPaymentStatus(order);
              const statusInfo = getStatusInfo(order.invoiceStatus);
              
              return (
                <TableRow key={order.id} hover>
                  <TableCell>
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
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#274290' }}>
                      {order.orderDetails?.billInvoice || 'N/A'}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#274290' }}>
                      {formatCurrency(profitData.revenue)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                      {formatCurrency(profitData.cost)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: profitData.profit >= 0 ? '#4caf50' : '#f44336' 
                      }}
                    >
                      {formatCurrency(profitData.profit)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          fontWeight: 'bold', 
                          color: profitData.profitPercentage >= 0 ? '#4caf50' : '#f44336',
                          mr: 1
                        }}
                      >
                        {profitData.profitPercentage.toFixed(1)}%
                      </Typography>
                      <Box
                        sx={{
                          width: 40,
                          height: 8,
                          backgroundColor: '#e0e0e0',
                          borderRadius: 4,
                          overflow: 'hidden'
                        }}
                      >
                        <Box
                          sx={{
                            width: `${Math.min(Math.abs(profitData.profitPercentage), 100)}%`,
                            height: '100%',
                            backgroundColor: profitData.profitPercentage >= 0 ? '#4caf50' : '#f44336',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                      {formatCurrency(paidAmount)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: balance > 0 ? '#f44336' : '#4caf50' 
                      }}
                    >
                      {formatCurrency(balance)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={paymentStatus.status}
                      sx={{
                        backgroundColor: paymentStatus.color,
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={statusInfo.label}
                      sx={{
                        backgroundColor: statusInfo.color,
                        color: 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedOrder(order);
                        setEditingStatus(order.invoiceStatus);
                        setStatusDialogOpen(true);
                      }}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(order.createdAt)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Tooltip title="View Order">
                      <IconButton 
                        size="small" 
                        onClick={() => navigate(`/orders`, { state: { viewOrder: order } })}
                        sx={{ color: '#274290' }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Invoice">
                      <IconButton 
                        size="small" 
                        onClick={() => navigate(`/invoices`, { state: { viewOrder: order } })}
                        sx={{ color: '#f27921' }}
                      >
                        <PdfIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Status Edit Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
        <DialogTitle>Update Invoice Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Invoice Status</InputLabel>
            <Select
              value={editingStatus || ''}
              onChange={(e) => setEditingStatus(e.target.value)}
              label="Invoice Status"
            >
                          {invoiceStatuses.map(status => (
              <MenuItem key={status.value} value={status.value}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: status.color,
                      mr: 2
                    }}
                  />
                  {status.label}
                </Box>
              </MenuItem>
            ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => updateInvoiceStatus(selectedOrder.id, editingStatus)}
            variant="contained"
            sx={{ 
              backgroundColor: '#f27921',
              '&:hover': { backgroundColor: '#e66a1a' }
            }}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FinancePage; 