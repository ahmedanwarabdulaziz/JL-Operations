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
  CircularProgress,
  Button,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  AccountBalance as AccountBalanceIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNotification } from '../../components/Common/NotificationSystem';
import { calculateOrderTotal, calculateOrderCost } from '../../utils/orderCalculations';
import { fetchMaterialCompanyTaxRates } from '../../utils/materialTaxRates';
import { buttonStyles } from '../../styles/buttonStyles';

const FinancePage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [materialTaxRates, setMaterialTaxRates] = useState({});

  const { showError } = useNotification();

  // Fetch orders and material tax rates from Firebase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch regular orders, corporate orders, and material tax rates
      const [ordersSnapshot, corporateOrdersSnapshot, taxRates] = await Promise.all([
        getDocs(query(collection(db, 'orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        getDocs(query(collection(db, 'corporate-orders'), orderBy('orderDetails.billInvoice', 'desc'))),
        fetchMaterialCompanyTaxRates()
      ]);
      
      // Set material tax rates
      setMaterialTaxRates(taxRates);
      
      // Map regular orders
      const regularOrders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'regular'
      }));
      
      // Map corporate orders
      const corporateOrders = corporateOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderType: 'corporate'
      }));
      
      // Combine all orders
      const allOrders = [...regularOrders, ...corporateOrders];
      
      // Sort by invoice number descending
      allOrders.sort((a, b) => {
        const invoiceA = a.orderDetails?.billInvoice || '';
        const invoiceB = b.orderDetails?.billInvoice || '';
        return invoiceB.localeCompare(invoiceA);
      });
      
      setOrders(allOrders);
      setFilteredOrders(allOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Calculate all totals for an order (Invoice, Cost, Profit)
  const calculateOrderFinancials = (order) => {
    // Normalize payment data for corporate orders (they use paymentDetails instead of paymentData)
    const paymentData = order.orderType === 'corporate' 
      ? (order.paymentDetails || {})
      : (order.paymentData || {});
    
    const normalizedOrder = {
      ...order,
      paymentData: paymentData
    };
    
    // Calculate invoice total (customer-facing total including tax)
    const invoiceTotal = calculateOrderTotal(normalizedOrder);
    
    // Calculate cost total (JL internal costs including tax)
    const costTotal = calculateOrderCost(normalizedOrder, materialTaxRates);
    
    // Calculate profit
    const profit = invoiceTotal - costTotal;

    return {
      invoiceTotal,
      costTotal,
      profit
    };
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Search and filter logic
  useEffect(() => {
    let filtered = orders;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderDetails?.billInvoice?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredOrders(filtered);
  }, [searchTerm, orders]);

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Calculate totals for all orders
  const grandTotals = filteredOrders.reduce((acc, order) => {
    const financials = calculateOrderFinancials(order);
    acc.invoiceTotal += financials.invoiceTotal;
    acc.costTotal += financials.costTotal;
    acc.profit += financials.profit;
    return acc;
  }, {
    invoiceTotal: 0,
    costTotal: 0,
    profit: 0
  });

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccountBalanceIcon sx={{ fontSize: 32, color: '#b98f33', mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
            Finance
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={fetchOrders}
          sx={buttonStyles.primaryButton}
        >
          Refresh
        </Button>
      </Box>

      {/* Search */}
      <Paper sx={{ p: 2, mb: 3, border: '1px solid #333333', backgroundColor: '#2a2a2a' }}>
        <TextField
          fullWidth
          placeholder="Search by invoice number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#b98f33' }} />
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#ffffff',
              '& fieldset': { borderColor: '#333333' },
              '&:hover fieldset': { borderColor: '#b98f33' },
              '&.Mui-focused fieldset': { borderColor: '#b98f33' }
            },
            '& .MuiInputBase-input::placeholder': {
              color: '#888888'
            }
          }}
        />
      </Paper>

      {/* Orders Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2, backgroundColor: '#2a2a2a' }}>
        <Table>
          <TableHead sx={{ backgroundColor: '#b98f33' }}>
            <TableRow>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }}>Invoice Number</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="right">Total Invoice</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="right">Total Cost</TableCell>
              <TableCell sx={{ color: '#000000', fontWeight: 'bold' }} align="right">Profit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.map((order) => {
              const financials = calculateOrderFinancials(order);
              
              // Get customer info based on order type
              const customerName = order.orderType === 'corporate'
                ? (order.corporateCustomer?.corporateName || 'N/A')
                : (order.personalInfo?.customerName || 'N/A');
              
              const customerEmail = order.orderType === 'corporate'
                ? (order.contactPerson?.email || order.corporateCustomer?.email || 'No email')
                : (order.personalInfo?.email || 'No email');
              
              const customerPhone = order.orderType === 'corporate'
                ? (order.contactPerson?.phone || order.corporateCustomer?.phone || 'No phone')
                : (order.personalInfo?.phone || 'No phone');
              
              const customerDetails = `${customerName} | ${customerEmail} | ${customerPhone}`;
              
              return (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Tooltip title={customerDetails} arrow>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#b98f33', cursor: 'help' }}>
                        {order.orderDetails?.billInvoice || 'N/A'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      {formatCurrency(financials.invoiceTotal)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body1" sx={{ color: '#ffffff' }}>
                      {formatCurrency(financials.costTotal)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontWeight: 'bold', 
                        color: financials.profit >= 0 ? '#4caf50' : '#f44336' 
                      }}
                    >
                      {formatCurrency(financials.profit)}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {/* Grand Totals Row */}
            {filteredOrders.length > 0 && (
              <TableRow sx={{ backgroundColor: '#3a3a3a', '& td': { borderTop: '2px solid #b98f33' } }}>
                <TableCell>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                    GRAND TOTAL
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                    {formatCurrency(grandTotals.invoiceTotal)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#b98f33' }}>
                    {formatCurrency(grandTotals.costTotal)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 'bold', 
                      color: grandTotals.profit >= 0 ? '#4caf50' : '#f44336' 
                    }}
                  >
                    {formatCurrency(grandTotals.profit)}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            
            {filteredOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" sx={{ color: '#888888' }}>
                    {searchTerm ? 'No invoices found matching your search.' : 'No invoices found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default FinancePage;
